import 'dotenv/config';
import { getPool, withTransaction } from './pool.js';
import { buildClaimMinutes } from '../services/claims.service.js';

const CENTER_SLUG = 'luna-mandala';
const CENTER_NAME = 'Luna Mandala';
const SEED_NOTES_MARKER = 'seed:classic-psych';

const THERAPIST_NAMES = [
  'Sigmund Freud',
  'Carl Jung',
  'Alfred Adler',
  'Ivan Pavlov',
  'B. F. Skinner',
  'Jean Piaget',
  'Erik Erikson'
];

const SERVICE_SEEDS = [
  {
    name: 'Terapia Psicoanalitica',
    description: 'Acompanamiento terapeutico con enfoque profundo.',
    durationMin: 60,
    priceCents: 16000
  },
  {
    name: 'Terapia Cognitiva',
    description: 'Intervencion orientada a patrones de pensamiento y conducta.',
    durationMin: 60,
    priceCents: 15000
  },
  {
    name: 'Terapia Integrativa',
    description: 'Sesion integrativa para regulacion emocional.',
    durationMin: 75,
    priceCents: 18000
  }
];

const ROOM_NAMES = ['Sala Cielo', 'Sala Agua', 'Sala Tierra'];

const CLIENT_SEEDS = [
  { fullName: 'Lucia Ramos', whatsappPhone: '59170001001' },
  { fullName: 'Mateo Quispe', whatsappPhone: '59170001002' },
  { fullName: 'Paula Choque', whatsappPhone: '59170001003' },
  { fullName: 'Nicolas Vargas', whatsappPhone: '59170001004' },
  { fullName: 'Camila Soruco', whatsappPhone: '59170001005' },
  { fullName: 'Daniel Mendez', whatsappPhone: '59170001006' },
  { fullName: 'Valentina Rojas', whatsappPhone: '59170001007' },
  { fullName: 'Andres Flores', whatsappPhone: '59170001008' },
  { fullName: 'Mariana Paredes', whatsappPhone: '59170001009' },
  { fullName: 'Gabriel Ortiz', whatsappPhone: '59170001010' }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function asSqlDateTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function inClause(values) {
  if (!values.length) {
    return { clause: '(NULL)', params: [] };
  }
  return {
    clause: `(${values.map(() => '?').join(',')})`,
    params: values
  };
}

async function ensureCenter(connection) {
  await connection.query(
    `INSERT INTO centers (slug, name, timezone, locale, status)
     VALUES (?, ?, 'America/La_Paz', 'es-BO', 'active')
     ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      status = 'active',
      updated_at = CURRENT_TIMESTAMP`,
    [CENTER_SLUG, CENTER_NAME]
  );

  const [rows] = await connection.query(
    `SELECT id FROM centers WHERE slug = ? LIMIT 1`,
    [CENTER_SLUG]
  );

  const centerId = rows[0].id;

  await connection.query(
    `INSERT INTO center_settings
      (center_id, brand_name, support_whatsapp_text, whatsapp_number)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      brand_name = VALUES(brand_name),
      support_whatsapp_text = VALUES(support_whatsapp_text),
      whatsapp_number = VALUES(whatsapp_number),
      updated_at = CURRENT_TIMESTAMP`,
    [
      centerId,
      CENTER_NAME,
      'Hola, quisiera orientacion para elegir una terapia en Luna Mandala.',
      '59170000000'
    ]
  );

  return centerId;
}

async function ensureServices(connection, centerId) {
  const ids = [];

  for (const service of SERVICE_SEEDS) {
    const [existing] = await connection.query(
      `SELECT id FROM services WHERE center_id = ? AND name = ? LIMIT 1`,
      [centerId, service.name]
    );

    if (existing[0]) {
      ids.push(existing[0].id);
      continue;
    }

    const [result] = await connection.query(
      `INSERT INTO services
        (center_id, name, description, duration_min, base_price_cents, currency, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, 'BOB', 1, 1)`,
      [centerId, service.name, service.description, service.durationMin, service.priceCents]
    );

    ids.push(result.insertId);
  }

  return ids;
}

async function ensureRooms(connection, centerId) {
  for (const room of ROOM_NAMES) {
    await connection.query(
      `INSERT INTO rooms (center_id, name, capacity, is_active)
       VALUES (?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [centerId, room]
    );
  }

  const [rows] = await connection.query(
    `SELECT id, name FROM rooms WHERE center_id = ? AND name IN (${ROOM_NAMES.map(() => '?').join(',')})`,
    [centerId, ...ROOM_NAMES]
  );

  return ROOM_NAMES.map((name) => rows.find((row) => row.name === name)?.id).filter(Boolean);
}

async function ensureTherapists(connection, centerId) {
  const ids = [];

  for (const fullName of THERAPIST_NAMES) {
    const [existing] = await connection.query(
      `SELECT id FROM therapists WHERE center_id = ? AND full_name = ? LIMIT 1`,
      [centerId, fullName]
    );

    if (existing[0]) {
      ids.push(existing[0].id);
      continue;
    }

    const [result] = await connection.query(
      `INSERT INTO therapists
        (center_id, full_name, bio_short, commission_pct, is_active)
       VALUES (?, ?, 'Perfil de prueba para Agenda Luna.', 60.00, 1)`,
      [centerId, fullName]
    );

    ids.push(result.insertId);
  }

  return ids;
}

async function ensureTherapistServices(connection, centerId, therapistIds, serviceIds) {
  for (const therapistId of therapistIds) {
    for (const [index, serviceId] of serviceIds.entries()) {
      await connection.query(
        `INSERT IGNORE INTO therapist_services
          (center_id, therapist_id, service_id, round_robin_order, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [centerId, therapistId, serviceId, index + 1]
      );
    }
  }
}

async function ensureServiceRooms(connection, centerId, serviceIds, roomIds) {
  for (const serviceId of serviceIds) {
    for (const roomId of roomIds) {
      await connection.query(
        `INSERT IGNORE INTO service_rooms (center_id, service_id, room_id)
         VALUES (?, ?, ?)`,
        [centerId, serviceId, roomId]
      );
    }
  }
}

async function resetSchedules(connection, centerId, therapistIds, roomIds) {
  if (therapistIds.length) {
    const therapistClause = inClause(therapistIds);
    await connection.query(
      `DELETE FROM resource_schedules
       WHERE center_id = ? AND resource_type = 'therapist' AND resource_id IN ${therapistClause.clause}`,
      [centerId, ...therapistClause.params]
    );
  }

  if (roomIds.length) {
    const roomClause = inClause(roomIds);
    await connection.query(
      `DELETE FROM resource_schedules
       WHERE center_id = ? AND resource_type = 'room' AND resource_id IN ${roomClause.clause}`,
      [centerId, ...roomClause.params]
    );
  }

  const weekdays = [1, 2, 3, 4, 5, 6];

  for (const therapistId of therapistIds) {
    for (const weekday of weekdays) {
      await connection.query(
        `INSERT INTO resource_schedules
          (center_id, resource_type, resource_id, weekday, start_time, end_time, is_active)
         VALUES (?, 'therapist', ?, ?, '08:00:00', '18:00:00', 1)`,
        [centerId, therapistId, weekday]
      );
    }
  }

  for (const roomId of roomIds) {
    for (const weekday of weekdays) {
      await connection.query(
        `INSERT INTO resource_schedules
          (center_id, resource_type, resource_id, weekday, start_time, end_time, is_active)
         VALUES (?, 'room', ?, ?, '08:00:00', '18:00:00', 1)`,
        [centerId, roomId, weekday]
      );
    }
  }
}

async function ensureClients(connection, centerId) {
  const clientIds = [];

  for (const client of CLIENT_SEEDS) {
    await connection.query(
      `INSERT INTO clients (center_id, full_name, whatsapp_phone)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        updated_at = CURRENT_TIMESTAMP`,
      [centerId, client.fullName, client.whatsappPhone]
    );

    const [rows] = await connection.query(
      `SELECT id FROM clients WHERE center_id = ? AND whatsapp_phone = ? LIMIT 1`,
      [centerId, client.whatsappPhone]
    );

    clientIds.push(rows[0].id);
  }

  return clientIds;
}

async function deletePreviousSeedAppointments(connection, centerId) {
  const [rows] = await connection.query(
    `SELECT id FROM appointments WHERE center_id = ? AND notes = ?`,
    [centerId, SEED_NOTES_MARKER]
  );

  const appointmentIds = rows.map((row) => row.id);
  if (!appointmentIds.length) {
    return;
  }

  const clause = inClause(appointmentIds);

  await connection.query(
    `DELETE FROM appointment_resource_claims WHERE appointment_id IN ${clause.clause}`,
    clause.params
  );
  await connection.query(
    `DELETE FROM payments WHERE appointment_id IN ${clause.clause}`,
    clause.params
  );
  await connection.query(
    `DELETE FROM audit_logs WHERE entity_type = 'appointment' AND entity_id IN ${clause.clause}`,
    clause.params
  );
  await connection.query(
    `DELETE FROM appointments WHERE id IN ${clause.clause}`,
    clause.params
  );
}

async function createSeedAppointments(connection, centerId, serviceIds, therapistIds, roomIds, clientIds) {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);

  const slots = [
    { dayOffset: 1, hour: 13, minute: 0 },
    { dayOffset: 1, hour: 14, minute: 30 },
    { dayOffset: 1, hour: 16, minute: 0 },
    { dayOffset: 1, hour: 17, minute: 30 },
    { dayOffset: 1, hour: 19, minute: 0 },
    { dayOffset: 2, hour: 13, minute: 0 },
    { dayOffset: 2, hour: 14, minute: 30 },
    { dayOffset: 2, hour: 16, minute: 0 },
    { dayOffset: 2, hour: 17, minute: 30 },
    { dayOffset: 2, hour: 19, minute: 0 }
  ];

  for (let i = 0; i < 10; i += 1) {
    const slot = slots[i];
    const serviceId = serviceIds[i % serviceIds.length];
    const therapistId = therapistIds[i % therapistIds.length];
    const roomId = roomIds[i % roomIds.length];
    const clientId = clientIds[i % clientIds.length];

    const [serviceRows] = await connection.query(
      `SELECT duration_min, base_price_cents, currency FROM services WHERE id = ? LIMIT 1`,
      [serviceId]
    );

    const service = serviceRows[0];
    const startsAt = new Date(base);
    startsAt.setUTCDate(startsAt.getUTCDate() + slot.dayOffset);
    startsAt.setUTCHours(slot.hour, slot.minute, 0, 0);

    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60 * 1000);

    const [appointmentResult] = await connection.query(
      `INSERT INTO appointments
        (center_id, client_id, service_id, therapist_id, room_id, starts_at, ends_at, status, source, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'admin', 'pending', ?)`,
      [
        centerId,
        clientId,
        serviceId,
        therapistId,
        roomId,
        asSqlDateTime(startsAt),
        asSqlDateTime(endsAt),
        SEED_NOTES_MARKER
      ]
    );

    const appointmentId = appointmentResult.insertId;

    const minutes = buildClaimMinutes(startsAt, endsAt);

    for (const minute of minutes) {
      const claimTime = asSqlDateTime(minute);
      await connection.query(
        `INSERT INTO appointment_resource_claims
          (center_id, appointment_id, resource_type, resource_id, claim_time)
         VALUES
          (?, ?, 'therapist', ?, ?),
          (?, ?, 'room', ?, ?)`,
        [
          centerId,
          appointmentId,
          therapistId,
          claimTime,
          centerId,
          appointmentId,
          roomId,
          claimTime
        ]
      );
    }

    await connection.query(
      `INSERT INTO payments
        (center_id, appointment_id, amount_cents, currency, status, method)
       VALUES (?, ?, ?, ?, 'pending', 'transfer')`,
      [centerId, appointmentId, service.base_price_cents, service.currency]
    );
  }
}

async function seed() {
  const pool = getPool();

  try {
    await withTransaction(async (connection) => {
      const centerId = await ensureCenter(connection);
      const serviceIds = await ensureServices(connection, centerId);
      const roomIds = await ensureRooms(connection, centerId);
      const therapistIds = await ensureTherapists(connection, centerId);

      await ensureTherapistServices(connection, centerId, therapistIds, serviceIds);
      await ensureServiceRooms(connection, centerId, serviceIds, roomIds);
      await resetSchedules(connection, centerId, therapistIds, roomIds);

      const clientIds = await ensureClients(connection, centerId);

      await deletePreviousSeedAppointments(connection, centerId);
      await createSeedAppointments(
        connection,
        centerId,
        serviceIds,
        therapistIds,
        roomIds,
        clientIds
      );
    });

    // eslint-disable-next-line no-console
    console.log('Seed completed: 7 therapists and 10 pending appointments ready.');
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
