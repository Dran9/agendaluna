import { Router } from 'express';
import { z } from 'zod';
import { getPool, withTransaction } from '../db/pool.js';
import { authRequired, signAdminToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/http.js';
import { env } from '../utils/env.js';
import { AppError, ConflictError, ValidationError } from '../services/errors.js';
import { analyzePaymentEvidence } from '../services/paymentsReview.service.js';
import {
  addMinutes,
  fromMySqlDateTime,
  toDateOnlyInAppTz,
  toMySqlDateTime
} from '../utils/dates.js';
import { listAvailability } from '../services/availability.service.js';
import { createClaimsTx, releaseClaimsTx } from '../services/claims.service.js';
import { advanceRoundRobinTx, chooseRoundRobinTherapist, getRoundRobinState } from '../services/roundRobin.service.js';
import { withLock } from '../services/locks.service.js';

const router = Router();
const pool = getPool();

const DevTokenSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  email: z.string().email().default('admin@luna.local')
});

const ClientsQuerySchema = z.object({
  q: z.string().max(90).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(40)
});

const CreateClientSchema = z.object({
  fullName: z.string().min(2).max(140),
  whatsappPhone: z.string().min(7).max(40),
  email: z.string().email().max(190).optional().or(z.literal('')),
  notes: z.string().max(3000).optional().or(z.literal(''))
});

const UpdateClientSchema = z
  .object({
    fullName: z.string().min(2).max(140).optional(),
    whatsappPhone: z.string().min(7).max(40).optional(),
    email: z.string().email().max(190).optional().or(z.literal('')),
    notes: z.string().max(3000).optional().or(z.literal(''))
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required'
  });

const TherapistsQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

const FinanceQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const PaymentsQuerySchema = z.object({
  status: z.enum(['all', 'pending', 'verified', 'rejected', 'needs_review']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(80)
});

const SettingsUpdateSchema = z.object({
  centerName: z.string().min(2).max(160).optional(),
  brandName: z.string().min(2).max(160).optional(),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(10).optional(),
  whatsappNumber: z.string().max(40).optional().or(z.literal('')),
  supportWhatsappText: z.string().max(255).optional().or(z.literal('')),
  primaryColor: z.string().max(16).optional().or(z.literal('')),
  accentColor: z.string().max(16).optional().or(z.literal(''))
});

const ManualVerifySchema = z
  .object({
    action: z.enum(['verified', 'rejected', 'needs_review']).optional(),
    note: z.string().max(800).optional().or(z.literal('')),
    ocrText: z.string().max(12000).optional().or(z.literal('')),
    imageBase64: z.string().max(3_000_000).optional().or(z.literal(''))
  })
  .refine((input) => Boolean(input.action || input.ocrText || input.imageBase64), {
    message: 'Provide action or OCR evidence'
  });

const TelegramLinkSchema = z.object({
  telegramUserId: z.string().min(3).max(120),
  telegramUsername: z.string().max(120).optional().or(z.literal(''))
});

const CreateTherapistSchema = z.object({
  fullName: z.string().min(2).max(140),
  bioShort: z.string().max(255).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().max(190).optional().or(z.literal('')),
  commissionPct: z.coerce.number().min(0).max(100),
  isActive: z.boolean().optional().default(true)
});

const UpdateTherapistSchema = z
  .object({
    fullName: z.string().min(2).max(140).optional(),
    bioShort: z.string().max(255).optional().or(z.literal('')),
    phone: z.string().max(40).optional().or(z.literal('')),
    email: z.string().email().max(190).optional().or(z.literal('')),
    commissionPct: z.coerce.number().min(0).max(100).optional(),
    isActive: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required'
  });

const TherapistServicesSchema = z.object({
  serviceIds: z.array(z.coerce.number().int().positive()).max(200).default([])
});

const ScheduleEntrySchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  isActive: z.boolean().optional().default(true)
});

const UpdateTherapistScheduleSchema = z.object({
  entries: z.array(ScheduleEntrySchema).max(35)
});

const CreateServiceSchema = z.object({
  name: z.string().min(2).max(140),
  description: z.string().max(4000).optional().or(z.literal('')),
  durationMin: z.coerce.number().int().min(15).max(600),
  basePriceCents: z.coerce.number().int().min(0).max(5_000_000_000),
  currency: z.string().length(3),
  isActive: z.boolean().optional().default(true)
});

const UpdateServiceSchema = z
  .object({
    name: z.string().min(2).max(140).optional(),
    description: z.string().max(4000).optional().or(z.literal('')),
    durationMin: z.coerce.number().int().min(15).max(600).optional(),
    basePriceCents: z.coerce.number().int().min(0).max(5_000_000_000).optional(),
    currency: z.string().length(3).optional(),
    isActive: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required'
  });

const CreateRoomSchema = z.object({
  name: z.string().min(2).max(120),
  capacity: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean().optional().default(true)
});

const UpdateRoomSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    capacity: z.coerce.number().int().min(1).max(100).optional(),
    isActive: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required'
  });

const AdminAvailabilitySchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  therapistId: z.coerce.number().int().positive().nullable().optional()
});

const NewAppointmentClientSchema = z.object({
  fullName: z.string().min(2).max(140),
  whatsappPhone: z.string().min(7).max(40),
  email: z.string().email().max(190).optional().or(z.literal('')),
  notes: z.string().max(3000).optional().or(z.literal(''))
});

const CreateAdminAppointmentSchema = z
  .object({
    clientId: z.coerce.number().int().positive().optional(),
    client: NewAppointmentClientSchema.optional(),
    serviceId: z.coerce.number().int().positive(),
    therapistId: z.coerce.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime({ offset: true }),
    note: z.string().max(3000).optional().or(z.literal(''))
  })
  .refine((payload) => Boolean(payload.clientId || payload.client), {
    message: 'Provide clientId or client payload'
  });

const UpdateAppointmentStatusSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'cancelled', 'no_show']),
  note: z.string().max(500).optional().or(z.literal(''))
});

const RescheduleAppointmentSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  therapistId: z.coerce.number().int().positive().nullable().optional(),
  roomId: z.coerce.number().int().positive().nullable().optional(),
  note: z.string().max(500).optional().or(z.literal(''))
});

function toNullable(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}

function parseOptionalJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }

  return value;
}

function toComparableMinute(value) {
  return toMySqlDateTime(fromMySqlDateTime(value)).slice(0, 16);
}

function normalizeTimeInput(value) {
  const trimmed = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
}

function timeToMinutes(value) {
  const normalized = normalizeTimeInput(value);
  const [hourPart, minutePart] = normalized.split(':');
  return Number(hourPart) * 60 + Number(minutePart);
}

function normalizeScheduleEntries(entries) {
  const normalized = entries.map((entry) => ({
    weekday: Number(entry.weekday),
    startTime: normalizeTimeInput(entry.startTime),
    endTime: normalizeTimeInput(entry.endTime),
    isActive: Boolean(entry.isActive)
  }));

  for (const entry of normalized) {
    if (timeToMinutes(entry.endTime) <= timeToMinutes(entry.startTime)) {
      throw new ValidationError('Schedule endTime must be after startTime');
    }
  }

  return normalized;
}

function pickAdminCandidate(slot, { therapistId = null, roomId = null } = {}) {
  if (!slot || !Array.isArray(slot.candidates) || slot.candidates.length === 0) {
    return null;
  }

  let candidates = slot.candidates;
  if (therapistId !== null) {
    candidates = candidates.filter((candidate) => Number(candidate.therapistId) === Number(therapistId));
  }
  if (roomId !== null) {
    candidates = candidates.filter((candidate) => Number(candidate.roomId) === Number(roomId));
  }
  return candidates[0] || null;
}

