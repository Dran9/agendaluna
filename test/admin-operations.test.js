import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createClaimsInMemory,
  createMemoryClaimsStore,
  releaseClaimsInMemory
} from '../server/services/claims.service.js'
import { ConflictError, ValidationError } from '../server/services/errors.js'

function createStore() {
  return {
    nextIds: {
      client: 1,
      therapist: 1,
      service: 1,
      room: 1,
      appointment: 1
    },
    clients: [],
    therapists: [],
    therapistServices: [],
    therapistSchedules: [],
    services: [],
    rooms: [],
    appointments: [],
    auditLogs: [],
    claims: createMemoryClaimsStore()
  }
}

function createClient(store, input) {
  const client = {
    id: store.nextIds.client++,
    fullName: input.fullName,
    whatsappPhone: input.whatsappPhone,
    email: input.email || null,
    notes: input.notes || null
  }
  store.clients.push(client)
  return client
}

function updateClient(store, clientId, patch) {
  const client = store.clients.find((item) => item.id === clientId)
  if (!client) {
    throw new ValidationError('Client not found')
  }
  Object.assign(client, patch)
  return client
}

function createTherapist(store, input) {
  const therapist = {
    id: store.nextIds.therapist++,
    fullName: input.fullName,
    commissionPct: Number(input.commissionPct),
    isActive: input.isActive !== false
  }
  store.therapists.push(therapist)
  return therapist
}

function updateTherapist(store, therapistId, patch) {
  const therapist = store.therapists.find((item) => item.id === therapistId)
  if (!therapist) {
    throw new ValidationError('Therapist not found')
  }
  Object.assign(therapist, patch)
  return therapist
}

function setTherapistServices(store, therapistId, serviceIds) {
  for (const relation of store.therapistServices) {
    if (relation.therapistId === therapistId) {
      relation.isActive = false
    }
  }

  for (const [index, serviceId] of serviceIds.entries()) {
    const existing = store.therapistServices.find(
      (item) => item.therapistId === therapistId && item.serviceId === serviceId
    )

    if (existing) {
      existing.isActive = true
      existing.roundRobinOrder = index + 1
      continue
    }

    store.therapistServices.push({
      therapistId,
      serviceId,
      roundRobinOrder: index + 1,
      isActive: true
    })
  }
}

function saveTherapistSchedule(store, therapistId, entries) {
  for (const entry of entries) {
    if (entry.endTime <= entry.startTime) {
      throw new ValidationError('Schedule endTime must be after startTime')
    }
  }
  store.therapistSchedules = store.therapistSchedules.filter((item) => item.therapistId !== therapistId)
  for (const entry of entries) {
    store.therapistSchedules.push({ therapistId, ...entry })
  }
  return store.therapistSchedules.filter((item) => item.therapistId === therapistId)
}

function createService(store, input) {
  const service = {
    id: store.nextIds.service++,
    name: input.name,
    durationMin: Number(input.durationMin),
    basePriceCents: Number(input.basePriceCents),
    currency: input.currency,
    isActive: input.isActive !== false
  }
  store.services.push(service)
  return service
}

function updateService(store, serviceId, patch) {
  const service = store.services.find((item) => item.id === serviceId)
  if (!service) {
    throw new ValidationError('Service not found')
  }
  Object.assign(service, patch)
  return service
}

function createRoom(store, input) {
  const room = {
    id: store.nextIds.room++,
    name: input.name,
    capacity: Number(input.capacity),
    isActive: input.isActive !== false
  }
  store.rooms.push(room)
  return room
}

function updateRoom(store, roomId, patch) {
  const room = store.rooms.find((item) => item.id === roomId)
  if (!room) {
    throw new ValidationError('Room not found')
  }
  Object.assign(room, patch)
  return room
}

