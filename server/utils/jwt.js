import jwt from 'jsonwebtoken';
import { env } from './env.js';

export function signAdminToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyAdminToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    res.status(401).json({ ok: false, code: 'unauthorized', message: 'Missing token' });
    return;
  }

  try {
    req.user = verifyAdminToken(token);
    next();
  } catch (error) {
    res.status(401).json({ ok: false, code: 'unauthorized', message: 'Invalid token' });
  }
}