async function getAppointmentRow(connection, centerId, appointmentId, { forUpdate = false } = {}) {
  const [rows] = await connection.query(
    `SELECT
       a.id,
       a.center_id,
       a.client_id,
       a.service_id,
       a.therapist_id,
       a.room_id,
       a.starts_at,
       a.ends_at,
       a.status,
       a.source,
       a.payment_status,
       a.notes,
       c.full_name AS client_name,
       c.whatsapp_phone AS client_whatsapp,
       c.email AS client_email,
       s.name AS service_name,
       s.duration_min,
       s.base_price_cents,
       s.currency,
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
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [centerId, appointmentId]
  );

  return rows[0] || null;
}

function serializeAppointmentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    centerId: row.center_id,
    client: {
      id: row.client_id,
      fullName: row.client_name,
      whatsappPhone: row.client_whatsapp,
      email: row.client_email
    },
    service: {
      id: row.service_id,
      name: row.service_name,
      durationMin: Number(row.duration_min),
      basePriceCents: Number(row.base_price_cents || 0),
      currency: row.currency
    },
    therapist: {
      id: row.therapist_id,
      fullName: row.therapist_name
    },
    room: {
      id: row.room_id,
      name: row.room_name
    },
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    source: row.source,
    paymentStatus: row.payment_status,
    notes: row.notes
  };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function currentMonthPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
}

function nextMonth(period) {
  const [yearRaw, monthRaw] = period.split('-').map(Number);
  if (monthRaw === 12) {
    return `${yearRaw + 1}-01`;
  }
  return `${yearRaw}-${pad(monthRaw + 1)}`;
}

function resolveDateRange(query) {
  const parsed = FinanceQuerySchema.parse(query || {});

  if (parsed.from && parsed.to) {
    const toExclusive = new Date(`${parsed.to}T00:00:00Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const toExclusiveDate = toExclusive.toISOString().slice(0, 10);
    return {
      fromSql: `${parsed.from} 00:00:00`,
      toSql: `${toExclusiveDate} 00:00:00`,
      from: parsed.from,
      to: parsed.to
    };
  }

  const fallbackPeriod = currentMonthPeriod();
  const fallbackNext = nextMonth(fallbackPeriod);

  return {
    fromSql: `${fallbackPeriod}-01 00:00:00`,
    toSql: `${fallbackNext}-01 00:00:00`,
    from: `${fallbackPeriod}-01`,
    to: `${fallbackNext}-01`
  };
}

router.post(
  '/auth/dev-token',
  asyncHandler(async (req, res) => {
    if (env.NODE_ENV !== 'development') {
      throw new AppError('Dev token endpoint is disabled outside development', 403, 'forbidden');
    }

    const input = DevTokenSchema.parse(req.body || {});

    const token = signAdminToken({
      sub: input.email,
      role: 'admin',
      centerId: input.centerId
    });

    res.json({ ok: true, token });
  })
);

router.use(authRequired);

router.get(
  '/control/summary',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const [appointmentRows] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'confirmed') AS confirmed,
              SUM(status = 'pending') AS pending,
              SUM(status = 'cancelled') AS cancelled
       FROM appointments
       WHERE center_id = ?
         AND DATE(starts_at) = CURDATE()`,
      [centerId]
    );

    const [paymentRows] = await pool.query(
      `SELECT COUNT(*) AS pendingPayments
       FROM payments
       WHERE center_id = ? AND status = 'pending'`,
      [centerId]
    );

    res.json({
      ok: true,
      summary: {
        totalToday: Number(appointmentRows[0]?.total || 0),
        confirmedToday: Number(appointmentRows[0]?.confirmed || 0),
        pendingToday: Number(appointmentRows[0]?.pending || 0),
        cancelledToday: Number(appointmentRows[0]?.cancelled || 0),
        pendingPayments: Number(paymentRows[0]?.pendingPayments || 0)
      }
    });
  })
);

router.get(
  '/control/today',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);

    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.starts_at,
         a.ends_at,
         a.status,
         c.full_name AS client_name,
         t.full_name AS therapist_name,
         r.name AS room_name,
         s.name AS service_name
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       JOIN therapists t ON t.id = a.therapist_id
       JOIN rooms r ON r.id = a.room_id
       JOIN services s ON s.id = a.service_id
       WHERE a.center_id = ?
         AND DATE(a.starts_at) = CURDATE()
       ORDER BY a.starts_at ASC
       LIMIT 100`,
      [centerId]
    );

    res.json({ ok: true, appointments: rows });
  })
);

router.get(
  '/clients',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const query = ClientsQuerySchema.parse(req.query || {});

    const params = [centerId, centerId];
    let whereSearch = '';
    if (query.q) {
      whereSearch = 'AND (c.full_name LIKE ? OR c.whatsapp_phone LIKE ?)';
      const like = `%${query.q.trim()}%`;
      params.push(like, like);
    }
    params.push(query.limit);

    const [rows] = await pool.query(
      `SELECT
         c.id,
         c.full_name,
         c.whatsapp_phone,
         c.email,
         c.notes,
         c.created_at,
         c.updated_at,
         COALESCE(stats.total_appointments, 0) AS total_appointments,
         COALESCE(stats.pending_appointments, 0) AS pending_appointments,
         stats.last_appointment_at
       FROM clients c
       LEFT JOIN (
         SELECT
           a.client_id,
           COUNT(*) AS total_appointments,
           SUM(a.status IN ('pending', 'confirmed')) AS pending_appointments,
           MAX(a.starts_at) AS last_appointment_at
         FROM appointments a
         WHERE a.center_id = ?
         GROUP BY a.client_id
       ) stats ON stats.client_id = c.id
       WHERE c.center_id = ?
       ${whereSearch}
       ORDER BY c.updated_at DESC
       LIMIT ?`,
      params
    );

    res.json({
      ok: true,
      clients: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        whatsappPhone: row.whatsapp_phone,
        email: row.email,
        notes: row.notes,
        totalAppointments: Number(row.total_appointments || 0),
        pendingAppointments: Number(row.pending_appointments || 0),
        lastAppointmentAt: row.last_appointment_at,
        updatedAt: row.updated_at
      }))
    });
  })
);

