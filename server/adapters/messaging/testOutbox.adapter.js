import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outboxFile = path.join(__dirname, 'test-outbox.log');

export async function sendMessage(message) {
  const entry = {
    id: `outbox_${Date.now()}`,
    ...message,
    createdAt: new Date().toISOString()
  };

  await fs.appendFile(outboxFile, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}
