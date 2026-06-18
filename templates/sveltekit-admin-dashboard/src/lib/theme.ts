import { browser } from '$app/environment'

export type Theme = 'light' | 'dark'

/** Read the persisted theme. Defaults to dark (matches app.html). */
export function readTheme(): Theme {
  if (!browser) return 'dark'
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
}

/** Write the theme to <html data-theme> and persist it. */
export function applyTheme(theme: Theme): void {
  if (!browser) return
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* storage may be unavailable (private mode) - ignore */
  }
}