router.post(
  '/clients',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = CreateClientSchema.parse(req.body || {});

    const [result] = await pool.query(
      `INSERT INTO clients (center_id, full_name, whatsapp_phone, email, notes)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        email = VALUES(email),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP`,
      [
        centerId,
        input.fullName,
        input.whatsappPhone,
        toNullable(input.email),
        toNullable(input.notes)
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, full_name, whatsapp_phone, email, notes, updated_at
       FROM clients
       WHERE center_id = ? AND whatsapp_phone = ?
       LIMIT 1`,
      [centerId, input.whatsappPhone]
    );

    res.status(result.insertId ? 201 : 200).json({
      ok: true,
      client: {
        id: rows[0].id,
        fullName: rows[0].full_name,
        whatsappPhone: rows[0].whatsapp_phone,
        email: rows[0].email,
        notes: rows[0].notes,
        updatedAt: rows[0].updated_at
      }
    });
  })
);

router.patch(
  '/clients/:id',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const clientId = Number(req.params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      throw new ValidationError('Invalid client id');
    }

    const input = UpdateClientSchema.parse(req.body || {});

    const updates = [];
    const params = [];

    if (input.fullName !== undefined) {
      updates.push('full_name = ?');
      params.push(input.fullName);
    }

    if (input.whatsappPhone !== undefined) {
      updates.push('whatsapp_phone = ?');
      params.push(input.whatsappPhone);
    }

    if (input.email !== undefined) {
      updates.push('email = ?');
      params.push(toNullable(input.email));
    }

    if (input.notes !== undefined) {
      updates.push('notes = ?');
      params.push(toNullable(input.notes));
    }

    params.push(clientId, centerId);

    const [result] = await pool.query(
      `UPDATE clients
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND center_id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new AppError('Client not found', 404, 'not_found');
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, whatsapp_phone, email, notes, updated_at
       FROM clients
       WHERE id = ? AND center_id = ?
       LIMIT 1`,
      [clientId, centerId]
    );

    res.json({
      ok: true,
      client: {
        id: rows[0].id,
        fullName: rows[0].full_name,
        whatsappPhone: rows[0].whatsapp_phone,
        email: rows[0].email,
        notes: rows[0].notes,
        updatedAt: rows[0].updated_at
      }
    });
  })
);

router.get(
  '/clients/:id/timeline',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const clientId = Number(req.params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      throw new ValidationError('Invalid client id');
    }

    const [[client]] = await pool.query(
      `SELECT id, full_name, whatsapp_phone, email, notes
       FROM clients
       WHERE center_id = ? AND id = ?
       LIMIT 1`,
      [centerId, clientId]
    );

    if (!client) {
      throw new AppError('Client not found', 404, 'not_found');
    }

    const [appointments] = await pool.query(
      `SELECT
         a.id,
         a.starts_at,
         a.ends_at,
         a.status,
         a.payment_status,
         s.name AS service_name,
         t.full_name AS therapist_name,
         r.name AS room_name
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       JOIN therapists t ON t.id = a.therapist_id
       JOIN rooms r ON r.id = a.room_id
       WHERE a.center_id = ?
         AND a.client_id = ?
       ORDER BY a.starts_at DESC
       LIMIT 100`,
      [centerId, clientId]
    );

    const [payments] = await pool.query(
      `SELECT
         p.id,
         p.status,
         p.amount_cents,
         p.currency,
         p.method,
         p.updated_at,
         p.appointment_id
       FROM payments p
       JOIN appointments a ON a.id = p.appointment_id AND a.center_id = p.center_id
       WHERE p.center_id = ?
         AND a.client_id = ?
       ORDER BY p.updated_at DESC
       LIMIT 100`,
      [centerId, clientId]
    );

    const [logs] = await pool.query(
      `SELECT id, action, metadata_json, created_at
       FROM audit_logs
       WHERE center_id = ?
         AND actor_type = 'client'
         AND actor_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [centerId, clientId]
    );

    const timeline = [
      ...appointments.map((item) => ({
        at: item.starts_at,
        kind: 'appointment',
        item: {
          id: item.id,
          status: item.status,
          paymentStatus: item.payment_status,
          serviceName: item.service_name,
          therapistName: item.therapist_name,
          roomName: item.room_name,
          startsAt: item.starts_at,
          endsAt: item.ends_at
        }
      })),
      ...payments.map((item) => ({
        at: item.updated_at,
        kind: 'payment',
        item: {
          id: item.id,
          appointmentId: item.appointment_id,
          status: item.status,
          amountCents: item.amount_cents,
          currency: item.currency,
          method: item.method
        }
      })),
      ...logs.map((item) => ({
        at: item.created_at,
        kind: 'audit',
        item: {
          id: item.id,
          action: item.action,
          metadata: item.metadata_json
        }
      }))
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

    res.json({
      ok: true,
      client: {
        id: client.id,
        fullName: client.full_name,
        whatsappPhone: client.whatsapp_phone,
        email: client.email,
        notes: client.notes
      },
      timeline
    });
  })
);

router.get(
  '/therapists',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const query = TherapistsQuerySchema.parse(req.query || {});

    const period = query.period || currentMonthPeriod();
    const periodStartSql = `${period}-01 00:00:00`;
    const periodEndSql = `${nextMonth(period)}-01 00:00:00`;

    const [therapists] = await pool.query(
      `SELECT
         id,
         full_name,
         bio_short,
         phone,
         email,
         commission_pct,
         is_active
       FROM therapists
       WHERE center_id = ?
       ORDER BY is_active DESC, full_name ASC`,
      [centerId]
    );

    const [services] = await pool.query(
      `SELECT ts.therapist_id, s.name AS service_name
       FROM therapist_services ts
       JOIN services s ON s.id = ts.service_id
       WHERE ts.center_id = ?
         AND ts.is_active = 1
         AND s.is_active = 1`,
      [centerId]
    );

    const [metrics] = await pool.query(
      `SELECT
         a.therapist_id,
         COUNT(*) AS sessions,
         COALESCE(SUM(CASE WHEN p.status IN ('pending', 'verified') THEN p.amount_cents ELSE 0 END), 0) AS generated_cents
       FROM appointments a
       LEFT JOIN payments p
         ON p.center_id = a.center_id
        AND p.appointment_id = a.id
       WHERE a.center_id = ?
         AND a.starts_at >= ?
         AND a.starts_at < ?
         AND a.status IN ('pending', 'confirmed', 'completed')
       GROUP BY a.therapist_id`,
      [centerId, periodStartSql, periodEndSql]
    );

    const [telegram] = await pool.query(
      `SELECT therapist_id, telegram_user_id, telegram_username
       FROM telegram_links
       WHERE center_id = ?
         AND is_active = 1`,
      [centerId]
    );

    const servicesMap = new Map();
    for (const row of services) {
      const current = servicesMap.get(row.therapist_id) || [];
      current.push(row.service_name);
      servicesMap.set(row.therapist_id, current);
    }

    const metricsMap = new Map();
    for (const row of metrics) {
      metricsMap.set(row.therapist_id, {
        sessions: Number(row.sessions || 0),
        generatedCents: Number(row.generated_cents || 0)
      });
    }

    const telegramMap = new Map();
    for (const row of telegram) {
      telegramMap.set(row.therapist_id, {
        linked: true,
        telegramUserId: row.telegram_user_id,
        telegramUsername: row.telegram_username
      });
    }

    res.json({
      ok: true,
      period,
      therapists: therapists.map((therapist) => {
        const metricsRow = metricsMap.get(therapist.id) || { sessions: 0, generatedCents: 0 };
        const generatedCents = Number(metricsRow.generatedCents || 0);
        const commissionPct = Number(therapist.commission_pct || 0);
        const therapistShareCents = Math.round(generatedCents * (commissionPct / 100));
        const lunaShareCents = generatedCents - therapistShareCents;

        return {
          id: therapist.id,
          fullName: therapist.full_name,
          bioShort: therapist.bio_short,
          phone: therapist.phone,
          email: therapist.email,
          isActive: Boolean(therapist.is_active),
          commissionPct,
          services: servicesMap.get(therapist.id) || [],
          sessions: metricsRow.sessions,
          generatedCents,
          therapistShareCents,
          lunaShareCents,
          telegram: telegramMap.get(therapist.id) || { linked: false }
        };
      })
    });
  })
);

router.post(
  '/therapists',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = CreateTherapistSchema.parse(req.body || {});

    const [insert] = await pool.query(
      `INSERT INTO therapists
        (center_id, full_name, bio_short, phone, email, commission_pct, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        centerId,
        input.fullName,
        toNullable(input.bioShort),
        toNullable(input.phone),
        toNullable(input.email),
        input.commissionPct,
        input.isActive ? 1 : 0
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, full_name, bio_short, phone, email, commission_pct, is_active
       FROM therapists
       WHERE center_id = ? AND id = ?
       LIMIT 1`,
      [centerId, insert.insertId]
    );

    res.status(201).json({
      ok: true,
      therapist: {
        id: rows[0].id,
        fullName: rows[0].full_name,
        bioShort: rows[0].bio_short,
        phone: rows[0].phone,
        email: rows[0].email,
        commissionPct: Number(rows[0].commission_pct),
        isActive: Boolean(rows[0].is_active)
      }
    });
  })
);

