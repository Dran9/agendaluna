export async function sendWhatsappLiveMessage(message) {
  return {
    id: `wh_live_stub_${Date.now()}`,
    delivered: false,
    message
  };
}
