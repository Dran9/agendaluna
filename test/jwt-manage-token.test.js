import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signAdminToken,
  signManageToken,
  verifyAdminToken,
  verifyManageToken
} from '../server/utils/jwt.js';

test('manage token se firma y valida con claims esperados', () => {
  const token = signManageToken({ centerId: 1, appointmentId: 55, clientId: 77 });
  const decoded = verifyManageToken(token);

  assert.equal(decoded.centerId, 1);
  assert.equal(decoded.appointmentId, 55);
  assert.equal(decoded.clientId, 77);
});

test('verifyManageToken rechaza token admin', () => {
  const adminToken = signAdminToken({ sub: 'admin@luna.local', role: 'admin', centerId: 1 });

  assert.throws(() => verifyManageToken(adminToken));
});

test('verifyAdminToken rechaza token manage', () => {
  const manageToken = signManageToken({ centerId: 1, appointmentId: 22, clientId: 11 });

  assert.throws(() => verifyAdminToken(manageToken));
});