router.patch(
  '/therapists/:id',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const therapistId = Number(req.params.id);
    if (!Number.isFinite(therapistId) || therapistId <= 0) {
      throw new ValidationError('Invalid therapist id');
    }

    const input = UpdateTherapistSchema.parse(req.body || {});
    const updates = [];
    const params = [];

    if (input.fullName !== undefined) {
      updates.push('full_name = ?');
      params.push(input.fullName);
    }

    if (input.bioShort !== undefined) {
      updates.push('bio_short = ?');
      params.push(toNullable(input.bioShort));
    }

    if (input.phone !== undefined) {
      updates.push('phone = ?');
      params.push(toNullable(input.phone));
    }

    if (input.email !== undefined) {
      updates.push('email = ?');
      params.push(toNullable(input.email));
    }

    if (input.commissionPct !== undefined) {
      updates.push('commission_pct = ?');
      params.push(input.commissionPct);
    }

    if (input.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }

    params.push(therapistId, centerId);

    const [result] = await pool.query(
      `UPDATE therapists
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND center_id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new AppError('Therapist not found', 404, 'not_found');
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, bio_short, phone, email, commission_pct, is_active
       FROM therapists
       WHERE center_id = ? AND id = ?
       LIMIT 1`,
      [centerId, therapistId]
    );

    res.json({
      ok: true,
      therapist: {
        id: rows[0].id,
        fullName: rows[0].full_name,
        bioShort: rows[0].bio_short,
        phone: rows[0].phone,
        email: rows[0].email,
        commissionPct: Number(rows[0].commission_pct),
        isActive: Boolean(rows[0].is_active)
      }
    });
  })
);

router.put(
  '/therapists/:id/services',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const therapistId = Number(req.params.id);
    if (!Number.isFinite(therapistId) || therapistId <= 0) {
      throw new ValidationError('Invalid therapist id');
    }

    const input = TherapistServicesSchema.parse(req.body || {});
    const dedupedServiceIds = [...new Set(input.serviceIds.map((serviceId) => Number(serviceId)))];

    const response = await withTransaction(async (connection) => {
      const [therapistRows] = await connection.query(
        `SELECT id
         FROM therapists
         WHERE center_id = ? AND id = ?
         LIMIT 1
         FOR UPDATE`,
        [centerId, therapistId]
      );

      if (!therapistRows[0]) {
        throw new AppError('Therapist not found', 404, 'not_found');
      }

      if (dedupedServiceIds.length > 0) {
        const [serviceRows] = await connection.query(
          `SELECT id
           FROM services
           WHERE center_id = ?
             AND id IN (${dedupedServiceIds.map(() => '?').join(',')})`,
          [centerId, ...dedupedServiceIds]
        );

        if (serviceRows.length !== dedupedServiceIds.length) {
          throw new ValidationError('Some services do not exist for this center');
        }
      }

      await connection.query(
        `UPDATE therapist_services
         SET is_active = 0
         WHERE center_id = ?
           AND therapist_id = ?`,
        [centerId, therapistId]
      );

      for (const [index, serviceId] of dedupedServiceIds.entries()) {
        await connection.query(
          `INSERT INTO therapist_services
            (center_id, therapist_id, service_id, round_robin_order, is_active)
           VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
            round_robin_order = VALUES(round_robin_order),
            is_active = 1`,
          [centerId, therapistId, serviceId, index + 1]
        );
      }

      await connection.query(
        `INSERT INTO audit_logs
          (center_id, actor_type, actor_id, entity_type, entity_id, action, metadata_json)
         VALUES (?, 'admin', ?, 'therapist', ?, 'therapist_services_updated', ?)`,
        [
          centerId,
          req.user.sub ? Number(req.user.id || 0) || null : null,
          therapistId,
          JSON.stringify({
            serviceIds: dedupedServiceIds
          })
        ]
      );

      const [rows] = await connection.query(
        `SELECT ts.service_id, ts.is_active, ts.round_robin_order, s.name AS service_name
         FROM therapist_services ts
         JOIN services s ON s.id = ts.service_id
         WHERE ts.center_id = ?
           AND ts.therapist_id = ?
         ORDER BY ts.round_robin_order ASC, ts.service_id ASC`,
        [centerId, therapistId]
      );

      return rows.map((row) => ({
        serviceId: row.service_id,
        serviceName: row.service_name,
        roundRobinOrder: Number(row.round_robin_order || 0),
        isActive: Boolean(row.is_active)
      }));
    });

    res.json({
      ok: true,
      therapistId,
      services: response
    });
  })
);

router.get(
  '/therapists/:id/schedule',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const therapistId = Number(req.params.id);
    if (!Number.isFinite(therapistId) || therapistId <= 0) {
      throw new ValidationError('Invalid therapist id');
    }

    const [therapistRows] = await pool.query(
      `SELECT id
       FROM therapists
       WHERE center_id = ? AND id = ?
       LIMIT 1`,
      [centerId, therapistId]
    );

    if (!therapistRows[0]) {
      throw new AppError('Therapist not found', 404, 'not_found');
    }

    const [rows] = await pool.query(
      `SELECT weekday, start_time, end_time, is_active
       FROM resource_schedules
       WHERE center_id = ?
         AND resource_type = 'therapist'
         AND resource_id = ?
       ORDER BY weekday ASC, start_time ASC`,
      [centerId, therapistId]
    );

    res.json({
      ok: true,
      therapistId,
      schedule: rows.map((row) => ({
        weekday: Number(row.weekday),
        startTime: String(row.start_time),
        endTime: String(row.end_time),
        isActive: Boolean(row.is_active)
      }))
    });
  })
);

router.put(
  '/therapists/:id/schedule',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const therapistId = Number(req.params.id);
    if (!Number.isFinite(therapistId) || therapistId <= 0) {
      throw new ValidationError('Invalid therapist id');
    }

    const input = UpdateTherapistScheduleSchema.parse(req.body || {});
    const entries = normalizeScheduleEntries(input.entries);

    await withTransaction(async (connection) => {
      const [therapistRows] = await connection.query(
        `SELECT id
         FROM therapists
         WHERE center_id = ? AND id = ?
         LIMIT 1
         FOR UPDATE`,
        [centerId, therapistId]
      );

      if (!therapistRows[0]) {
        throw new AppError('Therapist not found', 404, 'not_found');
      }

      await connection.query(
        `DELETE FROM resource_schedules
         WHERE center_id = ?
           AND resource_type = 'therapist'
           AND resource_id = ?`,
        [centerId, therapistId]
      );

      for (const entry of entries) {
        await connection.query(
          `INSERT INTO resource_schedules
            (center_id, resource_type, resource_id, weekday, start_time, end_time, is_active)
           VALUES (?, 'therapist', ?, ?, ?, ?, ?)`,
          [
            centerId,
            therapistId,
            entry.weekday,
            entry.startTime,
            entry.endTime,
            entry.isActive ? 1 : 0
          ]
        );
      }
    });

    res.json({
      ok: true,
      therapistId,
      schedule: entries
    });
  })
);

