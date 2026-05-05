import crypto from 'node:crypto';
import { getPool, withTransaction } from '../db/pool.js';
import { listAvailability } from './availability.service.js';
import { createClaimsTx } from './claims.service.js';
import { ValidationError, ConflictError } from './errors.js';
import { advanceRoundRobinTx, chooseRoundRobinTherapist, getRoundRobinState } from './roundRobin.service.js';
import { withLock } from './locks.service.js';

function asSqlDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid datetime');
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function hashPayload(payload) {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function toDateOnly(value) {
  return asSqlDateTime(value).slice(0, 10);
}

async function findService(connection, centerId, serviceId) {
  const [rows] = await connection.query(
    `SELECT id, name, duration_min, base_price_cents, currency
     FROM services
     WHERE center_id = ? AND id = ? AND is_active = 1
     LIMIT 1`,
    [centerId, serviceId]
  );

  if (!rows[0]) {
    throw new ValidationError('Service does not exist or is inactive');
  }

  return rows[0];
}

async function findOrCreateClient(connection, { centerId, fullName, whatsappPhone }) {
  await connection.query(
    `INSERT INTO clients (center_id, full_name, whatsapp_phone)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       updated_at = CURRENT_TIMESTAMP`,
    [centerId, fullName, whatsappPhone]
  );

  const [rows] = await connection.query(
    `SELECT id
     FROM clients
     WHERE center_id = ? AND whatsapp_phone = ?
     LIMIT 1`,
    [centerId, whatsappPhone]
  );

  return rows[0].id;
}

async function getExistingIdempotentResponse(connection, {
  centerId,
  idemKey,
  scope
}) {
  if (!idemKey) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT response_status, response_json
     FROM idempotency_keys
     WHERE center_id = ?
       AND scope = ?
       AND idem_key = ?
       AND expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [centerId, scope, idemKey]
  );

  if (!rows[0]) {
    return null;
  }

  const response = rows[0].response_json;
  return typeof response === 'string' ? JSON.parse(response) : response;
}

async function storeIdempotencyResult(connection, {
  centerId,
  scope,
  idemKey,
  requestHash,
  response,
  status = 200
}) {
  if (!idemKey) {
    return;
  }

  await connection.query(
    `INSERT INTO idempotency_keys
      (center_id, scope, idem_key, request_hash, response_status, response_json, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))
     ON DUPLICATE KEY UPDATE
      request_hash = VALUES(request_hash),
      response_status = VALUES(response_status),
      response_json = VALUES(response_json),
      expires_at = VALUES(expires_at)`,
    [centerId, scope, idemKey, requestHash, status, JSON.stringify(response)]
  );
}

function pickCandidate(slot, therapistId) {
  if (therapistId !== null) {
    return slot.candidates.find((candidate) => candidate.therapistId === therapistId) || null;
  }

  return slot.candidates[0] || null;
}

export async function confirmPublicAppointment(payload) {
  const {
    centerId,
    serviceId,
    startsAt,
    therapistId = null,
    client,
    idempotencyKey
  } = payload;

  const pool = getPool();

  return withTransaction(async (connection) => {
    const previous = await getExistingIdempotentResponse(connection, {
      centerId,
      idemKey: idempotencyKey,
      scope: 'public_confirm'
    });

    if (previous) {
      return previous;
    }

    const service = await findService(connection, centerId, serviceId);
    const lockKey = `luna:book:${centerId}:${serviceId}:${asSqlDateTime(startsAt).slice(0, 16)}`;

    return withLock(connection, lockKey, async () => {
      const availability = await listAvailability(connection, {
        centerId,
        serviceId,
        date: toDateOnly(startsAt),
        therapistId,
        maxSlots: 40
      });

      const requestedMinute = asSqlDateTime(startsAt).slice(0, 16);
      const matchingSlot = availability.slots.find(
        (slot) => asSqlDateTime(slot.startsAt).slice(0, 16) === requestedMinute
      );

      if (!matchingSlot) {
        throw new ConflictError('Requested slot is not available');
      }

      let candidate = pickCandidate(matchingSlot, therapistId);

      if (!candidate && therapistId === null) {
        const state = await getRoundRobinState(connection, centerId, serviceId);
        const therapistCandidates = matchingSlot.therapists;
        const chosen = chooseRoundRobinTherapist({
          candidates: therapistCandidates,
          lastTherapistId: state.last_therapist_id,
          loadsByTherapist: {}
        });

        if (chosen) {
          candidate = matchingSlot.candidates.find(
            (slotCandidate) => slotCandidate.therapistId === chosen.therapistId
          );
        }
      }

      if (!candidate) {
        throw new ConflictError('No therapist-room pair available for this slot');
      }

      const clientId = await findOrCreateClient(connection, {
        centerId,
        fullName: client.fullName,
        whatsappPhone: client.whatsappPhone
      });

      const slotStart = new Date(startsAt);
      const slotEnd = new Date(slotStart.getTime() + service.duration_min * 60 * 1000);

      const [appointmentResult] = await connection.query(
        `INSERT INTO appointments
          (center_id, client_id, service_id, therapist_id, room_id, starts_at, ends_at, status, source, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 'booking', 'pending')`,
        [
          centerId,
          clientId,
          serviceId,
          candidate.therapistId,
          candidate.roomId,
          asSqlDateTime(slotStart),
          asSqlDateTime(slotEnd)
        ]
      );

      const appointmentId = appointmentResult.insertId;

      await createClaimsTx(connection, {
        centerId,
        appointmentId,
        therapistId: candidate.therapistId,
        roomId: candidate.roomId,
        startsAt: slotStart,
        endsAt: slotEnd
      });

      await connection.query(
        `INSERT INTO payments
          (center_id, appointment_id, amount_cents, currency, status, method)
         VALUES (?, ?, ?, ?, 'pending', 'transfer')`,
        [centerId, appointmentId, service.base_price_cents, service.currency]
      );

      await advanceRoundRobinTx(connection, {
        centerId,
        serviceId,
        therapistId: candidate.therapistId
      });

      await connection.query(
        `INSERT INTO audit_logs
          (center_id, actor_type, entity_type, entity_id, action, metadata_json)
         VALUES (?, 'client', 'appointment', ?, 'appointment_confirmed', ?)` ,
        [
          centerId,
          appointmentId,
          JSON.stringify({
            therapistId: candidate.therapistId,
            roomId: candidate.roomId,
            startsAt: asSqlDateTime(slotStart),
            endsAt: asSqlDateTime(slotEnd)
          })
        ]
      );

      const response = {
        ok: true,
        appointment: {
          id: appointmentId,
          centerId,
          serviceId,
          therapistId: candidate.therapistId,
          roomId: candidate.roomId,
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString(),
          paymentStatus: 'pending'
        }
      };

      await storeIdempotencyResult(connection, {
        centerId,
        scope: 'public_confirm',
        idemKey: idempotencyKey,
        requestHash: hashPayload(payload),
        response
      });

      return response;
    });
  });
}
