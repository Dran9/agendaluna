import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { getPublicCatalog } from '../services/catalog.service.js';
import { listAvailability } from '../services/availability.service.js';
import { confirmPublicAppointment } from '../services/appointments.service.js';
import { asyncHandler } from '../utils/http.js';
import { sendBookingMessage } from '../adapters/messaging/index.js';
import { ValidationError } from '../services/errors.js';
import { buildMockAvailability, mockCatalog } from '../services/mockCatalog.service.js';

const router = Router();
const pool = getPool();

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
    let catalog = mockCatalog;

    try {
      catalog = await getPublicCatalog(pool, centerId);
    } catch {
      catalog = mockCatalog;
    }

    res.json({ ok: true, ...catalog });
  })
);

router.post(
  '/availability',
  asyncHandler(async (req, res) => {
    const input = AvailabilitySchema.parse(req.body);
    let availability;

    try {
      availability = await listAvailability(pool, {
        centerId: input.centerId,
        serviceId: input.serviceId,
        therapistId: input.therapistId ?? null,
        date: input.date
      });
    } catch {
      availability = buildMockAvailability({
        serviceId: input.serviceId,
        date: input.date,
        therapistId: input.therapistId ?? null
      });
    }

    res.json({ ok: true, ...availability });
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
    res.status(501).json({
      ok: false,
      code: 'not_implemented',
      message: 'Manage token flow will be implemented in Phase B.'
    });
  })
);

router.post(
  '/reschedule',
  asyncHandler(async (req, res) => {
    res.status(501).json({
      ok: false,
      code: 'not_implemented',
      message: 'Reschedule flow will be implemented in Phase B.'
    });
  })
);

router.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    res.status(501).json({
      ok: false,
      code: 'not_implemented',
      message: 'Cancel flow will be implemented in Phase B.'
    });
  })
);

router.post(
  '/support-request',
  asyncHandler(async (req, res) => {
    const input = SupportSchema.parse(req.body);
    let catalog = mockCatalog;
    try {
      catalog = await getPublicCatalog(pool, input.centerId);
    } catch {
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