router.post(
  '/services',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = CreateServiceSchema.parse(req.body || {});
    const currency = input.currency.toUpperCase();

    const result = await withTransaction(async (connection) => {
      const [insert] = await connection.query(
        `INSERT INTO services
          (center_id, name, description, duration_min, base_price_cents, currency, is_featured, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          centerId,
          input.name,
          toNullable(input.description),
          input.durationMin,
          input.basePriceCents,
          currency,
          input.isActive ? 1 : 0
        ]
      );

      const serviceId = Number(insert.insertId);

      const [roomRows] = await connection.query(
        `SELECT id
         FROM rooms
         WHERE center_id = ?
           AND is_active = 1`,
        [centerId]
      );

      for (const row of roomRows) {
        await connection.query(
          `INSERT IGNORE INTO service_rooms (center_id, service_id, room_id)
           VALUES (?, ?, ?)`,
          [centerId, serviceId, row.id]
        );
      }

      const [rows] = await connection.query(
        `SELECT id, name, description, duration_min, base_price_cents, currency, is_active
         FROM services
         WHERE center_id = ? AND id = ?
         LIMIT 1`,
        [centerId, serviceId]
      );

      return rows[0];
    });

    res.status(201).json({
      ok: true,
      service: {
        id: result.id,
        name: result.name,
        description: result.description,
        durationMin: Number(result.duration_min),
        basePriceCents: Number(result.base_price_cents),
        currency: result.currency,
        isActive: Boolean(result.is_active)
      }
    });
  })
);

router.patch(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const serviceId = Number(req.params.id);
    if (!Number.isFinite(serviceId) || serviceId <= 0) {
      throw new ValidationError('Invalid service id');
    }

    const input = UpdateServiceSchema.parse(req.body || {});
    const updates = [];
    const params = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(toNullable(input.description));
    }

    if (input.durationMin !== undefined) {
      updates.push('duration_min = ?');
      params.push(input.durationMin);
    }

    if (input.basePriceCents !== undefined) {
      updates.push('base_price_cents = ?');
      params.push(input.basePriceCents);
    }

    if (input.currency !== undefined) {
      updates.push('currency = ?');
      params.push(input.currency.toUpperCase());
    }

    if (input.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }

    params.push(serviceId, centerId);

    const [result] = await pool.query(
      `UPDATE services
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND center_id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new AppError('Service not found', 404, 'not_found');
    }

    const [rows] = await pool.query(
      `SELECT id, name, description, duration_min, base_price_cents, currency, is_active
       FROM services
       WHERE center_id = ? AND id = ?
       LIMIT 1`,
      [centerId, serviceId]
    );

    res.json({
      ok: true,
      service: {
        id: rows[0].id,
        name: rows[0].name,
        description: rows[0].description,
        durationMin: Number(rows[0].duration_min),
        basePriceCents: Number(rows[0].base_price_cents),
        currency: rows[0].currency,
        isActive: Boolean(rows[0].is_active)
      }
    });
  })
);

router.post(
  '/rooms',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = CreateRoomSchema.parse(req.body || {});

    const result = await withTransaction(async (connection) => {
      const [insert] = await connection.query(
        `INSERT INTO rooms (center_id, name, capacity, is_active)
         VALUES (?, ?, ?, ?)`,
        [centerId, input.name, input.capacity, input.isActive ? 1 : 0]
      );

      const roomId = Number(insert.insertId);

      const [serviceRows] = await connection.query(
        `SELECT id
         FROM services
         WHERE center_id = ?
           AND is_active = 1`,
        [centerId]
      );

      for (const row of serviceRows) {
        await connection.query(
          `INSERT IGNORE INTO service_rooms (center_id, service_id, room_id)
           VALUES (?, ?, ?)`,
          [centerId, row.id, roomId]
        );
      }

      const [rows] = await connection.query(
        `SELECT id, name, capacity, is_active
         FROM rooms
         WHERE center_id = ? AND id = ?
         LIMIT 1`,
        [centerId, roomId]
      );

      return rows[0];
    });

    res.status(201).json({
      ok: true,
      room: {
        id: result.id,
        name: result.name,
        capacity: Number(result.capacity),
        isActive: Boolean(result.is_active)
      }
    });
  })
);

