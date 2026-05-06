import { withTransaction } from '../db/pool.js';
import { signManageToken, verifyManageToken } from '../utils/jwt.js';
import {
  addMinutes,
  fromMySqlDateTime,
  toDateOnlyInAppTz,
  toMySqlDateTime
} from '../utils/dates.js';
import { listAvailability } from './availability.service.js';
import { createClaimsTx, releaseClaimsTx } from './claims.service.js';
import { ConflictError, ValidationError } from './errors.js';

function toComparableMinute(value) {
  return toMySqlDateTime(fromMySqlDateTime(value)).slice(0, 16);
}

function serializeAppointment(row) {
  return {
    id: row.id,
    centerId: row.center_id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientWhatsapp: row.whatsapp_phone,
    serviceId: row.service_id,
    serviceName: row.service_name,
    therapistId: row.therapist_id,
    therapistName: row.therapist_name,
    roomId: row.room_id,
    roomName: row.room_name,
    status: row.status,
    paymentStatus: row.payment_status,
    startsAt: fromMySqlDateTime(row.starts_at).toISOString(),
    endsAt: fromMySqlDateTime(row.ends_at).toISOString()
  };
}

async function getAppointmentByClient(connection, { centerId, appointmentId, whatsappPhone }) {
  const [rows] = await connection.query(
    `SELECT
       a.id,
       a.center_id,
       a.client_id,
       a.service_id,
       a.therapist_id,
       a.room_id,
       a.status,
       a.payment_status,
       a.starts_at,
       a.ends_at,
       c.full_name AS client_name,
       c.whatsapp_phone,
       s.name AS service_name,
       s.duration_min,
       t.full_name AS therapist_name,
       r.name AS room_name
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN services s ON s.id = a.service_id
     JOIN therapists t ON t.id = a.therapist_id
     JOIN rooms r ON r.id = a.room_id
     WHERE a.center_id = ?
       AND a.id = ?
       AND c.whatsapp_phone = ?
     LIMIT 1`,
    [centerId, appointmentId, whatsappPhone]
  );

  return rows[0] || null;
}

async function getAppointmentForUpdate(connection, { centerId, appointmentId }) {
  const [rows] = await connection.query(
    `SELECT
       a.id,
       a.center_id,
       a.client_id,
       a.service_id,
       a.therapist_id,
       a.room_id,
       a.status,
       a.payment_status,
       a.starts_at,
       a.ends_at,
       c.full_name AS client_name,
       c.whatsapp_phone,
       s.name AS service_name,
       s.duration_min,
       t.full_name AS therapist_name,
       r.name AS room_name
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN services s ON s.id = a.service_id
     JOIN therapists t ON t.id = a.therapist_id
     JOIN rooms r ON r.id = a.room_id
     WHERE a.center_id = ?
       AND a.id = ?
     LIMIT 1
     FOR UPDATE`,
    [centerId, appointmentId]
  );

  return rows[0] || null;
}

function assertManageableStatus(status) {
  if (!['pending', 'confirmed'].includes(status)) {
    throw new ConflictError('This appointment cannot be modified from booking');
  }
}

function assertManageTokenMatches(decodedToken, row) {
  if (
    Number(decodedToken.centerId) !== Number(row.center_id) ||
    Number(decodedToken.appointmentId) !== Number(row.id) ||
    Number(decodedToken.clientId) !== Number(row.client_id)
  ) {
    throw new ValidationError('Manage token does not match this appointment');
  }
}

function pickCandidateForReschedule(slot, preferredTherapistId) {
  if (!slot || !Array.isArray(slot.candidates)) {
    return null;
  }

  if (preferredTherapistId !== null) {
    const exact = slot.candidates.find(
      (candidate) => Number(candidate.therapistId) === Number(preferredTherapistId)
    );
    if (exact) {
      return exact;
    }
  }

  return slot.candidates[0] || null;
}

export async function createPublicManageToken(payload) {
  const { centerId, appointmentId, whatsappPhone } = payload;

  return withTransaction(async (connection) => {
    const row = await getAppointmentByClient(connection, {
      centerId,
      appointmentId,
      whatsappPhone
    });

    if (!row) {
      throw new ValidationError('Appointment not found for this WhatsApp number');
    }

    assertManageableStatus(row.status);

    const token = signManageToken({
      centerId: row.center_id,
      appointmentId: row.id,
      clientId: row.client_id
    });

    return {
      ok: true,
      manageToken: token,
      expiresInMinutes: 45,
      appointment: serializeAppointment(row)
    };
  });
}

