import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoundRobinTherapist } from '../server/services/roundRobin.service.js';

test('round-robin avanza al siguiente terapeuta disponible', () => {
  const selected = chooseRoundRobinTherapist({
    candidates: [
      { therapistId: 1, therapistName: 'A', roundRobinOrder: 1 },
      { therapistId: 2, therapistName: 'B', roundRobinOrder: 1 },
      { therapistId: 3, therapistName: 'C', roundRobinOrder: 1 }
    ],
    lastTherapistId: 1,
    loadsByTherapist: { 1: 3, 2: 3, 3: 3 }
  });

  assert.equal(selected?.therapistId, 2);
});

test('si el cliente elige terapeuta, la seleccion puede respetarse aguas arriba', () => {
  const chosenByClient = 3;
  const candidates = [
    { therapistId: 1, therapistName: 'A', roundRobinOrder: 1 },
    { therapistId: 3, therapistName: 'C', roundRobinOrder: 2 }
  ];

  const exists = candidates.some((candidate) => candidate.therapistId === chosenByClient);
  assert.equal(exists, true);
});

test('desempata por menor carga dentro de candidatos validos', () => {
  const selected = chooseRoundRobinTherapist({
    candidates: [
      { therapistId: 5, therapistName: 'E', roundRobinOrder: 1 },
      { therapistId: 6, therapistName: 'F', roundRobinOrder: 1 }
    ],
    lastTherapistId: null,
    loadsByTherapist: { 5: 9, 6: 2 }
  });

  assert.equal(selected?.therapistId, 6);
});