router.patch(
  '/rooms/:id',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const roomId = Number(req.params.id);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new ValidationError('Invalid room id');
    }

    const input = UpdateRoomSchema.parse(req.body || {});
    const updates = [];
    const params = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }

    if (input.capacity !== undefined) {
      updates.push('capacity = ?');
      params.push(input.capacity);
    }

    if (input.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }

    params.push(roomId, centerId);

    const [result] = await pool.query(
      `UPDATE rooms
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND center_id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new AppError('Room not found', 404, 'not_found');
    }

    const [rows] = await pool.query(
      `SELECT id, name, capacity, is_active
       FROM rooms
       WHERE center_id = ? AND id = ?
       LIMIT 1`,
      [centerId, roomId]
    );

    res.json({
      ok: true,
      room: {
        id: rows[0].id,
        name: rows[0].name,
        capacity: Number(rows[0].capacity),
        isActive: Boolean(rows[0].is_active)
      }
    });
  })
);

router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);

    const [[center], [services], [therapists], [rooms], [therapistServices]] = await Promise.all([
      pool.query(
        `SELECT c.id, c.slug, c.name, c.timezone, c.locale, c.status,
                cs.brand_name, cs.logo_url, cs.whatsapp_number, cs.support_whatsapp_text,
                cs.primary_color, cs.accent_color
         FROM centers c
         LEFT JOIN center_settings cs ON cs.center_id = c.id
         WHERE c.id = ?
         LIMIT 1`,
        [centerId]
      ),
      pool.query(
        `SELECT id, name, description, duration_min, base_price_cents, currency, is_active
         FROM services
         WHERE center_id = ?
         ORDER BY is_active DESC, name ASC`,
        [centerId]
      ),
      pool.query(
        `SELECT id, full_name, bio_short, phone, email, commission_pct, is_active
         FROM therapists
         WHERE center_id = ?
         ORDER BY is_active DESC, full_name ASC`,
        [centerId]
      ),
      pool.query(
        `SELECT id, name, capacity, is_active
         FROM rooms
         WHERE center_id = ?
         ORDER BY is_active DESC, name ASC`,
        [centerId]
      ),
      pool.query(
        `SELECT therapist_id, service_id, round_robin_order, is_active
         FROM therapist_services
         WHERE center_id = ?
         ORDER BY therapist_id ASC, round_robin_order ASC, service_id ASC`,
        [centerId]
      )
    ]);

    if (!center) {
      throw new AppError('Center not found', 404, 'not_found');
    }

    const therapistServicesMap = new Map();
    for (const row of therapistServices) {
      const current = therapistServicesMap.get(row.therapist_id) || [];
      current.push({
        serviceId: row.service_id,
        roundRobinOrder: Number(row.round_robin_order || 0),
        isActive: Boolean(row.is_active)
      });
      therapistServicesMap.set(row.therapist_id, current);
    }

    res.json({
      ok: true,
      center: {
        id: center.id,
        slug: center.slug,
        name: center.name,
        timezone: center.timezone,
        locale: center.locale,
        status: center.status,
        brandName: center.brand_name || center.name,
        logoUrl: center.logo_url || '',
        whatsappNumber: center.whatsapp_number || '',
        supportWhatsappText: center.support_whatsapp_text || '',
        primaryColor: center.primary_color || '',
        accentColor: center.accent_color || ''
      },
      services: services.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        durationMin: Number(row.duration_min),
        basePriceCents: Number(row.base_price_cents),
        currency: row.currency,
        isActive: Boolean(row.is_active)
      })),
      therapists: therapists.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        bioShort: row.bio_short,
        phone: row.phone,
        email: row.email,
        commissionPct: Number(row.commission_pct),
        isActive: Boolean(row.is_active),
        services: therapistServicesMap.get(row.id) || []
      })),
      rooms: rooms.map((row) => ({
        id: row.id,
        name: row.name,
        capacity: Number(row.capacity),
        isActive: Boolean(row.is_active)
      }))
    });
  })
);

router.post(
  '/availability',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = AdminAvailabilitySchema.parse(req.body || {});

    const availability = await listAvailability(pool, {
      centerId,
      serviceId: input.serviceId,
      date: input.date,
      therapistId: input.therapistId ?? null,
      maxSlots: 80
    });

    res.json({ ok: true, ...availability });
  })
);

router.post(
  '/appointments',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = CreateAdminAppointmentSchema.parse(req.body || {});

    const result = await withTransaction(async (connection) => {
      const [serviceRows] = await connection.query(
        `SELECT id, duration_min, base_price_cents, currency
         FROM services
         WHERE center_id = ? AND id = ? AND is_active = 1
         LIMIT 1`,
        [centerId, input.serviceId]
      );

      const service = serviceRows[0];
      if (!service) {
        throw new ValidationError('Service does not exist or is inactive');
      }

      const requestedStart = fromMySqlDateTime(input.startsAt);
      const requestedEnd = addMinutes(requestedStart, Number(service.duration_min));
      const lockKey = `luna:admin-book:${centerId}:${service.id}:${toMySqlDateTime(requestedStart).slice(0, 16)}`;

      return withLock(connection, lockKey, async () => {
        const availability = await listAvailability(connection, {
          centerId,
          serviceId: service.id,
          date: toDateOnlyInAppTz(requestedStart),
          therapistId: input.therapistId ?? null,
          maxSlots: 100
        });

        const requestedMinute = toComparableMinute(input.startsAt);
        const slot = availability.slots.find((item) => toComparableMinute(item.startsAt) === requestedMinute);

        if (!slot) {
          throw new ConflictError('Requested slot is not available');
        }

        let candidate = pickAdminCandidate(slot, {
          therapistId: input.therapistId ?? null
        });

        if (!candidate && input.therapistId === undefined) {
          const state = await getRoundRobinState(connection, centerId, service.id);
          const chosen = chooseRoundRobinTherapist({
            candidates: slot.therapists || [],
            lastTherapistId: state.last_therapist_id,
            loadsByTherapist: {}
          });

          if (chosen) {
            candidate = pickAdminCandidate(slot, { therapistId: chosen.therapistId });
          }
        }

        if (!candidate) {
          throw new ConflictError('No therapist-room pair available for this slot');
        }

        let clientId = input.clientId ? Number(input.clientId) : null;
        if (clientId) {
          const [clientRows] = await connection.query(
            `SELECT id
             FROM clients
             WHERE center_id = ? AND id = ?
             LIMIT 1`,
            [centerId, clientId]
          );
          if (!clientRows[0]) {
            throw new ValidationError('Client not found');
          }
        } else {
          const clientInput = input.client;
          const [clientInsert] = await connection.query(
            `INSERT INTO clients (center_id, full_name, whatsapp_phone, email, notes)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              full_name = VALUES(full_name),
              email = VALUES(email),
              notes = VALUES(notes),
              updated_at = CURRENT_TIMESTAMP`,
            [
              centerId,
              clientInput.fullName,
              clientInput.whatsappPhone,
              toNullable(clientInput.email),
              toNullable(clientInput.notes)
            ]
          );

          if (clientInsert.insertId) {
            clientId = Number(clientInsert.insertId);
          } else {
            const [clientRows] = await connection.query(
              `SELECT id
               FROM clients
               WHERE center_id = ? AND whatsapp_phone = ?
               LIMIT 1`,
              [centerId, clientInput.whatsappPhone]
            );
            clientId = Number(clientRows[0].id);
          }
        }

        const [appointmentInsert] = await connection.query(
          `INSERT INTO appointments
            (center_id, client_id, service_id, therapist_id, room_id, starts_at, ends_at, status, source, payment_status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 'admin', 'pending', ?)`,
          [
            centerId,
            clientId,
            service.id,
            candidate.therapistId,
            candidate.roomId,
            toMySqlDateTime(requestedStart),
            toMySqlDateTime(requestedEnd),
            toNullable(input.note)
          ]
        );

        const appointmentId = Number(appointmentInsert.insertId);

        await createClaimsTx(connection, {
          centerId,
          appointmentId,
          therapistId: candidate.therapistId,
          roomId: candidate.roomId,
          startsAt: requestedStart,
          endsAt: requestedEnd
        });

        await connection.query(
          `INSERT INTO payments
            (center_id, appointment_id, amount_cents, currency, status, method)
           VALUES (?, ?, ?, ?, 'pending', 'transfer')`,
          [centerId, appointmentId, service.base_price_cents, service.currency]
        );

        await advanceRoundRobinTx(connection, {
          centerId,
          serviceId: service.id,
          therapistId: candidate.therapistId
        });

        await connection.query(
          `INSERT INTO audit_logs
            (center_id, actor_type, entity_type, entity_id, action, metadata_json)
           VALUES (?, 'admin', 'appointment', ?, 'appointment_created_admin', ?)`,
          [
            centerId,
            appointmentId,
            JSON.stringify({
              therapistId: candidate.therapistId,
              roomId: candidate.roomId,
              startsAt: toMySqlDateTime(requestedStart),
              endsAt: toMySqlDateTime(requestedEnd),
              note: toNullable(input.note)
            })
          ]
        );

        const appointment = await getAppointmentRow(connection, centerId, appointmentId);
        return serializeAppointmentRow(appointment);
      });
    });

    res.status(201).json({ ok: true, appointment: result });
  })
);

router.get(
  '/appointments/:id',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      throw new ValidationError('Invalid appointment id');
    }

    const row = await getAppointmentRow(pool, centerId, appointmentId);
    if (!row) {
      throw new AppError('Appointment not found', 404, 'not_found');
    }

    const [payments, logs] = await Promise.all([
      pool.query(
        `SELECT id, amount_cents, currency, status, method, created_at, updated_at
         FROM payments
         WHERE center_id = ? AND appointment_id = ?
         ORDER BY id ASC`,
        [centerId, appointmentId]
      ),
      pool.query(
        `SELECT id, actor_type, actor_id, action, metadata_json, created_at
         FROM audit_logs
         WHERE center_id = ?
           AND entity_type = 'appointment'
           AND entity_id = ?
         ORDER BY created_at DESC
         LIMIT 120`,
        [centerId, appointmentId]
      )
    ]);

    res.json({
      ok: true,
      appointment: serializeAppointmentRow(row),
      payments: payments[0].map((item) => ({
        id: item.id,
        amountCents: Number(item.amount_cents || 0),
        currency: item.currency,
        status: item.status,
        method: item.method,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      audit: logs[0].map((item) => ({
        id: item.id,
        actorType: item.actor_type,
        actorId: item.actor_id,
        action: item.action,
        metadata: parseOptionalJson(item.metadata_json),
        createdAt: item.created_at
      }))
    });
  })
);

router.patch(
  '/appointments/:id/status',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      throw new ValidationError('Invalid appointment id');
    }

    const input = UpdateAppointmentStatusSchema.parse(req.body || {});

    const appointment = await withTransaction(async (connection) => {
      const current = await getAppointmentRow(connection, centerId, appointmentId, { forUpdate: true });
      if (!current) {
        throw new AppError('Appointment not found', 404, 'not_found');
      }

      if (current.status === input.status) {
        return serializeAppointmentRow(current);
      }

      await connection.query(
        `UPDATE appointments
         SET status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE center_id = ? AND id = ?`,
        [input.status, centerId, appointmentId]
      );

      if (['completed', 'cancelled', 'no_show'].includes(input.status)) {
        await releaseClaimsTx(connection, { centerId, appointmentId });
      }

      await connection.query(
        `INSERT INTO audit_logs
          (center_id, actor_type, entity_type, entity_id, action, metadata_json)
         VALUES (?, 'admin', 'appointment', ?, 'appointment_status_updated', ?)`,
        [
          centerId,
          appointmentId,
          JSON.stringify({
            previousStatus: current.status,
            nextStatus: input.status,
            note: toNullable(input.note)
          })
        ]
      );

      const updated = await getAppointmentRow(connection, centerId, appointmentId);
      return serializeAppointmentRow(updated);
    });

    res.json({ ok: true, appointment });
  })
);

router.patch(
  '/appointments/:id/reschedule',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      throw new ValidationError('Invalid appointment id');
    }

    const input = RescheduleAppointmentSchema.parse(req.body || {});

    const appointment = await withTransaction(async (connection) => {
      const current = await getAppointmentRow(connection, centerId, appointmentId, { forUpdate: true });
      if (!current) {
        throw new AppError('Appointment not found', 404, 'not_found');
      }

      if (!['pending', 'confirmed'].includes(current.status)) {
        throw new ConflictError('Only pending or confirmed appointments can be rescheduled');
      }

      const requestedStart = fromMySqlDateTime(input.startsAt);
      const requestedEnd = addMinutes(requestedStart, Number(current.duration_min));

      const sameMinute = toComparableMinute(current.starts_at) === toComparableMinute(input.startsAt);
      const sameTherapist =
        input.therapistId === undefined || input.therapistId === null
          ? true
          : Number(input.therapistId) === Number(current.therapist_id);
      const sameRoom =
        input.roomId === undefined || input.roomId === null
          ? true
          : Number(input.roomId) === Number(current.room_id);

      if (sameMinute && sameTherapist && sameRoom) {
        return serializeAppointmentRow(current);
      }

      const availability = await listAvailability(connection, {
        centerId,
        serviceId: current.service_id,
        date: toDateOnlyInAppTz(requestedStart),
        therapistId: input.therapistId ?? null,
        maxSlots: 100
      });

      const requestedMinute = toComparableMinute(input.startsAt);
      const slot = availability.slots.find((item) => toComparableMinute(item.startsAt) === requestedMinute);

      if (!slot) {
        throw new ConflictError('Requested slot is not available');
      }

      const preferredTherapistId =
        input.therapistId === undefined || input.therapistId === null
          ? Number(current.therapist_id)
          : input.therapistId;
      const preferredRoomId =
        input.roomId === undefined || input.roomId === null ? Number(current.room_id) : input.roomId;

      const candidate = pickAdminCandidate(slot, {
        therapistId: preferredTherapistId,
        roomId: preferredRoomId
      });

      if (!candidate) {
        throw new ConflictError('No therapist-room pair available for this slot');
      }

      await releaseClaimsTx(connection, { centerId, appointmentId });

      await createClaimsTx(connection, {
        centerId,
        appointmentId,
        therapistId: candidate.therapistId,
        roomId: candidate.roomId,
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
         WHERE center_id = ? AND id = ?`,
        [
          candidate.therapistId,
          candidate.roomId,
          toMySqlDateTime(requestedStart),
          toMySqlDateTime(requestedEnd),
          centerId,
          appointmentId
        ]
      );

      await connection.query(
        `INSERT INTO audit_logs
          (center_id, actor_type, entity_type, entity_id, action, metadata_json)
         VALUES (?, 'admin', 'appointment', ?, 'appointment_rescheduled_admin', ?)`,
        [
          centerId,
          appointmentId,
          JSON.stringify({
            previous: {
              therapistId: current.therapist_id,
              roomId: current.room_id,
              startsAt: current.starts_at,
              endsAt: current.ends_at
            },
            next: {
              therapistId: candidate.therapistId,
              roomId: candidate.roomId,
              startsAt: toMySqlDateTime(requestedStart),
              endsAt: toMySqlDateTime(requestedEnd)
            },
            note: toNullable(input.note)
          })
        ]
      );

      const updated = await getAppointmentRow(connection, centerId, appointmentId);
      return serializeAppointmentRow(updated);
    });

    res.json({ ok: true, appointment });
  })
);

