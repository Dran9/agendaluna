import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClaimsInMemory,
  createMemoryClaimsStore,
  releaseClaimsInMemory
} from '../server/services/claims.service.js';
import { ConflictError } from '../server/services/errors.js';

const basePayload = {
  centerId: 1,
  startsAt: '2026-05-06T10:00:00.000Z',
  endsAt: '2026-05-06T11:00:00.000Z'
};

test('no permite doble reserva del terapeuta en el mismo minuto', () => {
  const store = createMemoryClaimsStore();

  createClaimsInMemory(store, {
    ...basePayload,
    appointmentId: 101,
    therapistId: 10,
    roomId: 20
  });

  assert.throws(
    () =>
      createClaimsInMemory(store, {
        ...basePayload,
        appointmentId: 102,
        therapistId: 10,
        roomId: 21
      }),
    (error) => error instanceof ConflictError
  );
});

test('no permite doble reserva de sala en el mismo minuto', () => {
  const store = createMemoryClaimsStore();

  createClaimsInMemory(store, {
    ...basePayload,
    appointmentId: 201,
    therapistId: 11,
    roomId: 30
  });

  assert.throws(
    () =>
      createClaimsInMemory(store, {
        ...basePayload,
        appointmentId: 202,
        therapistId: 12,
        roomId: 30
      }),
    (error) => error instanceof ConflictError
  );
});

test('permite citas simultaneas cuando terapeuta y sala son distintos', () => {
  const store = createMemoryClaimsStore();

  createClaimsInMemory(store, {
    ...basePayload,
    appointmentId: 301,
    therapistId: 13,
    roomId: 40
  });

  assert.doesNotThrow(() => {
    createClaimsInMemory(store, {
      ...basePayload,
      appointmentId: 302,
      therapistId: 14,
      roomId: 41
    });
  });
});

test('liberar claims permite reservar nuevamente el mismo slot', () => {
  const store = createMemoryClaimsStore();

  createClaimsInMemory(store, {
    ...basePayload,
    appointmentId: 401,
    therapistId: 15,
    roomId: 50
  });

  releaseClaimsInMemory(store, 401);

  assert.doesNotThrow(() => {
    createClaimsInMemory(store, {
      ...basePayload,
      appointmentId: 402,
      therapistId: 15,
      roomId: 50
    });
  });
});
