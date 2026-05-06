import { AppError } from '../services/errors.js';

function isDatabaseUnavailable(error) {
  if (!error) {
    return false;
  }

  const connectionCodes = new Set([
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENOTFOUND',
    'PROTOCOL_CONNECTION_LOST'
  ]);

  if (connectionCodes.has(error.code)) {
    return true;
  }

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('access denied') ||
    message.includes('connection') ||
    message.includes('connect') ||
    message.includes('database unavailable')
  );
}

export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      ok: false,
      code: error.code,
      message: error.message
    });
    return;
  }

  if (error?.name === 'ZodError') {
    res.status(400).json({
      ok: false,
      code: 'validation_error',
      message: 'Invalid request payload',
      issues: error.issues
    });
    return;
  }

  if (error?.code === 'ER_DUP_ENTRY') {
    res.status(409).json({
      ok: false,
      code: 'conflict',
      message: 'The selected slot is no longer available.'
    });
    return;
  }

  if (isDatabaseUnavailable(error)) {
    res.status(503).json({
      ok: false,
      code: 'db_unavailable',
      message: 'Database is unavailable for this request.'
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({
    ok: false,
    code: 'internal_error',
    message: 'Unexpected server error'
  });
}