router.get(
  '/finances/summary',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const range = resolveDateRange(req.query || {});

    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS payments_count,
         COALESCE(SUM(CASE WHEN p.status IN ('pending', 'verified') THEN p.amount_cents ELSE 0 END), 0) AS total_cents,
         COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount_cents ELSE 0 END), 0) AS pending_cents,
         COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount_cents ELSE 0 END), 0) AS verified_cents,
         COALESCE(SUM(CASE WHEN p.status = 'needs_review' THEN p.amount_cents ELSE 0 END), 0) AS review_cents,
         COALESCE(SUM(CASE WHEN p.status = 'rejected' THEN p.amount_cents ELSE 0 END), 0) AS rejected_cents
       FROM payments p
       JOIN appointments a
         ON a.center_id = p.center_id
        AND a.id = p.appointment_id
       WHERE p.center_id = ?
         AND a.starts_at >= ?
         AND a.starts_at < ?`,
      [centerId, range.fromSql, range.toSql]
    );

    const summary = rows[0] || {};

    const [therapistRows] = await pool.query(
      `SELECT
         t.id,
         t.full_name,
         t.commission_pct,
         COUNT(a.id) AS sessions,
         COALESCE(SUM(CASE WHEN p.status IN ('pending', 'verified') THEN p.amount_cents ELSE 0 END), 0) AS gross_cents
       FROM therapists t
       LEFT JOIN appointments a
         ON a.center_id = t.center_id
        AND a.therapist_id = t.id
        AND a.starts_at >= ?
        AND a.starts_at < ?
        AND a.status IN ('pending', 'confirmed', 'completed')
       LEFT JOIN payments p
         ON p.center_id = a.center_id
        AND p.appointment_id = a.id
       WHERE t.center_id = ?
         AND t.is_active = 1
       GROUP BY t.id, t.full_name, t.commission_pct
       ORDER BY gross_cents DESC, t.id ASC`,
      [range.fromSql, range.toSql, centerId]
    );

    res.json({
      ok: true,
      range,
      summary: {
        paymentsCount: Number(summary.payments_count || 0),
        totalCents: Number(summary.total_cents || 0),
        pendingCents: Number(summary.pending_cents || 0),
        verifiedCents: Number(summary.verified_cents || 0),
        reviewCents: Number(summary.review_cents || 0),
        rejectedCents: Number(summary.rejected_cents || 0)
      },
      byTherapist: therapistRows.map((row) => {
        const grossCents = Number(row.gross_cents || 0);
        const commissionPct = Number(row.commission_pct || 0);
        const therapistShareCents = Math.round(grossCents * (commissionPct / 100));

        return {
          therapistId: row.id,
          therapistName: row.full_name,
          sessions: Number(row.sessions || 0),
          commissionPct,
          grossCents,
          therapistShareCents,
          lunaShareCents: grossCents - therapistShareCents
        };
      })
    });
  })
);

router.get(
  '/finances/payments',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const query = PaymentsQuerySchema.parse(req.query || {});

    const params = [centerId];
    let statusFilter = '';
    if (query.status !== 'all') {
      statusFilter = 'AND p.status = ?';
      params.push(query.status);
    }
    params.push(query.limit);

    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.appointment_id,
         p.amount_cents,
         p.currency,
         p.status,
         p.method,
         p.created_at,
         p.updated_at,
         p.voucher_file_id,
         p.ocr_json,
         c.full_name AS client_name,
         t.full_name AS therapist_name,
         s.name AS service_name,
         a.starts_at
       FROM payments p
       JOIN appointments a ON a.id = p.appointment_id AND a.center_id = p.center_id
       JOIN clients c ON c.id = a.client_id
       JOIN therapists t ON t.id = a.therapist_id
       JOIN services s ON s.id = a.service_id
       WHERE p.center_id = ?
       ${statusFilter}
       ORDER BY p.updated_at DESC
       LIMIT ?`,
      params
    );

    res.json({ ok: true, payments: rows });
  })
);

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);

    const [[center]] = await pool.query(
      `SELECT c.id, c.slug, c.name, c.timezone, c.locale, c.status,
              cs.brand_name, cs.logo_url, cs.whatsapp_number, cs.support_whatsapp_text,
              cs.primary_color, cs.accent_color
       FROM centers c
       LEFT JOIN center_settings cs ON cs.center_id = c.id
       WHERE c.id = ?
       LIMIT 1`,
      [centerId]
    );

    if (!center) {
      throw new AppError('Center not found', 404, 'not_found');
    }

    const [services] = await pool.query(
      `SELECT id, name, duration_min, base_price_cents, currency, is_active
       FROM services
       WHERE center_id = ?
       ORDER BY is_active DESC, id ASC`,
      [centerId]
    );

    const [rooms] = await pool.query(
      `SELECT id, name, capacity, is_active
       FROM rooms
       WHERE center_id = ?
       ORDER BY is_active DESC, id ASC`,
      [centerId]
    );

    res.json({
      ok: true,
      center: {
        id: center.id,
        slug: center.slug,
        name: center.name,
        timezone: center.timezone,
        locale: center.locale,
        status: center.status,
        brandName: center.brand_name || center.name,
        logoUrl: center.logo_url || '',
        whatsappNumber: center.whatsapp_number || '',
        supportWhatsappText: center.support_whatsapp_text || '',
        primaryColor: center.primary_color || '',
        accentColor: center.accent_color || ''
      },
      services,
      rooms
    });
  })
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const input = SettingsUpdateSchema.parse(req.body || {});

    await withTransaction(async (connection) => {
      if (input.centerName !== undefined || input.timezone !== undefined || input.locale !== undefined) {
        const centerUpdates = [];
        const centerParams = [];

        if (input.centerName !== undefined) {
          centerUpdates.push('name = ?');
          centerParams.push(input.centerName);
        }

        if (input.timezone !== undefined) {
          centerUpdates.push('timezone = ?');
          centerParams.push(input.timezone);
        }

        if (input.locale !== undefined) {
          centerUpdates.push('locale = ?');
          centerParams.push(input.locale);
        }

        if (centerUpdates.length > 0) {
          centerParams.push(centerId);
          await connection.query(
            `UPDATE centers
             SET ${centerUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            centerParams
          );
        }
      }

      if (
        input.brandName !== undefined ||
        input.logoUrl !== undefined ||
        input.whatsappNumber !== undefined ||
        input.supportWhatsappText !== undefined ||
        input.primaryColor !== undefined ||
        input.accentColor !== undefined
      ) {
        await connection.query(
          `INSERT INTO center_settings
            (center_id, brand_name, logo_url, whatsapp_number, support_whatsapp_text, primary_color, accent_color)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            brand_name = VALUES(brand_name),
            logo_url = VALUES(logo_url),
            whatsapp_number = VALUES(whatsapp_number),
            support_whatsapp_text = VALUES(support_whatsapp_text),
            primary_color = VALUES(primary_color),
            accent_color = VALUES(accent_color),
            updated_at = CURRENT_TIMESTAMP`,
          [
            centerId,
            input.brandName || input.centerName || 'Centro Agenda Luna',
            toNullable(input.logoUrl),
            toNullable(input.whatsappNumber),
            toNullable(input.supportWhatsappText),
            toNullable(input.primaryColor),
            toNullable(input.accentColor)
          ]
        );
      }
    });

    const [[center]] = await pool.query(
      `SELECT c.id, c.name, c.timezone, c.locale,
              cs.brand_name, cs.logo_url, cs.whatsapp_number, cs.support_whatsapp_text,
              cs.primary_color, cs.accent_color
       FROM centers c
       LEFT JOIN center_settings cs ON cs.center_id = c.id
       WHERE c.id = ?
       LIMIT 1`,
      [centerId]
    );

    res.json({
      ok: true,
      center: {
        id: center.id,
        name: center.name,
        timezone: center.timezone,
        locale: center.locale,
        brandName: center.brand_name || center.name,
        logoUrl: center.logo_url || '',
        whatsappNumber: center.whatsapp_number || '',
        supportWhatsappText: center.support_whatsapp_text || '',
        primaryColor: center.primary_color || '',
        accentColor: center.accent_color || ''
      }
    });
  })
);

router.post(
  '/payments/:id/manual-verify',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const paymentId = Number(req.params.id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      throw new ValidationError('Invalid payment id');
    }

    const input = ManualVerifySchema.parse(req.body || {});

    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT
           p.id,
           p.center_id,
           p.appointment_id,
           p.amount_cents,
           p.currency,
           p.status,
           a.payment_status AS appointment_payment_status,
           c.full_name AS client_name
         FROM payments p
         JOIN appointments a ON a.id = p.appointment_id AND a.center_id = p.center_id
         JOIN clients c ON c.id = a.client_id
         WHERE p.center_id = ?
           AND p.id = ?
         LIMIT 1
         FOR UPDATE`,
        [centerId, paymentId]
      );

      const payment = rows[0];
      if (!payment) {
        throw new AppError('Payment not found', 404, 'not_found');
      }

      let ocr = null;
      if (input.ocrText || input.imageBase64) {
        ocr = await analyzePaymentEvidence({
          expectedAmountCents: Number(payment.amount_cents),
          ocrText: toNullable(input.ocrText),
          imageBase64: toNullable(input.imageBase64)
        });
      }

      const finalStatus = input.action || ocr?.recommendation || 'needs_review';
      const normalizedNote = toNullable(input.note);
      const reviewedAt = toMySqlDateTime(new Date());

      const ocrPayload = {
        ...(ocr || {}),
        manualAction: input.action || null,
        note: normalizedNote,
        reviewedAt,
        reviewedBy: req.user.sub || null
      };

      await connection.query(
        `UPDATE payments
         SET status = ?,
             ocr_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE center_id = ? AND id = ?`,
        [finalStatus, JSON.stringify(ocrPayload), centerId, paymentId]
      );

      await connection.query(
        `UPDATE appointments
         SET payment_status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE center_id = ? AND id = ?`,
        [finalStatus, centerId, payment.appointment_id]
      );

      await connection.query(
        `INSERT INTO audit_logs
          (center_id, actor_type, entity_type, entity_id, action, metadata_json)
         VALUES (?, 'admin', 'payment', ?, 'payment_manual_verify', ?)`,
        [
          centerId,
          paymentId,
          JSON.stringify({
            previousStatus: payment.status,
            nextStatus: finalStatus,
            note: normalizedNote,
            ocr: ocr || null
          })
        ]
      );

      return {
        paymentId,
        appointmentId: payment.appointment_id,
        previousStatus: payment.status,
        status: finalStatus,
        ocr
      };
    });

    res.json({ ok: true, payment: result });
  })
);

