export async function notifyTherapistTelegram(payload) {
  return {
    ok: true,
    mode: 'stub',
    delivered: false,
    payload
  };
}
