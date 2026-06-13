// Shared blog "card" generator: the 1200x630 branded hero / social image for a
// blog post. Used in two places so dev and prod render identical images:
//
//   - tools/prerender-site.mjs writes a .svg (+ rasterized .png) per post into
//     dist/og/blog/ at build time.
//   - website/vite.config.ts mounts a dev-only middleware that serves the same
//     /og/blog/<slug>.{svg,png} on the fly, so the images show under `vite dev`
//     without committing any binaries.
//
// Keep this dependency-light: only node builtins, plus an optional lazy
// @resvg/resvg-js (resolved from the website package) for PNG rasterization.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const F = 'Inter, system-ui, sans-serif'

export function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Wrap a string into at most `maxLines` lines of ~`maxChars` chars, ellipsizing
// the last line if the title overflows. Used to lay out arbitrary post titles.
export function wrapTitle(text, maxChars = 26, maxLines = 3) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) { cur = w; continue }
    if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s,.;:]+$/, '') + '…'
    return kept
  }
  return lines
}

// Brand tokens (dark surface), kept in step with website/src/index.css and the
// SvGrid mark in website/src/components/Logo.svelte.
const ACCENT = '#fb7a3c' // --site-accent (dark): brand orange
const ACCENT_2 = '#fbbf24' // --site-accent-2 (dark): amber eyebrow
const INK = '#e7edf5' // grid-cell ink on the dark plate
const TITLE = '#f3f6fb'
const MUTED = '#9aa6c2'

// The SvGrid mark - the data-grid glyph from Logo.svelte's 'plate' variant,
// drawn on a 24-unit grid: a segmented header, a wide label column plus two
// value columns over three rows, and the rightmost "sorted" column highlighted
// in brand orange with a sort caret. Returned as a <g> the caller positions.
function svgridMark() {
  const COLS = [{ x: 4, w: 6 }, { x: 11, w: 4 }, { x: 16, w: 4 }]
  const ROWS = [9, 13, 17]
  const ac = COLS[2]
  const cx = ac.x + ac.w / 2
  let cells = ''
  for (const c of COLS) cells += `<rect x="${c.x}" y="4" width="${c.w}" height="4" rx="1.2" fill="${INK}" opacity="0.95"/>`
  cells += `<path d="M${cx - 1.1} 5.4 L${cx + 1.1} 5.4 L${cx} 6.9 Z" fill="${ACCENT}"/>`
  for (const ry of ROWS) {
    COLS.forEach((c, ci) => {
      const active = ci === 2
      cells += `<rect x="${c.x}" y="${ry}" width="${c.w}" height="3" rx="0.9" fill="${active ? ACCENT : INK}" opacity="${active ? 1 : 0.32}"/>`
    })
  }
  return `<rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="#111a2e"/><rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="none" stroke="rgba(148,163,184,0.30)" stroke-width="1"/>${cells}`
}

// ---- grid-illustration card ------------------------------------------------
// Instead of a title card, each post shows a realistic SvGrid mockup whose
// details change per feature: a sort caret + tinted column, a filter row,
// inline-edit cell, group bands, virtualized rows, a pivot cross-tab, etc.
// The feature is detected from the post's slug / tags / category.

const GRID = {
  bg: '#1b212e', header: '#232c3b', alt: '#202736',
  border: 'rgba(148,163,184,0.20)', line: 'rgba(148,163,184,0.10)',
  ink: '#c8d2e0', headInk: '#eef2f8', muted: '#8b97ab',
}
const ACCENT_SOFT = 'rgba(251,122,60,0.14)'
const GREEN = '#34d399'
const RED = '#f87171'

