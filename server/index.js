import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { env } from './utils/env.js';
import healthRoutes from './routes/health.route.js';
import publicRoutes from './routes/public.route.js';
import adminRoutes from './routes/admin.route.js';
import { errorMiddleware } from './utils/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: ['http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/admin', adminRoutes);

  const adminDist = path.join(rootDir, 'dist', 'admin');
  const bookingDist = path.join(rootDir, 'dist', 'booking');

  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.get('/admin/*', (req, res) => {
      res.sendFile(path.join(adminDist, 'index.html'));
    });
  }

  if (fs.existsSync(bookingDist)) {
    app.use('/', express.static(bookingDist));
    app.use('/booking', express.static(bookingDist));
    app.get(['/booking/*', '*'], (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      const acceptsHtml = req.accepts(['html', 'json', 'text']) === 'html';
      if (!acceptsHtml) {
        next();
        return;
      }
      res.sendFile(path.join(bookingDist, 'index.html'));
    });
  }

  app.use(errorMiddleware);
  return app;
}

export const app = createApp();

function shouldStartServer() {
  if (env.NODE_ENV === 'test') {
    return false;
  }

  const mainArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return mainArg === __filename;
}

if (shouldStartServer()) {
  app.listen(env.PORT, env.HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Agenda Luna API running on http://${env.HOST}:${env.PORT}`);
  });
}
