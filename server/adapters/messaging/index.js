import { env } from '../../utils/env.js';
import { sendMessage as sendTestOutboxMessage } from './testOutbox.adapter.js';
import { sendWhatsappLiveMessage } from './whatsappLive.adapter.js';

async function sendLogOnly(message) {
  // eslint-disable-next-line no-console
  console.log('[MESSAGING_LOG_ONLY]', message);
  return { id: `log_${Date.now()}`, ...message };
}

async function sendWhatsappLiveStub(message) {
  return sendWhatsappLiveMessage({ channel: 'whatsapp_live', ...message });
}

export async function sendBookingMessage(message) {
  if (env.MESSAGING_PROVIDER === 'test_outbox') {
    return sendTestOutboxMessage({ channel: 'test_outbox', ...message });
  }

  if (env.MESSAGING_PROVIDER === 'whatsapp_live') {
    return sendWhatsappLiveStub(message);
  }

  return sendLogOnly(message);
}
