const STORAGE_KEY = 'agenda-luna-theme';

export function readTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'dark' || value === 'light') {
      return value;
    }
  } catch {
    // ignore localStorage access issues
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore localStorage access issues
  }
}
