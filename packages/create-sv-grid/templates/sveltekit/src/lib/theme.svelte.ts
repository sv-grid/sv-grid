/**
 * Runtime theme switching.
 *
 * `@svgrid/grid/themes` ships 20 presets and a `resolveThemeTokens(preset, mode)`
 * helper that returns the `--sg-*` custom properties for a given preset and
 * light/dark mode. Writing those onto `<html>` re-themes the grid live - there
 * is nothing to rebuild and no stylesheet to swap.
 *
 * `app.css` imports one preset as a stylesheet so the very first paint (and the
 * server-rendered HTML) already has a theme before any JS runs. The values set
 * here override it once the user picks something.
 */
import {
  getThemePreset,
  resolveThemeTokens,
  themePresets,
  type ThemeMode,
} from '@svgrid/grid/themes'

/** Every preset, for the picker. */
export const presets = themePresets.map((p) => ({ id: p.id, name: p.name }))

const STORAGE_KEY = 'svgrid-theme'

// `npm create @svgrid@latest -- --theme <id> [--dark|--light]` patches the two
// values between these markers so the scaffolded app starts on the theme you
// asked for. INITIAL_MODE is only the fallback: a saved choice wins over it, and
// so does the OS preference when nobody has pinned a mode. The inline script in
// `app.html` settles the same question before the first paint.
/* svgrid-initial-theme:start */
export const INITIAL_THEME = 'tailwind'
export const INITIAL_MODE: ThemeMode = 'light'
/* svgrid-initial-theme:end */

type Saved = { id: string; mode: ThemeMode }

function restore(): Saved {
  const fallback: Saved = { id: INITIAL_THEME, mode: INITIAL_MODE }
  if (typeof document === 'undefined') return fallback
  // Trust whatever app.html's inline script settled on, so the picker agrees
  // with what is already on screen.
  const painted = document.documentElement.dataset.theme
  if (painted === 'dark' || painted === 'light') fallback.mode = painted
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null
    if (!saved || typeof saved.id !== 'string') return fallback
    if (!getThemePreset(saved.id)) return fallback
    return { id: saved.id, mode: saved.mode === 'dark' ? 'dark' : 'light' }
  } catch {
    return fallback
  }
}

class ThemeState {
  #initial = restore()
  id = $state(this.#initial.id)
  mode = $state<ThemeMode>(this.#initial.mode)

  /** Push the current selection onto <html> as CSS custom properties. */
  apply() {
    if (typeof document === 'undefined') return
    const tokens = resolveThemeTokens(getThemePreset(this.id) ?? getThemePreset(INITIAL_THEME)!, this.mode)
    const root = document.documentElement
    for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value)
    // Lets the browser theme form controls and scrollbars to match, and keeps
    // any `[data-theme='dark']` rules in your own CSS in step.
    root.style.colorScheme = this.mode
    root.dataset.theme = this.mode
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: this.id, mode: this.mode }))
    } catch {
      // Private mode, quota, a blocked origin - not worth breaking the page over.
    }
  }

  set(id: string, mode: ThemeMode = this.mode) {
    this.id = id
    this.mode = mode
    this.apply()
  }

  toggleMode() {
    this.set(this.id, this.mode === 'dark' ? 'light' : 'dark')
  }
}

export const theme = new ThemeState()
