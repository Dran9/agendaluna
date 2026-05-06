import { Router } from 'express';
import { z } from 'zod';
import { getPool, withTransaction } from '../db/pool.js';
import { authRequired, signAdminToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/http.js';
import { env } from '../utils/env.js';
import { AppError, ValidationError } from '../services/errors.js';
import { analyzePaymentEvidence } from '../services/paymentsReview.service.js';
import { toMySqlDateTime } from '../utils/dates.js';

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

function toNullable(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
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
