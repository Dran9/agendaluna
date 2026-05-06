import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromMySqlDateTime,
  parseDateOnlyInAppTz,
  toDateOnlyInAppTz,
  toMySqlDateTime
} from '../server/utils/dates.js';

test('formatea DATETIME MySQL en timezone Bolivia (-04:00)', () => {
  const date = new Date('2026-01-15T15:30:00.000Z');
  assert.equal(toMySqlDateTime(date), '2026-01-15 11:30:00');
});

test('roundtrip MySQL datetime mantiene instante esperado', () => {
  const original = '2026-03-21 09:45:00';
  const parsed = fromMySqlDateTime(original);
  assert.equal(toMySqlDateTime(parsed), original);
});

test('parseDateOnlyInAppTz usa Bolivia y no UTC accidental', () => {
  const day = parseDateOnlyInAppTz('2026-05-10', '00:00:00');
  assert.equal(toDateOnlyInAppTz(day), '2026-05-10');
});
