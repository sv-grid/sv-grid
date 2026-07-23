/**
 * SvGrid's built-in design-system theme presets (shadcn/ui, Tailwind, Material 3,
 * Excel, Fluent 2, ...). Each preset carries an explicit light + dark palette;
 * resolving one (plus a light/dark mode) yields the full `--sg-*` token set that
 * restyles the whole grid - not just the accent.
 *
 * Pure, framework-agnostic data + helpers - safe to import from Node or the
 * browser. `@svgrid/enterprise`'s Studio layer builds its `ProjectTheme`-aware
 * wrapper on top of this module instead of keeping its own copy.
 */

export type ThemeMode = 'light' | 'dark'

/** The core palette for one mode. */
export type ThemePalette = {
  bg: string; fg: string; muted: string; border: string
  headerBg: string; headerFg: string; accent: string
  rowAlt: string; rowHover: string; selectionBg: string
}

export type ThemePreset = {
  /** Stable id, e.g. used as a CSS file name (`themes/<id>.css`). */
  id: string
  /** Display name shown on a theme picker. */
  name: string
  /** Control corner rounding (px). */
  radius: number
  /** Font stack applied to the app surface. */
  font: string
  light: ThemePalette
  dark: ThemePalette
}

/** The built-in theme presets, in gallery order (default first). */
export const themePresets: ThemePreset[] = [
  { id: 'shadcn', name: 'shadcn/ui', radius: 6, font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    light: { bg: '#ffffff', fg: '#09090b', muted: '#71717a', border: '#e4e4e7', headerBg: '#fafafa', headerFg: '#71717a', accent: '#18181b', rowAlt: '#ffffff', rowHover: '#f4f4f5', selectionBg: '#f4f4f5' },
    dark: { bg: '#0a0a0a', fg: '#fafafa', muted: '#a1a1aa', border: '#27272a', headerBg: '#18181b', headerFg: '#a1a1aa', accent: '#fafafa', rowAlt: '#0a0a0a', rowHover: '#18181b', selectionBg: '#27272a' } },
  { id: 'tailwind', name: 'Tailwind', radius: 6, font: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    light: { bg: '#ffffff', fg: '#0f172a', muted: '#64748b', border: '#e2e8f0', headerBg: '#f8fafc', headerFg: '#0f172a', accent: '#4f46e5', rowAlt: '#ffffff', rowHover: '#f1f5f9', selectionBg: '#e0e7ff' },
    dark: { bg: '#0f172a', fg: '#f8fafc', muted: '#94a3b8', border: '#334155', headerBg: '#1e293b', headerFg: '#f8fafc', accent: '#818cf8', rowAlt: '#0f172a', rowHover: '#1e293b', selectionBg: '#312e81' } },
  { id: 'material', name: 'Material 3', radius: 8, font: '"Roboto Flex", Roboto, "Segoe UI", system-ui, sans-serif',
    light: { bg: '#fef7ff', fg: '#1d1b20', muted: '#49454f', border: '#cac4d0', headerBg: '#f3edf7', headerFg: '#1d1b20', accent: '#6750a4', rowAlt: '#fffbfe', rowHover: '#ece6f0', selectionBg: '#e8def8' },
    dark: { bg: '#141218', fg: '#e6e0e9', muted: '#cac4d0', border: '#49454f', headerBg: '#211f26', headerFg: '#e6e0e9', accent: '#d0bcff', rowAlt: '#141218', rowHover: '#2b2930', selectionBg: '#4a4458' } },
  { id: 'excel', name: 'Excel', radius: 0, font: '"Aptos", "Segoe UI", Calibri, Arial, sans-serif',
    light: { bg: '#ffffff', fg: '#323130', muted: '#605e5c', border: '#d2d0ce', headerBg: '#f3f2f1', headerFg: '#444444', accent: '#107c41', rowAlt: '#ffffff', rowHover: '#edebe9', selectionBg: 'rgba(16, 124, 65, 0.10)' },
    dark: { bg: '#1b1a19', fg: '#f3f2f1', muted: '#c8c6c4', border: '#3b3a39', headerBg: '#252423', headerFg: '#c8c6c4', accent: '#58c188', rowAlt: '#1b1a19', rowHover: '#323130', selectionBg: 'rgba(88, 193, 136, 0.16)' } },
  { id: 'fluent', name: 'Fluent 2', radius: 4, font: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    light: { bg: '#ffffff', fg: '#242424', muted: '#616161', border: '#e0e0e0', headerBg: '#f5f5f5', headerFg: '#242424', accent: '#0f6cbd', rowAlt: '#fafafa', rowHover: '#f0f0f0', selectionBg: '#ebebeb' },
    dark: { bg: '#1f1f1f', fg: '#ffffff', muted: '#d6d6d6', border: '#666666', headerBg: '#141414', headerFg: '#ffffff', accent: '#479ef5', rowAlt: '#1a1a1a', rowHover: '#3d3d3d', selectionBg: '#383838' } },
  { id: 'carbon', name: 'Carbon', radius: 0, font: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif',
    light: { bg: '#ffffff', fg: '#161616', muted: '#525252', border: '#e0e0e0', headerBg: '#e0e0e0', headerFg: '#161616', accent: '#0f62fe', rowAlt: '#f4f4f4', rowHover: '#e8e8e8', selectionBg: '#d0e2ff' },
    dark: { bg: '#161616', fg: '#f4f4f4', muted: '#c6c6c6', border: '#393939', headerBg: '#393939', headerFg: '#f4f4f4', accent: '#78a9ff', rowAlt: '#262626', rowHover: '#333333', selectionBg: '#393939' } },
  { id: 'sap', name: 'SAP Fiori', radius: 6, font: '"72", "72full", "Arial", sans-serif',
    light: { bg: '#f5f6f7', fg: '#131e29', muted: '#556b82', border: '#e5e5e5', headerBg: '#ffffff', headerFg: '#131e29', accent: '#0070f2', rowAlt: '#f5f6f7', rowHover: '#eaecee', selectionBg: '#ebf8ff' },
    dark: { bg: '#12171c', fg: '#f5f6f7', muted: '#8396a8', border: '#2e3742', headerBg: '#1d232a', headerFg: '#f5f6f7', accent: '#4db1ff', rowAlt: '#12171c', rowHover: '#222b35', selectionBg: '#1d2d3e' } },
  { id: 'salesforce', name: 'Salesforce', radius: 4, font: '"Salesforce Sans", "SF Pro", Helvetica, Arial, sans-serif',
    light: { bg: '#ffffff', fg: '#181818', muted: '#757575', border: '#c9c9c9', headerBg: '#f3f3f3', headerFg: '#181818', accent: '#0176d3', rowAlt: '#ffffff', rowHover: '#f3f3f3', selectionBg: '#ecebea' },
    dark: { bg: '#181818', fg: '#ffffff', muted: '#c9c9c9', border: '#3e3e3c', headerBg: '#2e2e2e', headerFg: '#ffffff', accent: '#1b96ff', rowAlt: '#181818', rowHover: '#2e2e2e', selectionBg: '#1e4d8e' } },
  { id: 'atlassian', name: 'Atlassian', radius: 3, font: '"Charlie Display", "Atlassian Sans", -apple-system, "Segoe UI", sans-serif',
    light: { bg: '#ffffff', fg: '#172b4d', muted: '#44546f', border: '#dcdfe4', headerBg: '#fafbfc', headerFg: '#44546f', accent: '#0c66e4', rowAlt: '#ffffff', rowHover: '#f1f2f4', selectionBg: '#e9f2ff' },
    dark: { bg: '#1d2125', fg: '#b6c2cf', muted: '#8590a2', border: '#38414a', headerBg: '#22272b', headerFg: '#8590a2', accent: '#579dff', rowAlt: '#1d2125', rowHover: '#2c333a', selectionBg: '#09326c' } },
  { id: 'github', name: 'GitHub', radius: 6, font: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    light: { bg: '#ffffff', fg: '#1f2328', muted: '#59636e', border: '#d1d9e0', headerBg: '#f6f8fa', headerFg: '#59636e', accent: '#0969da', rowAlt: '#ffffff', rowHover: '#f6f8fa', selectionBg: '#ddf4ff' },
    dark: { bg: '#0d1117', fg: '#f0f6fc', muted: '#9198a1', border: '#3d444d', headerBg: '#151b23', headerFg: '#9198a1', accent: '#4493f8', rowAlt: '#0d1117', rowHover: '#151b23', selectionBg: 'rgba(56, 139, 253, 0.10)' } },
  { id: 'antd', name: 'Ant Design', radius: 6, font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif',
    light: { bg: '#ffffff', fg: 'rgba(0, 0, 0, 0.88)', muted: 'rgba(0, 0, 0, 0.65)', border: '#d9d9d9', headerBg: '#fafafa', headerFg: 'rgba(0, 0, 0, 0.88)', accent: '#1677ff', rowAlt: '#ffffff', rowHover: '#f5f5f5', selectionBg: '#e6f4ff' },
    dark: { bg: '#141414', fg: 'rgba(255, 255, 255, 0.85)', muted: 'rgba(255, 255, 255, 0.65)', border: '#424242', headerBg: '#1f1f1f', headerFg: 'rgba(255, 255, 255, 0.85)', accent: '#177ddc', rowAlt: '#141414', rowHover: '#262626', selectionBg: '#111a2c' } },
  { id: 'ag-alpine', name: 'Alpine', radius: 3, font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    light: { bg: '#ffffff', fg: '#181d1f', muted: 'rgba(24, 29, 31, 0.5)', border: '#babfc7', headerBg: '#f8f8f8', headerFg: '#181d1f', accent: '#2196f3', rowAlt: '#fcfcfc', rowHover: 'rgba(33, 150, 243, 0.1)', selectionBg: 'rgba(33, 150, 243, 0.3)' },
    dark: { bg: '#181d1f', fg: '#ffffff', muted: 'rgba(255, 255, 255, 0.5)', border: '#68686e', headerBg: '#222628', headerFg: '#ffffff', accent: '#2196f3', rowAlt: '#222628', rowHover: 'rgba(33, 150, 243, 0.1)', selectionBg: 'rgba(33, 150, 243, 0.3)' } },
  { id: 'bootstrap', name: 'Bootstrap 5', radius: 6, font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    light: { bg: '#ffffff', fg: '#212529', muted: '#6c757d', border: '#dee2e6', headerBg: '#f8f9fa', headerFg: '#212529', accent: '#0d6efd', rowAlt: '#fcfcfd', rowHover: '#f2f2f2', selectionBg: '#cfe2ff' },
    dark: { bg: '#212529', fg: '#dee2e6', muted: '#adb5bd', border: '#495057', headerBg: '#2b3035', headerFg: '#dee2e6', accent: '#0d6efd', rowAlt: '#25292e', rowHover: '#2c3034', selectionBg: '#031633' } },
  { id: 'vercel', name: 'Vercel', radius: 6, font: '"Geist", "Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    light: { bg: '#ffffff', fg: '#000000', muted: '#666666', border: '#eaeaea', headerBg: '#fafafa', headerFg: '#666666', accent: '#0070f3', rowAlt: '#fafafa', rowHover: '#f5f5f5', selectionBg: '#e8f0fe' },
    dark: { bg: '#000000', fg: '#ffffff', muted: '#888888', border: '#333333', headerBg: '#111111', headerFg: '#888888', accent: '#3291ff', rowAlt: '#0a0a0a', rowHover: '#1a1a1a', selectionBg: '#0d2847' } },
  { id: 'linear', name: 'Linear', radius: 6, font: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    light: { bg: '#ffffff', fg: '#282a30', muted: '#6b6f76', border: '#e9e9eb', headerBg: '#f7f8f8', headerFg: '#6b6f76', accent: '#5e6ad2', rowAlt: '#fbfbfc', rowHover: '#f4f4f5', selectionBg: '#e8eafd' },
    dark: { bg: '#08090a', fg: '#f7f8f8', muted: '#8a8f98', border: '#23252a', headerBg: '#0f1011', headerFg: '#8a8f98', accent: '#5e6ad2', rowAlt: '#0f1011', rowHover: '#1a1b1e', selectionBg: '#2a2d4a' } },
  { id: 'notion', name: 'Notion', radius: 4, font: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    light: { bg: '#ffffff', fg: '#37352f', muted: '#787774', border: '#e9e9e7', headerBg: '#f7f6f3', headerFg: '#787774', accent: '#2383e2', rowAlt: '#fbfbfa', rowHover: '#f1f1ef', selectionBg: '#d9eaf7' },
    dark: { bg: '#191919', fg: '#d4d4d4', muted: '#9b9b9b', border: '#2f2f2f', headerBg: '#202020', headerFg: '#9b9b9b', accent: '#529cca', rowAlt: '#1c1c1c', rowHover: '#252525', selectionBg: '#20415c' } },
  { id: 'nord', name: 'Nord', radius: 4, font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    light: { bg: '#eceff4', fg: '#2e3440', muted: '#4c566a', border: '#d8dee9', headerBg: '#e5e9f0', headerFg: '#2e3440', accent: '#5e81ac', rowAlt: '#e5e9f0', rowHover: '#dde3ec', selectionBg: '#d8dee9' },
    dark: { bg: '#2e3440', fg: '#d8dee9', muted: '#4c566a', border: '#434c5e', headerBg: '#3b4252', headerFg: '#e5e9f0', accent: '#88c0d0', rowAlt: '#333b48', rowHover: '#3b4252', selectionBg: '#434c5e' } },
  { id: 'dracula', name: 'Dracula', radius: 6, font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    light: { bg: '#fffbeb', fg: '#1f1f1f', muted: '#6c664b', border: '#dedccf', headerBg: '#ece9df', headerFg: '#1f1f1f', accent: '#644ac9', rowAlt: '#fffdf5', rowHover: '#f2efe3', selectionBg: '#cfcfde' },
    dark: { bg: '#282a36', fg: '#f8f8f2', muted: '#6272a4', border: '#44475a', headerBg: '#21222c', headerFg: '#f8f8f2', accent: '#bd93f9', rowAlt: '#2d2f3b', rowHover: '#343746', selectionBg: '#44475a' } },
  { id: 'catppuccin', name: 'Catppuccin', radius: 8, font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    light: { bg: '#eff1f5', fg: '#4c4f69', muted: '#6c6f85', border: '#ccd0da', headerBg: '#e6e9ef', headerFg: '#4c4f69', accent: '#8839ef', rowAlt: '#e6e9ef', rowHover: '#dce0e8', selectionBg: '#dce0e8' },
    dark: { bg: '#1e1e2e', fg: '#cdd6f4', muted: '#a6adc8', border: '#313244', headerBg: '#181825', headerFg: '#cdd6f4', accent: '#cba6f7', rowAlt: '#1a1a28', rowHover: '#313244', selectionBg: '#45475a' } },
]

