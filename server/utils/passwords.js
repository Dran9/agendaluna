import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function derive(password, salt, {
  cost = SCRYPT_COST,
  blockSize = SCRYPT_BLOCK_SIZE,
  parallelization = SCRYPT_PARALLELIZATION
} = {}) {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: cost,
    r: blockSize,
    p: parallelization
  });
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = derive(password, salt);

  return [
    'scrypt',
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt.toString('base64'),
    derived.toString('base64')
  ].join('$');
}

export function verifyPassword(password, encodedHash) {
  if (!password || !encodedHash) {
    return false;
  }

  const parts = String(encodedHash).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, costRaw, blockSizeRaw, parallelRaw, saltB64, hashB64] = parts;
  const cost = Number(costRaw);
  const blockSize = Number(blockSizeRaw);
  const parallelization = Number(parallelRaw);

  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelization)) {
    return false;
  }

  const salt = Buffer.from(saltB64, 'base64');
  const expectedHash = Buffer.from(hashB64, 'base64');

  if (!salt.length || !expectedHash.length) {
    return false;
  }

  const actualHash = derive(password, salt, { cost, blockSize, parallelization });

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualHash, expectedHash);
}
