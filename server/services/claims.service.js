import { ConflictError, ValidationError } from './errors.js';
import { fromMySqlDateTime, toMySqlDateTime } from '../utils/dates.js';

const MINUTE_MS = 60 * 1000;

function floorToMinute(input) {
  let value;
  try {
    value = fromMySqlDateTime(input);
  } catch {
    throw new ValidationError('Invalid datetime format');
  }

  value.setSeconds(0, 0);
  return value;
}

export function buildClaimMinutes(startsAtInput, endsAtInput) {
  const start = floorToMinute(startsAtInput);
  const end = floorToMinute(endsAtInput);

  if (end <= start) {
    throw new ValidationError('End time must be after start time');
  }

  const minutes = [];
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += MINUTE_MS) {
    minutes.push(new Date(cursor));
  }

  return minutes;
}

function asClaimRows(centerId, appointmentId, resourceType, resourceId, minutes) {
  return minutes.map((minute) => [
    centerId,
    appointmentId,
    resourceType,
    resourceId,
    toMySqlDateTime(minute)
  ]);
}

export async function createClaimsTx(connection, {
  centerId,
  appointmentId,
  therapistId,
  roomId,
  startsAt,
  endsAt
}) {
  const minutes = buildClaimMinutes(startsAt, endsAt);

  const rows = [
    ...asClaimRows(centerId, appointmentId, 'therapist', therapistId, minutes),
    ...asClaimRows(centerId, appointmentId, 'room', roomId, minutes)
  ];

  try {
    await connection.query(
      `INSERT INTO appointment_resource_claims
       (center_id, appointment_id, resource_type, resource_id, claim_time)
       VALUES ?`,
      [rows]
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('The slot was taken while confirming the appointment');
    }
    throw error;
  }
}

export async function releaseClaimsTx(connection, { centerId, appointmentId }) {
  await connection.query(
    `DELETE FROM appointment_resource_claims
     WHERE center_id = ? AND appointment_id = ?`,
    [centerId, appointmentId]
  );
}

export function createMemoryClaimsStore() {
  return {
    byKey: new Map(),
    byAppointment: new Map()
  };
}

function claimKey({ centerId, resourceType, resourceId, minute }) {
  return `${centerId}:${resourceType}:${resourceId}:${toMySqlDateTime(minute)}`;
}

function appendAppointmentKey(store, appointmentId, key) {
  const current = store.byAppointment.get(appointmentId) || [];
  current.push(key);
  store.byAppointment.set(appointmentId, current);
}

export function createClaimsInMemory(store, payload) {
  const {
    centerId,
    appointmentId,
    therapistId,
    roomId,
    startsAt,
    endsAt
  } = payload;

  const minutes = buildClaimMinutes(startsAt, endsAt);
  const candidateKeys = [];

  for (const minute of minutes) {
    candidateKeys.push(
      claimKey({ centerId, resourceType: 'therapist', resourceId: therapistId, minute }),
      claimKey({ centerId, resourceType: 'room', resourceId: roomId, minute })
    );
  }

  for (const key of candidateKeys) {
    const owner = store.byKey.get(key);
    if (owner && owner !== appointmentId) {
      throw new ConflictError('Resource already claimed for that minute');
    }
  }

  for (const key of candidateKeys) {
    store.byKey.set(key, appointmentId);
    appendAppointmentKey(store, appointmentId, key);
  }
}

export function releaseClaimsInMemory(store, appointmentId) {
  const keys = store.byAppointment.get(appointmentId) || [];
  for (const key of keys) {
    store.byKey.delete(key);
  }
  store.byAppointment.delete(appointmentId);
}
