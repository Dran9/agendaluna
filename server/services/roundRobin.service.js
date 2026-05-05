export function chooseRoundRobinTherapist({
  candidates,
  lastTherapistId = null,
  loadsByTherapist = {}
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.roundRobinOrder !== b.roundRobinOrder) {
      return a.roundRobinOrder - b.roundRobinOrder;
    }
    return a.therapistId - b.therapistId;
  });

  let startIndex = 0;
  if (lastTherapistId !== null) {
    const found = sorted.findIndex((item) => item.therapistId === lastTherapistId);
    if (found >= 0) {
      startIndex = (found + 1) % sorted.length;
    }
  }

  const rotated = [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];

  let chosen = rotated[0];
  let chosenLoad = loadsByTherapist[chosen.therapistId] ?? 0;

  for (const candidate of rotated.slice(1)) {
    const candidateLoad = loadsByTherapist[candidate.therapistId] ?? 0;
    if (candidateLoad < chosenLoad) {
      chosen = candidate;
      chosenLoad = candidateLoad;
    }
  }

  return chosen;
}

export async function getRoundRobinState(connection, centerId, serviceId) {
  const [rows] = await connection.query(
    `SELECT last_therapist_id
     FROM round_robin_state
     WHERE center_id = ? AND service_id = ?
     LIMIT 1`,
    [centerId, serviceId]
  );

  return rows[0] || { last_therapist_id: null };
}

export async function advanceRoundRobinTx(connection, { centerId, serviceId, therapistId }) {
  await connection.query(
    `INSERT INTO round_robin_state
      (center_id, service_id, last_therapist_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
      last_therapist_id = VALUES(last_therapist_id),
      updated_at = CURRENT_TIMESTAMP`,
    [centerId, serviceId, therapistId]
  );
}
