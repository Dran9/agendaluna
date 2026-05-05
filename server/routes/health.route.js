import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'agenda-luna-api',
    uptimeSeconds: Math.round(process.uptime()),
    now: new Date().toISOString()
  });
});

export default router;
