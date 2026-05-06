import { env } from '../utils/env.js';
import {
  addMinutes,
  fromMySqlDateTime,
  parseDateOnlyInAppTz,
  toDateOnlyInAppTz,
  toMySqlDateTime
} from '../utils/dates.js';
import { ValidationError } from './errors.js';
import { chooseRoundRobinTherapist, getRoundRobinState } from './roundRobin.service.js';

const DEFAULT_SLOT_STEP_MIN = 30;

function pad(num) {
  return String(num).padStart(2, '0');
}

function getMinutesInAppTz(date) {
  const sqlDateTime = toMySqlDateTime(date);
  const hour = Number(sqlDateTime.slice(11, 13));
  const minute = Number(sqlDateTime.slice(14, 16));
  return hour * 60 + minute;
}

function getWeekdayInAppTz(date) {
  const dayString = toDateOnlyInAppTz(date);
  const noon = fromMySqlDateTime(`${dayString} 12:00:00`);
  return noon.getUTCDay();
}

function parseTimeToMinutes(sqlTime) {
  const [hours, minutes] = String(sqlTime).split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

function hasWindowCoverage(windows, startMin, endMin) {
  if (!windows || windows.length === 0) {
    if (!env.ENABLE_DEMO_SCHEDULE_FALLBACK) {
      return false;
    }

    return startMin >= 9 * 60 && endMin <= 18 * 60;
  }

  return windows.some((window) => startMin >= window.startMin && endMin <= window.endMin);
}

function arrayToMap(rows, resourceKey, valueKey = 'conflict_count') {
  const map = new Map();
  for (const row of rows) {
    map.set(row[resourceKey], Number(row[valueKey] || 0));
  }
  return map;
}

function buildInClause(values) {
  if (!values.length) {
    return { clause: '(NULL)', params: [] };
  }

  return {
    clause: `(${values.map(() => '?').join(',')})`,
    params: values
  };
}

async function getServiceRow(connection, centerId, serviceId) {
  const [rows] = await connection.query(
    `SELECT id, name, duration_min, base_price_cents, currency
     FROM services
     WHERE center_id = ? AND id = ? AND is_active = 1
     LIMIT 1`,
    [centerId, serviceId]
  );

  return rows[0] || null;
}

async function getTherapistsForService(connection, centerId, serviceId, therapistId = null) {
  const params = [centerId, serviceId];
  let sql = `
    SELECT
      t.id,
      t.full_name,
      ts.round_robin_order
    FROM therapists t
    JOIN therapist_services ts
      ON ts.therapist_id = t.id
      AND ts.center_id = t.center_id
    WHERE t.center_id = ?
      AND ts.service_id = ?
      AND t.is_active = 1
      AND ts.is_active = 1
  `;

  if (therapistId !== null) {
    sql += ' AND t.id = ?';
    params.push(therapistId);
  }

  sql += ' ORDER BY ts.round_robin_order ASC, t.id ASC';

  const [rows] = await connection.query(sql, params);
  return rows;
}

async function getRoomsForService(connection, centerId, serviceId) {
  const [rows] = await connection.query(
    `SELECT r.id, r.name
     FROM rooms r
     JOIN service_rooms sr
       ON sr.room_id = r.id
       AND sr.center_id = r.center_id
     WHERE r.center_id = ?
       AND sr.service_id = ?
       AND r.is_active = 1`,
    [centerId, serviceId]
  );

  return rows;
}

async function getResourceSchedules(connection, centerId, resourceType, resourceIds, weekday) {
  if (!resourceIds.length) {
    return new Map();
  }

  const inClause = buildInClause(resourceIds);
  const [rows] = await connection.query(
    `SELECT resource_id, start_time, end_time
     FROM resource_schedules
     WHERE center_id = ?
       AND resource_type = ?
       AND weekday = ?
       AND is_active = 1
       AND resource_id IN ${inClause.clause}`,
    [centerId, resourceType, weekday, ...inClause.params]
  );

  const map = new Map();
  for (const row of rows) {
    const current = map.get(row.resource_id) || [];
    current.push({
      startMin: parseTimeToMinutes(row.start_time),
      endMin: parseTimeToMinutes(row.end_time)
    });
    map.set(row.resource_id, current);
  }

  return map;
}

async function getResourceBlocks(connection, centerId, resourceType, resourceIds, slotStart, slotEnd) {
  if (!resourceIds.length) {
    return new Map();
  }

  const inClause = buildInClause(resourceIds);
  const [rows] = await connection.query(
    `SELECT resource_id, COUNT(*) AS conflict_count
     FROM resource_blocks
     WHERE center_id = ?
       AND resource_type = ?
       AND resource_id IN ${inClause.clause}
       AND starts_at < ?
       AND ends_at > ?
     GROUP BY resource_id`,
    [
      centerId,
      resourceType,
      ...inClause.params,
      toMySqlDateTime(slotEnd),
      toMySqlDateTime(slotStart)
    ]
  );

  return arrayToMap(rows, 'resource_id');
}

async function getClaimConflicts(connection, centerId, resourceType, resourceIds, slotStart, slotEnd) {
  if (!resourceIds.length) {
    return new Map();
  }

  const inClause = buildInClause(resourceIds);
  const [rows] = await connection.query(
    `SELECT resource_id, COUNT(*) AS conflict_count
     FROM appointment_resource_claims
     WHERE center_id = ?
       AND resource_type = ?
       AND resource_id IN ${inClause.clause}
       AND claim_time >= ?
       AND claim_time < ?
     GROUP BY resource_id`,
    [
      centerId,
      resourceType,
      ...inClause.params,
      toMySqlDateTime(slotStart),
      toMySqlDateTime(slotEnd)
    ]
  );

  return arrayToMap(rows, 'resource_id');
}

async function getAppointmentConflicts(connection, centerId, idColumn, resourceIds, slotStart, slotEnd) {
  if (!resourceIds.length) {
    return new Map();
  }

  const inClause = buildInClause(resourceIds);
  const [rows] = await connection.query(
    `SELECT ${idColumn} AS resource_id, COUNT(*) AS conflict_count
     FROM appointments
     WHERE center_id = ?
       AND status IN ('pending', 'confirmed')
       AND ${idColumn} IN ${inClause.clause}
       AND starts_at < ?
       AND ends_at > ?
     GROUP BY ${idColumn}`,
    [centerId, ...inClause.params, toMySqlDateTime(slotEnd), toMySqlDateTime(slotStart)]
  );

  return arrayToMap(rows, 'resource_id');
}

export async function findSlotCandidates(connection, {
  centerId,
  serviceId,
  slotStart,
  therapistId = null,
  durationMin = null
}) {
  const service = await getServiceRow(connection, centerId, serviceId);
  if (!service) {
    throw new ValidationError('Service is inactive or does not exist');
  }

  const effectiveDuration = Number(durationMin || service.duration_min);
  const start = fromMySqlDateTime(slotStart);
  const end = addMinutes(start, effectiveDuration);

  const startMin = getMinutesInAppTz(start);
  const endMin = getMinutesInAppTz(end);
  const weekday = getWeekdayInAppTz(start);

  const therapists = await getTherapistsForService(connection, centerId, serviceId, therapistId);
  const rooms = await getRoomsForService(connection, centerId, serviceId);

  if (!therapists.length || !rooms.length) {
    return {
      service,
      candidates: [],
      therapists,
      rooms
    };
  }

  const therapistIds = therapists.map((item) => item.id);
  const roomIds = rooms.map((item) => item.id);

  const [
    therapistSchedules,
    roomSchedules,
    therapistBlocks,
    roomBlocks,
    therapistClaims,
    roomClaims,
    therapistAppointments,
    roomAppointments
  ] = await Promise.all([
    getResourceSchedules(connection, centerId, 'therapist', therapistIds, weekday),
    getResourceSchedules(connection, centerId, 'room', roomIds, weekday),
    getResourceBlocks(connection, centerId, 'therapist', therapistIds, start, end),
    getResourceBlocks(connection, centerId, 'room', roomIds, start, end),
    getClaimConflicts(connection, centerId, 'therapist', therapistIds, start, end),
    getClaimConflicts(connection, centerId, 'room', roomIds, start, end),
    getAppointmentConflicts(connection, centerId, 'therapist_id', therapistIds, start, end),
    getAppointmentConflicts(connection, centerId, 'room_id', roomIds, start, end)
  ]);

  const availableTherapists = therapists.filter((therapist) => {
    const scheduled = hasWindowCoverage(therapistSchedules.get(therapist.id), startMin, endMin);
    const blocked = (therapistBlocks.get(therapist.id) || 0) > 0;
    const claimed = (therapistClaims.get(therapist.id) || 0) > 0;
    const occupied = (therapistAppointments.get(therapist.id) || 0) > 0;

    return scheduled && !blocked && !claimed && !occupied;
  });

  const availableRooms = rooms.filter((room) => {
    const scheduled = hasWindowCoverage(roomSchedules.get(room.id), startMin, endMin);
    const blocked = (roomBlocks.get(room.id) || 0) > 0;
    const claimed = (roomClaims.get(room.id) || 0) > 0;
    const occupied = (roomAppointments.get(room.id) || 0) > 0;

    return scheduled && !blocked && !claimed && !occupied;
  });

  const candidates = [];
  for (const therapistRow of availableTherapists) {
    for (const roomRow of availableRooms) {
      candidates.push({
        therapistId: therapistRow.id,
        therapistName: therapistRow.full_name,
        roundRobinOrder: therapistRow.round_robin_order,
        roomId: roomRow.id,
        roomName: roomRow.name,
        startsAt: start,
        endsAt: end
      });
    }
  }

  return {
    service,
    candidates,
    therapists,
    rooms
  };
}

async function getMonthlyLoads(connection, centerId, serviceId, referenceDate) {
  const referenceSql = toMySqlDateTime(referenceDate);
  const year = Number(referenceSql.slice(0, 4));
  const month = Number(referenceSql.slice(5, 7));

  const monthStartSql = `${year}-${pad(month)}-01 00:00:00`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStartSql = `${nextYear}-${pad(nextMonth)}-01 00:00:00`;

  const [rows] = await connection.query(
    `SELECT therapist_id, COUNT(*) AS load_count
     FROM appointments
     WHERE center_id = ?
       AND service_id = ?
       AND status IN ('pending', 'confirmed', 'completed')
       AND starts_at >= ?
       AND starts_at < ?
     GROUP BY therapist_id`,
    [centerId, serviceId, monthStartSql, nextMonthStartSql]
  );

  return rows.reduce((acc, row) => {
    acc[row.therapist_id] = Number(row.load_count || 0);
    return acc;
  }, {});
}

export async function listAvailability(connection, {
  centerId,
  serviceId,
  date,
  therapistId = null,
  slotStepMin = DEFAULT_SLOT_STEP_MIN,
  maxSlots = 18
}) {
  const serviceRow = await getServiceRow(connection, centerId, serviceId);
  if (!serviceRow) {
    throw new ValidationError('Service is inactive or does not exist');
  }

  const dayString = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
    ? String(date)
    : toDateOnlyInAppTz(fromMySqlDateTime(date));

  const dayStart = parseDateOnlyInAppTz(dayString, '08:00:00');
  const dayEnd = parseDateOnlyInAppTz(dayString, '20:00:00');

  const slotEntries = [];
  for (
    let cursor = dayStart.getTime();
    cursor <= dayEnd.getTime();
    cursor += slotStepMin * 60 * 1000
  ) {
    const slotStart = new Date(cursor);
    const slotResult = await findSlotCandidates(connection, {
      centerId,
      serviceId,
      slotStart,
      therapistId
    });

    if (!slotResult.candidates.length) {
      continue;
    }

    const seenTherapists = new Set();
    const therapists = [];

    for (const candidate of slotResult.candidates) {
      if (!seenTherapists.has(candidate.therapistId)) {
        seenTherapists.add(candidate.therapistId);
        therapists.push({
          therapistId: candidate.therapistId,
          therapistName: candidate.therapistName,
          roundRobinOrder: candidate.roundRobinOrder
        });
      }
    }

    slotEntries.push({
      startsAt: slotResult.candidates[0].startsAt,
      endsAt: slotResult.candidates[0].endsAt,
      therapists,
      candidatePairs: slotResult.candidates
    });

    if (slotEntries.length >= maxSlots) {
      break;
    }
  }

  let recommendation = null;
  if (slotEntries.length > 0) {
    const firstSlotTherapists = slotEntries[0].therapists;
    const state = await getRoundRobinState(connection, centerId, serviceId);
    const loads = await getMonthlyLoads(connection, centerId, serviceId, dayStart);

    const selected = chooseRoundRobinTherapist({
      candidates: firstSlotTherapists,
      lastTherapistId: state.last_therapist_id,
      loadsByTherapist: loads
    });

    if (selected) {
      recommendation = {
        therapistId: selected.therapistId,
        therapistName: selected.therapistName,
        reason: 'Disponible para este servicio y horario'
      };
    }
  }

  return {
    service: {
      id: serviceRow.id,
      name: serviceRow.name,
      durationMin: Number(serviceRow.duration_min),
      basePriceCents: Number(serviceRow.base_price_cents),
      currency: serviceRow.currency
    },
    recommendation,
    slots: slotEntries.map((entry) => ({
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      therapists: entry.therapists,
      candidates: entry.candidatePairs.map((pair) => ({
        therapistId: pair.therapistId,
        therapistName: pair.therapistName,
        roomId: pair.roomId,
        roomName: pair.roomName
      }))
    }))
  };
}
