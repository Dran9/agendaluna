import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../server/utils/env.js';
import { findSlotCandidates } from '../server/services/availability.service.js';

function buildFakeConnection({ therapistSchedules = [], roomSchedules = [] } = {}) {
  return {
    async query(sql, params) {
      if (sql.includes('FROM services')) {
        return [[{ id: 1, name: 'Terapia', duration_min: 60, base_price_cents: 12000, currency: 'BOB' }]];
      }

      if (sql.includes('FROM therapists t')) {
        return [[{ id: 11, full_name: 'Terapeuta Uno', round_robin_order: 1 }]];
      }

      if (sql.includes('FROM rooms r')) {
        return [[{ id: 21, name: 'Sala A' }]];
      }

      if (sql.includes('FROM resource_schedules')) {
        const resourceType = params[1];
        if (resourceType === 'therapist') {
          return [therapistSchedules];
        }
        return [roomSchedules];
      }

      if (
        sql.includes('FROM resource_blocks') ||
        sql.includes('FROM appointment_resource_claims') ||
        sql.includes('FROM appointments')
      ) {
        return [[]];
      }

      throw new Error(`Unexpected SQL in fake connection: ${sql}`);
    }
  };
}

test('sin resource_schedule no hay disponibilidad cuando fallback demo esta deshabilitado', async () => {
  const previousFlag = env.ENABLE_DEMO_SCHEDULE_FALLBACK;
  env.ENABLE_DEMO_SCHEDULE_FALLBACK = false;

  try {
    const connection = buildFakeConnection();
    const result = await findSlotCandidates(connection, {
      centerId: 1,
      serviceId: 1,
      slotStart: '2026-05-10T10:00:00-04:00'
    });

    assert.equal(result.candidates.length, 0);
  } finally {
    env.ENABLE_DEMO_SCHEDULE_FALLBACK = previousFlag;
  }
});

test('con flag demo habilitado, fallback 9-18 permite disponibilidad', async () => {
  const previousFlag = env.ENABLE_DEMO_SCHEDULE_FALLBACK;
  env.ENABLE_DEMO_SCHEDULE_FALLBACK = true;

  try {
    const connection = buildFakeConnection();
    const result = await findSlotCandidates(connection, {
      centerId: 1,
      serviceId: 1,
      slotStart: '2026-05-10T10:00:00-04:00'
    });

    assert.equal(result.candidates.length, 1);
  } finally {
    env.ENABLE_DEMO_SCHEDULE_FALLBACK = previousFlag;
  }
});

test('con horarios configurados la disponibilidad aparece sin fallback demo', async () => {
  const previousFlag = env.ENABLE_DEMO_SCHEDULE_FALLBACK;
  env.ENABLE_DEMO_SCHEDULE_FALLBACK = false;

  try {
    const connection = buildFakeConnection({
      therapistSchedules: [{ resource_id: 11, start_time: '08:00:00', end_time: '18:00:00' }],
      roomSchedules: [{ resource_id: 21, start_time: '08:00:00', end_time: '18:00:00' }]
    });

    const result = await findSlotCandidates(connection, {
      centerId: 1,
      serviceId: 1,
      slotStart: '2026-05-10T10:00:00-04:00'
    });

    assert.equal(result.candidates.length, 1);
  } finally {
    env.ENABLE_DEMO_SCHEDULE_FALLBACK = previousFlag;
  }
});
