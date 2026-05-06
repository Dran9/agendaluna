import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { env } from '../utils/env.js';
import { getPublicCatalog } from '../services/catalog.service.js';
import { listAvailability } from '../services/availability.service.js';
import { confirmPublicAppointment } from '../services/appointments.service.js';
import {
  cancelPublicAppointment,
  createPublicManageToken,
  reschedulePublicAppointment
} from '../services/manageAppointment.service.js';
import { asyncHandler } from '../utils/http.js';
import { sendBookingMessage } from '../adapters/messaging/index.js';
import { AppError, ValidationError } from '../services/errors.js';
import { buildMockAvailability, mockCatalog } from '../services/mockCatalog.service.js';

const router = Router();
const pool = getPool();

function isDatabaseError(error) {
  if (!error) {
    return false;
  }

  if (typeof error.code === 'string' && error.code.startsWith('ER_')) {
    return true;
  }

  if (typeof error.errno === 'number') {
    return true;
  }

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('connection') ||
    message.includes('econn') ||
    message.includes('database') ||
    message.includes('pool') ||
    message.includes('query')
  );
}

function canUseMockFallback() {
  return env.NODE_ENV === 'development' && env.ENABLE_MOCK_FALLBACK;
}

function handleDatabaseFailure(scope, error) {
  if (canUseMockFallback()) {
    // eslint-disable-next-line no-console
    console.warn(`[MOCK_FALLBACK_ENABLED] ${scope}: ${error.message}`);
    return null;
  }

  throw new AppError(
    `Database unavailable while processing ${scope}. Enable ENABLE_MOCK_FALLBACK=true only for local development if needed.`,
    503,
    'db_unavailable'
  );
}

const AvailabilitySchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  serviceId: z.coerce.number().int().positive(),
  therapistId: z.coerce.number().int().positive().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const IdentifySchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  fullName: z.string().min(2).max(140),
  whatsappPhone: z.string().min(7).max(40)
});

const ConfirmSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  serviceId: z.coerce.number().int().positive(),
  therapistId: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().min(8).max(120).optional(),
  client: z.object({
    fullName: z.string().min(2).max(140),
    whatsappPhone: z.string().min(7).max(40)
  })
});

const ManageTokenSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  appointmentId: z.coerce.number().int().positive(),
  whatsappPhone: z.string().min(7).max(40)
});

const RescheduleSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  appointmentId: z.coerce.number().int().positive(),
  manageToken: z.string().min(20),
  startsAt: z.string().datetime({ offset: true }),
  therapistId: z.coerce.number().int().positive().nullable().optional()
});

const CancelSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  appointmentId: z.coerce.number().int().positive(),
  manageToken: z.string().min(20),
  reason: z.string().max(400).optional()
});

const SupportSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  whatsappPhone: z.string().min(7).max(40).optional(),
  name: z.string().min(2).max(140).optional(),
  message: z.string().max(500).optional()
});

router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    const centerId = Number(req.query.centerId || 1);
    let usedMockFallback = false;
    let catalog;
    try {
      catalog = await getPublicCatalog(pool, centerId);
    } catch (error) {
      if (!isDatabaseError(error)) {
        throw error;
      }
      handleDatabaseFailure('public catalog', error);
      catalog = mockCatalog;
      usedMockFallback = true;
    }

    res.json({ ok: true, mockFallbackUsed: usedMockFallback, ...catalog });
  })
);

router.post(
  '/availability',
  asyncHandler(async (req, res) => {
    const input = AvailabilitySchema.parse(req.body);
    let usedMockFallback = false;
    let availability;

    try {
      availability = await listAvailability(pool, {
        centerId: input.centerId,
        serviceId: input.serviceId,
        therapistId: input.therapistId ?? null,
        date: input.date
      });
    } catch (error) {
      if (!isDatabaseError(error)) {
        throw error;
      }
      handleDatabaseFailure('public availability', error);
      availability = buildMockAvailability({
        serviceId: input.serviceId,
        date: input.date,
        therapistId: input.therapistId ?? null
      });
      usedMockFallback = true;
    }

    res.json({ ok: true, mockFallbackUsed: usedMockFallback, ...availability });
  })
);