export async function cancelPublicAppointment(payload) {
  const { centerId, appointmentId, manageToken, reason = '' } = payload;
  let decoded;

  try {
    decoded = verifyManageToken(manageToken);
  } catch {
    throw new ValidationError('Invalid or expired manage token');
  }

  return withTransaction(async (connection) => {
    const row = await getAppointmentForUpdate(connection, { centerId, appointmentId });

    if (!row) {
      throw new ValidationError('Appointment not found');
    }

    assertManageTokenMatches(decoded, row);

    if (row.status === 'cancelled') {
      return {
        ok: true,
        alreadyCancelled: true,
        appointment: serializeAppointment(row)
      };
    }

    assertManageableStatus(row.status);

    await connection.query(
      `UPDATE appointments
       SET status = 'cancelled',
           payment_status = CASE WHEN payment_status = 'verified' THEN 'verified' ELSE 'rejected' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND center_id = ?`,
      [row.id, centerId]
    );

    await connection.query(
      `UPDATE payments
       SET status = CASE WHEN status = 'verified' THEN 'verified' ELSE 'rejected' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE center_id = ? AND appointment_id = ?`,
      [centerId, row.id]
    );

    await releaseClaimsTx(connection, { centerId, appointmentId: row.id });

    await connection.query(
      `INSERT INTO audit_logs
        (center_id, actor_type, actor_id, entity_type, entity_id, action, metadata_json)
       VALUES (?, 'client', ?, 'appointment', ?, 'appointment_cancelled', ?)`,
      [
        centerId,
        row.client_id,
        row.id,
        JSON.stringify({ reason: reason.trim() || null })
      ]
    );

    const [updatedRows] = await connection.query(
      `SELECT
         a.id,
         a.center_id,
         a.client_id,
         a.service_id,
         a.therapist_id,
         a.room_id,
         a.status,
         a.payment_status,
         a.starts_at,
         a.ends_at,
         c.full_name AS client_name,
         c.whatsapp_phone,
         s.name AS service_name,
         s.duration_min,
         t.full_name AS therapist_name,
         r.name AS room_name
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       JOIN services s ON s.id = a.service_id
       JOIN therapists t ON t.id = a.therapist_id
       JOIN rooms r ON r.id = a.room_id
       WHERE a.id = ? AND a.center_id = ?
       LIMIT 1`,
      [row.id, centerId]
    );

    return {
      ok: true,
      appointment: serializeAppointment(updatedRows[0])
    };
  });
}

export async function reschedulePublicAppointment(payload) {
  const {
    centerId,
    appointmentId,
    manageToken,
    startsAt,
    therapistId = null
  } = payload;

  let decoded;
  try {
    decoded = verifyManageToken(manageToken);
  } catch {
    throw new ValidationError('Invalid or expired manage token');
  }

  return withTransaction(async (connection) => {
    const row = await getAppointmentForUpdate(connection, { centerId, appointmentId });

    if (!row) {
      throw new ValidationError('Appointment not found');
    }

    assertManageTokenMatches(decoded, row);
    assertManageableStatus(row.status);

    const requestedStart = fromMySqlDateTime(startsAt);
    const requestedEnd = addMinutes(requestedStart, Number(row.duration_min));

    const sameMinute = toComparableMinute(row.starts_at) === toComparableMinute(startsAt);
    const sameTherapist = therapistId === null || Number(therapistId) === Number(row.therapist_id);

    if (sameMinute && sameTherapist) {
      return {
        ok: true,
        unchanged: true,
        appointment: serializeAppointment(row)
      };
    }

    const availability = await listAvailability(connection, {
      centerId,
      serviceId: row.service_id,
      date: toDateOnlyInAppTz(requestedStart),
      therapistId: therapistId ? Number(therapistId) : null,
      maxSlots: 50
    });

    const minuteKey = toComparableMinute(startsAt);
    const matchingSlot = availability.slots.find(
      (slot) => toComparableMinute(slot.startsAt) === minuteKey
    );

    if (!matchingSlot) {
      throw new ConflictError('Requested slot is no longer available');
    }

    const preferredTherapistId = therapistId ? Number(therapistId) : Number(row.therapist_id);
    const selectedCandidate = pickCandidateForReschedule(matchingSlot, preferredTherapistId);

    if (!selectedCandidate) {
      throw new ConflictError('No therapist-room pair available for this slot');
    }

    await releaseClaimsTx(connection, { centerId, appointmentId: row.id });

    await createClaimsTx(connection, {
      centerId,
      appointmentId: row.id,
      therapistId: selectedCandidate.therapistId,
      roomId: selectedCandidate.roomId,
      startsAt: requestedStart,
      endsAt: requestedEnd
    });

    await connection.query(
      `UPDATE appointments
       SET therapist_id = ?,
           room_id = ?,
           starts_at = ?,
           ends_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND center_id = ?`,
      [
        selectedCandidate.therapistId,
        selectedCandidate.roomId,
        toMySqlDateTime(requestedStart),
        toMySqlDateTime(requestedEnd),
        row.id,
        centerId
      ]
    );

    await connection.query(
      `INSERT INTO audit_logs
        (center_id, actor_type, actor_id, entity_type, entity_id, action, metadata_json)
       VALUES (?, 'client', ?, 'appointment', ?, 'appointment_rescheduled', ?)`,
      [
        centerId,
        row.client_id,
        row.id,
        JSON.stringify({
          previous: {
            therapistId: row.therapist_id,
            roomId: row.room_id,
            startsAt: row.starts_at,
            endsAt: row.ends_at
          },
          next: {
            therapistId: selectedCandidate.therapistId,
            roomId: selectedCandidate.roomId,
            startsAt: toMySqlDateTime(requestedStart),
            endsAt: toMySqlDateTime(requestedEnd)
          }
        })
      ]
    );

    const [updatedRows] = await connection.query(
      `SELECT
         a.id,
         a.center_id,
         a.client_id,
         a.service_id,
         a.therapist_id,
         a.room_id,
         a.status,
         a.payment_status,
         a.starts_at,
         a.ends_at,
         c.full_name AS client_name,
         c.whatsapp_phone,
         s.name AS service_name,
         s.duration_min,
         t.full_name AS therapist_name,
         r.name AS room_name
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       JOIN services s ON s.id = a.service_id
       JOIN therapists t ON t.id = a.therapist_id
       JOIN rooms r ON r.id = a.room_id
       WHERE a.id = ? AND a.center_id = ?
       LIMIT 1`,
      [row.id, centerId]
    );

    return {
      ok: true,
      appointment: serializeAppointment(updatedRows[0])
    };
  });
}
