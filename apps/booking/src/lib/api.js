const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const normalizedBase = configuredBase.endsWith('/')
  ? configuredBase.slice(0, -1)
  : configuredBase;

export function apiUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error('API path must start with /');
  }

  return normalizedBase ? `${normalizedBase}${path}` : path;
}
