export const API_BASE_URL = process.env.AGENDA_LUNA_API_URL || 'http://127.0.0.1:3000';

export function publicApi(path) {
  return `${API_BASE_URL}/api/public${path}`;
}

export function adminApi(path) {
  return `${API_BASE_URL}/api/admin${path}`;
}