function rr(x, y, w, h, r, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra ? ' ' + extra : ''}/>`
}
function tx(x, y, s, o = {}) {
  const { size = 22, fill = GRID.ink, weight = 500, anchor = 'start', ls = 0 } = o
  return `<text x="${x}" y="${y}" font-family="${F}" font-weight="${weight}" font-size="${size}" fill="${fill}" letter-spacing="${ls}" text-anchor="${anchor}">${escapeAttr(s)}</text>`
}

const FEATURES = [
  [['pivot'], 'pivot', 'PIVOT TABLES'],
  [['virtual', '100,000', '100k', 'performance', 'large data', 'runes'], 'virtual', 'PERFORMANCE'],
  [['filter'], 'filter', 'FILTERING'],
  [['sort'], 'sort', 'SORTING'],
  [['edit', 'validation', 'optimistic'], 'edit', 'INLINE EDITING'],
  [['group', 'aggreg'], 'group', 'GROUPING'],
  [['tree', 'master', 'detail', 'hierarch', 'expand'], 'tree', 'TREE & DETAIL'],
  [['select', 'copy', 'clipboard', 'range', 'bulk'], 'select', 'SELECTION'],
  [['pin', 'frozen'], 'pinned', 'PINNED COLUMNS'],
  [['export', 'excel', 'csv', 'pdf', 'print', 'import'], 'export', 'EXPORT'],
  [['theme', 'dark', 'css'], 'theme', 'THEMING'],
  [['realtime', 'websocket', 'live'], 'realtime', 'REAL-TIME'],
  [['paginat', 'cursor', 'infinite'], 'paginate', 'PAGINATION'],
  [['server'], 'server', 'SERVER-SIDE'],
  [['format', 'locale', 'currency'], 'format', 'FORMATTING'],
  [['access', 'keyboard', 'aria'], 'a11y', 'ACCESSIBILITY'],
  [['column', 'resize', 'reorder'], 'columns', 'COLUMNS'],
  [['ai', 'mcp', 'claude', 'cursor'], 'ai', 'AI-NATIVE'],
]

function featureOf(post) {
  const t = `${post.slug || ''} ${(post.tags || []).join(' ')} ${post.category || ''}`.toLowerCase()
  for (const [keys, key, label] of FEATURES) {
    if (keys.some((k) => t.includes(k))) return { key, label }
  }
  return { key: 'default', label: String(post.category || 'SvGrid').toUpperCase() }
}

const STATUS = [
  ['Active', GREEN], ['Pending', ACCENT_2], ['Closed', '#94a3b8'],
  ['Active', GREEN], ['Pending', ACCENT_2], ['Active', GREEN],
]
const NAME_W = [184, 150, 206, 132, 172, 158]
const REGION_W = [120, 158, 104, 142, 116, 134]
const REV = ['$48,200', '$39,750', '$31,400', '$22,900', '$18,300', '$12,150']
const DATES = ['2026-06-09', '2026-05-22', '2026-04-18', '2026-03-30', '2026-02-12', '2026-01-08']

// The grid "window": frame + header + body, specialized per feature key.
function gridWindow(key) {
  const X = 80, Y = 150, W = 1040, H = 392, R = 18
  const C = {
    chk: { x: 80, w: 54 }, name: { x: 134, w: 288 }, status: { x: 422, w: 196 },
    region: { x: 618, w: 210 }, rev: { x: 828, w: 292 },
  }
  const headerH = 54, bodyTop = Y + headerH, rowH = 46, nRows = 6
  const p = []

  // Frame + clip so inner content keeps the rounded corners.
  p.push(`<clipPath id="win"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="${R}"/></clipPath>`)
  p.push(rr(X, Y, W, H, R, GRID.bg, `stroke="${GRID.border}" stroke-width="1.5"`))
  p.push(`<g clip-path="url(#win)">`)

  // Pivot + virtual replace the standard body entirely.
  if (key === 'pivot') { p.push(pivotBody(X, Y, W, H)); p.push(`</g>`); return p.join('') }
  if (key === 'virtual') { p.push(virtualBody(X, Y, W, H, headerH, C)); p.push(`</g>`); p.push(featureFloats(key)); return p.join('') }

  // Header band.
  p.push(rr(X, Y, W, headerH, 0, GRID.header))
  p.push(`<line x1="${X}" y1="${bodyTop}" x2="${X + W}" y2="${bodyTop}" stroke="${GRID.border}" stroke-width="1"/>`)
  // Accent (sorted) column tint behind body.
  if (key !== 'theme') p.push(rr(C.rev.x, bodyTop, C.rev.w, H - headerH, 0, ACCENT_SOFT))
  // Header checkbox (indeterminate).
  p.push(rr(C.chk.x + 17, Y + headerH / 2 - 10, 20, 20, 5, 'none', `stroke="${GRID.muted}" stroke-width="2"`))
  p.push(`<line x1="${C.chk.x + 22}" y1="${Y + headerH / 2}" x2="${C.chk.x + 32}" y2="${Y + headerH / 2}" stroke="${GRID.muted}" stroke-width="2"/>`)
  // Header labels.
  const hy = Y + headerH / 2 + 7
  p.push(tx(C.name.x + 16, hy, 'Name', { size: 21, fill: GRID.headInk, weight: 700 }))
  p.push(tx(C.status.x + 16, hy, 'Status', { size: 21, fill: GRID.headInk, weight: 700 }))
  p.push(tx(C.region.x + 16, hy, key === 'format' ? 'Joined' : 'Region', { size: 21, fill: GRID.headInk, weight: 700 }))
  // Sorted "Revenue" header: label + caret in accent.
  p.push(tx(C.rev.x + C.rev.w - 44, hy, 'Revenue', { size: 21, fill: ACCENT, weight: 700, anchor: 'end' }))
  const cax = C.rev.x + C.rev.w - 26
  p.push(`<path d="M${cax - 7} ${hy - 4} L${cax + 7} ${hy - 4} L${cax} ${hy - 14} Z" fill="${ACCENT}"/>`)
  if (key === 'pinned') {
    p.push(`<circle cx="${C.name.x + C.name.w - 22}" cy="${Y + headerH / 2}" r="3.4" fill="${ACCENT}"/>`)
    p.push(`<line x1="${C.name.x + C.name.w - 22}" y1="${Y + headerH / 2}" x2="${C.name.x + C.name.w - 22}" y2="${Y + headerH / 2 + 9}" stroke="${ACCENT}" stroke-width="2"/>`)
  }
  if (key === 'filter') p.push(funnel(C.status.x + C.status.w - 30, Y + headerH / 2 - 8))

  const sel = key === 'filter' ? [] : [0, 1]
  const dim = key === 'filter' ? [3, 4, 5] : []
  const treeIndent = [0, 1, 1, 0, 1, 2]

  for (let i = 0; i < nRows; i++) {
    const y = bodyTop + i * rowH
    const cy = y + rowH / 2
    if (i % 2 === 1) p.push(rr(X, y, W, rowH, 0, GRID.alt))
    if (sel.includes(i)) { p.push(rr(X, y, W, rowH, 0, 'rgba(251,122,60,0.08)')); p.push(rr(X, y, 3, rowH, 0, ACCENT)) }

    // Group band over the first member row.
    if (key === 'group' && i === 0) {
      p.push(rr(X, y, W, rowH, 0, 'rgba(251,122,60,0.12)'))
      p.push(`<path d="M${C.name.x + 16} ${cy - 5} L${C.name.x + 28} ${cy - 5} L${C.name.x + 22} ${cy + 5} Z" fill="${ACCENT}"/>`)
      p.push(tx(C.name.x + 40, cy + 6, 'Region: West', { size: 20, fill: GRID.headInk, weight: 700 }))
      p.push(rr(C.name.x + 196, cy - 13, 34, 26, 13, 'rgba(148,163,184,0.18)'))
      p.push(tx(C.name.x + 213, cy + 5, '3', { size: 17, fill: GRID.muted, weight: 700, anchor: 'middle' }))
      p.push(tx(C.rev.x + C.rev.w - 18, cy + 6, 'Σ $119,350', { size: 20, fill: ACCENT, weight: 800, anchor: 'end' }))
      continue
    }

    // Checkbox.
    if (sel.includes(i)) {
      p.push(rr(C.chk.x + 17, cy - 10, 20, 20, 5, ACCENT))
      p.push(`<path d="M${C.chk.x + 21} ${cy} l3.5 3.5 l7 -7.5" fill="none" stroke="#1b212e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`)
    } else {
      p.push(rr(C.chk.x + 17, cy - 10, 20, 20, 5, 'none', `stroke="${GRID.muted}" stroke-width="2"`))
    }

    // Name column: tree rows, edit cell, or avatar + bar.
    const indent = key === 'tree' ? treeIndent[i] * 22 : 0
    if (key === 'tree') {
      const chx = C.name.x + 16 + indent
      if (treeIndent[i] === 0) p.push(`<path d="M${chx} ${cy - 6} L${chx + 12} ${cy} L${chx} ${cy + 6} Z" fill="${GRID.muted}" transform="rotate(90 ${chx + 6} ${cy})"/>`)
      else p.push(`<path d="M${chx} ${cy - 5} L${chx + 9} ${cy} L${chx} ${cy + 5} Z" fill="${GRID.muted}"/>`)
      p.push(rr(chx + 20, cy - 5, NAME_W[i] - indent, 10, 5, 'rgba(200,210,224,0.24)'))
    } else if (key === 'edit' && i === 2) {
      p.push(rr(C.name.x + 12, cy - 17, 236, 34, 7, '#f3f6fb', `stroke="${ACCENT}" stroke-width="2.5"`))
      p.push(tx(C.name.x + 26, cy + 6, 'Acme Corp', { size: 20, fill: '#0f172a', weight: 600 }))
      p.push(`<line x1="${C.name.x + 150}" y1="${cy - 11}" x2="${C.name.x + 150}" y2="${cy + 11}" stroke="${ACCENT}" stroke-width="2"/>`)
    } else {
      p.push(`<circle cx="${C.name.x + 28}" cy="${cy}" r="11" fill="rgba(251,122,60,0.18)"/>`)
      p.push(rr(C.name.x + 50, cy - 5, NAME_W[i], 10, 5, 'rgba(200,210,224,0.22)'))
    }

    // Status badge.
    const [stt, stc] = STATUS[i]
    p.push(rr(C.status.x + 14, cy - 14, 96, 28, 14, hexA(stc, 0.16)))
    p.push(`<circle cx="${C.status.x + 30}" cy="${cy}" r="4" fill="${stc}"/>`)
    p.push(tx(C.status.x + 42, cy + 5, stt, { size: 17, fill: stc, weight: 600 }))

    // Region / Joined.
    if (key === 'format') p.push(tx(C.region.x + 16, cy + 6, DATES[i], { size: 19, fill: GRID.ink, weight: 500 }))
    else p.push(rr(C.region.x + 16, cy - 5, REGION_W[i], 10, 5, 'rgba(200,210,224,0.18)'))

    // Revenue (accent column), with real-time deltas when applicable.
    const rvx = C.rev.x + C.rev.w - 18
    if (key === 'realtime') {
      const up = i % 2 === 0
      p.push(`<path d="M${C.rev.x + 26} ${cy - 1} l6 ${up ? -9 : 9} l6 ${up ? 9 : -9} Z" fill="${up ? GREEN : RED}"/>`)
    }
    const rv = key === 'format' ? REV[i] + '.00' : REV[i]
    p.push(tx(rvx, cy + 6, rv, { size: 20, fill: GRID.headInk, weight: 700, anchor: 'end' }))

    // Filtered-out rows dim.
    if (dim.includes(i)) p.push(rr(X, y, W, rowH, 0, 'rgba(27,33,46,0.62)'))

    // Accessibility focus ring on one cell.
    if (key === 'a11y' && i === 2) p.push(rr(C.region.x + 4, y + 4, C.region.w - 8, rowH - 8, 6, 'none', `stroke="${ACCENT}" stroke-width="3"`))
  }

  // Footer / pager band.
  const fy = Y + H - 50
  p.push(`<line x1="${X}" y1="${fy}" x2="${X + W}" y2="${fy}" stroke="${GRID.border}" stroke-width="1"/>`)
  p.push(tx(X + 18, fy + 32, 'Rows 1-6 of 1,284', { size: 18, fill: GRID.muted }))
  const pages = ['‹', '1', '2', '3', '4', '›']
  const activePage = key === 'paginate' ? '2' : '1'
  let px = X + W - 18 - pages.length * 40
  for (const lbl of pages) {
    const on = lbl === activePage
    p.push(rr(px, fy + 12, 32, 26, 7, on ? ACCENT : 'transparent'))
    p.push(tx(px + 16, fy + 30, lbl, { size: 18, fill: on ? '#1b212e' : GRID.muted, weight: on ? 800 : 600, anchor: 'middle' }))
    px += 40
  }

  // Pinned-column frozen divider (drawn over the body).
  if (key === 'pinned') {
    p.push(`<line x1="${C.name.x + C.name.w}" y1="${Y}" x2="${C.name.x + C.name.w}" y2="${Y + H}" stroke="${ACCENT}" stroke-width="2" stroke-opacity="0.5"/>`)
    p.push(`<rect x="${C.name.x + C.name.w}" y="${Y}" width="16" height="${H}" fill="rgba(0,0,0,0.18)"/>`)
  }
  // Theming: a light-mode slab over the right columns.
  if (key === 'theme') {
    const tx0 = C.region.x
    p.push(rr(tx0, bodyTop, X + W - tx0, H - headerH - 50, 0, '#f4f6fb'))
    p.push(`<line x1="${tx0}" y1="${bodyTop}" x2="${tx0}" y2="${Y + H - 50}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`)
    for (let i = 0; i < nRows; i++) {
      const cyy = bodyTop + i * rowH + rowH / 2
      p.push(rr(tx0 + 16, cyy - 5, REGION_W[i], 10, 5, 'rgba(15,23,42,0.18)'))
      p.push(tx(X + W - 18, cyy + 6, REV[i], { size: 20, fill: '#0f172a', weight: 700, anchor: 'end' }))
    }
  }

  p.push(`</g>`)
  p.push(featureFloats(key))
  return p.join('')
}