/** The default preset (used when nothing is chosen). */
export const defaultThemePreset: ThemePreset = themePresets.find((t) => t.id === 'tailwind') ?? themePresets[0]!

/** Look up a preset by id. */
export const getThemePreset = (id?: string): ThemePreset | undefined =>
  id ? themePresets.find((t) => t.id === id) : undefined

/** A readable (near-black / white) foreground for text placed on the accent. */
function onAccent(accent: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(accent.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1]!, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  // Perceived luminance (sRGB, quick approximation).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#18181b' : '#ffffff'
}

/** Resolve the effective `--sg-*` tokens for a preset in a given mode, with an
 *  optional accent override applied. */
export function resolveThemeTokens(preset: ThemePreset | undefined, mode: ThemeMode, accentOverride?: string): Record<string, string> {
  const resolved = preset ?? defaultThemePreset
  const p = resolved[mode]
  const accent = accentOverride || p.accent
  return {
    '--sg-bg': p.bg,
    '--sg-fg': p.fg,
    '--sg-muted': p.muted,
    '--sg-border': p.border,
    '--sg-header-bg': p.headerBg,
    '--sg-header-fg': p.headerFg,
    // A subtle inset surface (used by e.g. the master-detail region behind the
    // nested grid). Themed so it isn't a fixed light grey on dark presets.
    '--sg-bg-subtle': p.headerBg,
    '--sg-row-alt-bg': p.rowAlt,
    '--sg-row-hover-bg': p.rowHover,
    '--sg-selection-bg': p.selectionBg,
    // Inputs/checkboxes: pin to the theme's own surface so they never borrow the
    // host page's input tokens (which is how a themed grid ended up with dark
    // checkboxes on a light page when the host mode differed).
    '--sg-input-bg': p.bg,
    '--sg-input-border': p.border,
    '--sg-accent': accent,
    '--sg-on-accent': onAccent(accent),
    '--sg-radius': `${resolved.radius}px`,
    '--sg-font': resolved.font,
    // The grid's custom scrollbar is a shadow-DOM web component that reads its
    // OWN --sg-scrollbar-* tokens (with fixed light-mode fallbacks). Without
    // these it ignores the theme entirely - a light scrollbar left on a dark
    // grid. CSS custom properties pierce shadow DOM, so defining them here (on
    // the themed container) reaches the scrollbar. Derive them from the palette
    // so the scrollbar tracks the preset + light/dark mode like everything else.
    '--sg-scrollbar-bg': p.headerBg,
    '--sg-scrollbar-border': p.border,
    '--sg-scrollbar-thumb': p.muted,
    '--sg-scrollbar-thumb-hover': p.fg,
    '--sg-scrollbar-thumb-active': p.fg,
    '--sg-scrollbar-arrow': p.muted,
    '--sg-scrollbar-arrow-hover': p.fg,
    '--sg-scrollbar-arrow-hover-bg': p.rowHover,
    '--sg-scrollbar-arrow-active': p.fg,
    '--sg-scrollbar-arrow-active-bg': p.selectionBg,
    '--sg-scrollbar-arrow-disabled': p.border,
  }
}
