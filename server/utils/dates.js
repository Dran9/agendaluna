import { env } from './env.js';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: env.APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: env.APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function ensureDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  return date;
}

function partsToMap(parts) {
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

export function toMySqlDateTime(value) {
  const date = ensureDate(value);
  const parts = partsToMap(dateTimeFormatter.formatToParts(date));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function toDateOnlyInAppTz(value) {
  const date = ensureDate(value);
  const parts = partsToMap(dateFormatter.formatToParts(date));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function fromMySqlDateTime(value) {
  if (value instanceof Date) {
    return value;
  }

  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error('Invalid MySQL datetime value');
  }

  const isoBase = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const hasOffset = /[zZ]$|[+-]\d{2}:\d{2}$/.test(isoBase);
  const withOffset = hasOffset ? isoBase : `${isoBase}${env.DB_TIMEZONE}`;

  const date = new Date(withOffset);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid MySQL datetime value');
  }

  return date;
}

export function parseDateOnlyInAppTz(dateOnly, time = '00:00:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOnly))) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  return fromMySqlDateTime(`${dateOnly} ${time}`);
}

export function addMinutes(dateValue, minutes) {
  const date = ensureDate(dateValue);
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function nowInIso() {
  return new Date().toISOString();
}