router.post(
  '/therapists/:id/telegram-link',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.user.centerId || 1);
    const therapistId = Number(req.params.id);
    if (!Number.isFinite(therapistId) || therapistId <= 0) {
      throw new ValidationError('Invalid therapist id');
    }

    const input = TelegramLinkSchema.parse(req.body || {});

    const response = await withTransaction(async (connection) => {
      const [therapistRows] = await connection.query(
        `SELECT id, full_name
         FROM therapists
         WHERE center_id = ? AND id = ?
         LIMIT 1
         FOR UPDATE`,
        [centerId, therapistId]
      );

      const therapist = therapistRows[0];
      if (!therapist) {
        throw new AppError('Therapist not found', 404, 'not_found');
      }

      await connection.query(
        `UPDATE telegram_links
         SET is_active = 0
         WHERE center_id = ?
           AND therapist_id = ?
           AND is_active = 1`,
        [centerId, therapistId]
      );

      const [insert] = await connection.query(
        `INSERT INTO telegram_links
          (center_id, therapist_id, telegram_user_id, telegram_username, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [centerId, therapistId, input.telegramUserId, toNullable(input.telegramUsername)]
      );

      await connection.query(
        `INSERT INTO audit_logs
          (center_id, actor_type, entity_type, entity_id, action, metadata_json)
         VALUES (?, 'admin', 'therapist', ?, 'telegram_linked', ?)`,
        [
          centerId,
          therapistId,
          JSON.stringify({
            telegramUserId: input.telegramUserId,
            telegramUsername: toNullable(input.telegramUsername)
          })
        ]
      );

      return {
        id: insert.insertId,
        therapistId,
        therapistName: therapist.full_name,
        telegramUserId: input.telegramUserId,
        telegramUsername: toNullable(input.telegramUsername)
      };
    });

    res.json({ ok: true, link: response });
  })
);

export default router;
