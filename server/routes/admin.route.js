import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { authRequired, signAdminToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
const pool = getPool();

const DevTokenSchema = z.object({
  centerId: z.coerce.number().int().positive().default(1),
  email: z.string().email().default('admin@luna.local')
});

router.post(
  '/auth/dev-token',
  asyncHandler(async (req, res) => {
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

export default router;