function createAdminAppointment(store, payload) {
  const service = store.services.find((item) => item.id === payload.serviceId && item.isActive)
  if (!service) {
    throw new ValidationError('Service is inactive or not found')
  }

  const therapist = store.therapists.find((item) => item.id === payload.therapistId && item.isActive)
  if (!therapist) {
    throw new ValidationError('Therapist is inactive or not found')
  }

  const room = store.rooms.find((item) => item.id === payload.roomId && item.isActive)
  if (!room) {
    throw new ValidationError('Room is inactive or not found')
  }

  const startsAt = new Date(payload.startsAt)
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60 * 1000)
  const appointmentId = store.nextIds.appointment++

  createClaimsInMemory(store.claims, {
    centerId: 1,
    appointmentId,
    therapistId: therapist.id,
    roomId: room.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString()
  })

  const appointment = {
    id: appointmentId,
    clientId: payload.clientId,
    serviceId: service.id,
    therapistId: therapist.id,
    roomId: room.id,
    status: 'confirmed',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString()
  }

  store.appointments.push(appointment)
  return appointment
}

function updateAppointmentStatus(store, appointmentId, nextStatus) {
  const appointment = store.appointments.find((item) => item.id === appointmentId)
  if (!appointment) {
    throw new ValidationError('Appointment not found')
  }

  const previousStatus = appointment.status
  appointment.status = nextStatus

  if (['completed', 'cancelled', 'no_show'].includes(nextStatus)) {
    releaseClaimsInMemory(store.claims, appointmentId)
  }

  store.auditLogs.push({
    entityType: 'appointment',
    entityId: appointmentId,
    action: 'appointment_status_updated',
    metadata: {
      previousStatus,
      nextStatus
    }
  })

  return appointment
}

test('crear/editar cliente', () => {
  const store = createStore()
  const client = createClient(store, {
    fullName: 'Lucia Ramos',
    whatsappPhone: '59170001001',
    email: 'lucia@test.local'
  })

  assert.equal(client.fullName, 'Lucia Ramos')

  const updated = updateClient(store, client.id, {
    notes: 'Prefiere horario de tarde'
  })
  assert.equal(updated.notes, 'Prefiere horario de tarde')
})

test('crear/editar terapeuta', () => {
  const store = createStore()
  const therapist = createTherapist(store, {
    fullName: 'Carl Jung',
    commissionPct: 60
  })
  assert.equal(therapist.commissionPct, 60)

  const updated = updateTherapist(store, therapist.id, {
    commissionPct: 55,
    isActive: false
  })

  assert.equal(updated.commissionPct, 55)
  assert.equal(updated.isActive, false)
})

test('asignar servicios a terapeuta', () => {
  const store = createStore()
  const therapist = createTherapist(store, { fullName: 'Alfred Adler', commissionPct: 50 })
  const serviceA = createService(store, {
    name: 'Terapia A',
    durationMin: 60,
    basePriceCents: 10000,
    currency: 'BOB'
  })
  const serviceB = createService(store, {
    name: 'Terapia B',
    durationMin: 60,
    basePriceCents: 12000,
    currency: 'BOB'
  })

  setTherapistServices(store, therapist.id, [serviceA.id, serviceB.id])
  const active = store.therapistServices.filter((item) => item.therapistId === therapist.id && item.isActive)

  assert.equal(active.length, 2)
  assert.equal(active[0].roundRobinOrder, 1)
  assert.equal(active[1].roundRobinOrder, 2)
})

test('guardar horario semanal de terapeuta', () => {
  const store = createStore()
  const therapist = createTherapist(store, { fullName: 'Ivan Pavlov', commissionPct: 52 })
  const schedule = saveTherapistSchedule(store, therapist.id, [
    { weekday: 1, startTime: '08:00:00', endTime: '12:00:00', isActive: true },
    { weekday: 3, startTime: '14:00:00', endTime: '18:00:00', isActive: true }
  ])

  assert.equal(schedule.length, 2)
  assert.equal(schedule[0].weekday, 1)
  assert.equal(schedule[1].weekday, 3)
})

test('crear/editar servicio', () => {
  const store = createStore()
  const service = createService(store, {
    name: 'Terapia Integrativa',
    durationMin: 75,
    basePriceCents: 18000,
    currency: 'BOB'
  })

  const updated = updateService(store, service.id, {
    basePriceCents: 19000,
    isActive: false
  })

  assert.equal(updated.basePriceCents, 19000)
  assert.equal(updated.isActive, false)
})

