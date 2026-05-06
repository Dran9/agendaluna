import jwt from 'jsonwebtoken';
import { env } from './env.js';

export function signAdminToken(payload) {
  return jwt.sign({ ...payload, tokenType: 'admin' }, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyAdminToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (decoded?.tokenType !== 'admin') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function signManageToken(payload) {
  return jwt.sign({ ...payload, tokenType: 'booking_manage' }, env.JWT_SECRET, {
    expiresIn: '45m'
  });
}

export function verifyManageToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (decoded?.tokenType !== 'booking_manage') {
    throw new Error('Invalid token type');
  }
  return decoded;
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
