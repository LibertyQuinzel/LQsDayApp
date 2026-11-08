import { useEffect } from 'react';
import type { ThemePreference } from './state';

// Mirrored here so index.html can apply the theme before the saved state finishes loading.
export const THEME_STORAGE_KEY = 'myday:theme';

const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(preference: ThemePreference) {
  const resolved = preference === 'system' ? (systemDarkQuery.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
}

export function useTheme(preference: ThemePreference | undefined) {
  useEffect(() => {
    if (!preference) return;

    applyTheme(preference);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Only costs a flash of the default theme on next launch.
    }

    if (preference !== 'system') return;
    const onSystemChange = () => applyTheme('system');
    systemDarkQuery.addEventListener('change', onSystemChange);
    return () => systemDarkQuery.removeEventListener('change', onSystemChange);
  }, [preference]);
}
