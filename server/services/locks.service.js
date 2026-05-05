import { ConflictError } from './errors.js';

export async function acquireLock(connection, lockKey, timeoutSeconds = 2) {
  const [rows] = await connection.query('SELECT GET_LOCK(?, ?) AS lock_acquired', [
    lockKey,
    timeoutSeconds
  ]);

  if (!rows[0] || rows[0].lock_acquired !== 1) {
    throw new ConflictError('Could not acquire booking lock');
  }
}

export async function releaseLock(connection, lockKey) {
  await connection.query('SELECT RELEASE_LOCK(?)', [lockKey]);
}

export async function withLock(connection, lockKey, callback, timeoutSeconds = 2) {
  await acquireLock(connection, lockKey, timeoutSeconds);
  try {
    return await callback();
  } finally {
    await releaseLock(connection, lockKey);
  }
}