// Floating badges/chips that sit above the window for certain features.
function featureFloats(key) {
  const out = []
  const chip = (xRight, label, icon) => {
    const w = label.length * 11 + 56
    const x = xRight - w, y = 120
    out.push(rr(x, y, w, 38, 19, 'rgba(251,122,60,0.16)', `stroke="${ACCENT}" stroke-width="1.5"`))
    out.push(icon(x + 18, y + 19))
    out.push(tx(x + 38, y + 25, label, { size: 18, fill: ACCENT, weight: 700 }))
  }
  if (key === 'virtual') chip(1120, '100,000 rows', (x, y) => `<path d="M${x - 4} ${y - 7} h8 M${x - 4} ${y - 2} h8 M${x - 4} ${y + 3} h8 M${x - 4} ${y + 8} h8" stroke="${ACCENT}" stroke-width="2"/>`)
  else if (key === 'realtime') chip(1120, 'Live', (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="${GREEN}"/>`)
  else if (key === 'export') chip(1120, 'Export XLSX', (x, y) => `<path d="M${x} ${y - 8} v11 M${x - 5} ${y - 1} l5 5 l5 -5 M${x - 6} ${y + 8} h12" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`)
  else if (key === 'server') chip(1120, 'Server-side', (x, y) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="6" rx="1.5" fill="none" stroke="${ACCENT}" stroke-width="1.8"/><rect x="${x - 7}" y="${y + 1}" width="14" height="6" rx="1.5" fill="none" stroke="${ACCENT}" stroke-width="1.8"/>`)
  else if (key === 'ai') chip(1120, 'AI assist', (x, y) => `<path d="M${x} ${y - 8} l2.2 5.8 l5.8 2.2 l-5.8 2.2 l-2.2 5.8 l-2.2 -5.8 l-5.8 -2.2 l5.8 -2.2 Z" fill="${ACCENT}"/>`)
  else if (key === 'columns') chip(1120, 'Drag to reorder', (x, y) => `<path d="M${x - 6} ${y} h12 M${x - 6} ${y} l4 -4 M${x - 6} ${y} l4 4 M${x + 6} ${y} l-4 -4 M${x + 6} ${y} l-4 4" stroke="${ACCENT}" stroke-width="2" fill="none" stroke-linecap="round"/>`)
  else if (key === 'a11y') chip(1120, 'Keyboard', (x, y) => `<rect x="${x - 8}" y="${y - 6}" width="16" height="12" rx="2.5" fill="none" stroke="${ACCENT}" stroke-width="1.8"/><path d="M${x - 4} ${y + 2} h8" stroke="${ACCENT}" stroke-width="1.8"/>`)
  return out.join('')
}

function funnel(x, y) {
  return `<path d="M${x} ${y} h16 l-6 7 v7 l-4 2 v-9 Z" fill="${ACCENT}"/>`
}

// Virtualized body: many thin rows + a scrollbar thumb.
function virtualBody(X, Y, W, H, headerH, C) {
  const p = []
  p.push(rr(X, Y, W, headerH, 0, GRID.header))
  p.push(tx(C.name.x + 16, Y + headerH / 2 + 7, 'Name', { size: 21, fill: GRID.headInk, weight: 700 }))
  p.push(tx(C.status.x + 16, Y + headerH / 2 + 7, 'Status', { size: 21, fill: GRID.headInk, weight: 700 }))
  p.push(tx(C.region.x + 16, Y + headerH / 2 + 7, 'Region', { size: 21, fill: GRID.headInk, weight: 700 }))
  p.push(tx(C.rev.x + C.rev.w - 26, Y + headerH / 2 + 7, 'Revenue', { size: 21, fill: ACCENT, weight: 700, anchor: 'end' }))
  const top = Y + headerH, rh = 24, n = Math.floor((H - headerH) / rh)
  p.push(rr(C.rev.x, top, C.rev.w, H - headerH, 0, ACCENT_SOFT))
  for (let i = 0; i < n; i++) {
    const y = top + i * rh, cy = y + rh / 2
    if (i % 2 === 1) p.push(rr(X, y, W, rh, 0, GRID.alt))
    p.push(rr(C.name.x + 16, cy - 4, 150 + ((i * 37) % 110), 8, 4, 'rgba(200,210,224,0.20)'))
    p.push(rr(C.status.x + 16, cy - 4, 84, 8, 4, 'rgba(200,210,224,0.16)'))
    p.push(rr(C.region.x + 16, cy - 4, 96 + ((i * 53) % 90), 8, 4, 'rgba(200,210,224,0.16)'))
    p.push(rr(C.rev.x + C.rev.w - 120, cy - 4, 104, 8, 4, 'rgba(251,122,60,0.4)'))
  }
  // Scrollbar.
  p.push(rr(X + W - 12, top + 4, 6, H - headerH - 8, 3, 'rgba(148,163,184,0.14)'))
  p.push(rr(X + W - 12, top + 6, 6, 70, 3, 'rgba(251,122,60,0.7)'))
  return p.join('')
}

// Pivot cross-tab body.
function pivotBody(X, Y, W, H) {
  const p = []
  const rowsHdr = ['West', 'East', 'North', 'South', 'Total']
  const colsHdr = ['Q1', 'Q2', 'Q3', 'Q4', 'Total']
  const data = [
    ['$12.4k', '$15.1k', '$18.9k', '$21.0k', '$67.4k'],
    ['$9.8k', '$11.2k', '$13.7k', '$16.4k', '$51.1k'],
    ['$7.1k', '$8.0k', '$9.3k', '$10.6k', '$35.0k'],
    ['$5.5k', '$6.2k', '$7.0k', '$8.1k', '$26.8k'],
    ['$34.8k', '$40.5k', '$48.9k', '$56.1k', '$180.3k'],
  ]
  const labelW = 220, colW = (W - labelW) / 5, headerH = 54, rowH = (H - headerH) / 5
  p.push(rr(X, Y, W, headerH, 0, GRID.header))
  for (let c = 0; c < 5; c++) {
    const cx = X + labelW + c * colW + colW / 2
    const last = c === 4
    p.push(tx(cx, Y + headerH / 2 + 7, colsHdr[c], { size: 21, fill: last ? ACCENT : GRID.headInk, weight: 700, anchor: 'middle' }))
  }
  p.push(tx(X + 20, Y + headerH / 2 + 7, 'Region', { size: 20, fill: GRID.muted, weight: 700 }))
  // Total column tint + total row tint.
  p.push(rr(X + labelW + 4 * colW, Y + headerH, colW, H - headerH, 0, ACCENT_SOFT))
  p.push(rr(X, Y + headerH + 4 * rowH, W, rowH, 0, ACCENT_SOFT))
  for (let r = 0; r < 5; r++) {
    const y = Y + headerH + r * rowH, cy = y + rowH / 2
    if (r % 2 === 1) p.push(rr(X, y, W, rowH, 0, GRID.alt))
    const lastRow = r === 4
    p.push(tx(X + 20, cy + 7, rowsHdr[r], { size: 20, fill: lastRow ? ACCENT : GRID.headInk, weight: 700 }))
    for (let c = 0; c < 5; c++) {
      const cx = X + labelW + c * colW + colW / 2
      const strong = lastRow || c === 4
      p.push(tx(cx, cy + 7, data[r][c], { size: 19, fill: strong ? ACCENT : GRID.ink, weight: strong ? 700 : 500, anchor: 'middle' }))
    }
    p.push(`<line x1="${X}" y1="${y}" x2="${X + W}" y2="${y}" stroke="${GRID.line}" stroke-width="1"/>`)
  }
  p.push(`<line x1="${X + labelW}" y1="${Y}" x2="${X + labelW}" y2="${Y + H}" stroke="${GRID.border}" stroke-width="1"/>`)
  return p.join('')
}

function hexA(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// The per-post card. The hero is a data-grid mockup demonstrating the post's
// feature; a small eyebrow names the feature, and the SvGrid lockup + footer
// keep it branded.
export function blogCardSvg(post, host = 'svgrid.com') {
  const { key, label } = featureOf(post)
  const eyebrowW = label.length * 14.5 + 40
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141925"/><stop offset="1" stop-color="#1d2433"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.08" r="0.7"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0.16"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></radialGradient>
    <pattern id="dot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#9aa6c2" fill-opacity="0.06"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#page)"/><rect width="1200" height="630" fill="url(#dot)"/><rect width="1200" height="630" fill="url(#glow)"/>
  <g transform="translate(64, 50) scale(2)">${svgridMark()}</g>
  <text x="148" y="92" font-family="${F}" font-weight="800" font-size="34" letter-spacing="-1"><tspan fill="${ACCENT}">Sv</tspan><tspan fill="#e8ecf6">Grid</tspan></text>
  <rect x="${1120 - eyebrowW}" y="60" width="${eyebrowW}" height="40" rx="20" fill="rgba(251,122,60,0.12)" stroke="${ACCENT}" stroke-width="1.5"/>
  <text x="${1120 - eyebrowW / 2}" y="86" font-family="${F}" font-weight="700" font-size="22" fill="${ACCENT_2}" letter-spacing="3" text-anchor="middle">${escapeAttr(label)}</text>
  ${gridWindow(key)}
  <text x="80" y="600" font-family="${F}" font-weight="600" font-size="22" fill="${MUTED}" letter-spacing="0.5">${escapeAttr(host)}/blog</text>
  <text x="1120" y="600" text-anchor="end" font-family="${F}" font-weight="600" font-size="22" fill="${MUTED}" letter-spacing="0.5">Built by jQWidgets</text>
</svg>`
}

// ---- optional SVG -> PNG rasterizer (@resvg/resvg-js) ----------------------
// Resolved lazily from the website package and used best-effort: a failure
// returns null so callers fall back to the SVG. Never throws.

const requireFromHere = createRequire(import.meta.url)
let _Resvg
function getResvg() {
  if (_Resvg !== undefined) return _Resvg
  try {
    // resvg is a devDependency of the website package, one dir over.
    const req = createRequire(new URL('../website/package.json', import.meta.url))
    _Resvg = req('@resvg/resvg-js').Resvg
  } catch {
    try { _Resvg = requireFromHere('@resvg/resvg-js').Resvg } catch { _Resvg = null }
  }
  return _Resvg
}

export function rasterizePng(svg) {
  const Resvg = getResvg()
  if (!Resvg) return null
  try {
    const r = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
      font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
    })
    return Buffer.from(r.render().asPng())
  } catch {
    return null
  }
}

// ---- frontmatter + post metadata (shared with blog.ts's parser) ------------

export function parseFrontmatter(raw) {
  let text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  text = text.replace(/\r\n/g, '\n')
  const meta = {}
  let body = text
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4)
    if (end !== -1) {
      for (const line of text.slice(4, end).split('\n')) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        let value = line.slice(idx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        meta[key] = value
      }
      const after = text.indexOf('\n', end + 1)
      body = after === -1 ? '' : text.slice(after + 1)
    }
  }
  return { meta, body }
}

/** Read every post in `blogDir` and return its card-relevant metadata. */
export async function loadBlogCards(blogDir) {
  let entries
  try {
    entries = await readdir(blogDir, { withFileTypes: true })
  } catch {
    return new Map()
  }
  const out = new Map()
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const raw = await readFile(join(blogDir, entry.name), 'utf-8')
    const { meta, body } = parseFrontmatter(raw)
    const words = body.trim().split(/\s+/).filter(Boolean).length
    const slug = entry.name.replace(/\.md$/, '')
    out.set(slug, {
      slug,
      title: meta.title ?? slug,
      category: meta.category ?? 'General',
      tags: (meta.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      readingMinutes: Math.max(1, Math.round(words / 200)),
    })
  }
  return out
}