test('crear/editar sala', () => {
  const store = createStore()
  const room = createRoom(store, {
    name: 'Sala Cielo',
    capacity: 1
  })

  const updated = updateRoom(store, room.id, {
    name: 'Sala Cielo Norte',
    isActive: false
  })

  assert.equal(updated.name, 'Sala Cielo Norte')
  assert.equal(updated.isActive, false)
})

test('crear cita admin sin doble reserva', () => {
  const store = createStore()
  const client = createClient(store, { fullName: 'Paula', whatsappPhone: '59170001003' })
  const service = createService(store, {
    name: 'Terapia 60',
    durationMin: 60,
    basePriceCents: 15000,
    currency: 'BOB'
  })
  const therapistA = createTherapist(store, { fullName: 'Terap A', commissionPct: 60 })
  const therapistB = createTherapist(store, { fullName: 'Terap B', commissionPct: 60 })
  const roomA = createRoom(store, { name: 'Sala A', capacity: 1 })
  const roomB = createRoom(store, { name: 'Sala B', capacity: 1 })

  const startsAt = '2026-05-08T14:00:00.000Z'

  const first = createAdminAppointment(store, {
    clientId: client.id,
    serviceId: service.id,
    therapistId: therapistA.id,
    roomId: roomA.id,
    startsAt
  })

  const second = createAdminAppointment(store, {
    clientId: client.id,
    serviceId: service.id,
    therapistId: therapistB.id,
    roomId: roomB.id,
    startsAt
  })

  assert.equal(first.id, 1)
  assert.equal(second.id, 2)
})

test('rechazar cita admin si terapeuta o sala ya estan tomados', () => {
  const store = createStore()
  const client = createClient(store, { fullName: 'Mateo', whatsappPhone: '59170001002' })
  const service = createService(store, {
    name: 'Terapia 60',
    durationMin: 60,
    basePriceCents: 15000,
    currency: 'BOB'
  })
  const therapistA = createTherapist(store, { fullName: 'Terap A', commissionPct: 60 })
  const therapistB = createTherapist(store, { fullName: 'Terap B', commissionPct: 60 })
  const roomA = createRoom(store, { name: 'Sala A', capacity: 1 })
  const roomB = createRoom(store, { name: 'Sala B', capacity: 1 })

  const startsAt = '2026-05-08T16:00:00.000Z'

  createAdminAppointment(store, {
    clientId: client.id,
    serviceId: service.id,
    therapistId: therapistA.id,
    roomId: roomA.id,
    startsAt
  })

  assert.throws(
    () =>
      createAdminAppointment(store, {
        clientId: client.id,
        serviceId: service.id,
        therapistId: therapistA.id,
        roomId: roomB.id,
        startsAt
      }),
    (error) => error instanceof ConflictError
  )

  assert.throws(
    () =>
      createAdminAppointment(store, {
        clientId: client.id,
        serviceId: service.id,
        therapistId: therapistB.id,
        roomId: roomA.id,
        startsAt
      }),
    (error) => error instanceof ConflictError
  )
})

test('cambiar estado de cita y registrar audit log', () => {
  const store = createStore()
  const client = createClient(store, { fullName: 'Camila', whatsappPhone: '59170001005' })
  const service = createService(store, {
    name: 'Terapia 60',
    durationMin: 60,
    basePriceCents: 15000,
    currency: 'BOB'
  })
  const therapist = createTherapist(store, { fullName: 'Terap A', commissionPct: 60 })
  const room = createRoom(store, { name: 'Sala A', capacity: 1 })

  const appointment = createAdminAppointment(store, {
    clientId: client.id,
    serviceId: service.id,
    therapistId: therapist.id,
    roomId: room.id,
    startsAt: '2026-05-08T18:00:00.000Z'
  })

  const updated = updateAppointmentStatus(store, appointment.id, 'completed')

  assert.equal(updated.status, 'completed')
  assert.equal(store.auditLogs.length, 1)
  assert.equal(store.auditLogs[0].action, 'appointment_status_updated')
  assert.deepEqual(store.auditLogs[0].metadata, {
    previousStatus: 'confirmed',
    nextStatus: 'completed'
  })
})