router.post(
  '/identify',
  asyncHandler(async (req, res) => {
    const input = IdentifySchema.parse(req.body);

    await pool.query(
      `INSERT INTO clients (center_id, full_name, whatsapp_phone)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        updated_at = CURRENT_TIMESTAMP`,
      [input.centerId, input.fullName, input.whatsappPhone]
    );

    res.json({
      ok: true,
      manageTokenHint: crypto
        .createHash('sha1')
        .update(`${input.centerId}:${input.whatsappPhone}`)
        .digest('hex')
        .slice(0, 12)
    });
  })
);

router.post(
  '/hold',
  asyncHandler(async (req, res) => {
    const input = ConfirmSchema.parse(req.body);

    const holdId = crypto
      .createHash('sha1')
      .update(`${input.centerId}:${input.serviceId}:${input.startsAt}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);

    res.json({
      ok: true,
      hold: {
        id: holdId,
        expiresInSeconds: 120,
        note: 'v1 hold is advisory; final guarantee is the DB claim insert in /confirm.'
      }
    });
  })
);

router.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    const input = ConfirmSchema.parse(req.body);
    const result = await confirmPublicAppointment(input);

    await sendBookingMessage({
      kind: 'booking_confirmed',
      centerId: input.centerId,
      appointment: result.appointment,
      whatsappPhone: input.client.whatsappPhone
    });

    res.json(result);
  })
);

router.post(
  '/manage-token',
  asyncHandler(async (req, res) => {
    const input = ManageTokenSchema.parse(req.body || {});
    const result = await createPublicManageToken(input);
    res.json(result);
  })
);

router.post(
  '/reschedule',
  asyncHandler(async (req, res) => {
    const input = RescheduleSchema.parse(req.body || {});
    const result = await reschedulePublicAppointment({
      centerId: input.centerId,
      appointmentId: input.appointmentId,
      manageToken: input.manageToken,
      startsAt: input.startsAt,
      therapistId: input.therapistId ?? null
    });

    await sendBookingMessage({
      kind: 'booking_rescheduled',
      centerId: input.centerId,
      appointment: result.appointment
    });

    res.json(result);
  })
);

router.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const input = CancelSchema.parse(req.body || {});
    const result = await cancelPublicAppointment(input);

    await sendBookingMessage({
      kind: 'booking_cancelled',
      centerId: input.centerId,
      appointment: result.appointment,
      reason: input.reason || null
    });

    res.json(result);
  })
);

router.post(
  '/support-request',
  asyncHandler(async (req, res) => {
    const input = SupportSchema.parse(req.body);
    let catalog;
    try {
      catalog = await getPublicCatalog(pool, input.centerId);
    } catch (error) {
      if (!isDatabaseError(error)) {
        throw error;
      }
      handleDatabaseFailure('support request catalog', error);
      catalog = mockCatalog;
    }

    const baseText =
      input.message ||
      catalog.center.supportWhatsappText ||
      'Hola, quisiera orientacion para elegir una terapia en Luna Mandala.';

    const url = `https://wa.me/${catalog.center.whatsappNumber || ''}?text=${encodeURIComponent(baseText)}`;

    await sendBookingMessage({
      kind: 'support_request',
      centerId: input.centerId,
      whatsappPhone: input.whatsappPhone || null,
      name: input.name || null,
      message: baseText
    });

    res.json({
      ok: true,
      whatsappUrl: url,
      prefilledText: baseText
    });
  })
);

router.use((error, req, res, next) => {
  if (error instanceof TypeError && error.message.includes('fetch failed')) {
    next(new ValidationError('Upstream service unavailable'));
    return;
  }
  next(error);
});

export default router;
