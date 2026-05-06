import test from 'node:test';
import assert from 'node:assert/strict';
import { setupIntegrationTestDb } from './helpers/testDb.js';

function nextWorkingDate() {
  const now = new Date();
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = candidate.getUTCDay();
    if (weekday >= 1 && weekday <= 6) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  return now.toISOString().slice(0, 10);
}

async function requestJson(baseUrl, path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status,
    payload
  };
}

test('rutas admin criticas con HTTP + DB de prueba', async (t) => {
  const setup = await setupIntegrationTestDb();
  if (!setup.ok) {
    t.skip(setup.reason);
    return;
  }

  Object.assign(process.env, setup.appEnv);

  const { createApp } = await import('../server/index.js');
  const { closePool } = await import('../server/db/pool.js');

  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await requestJson(baseUrl, '/api/admin/catalog');
    assert.equal(unauthorized.status, 401);

    const loginInvalid = await requestJson(baseUrl, '/api/admin/auth/login', {
      method: 'POST',
      body: {
        centerId: setup.credentials.centerId,
        email: setup.credentials.email,
        password: 'wrong-password'
      }
    });
    assert.equal(loginInvalid.status, 401);

    const loginInactive = await requestJson(baseUrl, '/api/admin/auth/login', {
      method: 'POST',
      body: {
        centerId: setup.credentials.centerId,
        email: setup.credentials.inactiveEmail,
        password: setup.credentials.inactivePassword
      }
    });
    assert.equal(loginInactive.status, 403);

    const loginOk = await requestJson(baseUrl, '/api/admin/auth/login', {
      method: 'POST',
      body: {
        centerId: setup.credentials.centerId,
        email: setup.credentials.email,
        password: setup.credentials.password
      }
    });
    assert.equal(loginOk.status, 200);
    assert.equal(Boolean(loginOk.payload.token), true);

    const token = loginOk.payload.token;

    const clientA = await requestJson(baseUrl, '/api/admin/clients', {
      method: 'POST',
      token,
      body: {
        fullName: 'Cliente Uno',
        whatsappPhone: '59171110001',
        email: 'cliente1@test.local'
      }
    });
    assert.equal(clientA.status, 201);

    const clientB = await requestJson(baseUrl, '/api/admin/clients', {
      method: 'POST',
      token,
      body: {
        fullName: 'Cliente Dos',
        whatsappPhone: '59171110002',
        email: 'cliente2@test.local'
      }
    });
    assert.equal(clientB.status, 201);

    const therapistA = await requestJson(baseUrl, '/api/admin/therapists', {
      method: 'POST',
      token,
      body: {
        fullName: 'Terapeuta A',
        commissionPct: 60,
        isActive: true
      }
    });
    assert.equal(therapistA.status, 201);

    const therapistB = await requestJson(baseUrl, '/api/admin/therapists', {
      method: 'POST',
      token,
      body: {
        fullName: 'Terapeuta B',
        commissionPct: 55,
        isActive: true
      }
    });
    assert.equal(therapistB.status, 201);

    const workingSchedule = [
      { weekday: 1, startTime: '08:00', endTime: '18:00', isActive: true },
      { weekday: 2, startTime: '08:00', endTime: '18:00', isActive: true },
      { weekday: 3, startTime: '08:00', endTime: '18:00', isActive: true },
      { weekday: 4, startTime: '08:00', endTime: '18:00', isActive: true },
      { weekday: 5, startTime: '08:00', endTime: '18:00', isActive: true },
      { weekday: 6, startTime: '08:00', endTime: '18:00', isActive: true }
    ];

    const therapistASchedule = await requestJson(
      baseUrl,
      `/api/admin/therapists/${therapistA.payload.therapist.id}/schedule`,
      {
        method: 'PUT',
        token,
        body: { entries: workingSchedule }
      }
    );
    assert.equal(therapistASchedule.status, 200);

    const therapistBSchedule = await requestJson(
      baseUrl,
      `/api/admin/therapists/${therapistB.payload.therapist.id}/schedule`,
      {
        method: 'PUT',
        token,
        body: { entries: workingSchedule }
      }
    );
    assert.equal(therapistBSchedule.status, 200);

    const service = await requestJson(baseUrl, '/api/admin/services', {
      method: 'POST',
      token,
      body: {
        name: 'Terapia Integral',
        durationMin: 60,
        basePriceCents: 16000,
        currency: 'BOB',
        isActive: true
      }
    });
    assert.equal(service.status, 201);

    const assignServiceA = await requestJson(
      baseUrl,
      `/api/admin/therapists/${therapistA.payload.therapist.id}/services`,
      {
        method: 'PUT',
        token,
        body: { serviceIds: [service.payload.service.id] }
      }
    );
    assert.equal(assignServiceA.status, 200);

    const assignServiceB = await requestJson(
      baseUrl,
      `/api/admin/therapists/${therapistB.payload.therapist.id}/services`,
      {
        method: 'PUT',
        token,
        body: { serviceIds: [service.payload.service.id] }
      }
    );
    assert.equal(assignServiceB.status, 200);

    const roomA = await requestJson(baseUrl, '/api/admin/rooms', {
      method: 'POST',
      token,
      body: {
        name: 'Sala A',
        capacity: 1,
        isActive: true
      }
    });
    assert.equal(roomA.status, 201);

    const [[roomScheduleCount]] = await setup.assertionPool.query(
      `SELECT COUNT(*) AS total
       FROM resource_schedules
       WHERE center_id = 1
         AND resource_type = 'room'
         AND resource_id = ?
         AND weekday IN (1,2,3,4,5,6)
         AND start_time = '08:00:00'
         AND end_time = '18:00:00'
         AND is_active = 1`,
      [roomA.payload.room.id]
    );
    assert.equal(Number(roomScheduleCount.total || 0), 6);

    const roomB = await requestJson(baseUrl, '/api/admin/rooms', {
      method: 'POST',
      token,
      body: {
        name: 'Sala B',
        capacity: 1,
        isActive: true
      }
    });
    assert.equal(roomB.status, 201);

    const availability = await requestJson(baseUrl, '/api/admin/availability', {
      method: 'POST',
      token,
      body: {
        serviceId: service.payload.service.id,
        date: nextWorkingDate(),
        therapistId: therapistA.payload.therapist.id
      }
    });
    assert.equal(availability.status, 200);
    assert.equal(Array.isArray(availability.payload.slots), true);
    assert.equal(availability.payload.slots.length > 0, true);

    const firstSlot = availability.payload.slots[0];

    const appointmentOne = await requestJson(baseUrl, '/api/admin/appointments', {
      method: 'POST',
      token,
      body: {
        clientId: clientA.payload.client.id,
        serviceId: service.payload.service.id,
        therapistId: therapistA.payload.therapist.id,
        startsAt: firstSlot.startsAt
      }
    });
    assert.equal(appointmentOne.status, 201);

    const appointmentConflict = await requestJson(baseUrl, '/api/admin/appointments', {
      method: 'POST',
      token,
      body: {
        clientId: clientB.payload.client.id,
        serviceId: service.payload.service.id,
        therapistId: therapistA.payload.therapist.id,
        startsAt: firstSlot.startsAt
      }
    });
    assert.equal(appointmentConflict.status, 409);

    const selfExclusionReschedule = await requestJson(
      baseUrl,
      `/api/admin/appointments/${appointmentOne.payload.appointment.id}/reschedule`,
      {
        method: 'PATCH',
        token,
        body: {
          startsAt: appointmentOne.payload.appointment.startsAt,
          therapistId: therapistA.payload.therapist.id,
          roomId: roomB.payload.room.id,
          note: 'Mover de sala sin cambiar hora'
        }
      }
    );
    assert.equal(selfExclusionReschedule.status, 200);
    assert.equal(selfExclusionReschedule.payload.appointment.room.id, roomB.payload.room.id);

    const appointmentTwo = await requestJson(baseUrl, '/api/admin/appointments', {
      method: 'POST',
      token,
      body: {
        clientId: clientB.payload.client.id,
        serviceId: service.payload.service.id,
        therapistId: therapistB.payload.therapist.id,
        startsAt: firstSlot.startsAt
      }
    });
    assert.equal(appointmentTwo.status, 201);

    const realConflictReschedule = await requestJson(
      baseUrl,
      `/api/admin/appointments/${appointmentOne.payload.appointment.id}/reschedule`,
      {
        method: 'PATCH',
        token,
        body: {
          startsAt: appointmentOne.payload.appointment.startsAt,
          therapistId: therapistB.payload.therapist.id,
          roomId: roomB.payload.room.id,
          note: 'Debe fallar por conflicto real de terapeuta'
        }
      }
    );
    assert.equal(realConflictReschedule.status, 409);

    const statusCompleted = await requestJson(
      baseUrl,
      `/api/admin/appointments/${appointmentOne.payload.appointment.id}/status`,
      {
        method: 'PATCH',
        token,
        body: { status: 'completed', note: 'Sesión completada' }
      }
    );
    assert.equal(statusCompleted.status, 200);
    assert.equal(statusCompleted.payload.appointment.status, 'completed');

    const [[claimsAfterComplete]] = await setup.assertionPool.query(
      `SELECT COUNT(*) AS total
       FROM appointment_resource_claims
       WHERE center_id = 1
         AND appointment_id = ?`,
      [appointmentOne.payload.appointment.id]
    );
    assert.equal(Number(claimsAfterComplete.total || 0), 0);

    const [[auditCount]] = await setup.assertionPool.query(
      `SELECT COUNT(*) AS total
       FROM audit_logs
       WHERE center_id = 1
         AND entity_type = 'appointment'
         AND entity_id = ?
         AND action = 'appointment_status_updated'`,
      [appointmentOne.payload.appointment.id]
    );
    assert.equal(Number(auditCount.total || 0) >= 1, true);

    const statusReactivation = await requestJson(
      baseUrl,
      `/api/admin/appointments/${appointmentOne.payload.appointment.id}/status`,
      {
        method: 'PATCH',
        token,
        body: { status: 'confirmed', note: 'No debe reactivar terminal' }
      }
    );
    assert.equal(statusReactivation.status, 409);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
    await setup.cleanup();
  }
});
