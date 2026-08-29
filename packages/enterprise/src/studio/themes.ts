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
 * drive the browser preview and every emitted output - `app.css` for the full
 * app and the fragment, the `<svelte:head>` of the CLI `add` scaffolds - via
 * `themeTokenCss` below, the single place the token CSS is built.
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

/** Resolve the `--sg-*` tokens for a project theme in an EXPLICIT mode (for the
 *  generated app's light/dark switcher, which ships both token sets). */
export function resolveThemeTokensFor(theme: ProjectTheme | undefined, mode: 'light' | 'dark'): Record<string, string> {
  const preset = getStudioTheme(theme?.preset) ?? defaultStudioTheme
  return resolveTokens(preset, mode, theme?.accent)
}

/**
 * The `--sg-*` token rules for a project theme, as CSS text. `:root` carries
 * the mode picked in Studio (what the server-rendered page shows before
 * hydration), and both palettes are scoped by `[data-theme]` on `<html>` for
 * the generated app's light/dark switcher. An explicit accent override is
 * applied to both. No theme -> the default preset, so every output is themed.
 *
 * `layer` wraps the rules in a cascade layer. Use it for drop-in outputs (the
 * fragment, `svgrid-studio add`): layered declarations lose to unlayered ones,
 * so a host app that already defines its own `--sg-*` tokens keeps winning.
 */
export function themeTokenCss(theme?: ProjectTheme, opts: { layer?: string } = {}): string {
  const decl = (m: Record<string, string>) => Object.entries(m).map(([k, v]) => `  ${k}: ${v};`).join('\n')
  const mode: ThemeMode = isDarkTheme(theme) ? 'dark' : 'light'
  const light = resolveThemeTokensFor(theme, 'light')
  const dark = resolveThemeTokensFor(theme, 'dark')
  const rules = [
    `:root {\n${decl(mode === 'dark' ? dark : light)}\n  color-scheme: ${mode};\n}`,
    `:root[data-theme="light"] {\n${decl(light)}\n  color-scheme: light;\n}`,
    `:root[data-theme="dark"] {\n${decl(dark)}\n  color-scheme: dark;\n}`,
  ].join('\n')
  return opts.layer ? `@layer ${opts.layer} {\n${rules}\n}` : rules
}

/** An inline `style` string (`--sg-x: y; ...; color-scheme; font-family`) for previews. */
export function themeStyleString(theme?: ProjectTheme): string {
  const tokens = resolveThemeTokens(theme)
  const vars = Object.entries(tokens).map(([k, v]) => `${k}: ${v}`).join('; ')
  return `${vars}; color-scheme: ${isDarkTheme(theme) ? 'dark' : 'light'}; font-family: ${tokens['--sg-font']}`
}
