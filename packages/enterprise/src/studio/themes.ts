/**
 * The Studio look-and-feel themes: a `ProjectTheme`-aware wrapper around
 * `@svgrid/grid`'s built-in design-system presets (shadcn/ui, Tailwind,
 * Material 3, Excel, Fluent 2, ...) - the single source of truth for these
 * tokens, also used directly (as plain CSS) by app code that isn't going
 * through Studio's project model.
 *
 * Picking a preset (and a light/dark mode) restyles the WHOLE generated app -
 * shell, grids, charts, KPIs, forms - not just the accent.
 *
 * Pure + node-safe (studio subtree): plain data + helpers, so the same tokens
 * drive the browser preview and the emitted `+layout.svelte` / `app.css`.
 */
import {
  themePresets,
  defaultThemePreset,
  getThemePreset,
  resolveThemeTokens as resolveTokens,
  type ThemeMode,
  type ThemePalette,
  type ThemePreset,
} from '@svgrid/grid/themes'
import type { ProjectTheme } from './project.js'

export type { ThemeMode, ThemePalette }

/** @deprecated Use `ThemePreset` from `@svgrid/grid/themes` - kept as an alias for the pre-existing public name. */
export type StudioTheme = ThemePreset

/** The built-in Studio themes, in gallery order (default first). */
export const studioThemes: StudioTheme[] = themePresets

/** The default theme (used when a project has no `preset`). */
export const defaultStudioTheme: StudioTheme = defaultThemePreset

/** Look up a theme by id. */
export const getStudioTheme = (id?: string): StudioTheme | undefined => getThemePreset(id)

/** True when the project's theme is rendering in dark mode. */
export const isDarkTheme = (theme?: ProjectTheme): boolean => theme?.mode === 'dark'

/** Resolve the effective `--sg-*` tokens for a project theme: the chosen preset
 *  (default if none) in the chosen mode, with the accent override applied. */
export function resolveThemeTokens(theme?: ProjectTheme): Record<string, string> {
  const preset = getStudioTheme(theme?.preset) ?? defaultStudioTheme
  const mode: ThemeMode = theme?.mode === 'dark' ? 'dark' : 'light'
  return resolveTokens(preset, mode, theme?.accent)
}

/** An inline `style` string (`--sg-x: y; ...; color-scheme; font-family`) for previews. */
export function themeStyleString(theme?: ProjectTheme): string {
  const tokens = resolveThemeTokens(theme)
  const vars = Object.entries(tokens).map(([k, v]) => `${k}: ${v}`).join('; ')
  return `${vars}; color-scheme: ${isDarkTheme(theme) ? 'dark' : 'light'}; font-family: ${tokens['--sg-font']}`
}
