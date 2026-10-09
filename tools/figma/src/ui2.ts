/**
 * The second half of the UI kit: inputs and selection controls beyond the
 * basics, navigation, data display and feedback. Built from the measured
 * spec of each Sv*.svelte file; each builder cites its source lines. Heights
 * that depend on an inherited line-height use Inter's normal line box
 * (1.21 x font size), the same assumption the rest of the kit makes.
 */
import {
  type Ink,
  absolute,
  boolProp,
  component,
  frame,
  icon,
  inst,
  put,
  rect,
  setFill,
  setStroke,
  shadow,
  text,
  textProp,
  variantSet,
} from './lib'
import { matrix } from './doc'
import { type Size, type UiKit, SIZES, R, vname, field, FIELD, borderFor, halo, focusRing } from './fields'

const lh = (fs: number) => Math.round(fs * 1.21)

const chevron = (d: string, stroke = 3) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`

// ================================================================= inputs

/** SvTextArea.svelte:102-116 (unframed SvField; the textarea draws its own box). */
function textArea(size: Size, state: string): ComponentNode {
  const fs = FIELD[size].fs
  const h = 3 * lh(fs) + 16 + 2
  const box = frame(
    { name: 'Textarea', dir: 'v', pad: [8, 10], w: 260, h, fill: '--sg-input-bg', stroke: borderFor(state), radius: '--sg-radius' },
    text('Leave parcels at the side door.\nCall on arrival.', { name: 'Value', size: fs, w: 'fill', lineHeight: lh(fs) }),
  )
  halo(box, state)
  // The browser's resize grip (resize: vertical); not in the CSS, but always drawn.
  const grip = icon('Resize grip', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M7 2 2 7M7 5 5 7"/></svg>', 8, '--sg-muted')
  absolute(box, grip, 260 - 11, h - 11)
  grip.constraints = { horizontal: 'MAX', vertical: 'MAX' }
  const control = frame({ name: 'Control', dir: 'v', gap: 3, w: 260 }, box, frame({ name: 'Count', w: 'fill', justify: 'end' }, text('46 / 200', { size: 11, color: '--sg-muted' })))
  const c = field(vname({ Size: size, State: state }), control, state === 'Invalid')
  if (state === 'Disabled') c.opacity = 0.6
  return c
}

/** SvNumberInput.svelte:124-171 inside the framed SvField box, width 150. */
function numberInput(size: Size, state: string): ComponentNode {
  const { h, fs } = FIELD[size]
  const spinBtn = (name: string, d: string) =>
    frame({ name, w: 23, h: 13, radius: 4, align: 'center', justify: 'center' }, icon('Chevron', chevron(d), 11, '--sg-fg'))
  const control = frame(
    { name: 'Control', align: 'center', w: 150, h, fill: '--sg-input-bg', stroke: borderFor(state), radius: '--sg-radius', opacity: state === 'Disabled' ? 0.6 : undefined },
    frame({ name: 'Input', pad: [0, 10], w: 'fill', justify: 'end' }, text('1,250', { name: 'Value', size: fs })),
    frame({ name: 'Spin', dir: 'v', pad: [0, 10, 0, 2] }, spinBtn('Increment', 'M6 15l6-6 6 6'), spinBtn('Decrement', 'M6 9l6 6 6-6')),
  )
  halo(control, state)
  return field(vname({ Size: size, State: state }), control, state === 'Invalid')
}

/** SvSlider.svelte:164-202: thumb, track and width by size, 10px padding. */
function slider(size: Size, state: string): ComponentNode {
  const { th, trk, w } = { sm: { th: 13, trk: 4, w: 180 }, md: { th: 16, trk: 6, w: 240 }, lg: { th: 20, trk: 8, w: 300 } }[size]
  const tw = w - 20
  const at = 0.4
  const track = frame({ name: 'Track', dir: 'none', w: tw, h: trk, radius: 999, fill: '--sg-border' })
  const fill = rect('Fill', tw * at, trk, '--sg-accent', 999)
  absolute(track, fill, 0, 0)
  fill.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' }
  // The thumb is a literal #fff in the CSS (no token), with a 2px accent border.
  const thumb = frame({ name: 'Thumb', dir: 'none', w: th, h: th, radius: 999, fill: '#ffffff', stroke: '--sg-accent', strokeWeight: 2, strokeInLayout: false })
  shadow(thumb, 'Slider thumb')
  const cx = tw * at
  absolute(track, thumb, cx - th / 2, trk / 2 - th / 2)
  if (state === 'Focus') focusRing(thumb, th / 2)
  const bubble = frame({ name: 'Value', pad: [2, 6], radius: 5, fill: '--sg-accent' }, text('40', { size: 11, weight: 'semibold', color: '--sg-on-accent', lineHeight: 13 }))
  absolute(track, bubble, cx - bubble.width / 2, trk / 2 - th / 2 - 0.3 * th - bubble.height)
  track.clipsContent = false
  return component({ name: vname({ Size: size, State: state }), dir: 'v', pad: 10, w, opacity: state === 'Disabled' ? 0.5 : undefined }, track)
}

/** SvTagsInput.svelte:92-114. */
function tagsInput(size: Size, state: string): ComponentNode {
  const { minh, chip, fs } = { sm: { minh: 28, chip: 19, fs: 12 }, md: { minh: 34, chip: 22, fs: 13 }, lg: { minh: 40, chip: 26, fs: 15 } }[size]
  const tag = (label: string) =>
    frame(
      { name: `Tag ${label}`, gap: 4, align: 'center', h: chip, pad: [0, 4, 0, 8], radius: 5, fill: ['--sg-accent', 0.14] },
      text(label, { size: fs - 1, weight: 'semibold', color: '--sg-accent' }),
      state === 'Disabled' ? null : text('×', { name: 'Remove', size: 15, lineHeight: 15, color: '--sg-accent', opacity: 0.7 }),
    )
  const box = frame(
    { name: 'Box', gap: 5, align: 'center', w: 280, h: Math.max(minh, 34), pad: [4, 6], fill: '--sg-input-bg', stroke: borderFor(state), radius: '--sg-radius', opacity: state === 'Disabled' ? 0.6 : undefined },
    tag('svelte'),
    tag('data grid'),
    frame({ name: 'Input', w: 80, h: 24 }),
  )
  halo(box, state)
  return field(vname({ Size: size, State: state }), box, state === 'Invalid')
}

// ============================================================== selection

/** SvSegmented.svelte:87-111. */
function segmented(size: Size, state: string): ComponentNode {
  const { h, fs } = { sm: { h: 26, fs: 12 }, md: { h: 32, fs: 13 }, lg: { h: 38, fs: 14.5 } }[size]
  const opt = (label: string, selected: boolean) => {
    const f = frame(
      { name: label, h, pad: [0, 12], align: 'center', justify: 'center', radius: '--sg-radius', fill: selected ? '--sg-input-bg' : null },
      text(label, { size: fs, weight: 'medium', color: selected ? '--sg-fg' : '--sg-muted' }),
    )
    if (selected) shadow(f, 'Segment')
    return f
  }
  return component(
    {
      name: vname({ Size: size, State: state }),
      gap: 2,
      pad: 2,
      fill: '--sg-row-hover-bg',
      stroke: state === 'Invalid' ? '--sg-danger' : '--sg-border',
      radius: R() + 2,
      opacity: state === 'Disabled' ? 0.6 : undefined,
    },
    opt('List', true),
    opt('Board', false),
    opt('Calendar', false),
  )
}

/** SvRating.svelte:83-111: 5 stars, 2px apart, fill rating-on / rating-empty. */
const STAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.7l1.2-6.6L2.5 9.5l6.6-.9z" fill="currentColor"/></svg>'
function rating(size: Size, value: number): ComponentNode {
  const px = { sm: 16, md: 22, lg: 30 }[size]
  const stars = [0, 1, 2, 3, 4].map((i) => icon(`Star ${i + 1}`, STAR, px, i < value ? '--sg-rating-on' : '--sg-rating-empty'))
  return component({ name: vname({ Size: size, Value: String(value) }), gap: 2, align: 'center' }, ...stars)
}

// ================================================================ actions

/** SvToggleButton.svelte:64-84. */
function toggleButton(size: Size, state: string): ComponentNode {
  const pad = { sm: [5, 10], md: [8, 13], lg: [11, 17] }[size] as [number, number]
  const fs = { sm: 12, md: 13, lg: 15 }[size]
  const pressed = state === 'Pressed'
  const c = component(
    {
      name: vname({ Size: size, State: state }),
      gap: 6,
      align: 'center',
      pad,
      radius: '--sg-radius',
      fill: pressed ? '--sg-accent' : state === 'Hover' ? '--sg-row-hover-bg' : '--sg-bg',
      stroke: pressed ? '--sg-accent' : '--sg-border',
      opacity: state === 'Disabled' ? 0.55 : undefined,
    },
    text('Bold', { name: 'Label', size: fs, weight: 'semibold', lineHeight: fs, color: pressed ? '--sg-on-accent' : '--sg-fg' }),
  )
  if (state === 'Focus') focusRing(c, R())
  return c
}

/** SvButtonGroup.svelte:91-120: one bordered box, dividers between buttons. */
function buttonGroup(variant: 'Solid' | 'Outline', size: Size, state: string): ComponentNode {
  const pad = { sm: [5, 11], md: [7, 14], lg: [10, 18] }[size] as [number, number]
  const fs = { sm: 12, md: 13, lg: 15 }[size]
  const btn = (label: string, i: number) => {
    const selected = i === 0
    const fill: Ink | null = selected ? (variant === 'Solid' ? '--sg-accent' : ['--sg-accent', 0.12]) : null
    const color: Ink = selected ? (variant === 'Solid' ? '--sg-on-accent' : '--sg-accent') : '--sg-fg'
    return frame(
      { name: label, pad, align: 'center', fill, stroke: i > 0 ? (i === 1 && variant === 'Solid' ? '--sg-accent' : '--sg-input-border') : undefined, strokeWeight: { left: 1 } },
      text(label, { name: 'Label', size: fs, weight: 'semibold', lineHeight: lh(fs), color }),
    )
  }
  return component(
    {
      name: vname({ Variant: variant, Size: size, State: state }),
      fill: '--sg-input-bg',
      stroke: '--sg-input-border',
      radius: '--sg-radius',
      clip: true,
      opacity: state === 'Disabled' ? 0.6 : undefined,
    },
    btn('Left', 0),
    btn('Center', 1),
    btn('Right', 2),
  )
}

// ============================================================ data display

/** avatar.ts:17-21: hue from the name, then hsl(h 62% 45%). */
function avatarColor(name: string): string {
  let h = 0
  for (const ch of name || '?') h = (h * 31 + ch.charCodeAt(0)) % 360
  const s = 0.62
  const l = 0.45
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const STATUS: Record<string, string> = { Online: '--sg-success', Away: '--sg-warning', Busy: '--sg-danger', Offline: '--sg-muted' }

/** SvAvatar.svelte:27-74. Text is a literal #fff; the background is the hashed hue. */
function avatar(size: Size, shape: 'Circle' | 'Square', status: string, name = 'Ada Lovelace'): ComponentNode {
  const px = { sm: 28, md: 36, lg: 48 }[size]
  const c = component(
    { name: vname({ Size: size, Shape: shape, Status: status }), w: px, h: px, align: 'center', justify: 'center', radius: shape === 'Circle' ? px / 2 : px * 0.22, fill: avatarColor(name) },
    text(initials(name), { name: 'Initials', size: Math.round(px * 0.4), weight: 'semibold', lineHeight: Math.round(px * 0.4), letterSpacing: Math.round(px * 0.4) * 0.02, color: '#ffffff' }),
  )
  if (status !== 'None') {
    const d = Math.max(px * 0.28, 8)
    const dot = rect('Status', d, d, STATUS[status]!, 999)
    setStroke(dot, '--sg-bg', 2, 'INSIDE')
    absolute(c, dot, px - d + 1, px - d + 1)
    dot.constraints = { horizontal: 'MAX', vertical: 'MAX' }
  }
  return c
}

/** SvKbd.svelte:35-50. */
function kbd(size: 'sm' | 'md'): ComponentNode {
  const fs = size === 'sm' ? 11 : 12
  return component(
    {
      name: vname({ Size: size }),
      pad: size === 'sm' ? [0, 4, 0, 4] : [1, 6, 1, 6],
      justify: 'center',
      fill: '--sg-muted-bg',
      stroke: '--sg-border',
      strokeWeight: { top: 1, right: 1, bottom: 2, left: 1 },
      radius: 5,
    },
    text('K', { name: 'Key', size: fs, mono: true, lineHeight: fs * 1.5, align: 'CENTER' }),
  )
}

/** SvStat.svelte:69-85. */
function stat(trend: 'Up' | 'Down' | 'Flat'): ComponentNode {
  const arrow = { Up: '▲', Down: '▼', Flat: '→' }[trend]
  const color = { Up: '--sg-success', Down: '--sg-danger', Flat: '--sg-muted' }[trend]
  const delta = { Up: '+12.4%', Down: '-3.1%', Flat: '0%' }[trend]
  return component(
    { name: vname({ Trend: trend }), dir: 'v', gap: 5, pad: [14, 16], w: 240, fill: '--sg-bg', stroke: '--sg-border', radius: '--sg-radius-lg' },
    text('Revenue', { name: 'Label', size: 12.5, weight: 'semibold', color: '--sg-muted' }),
    text('$48.2k', { name: 'Value', size: 26, weight: 'bold', lineHeight: 28.6 }),
    frame(
      { name: 'Foot', gap: 8, align: 'center' },
      frame({ name: 'Delta', gap: 3, align: 'center' }, text(arrow, { size: 9, color }), text(delta, { name: 'Delta value', size: 12, weight: 'semibold', color })),
      text('vs last month', { name: 'Hint', size: 12, color: '--sg-muted' }),
    ),
  )
}

/** SvCard.svelte:49-70. */
function card(state: 'Default' | 'Hover'): ComponentNode {
  const c = component(
    { name: vname({ State: state }), dir: 'v', w: 320, fill: '--sg-bg', stroke: state === 'Hover' ? '--sg-x-accent-border-45' : '--sg-border', radius: '--sg-radius-lg', clip: true },
    frame(
      { name: 'Header', dir: 'v', gap: 2, pad: [14, 16], w: 'fill', stroke: '--sg-border', strokeWeight: { bottom: 1 } },
      text('Revenue', { name: 'Title', size: 14.5, weight: 'semibold' }),
      text('Last 30 days', { name: 'Subtitle', size: 12.5, color: '--sg-muted' }),
    ),
    frame(
      { name: 'Body', pad: 16, w: 'fill' },
      text('$48,210 from 412 orders. Refunds are down a third on the previous period.', { name: 'Body text', size: 13.5, lineHeight: 20.9, w: 'fill' }),
    ),
    frame({ name: 'Footer', pad: [12, 16], w: 'fill', stroke: '--sg-border', strokeWeight: { top: 1 } }, text('View report', { name: 'Footer text', size: 13, color: '--sg-muted' })),
  )
  if (state === 'Hover') shadow(c, 'Card hover')
  return c
}

// =============================================================== feedback

const INTENT: Record<string, string> = { Accent: '--sg-accent', Success: '--sg-success', Warning: '--sg-warning', Danger: '--sg-danger' }

/** SvProgress.svelte:72-115: 280px wide here (the component is width 100%). */
function progress(color: string, size: Size): ComponentNode {
  const h = { sm: 5, md: 8, lg: 12 }[size]
  const c = INTENT[color]!
  const trackW = 280 - 10 - 38
  const track = frame({ name: 'Track', dir: 'none', w: trackW, h, radius: 999, fill: '--sg-border', clip: true })
  const fill = rect('Fill', trackW * 0.64, h, c, 999)
  absolute(track, fill, 0, 0)
  fill.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' }
  const comp = component(
    { name: vname({ Color: color, Size: size }), gap: 10, align: 'center', w: 280 },
    track,
    frame({ name: 'Label', w: 38, justify: 'end' }, text('64%', { size: 12, weight: 'semibold', color: '--sg-muted' })),
  )
  track.layoutSizingHorizontal = 'FILL'
  return comp
}

/** Arc path for a value, clockwise from 12 o'clock. */
function arc(cx: number, r: number, from: number, to: number): string {
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${(cx + r * Math.sin(a)).toFixed(3)} ${(cx - r * Math.cos(a)).toFixed(3)}`
  }
  return `M ${pt(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to)}`
}

/** SvCircularProgress.svelte:45-108: r = (size - thickness) / 2, round caps on the arc. */
function circular(color: string): ComponentNode {
  const size = 48
  const t = 5
  const r = (size - t) / 2
  const track = icon('Track', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="${t}"/></svg>`, size, '--sg-border')
  const value = icon('Arc', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path d="${arc(size / 2, r, 0, 0.72 * 360)}" fill="none" stroke="currentColor" stroke-width="${t}" stroke-linecap="round"/></svg>`, size, INTENT[color]!)
  const c = component({ name: vname({ Color: color }), dir: 'none', w: size, h: size })
  absolute(c, track, 0, 0)
  absolute(c, value, 0, 0)
  const label = frame({ name: 'Label', w: size, h: size, align: 'center', justify: 'center' }, text('72%', { size: 12.48, weight: 'bold' }))
  absolute(c, label, 0, 0)
  return c
}

/** SvSpinner.svelte:21-40: a 2px ring at 25% with the top quarter at full color. */
function spinner(size: Size): ComponentNode {
  const d = { sm: 15, md: 20, lg: 28 }[size]
  const r = (d - 2) / 2
  const ringNode = frame({ name: 'Track', dir: 'none', w: d, h: d, radius: 999, stroke: ['--sg-accent', 0.25], strokeWeight: 2 })
  const top = icon('Arc', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}"><path d="${arc(d / 2, r, -45, 45)}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`, d, '--sg-accent')
  const c = component({ name: vname({ Size: size }), dir: 'none', w: d, h: d })
  absolute(c, ringNode, 0, 0)
  absolute(c, top, 0, 0)
  return c
}

/** SvSkeleton.svelte:47-74: flat fill (the shimmer is motion). */
function skeleton(variant: 'Text' | 'Rect' | 'Circle'): ComponentNode {
  if (variant === 'Circle') return component({ name: vname({ Variant: variant }), w: 40, h: 40, radius: 999, fill: '--sg-skeleton-bg' })
  if (variant === 'Rect') return component({ name: vname({ Variant: variant }), w: 280, h: 120, radius: '--sg-radius', fill: '--sg-skeleton-bg' })
  const line = (w: number) => rect('Line', w, 11.9, '--sg-skeleton-bg', R())
  return component({ name: vname({ Variant: variant }), dir: 'v', gap: 8, w: 280 }, line(280), line(280), line(168))
}

/** Toast box, SvToaster.svelte:120-158. Info uses --sg-accent, not --sg-info. */
function toast(variant: string, actions: boolean): ComponentNode {
  const v = {
    Info: { c: '--sg-accent', glyph: 'ℹ', title: 'Sync started', msg: 'Orders are syncing in the background.' },
    Success: { c: '--sg-success', glyph: '✓', title: 'Order saved', msg: 'Order #10482 was saved.' },
    Warning: { c: '--sg-warning', glyph: '⚠', title: 'Slow connection', msg: 'Changes will sync when you are back online.' },
    Error: { c: '--sg-danger', glyph: '✕', title: 'Save failed', msg: 'The server rejected 2 rows. Check the highlighted cells.' },
  }[variant]!
  const btn = (label: string, primary: boolean) =>
    frame(
      { name: label, pad: [4, 11], radius: 6, stroke: primary ? v.c : '--sg-border' },
      text(label, { size: 12.5, weight: 'semibold', color: primary ? v.c : '--sg-muted', lineHeight: 18 }),
    )
  const c = component(
    { name: vname({ Variant: variant, Actions: actions ? 'True' : 'False' }), gap: 10, align: 'start', pad: [11, 12, 11, 14], w: 360, radius: 10, fill: '--sg-bg', stroke: '--sg-border', clip: true },
    frame({ name: 'Icon', w: 18, h: 18, align: 'center', justify: 'center' }, text(v.glyph, { size: 13, weight: 'bold', color: v.c })),
    frame(
      { name: 'Content', dir: 'v', gap: 1, w: 'fill' },
      text(v.title, { name: 'Title', size: 13, weight: 'semibold', lineHeight: 18.85 }),
      text(v.msg, { name: 'Message', size: 13, lineHeight: 18.85, w: 'fill' }),
      actions ? frame({ name: 'Actions', gap: 8, pad: [8, 0, 0, 0] }, btn('Dismiss', false), btn('Undo', true)) : null,
    ),
    frame({ name: 'Close', w: 22, h: 22, radius: 5, align: 'center', justify: 'center' }, text('×', { size: 17, lineHeight: 17, color: '--sg-muted' })),
  )
  const edge = rect('Start border', 3, c.height, v.c)
  absolute(c, edge, 0, 0)
  edge.constraints = { horizontal: 'MIN', vertical: 'STRETCH' }
  shadow(c, 'Toast')
  return c
}

/** SvEmptyState.svelte:34-58. */
const EMPTY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="12" width="32" height="26" rx="3"/><path d="M8 20h32"/><path d="M16 28h10"/></svg>'
function emptyState(compact: boolean, buttonSet: ComponentSetNode): ComponentNode {
  const tile = compact ? 48 : 66
  return component(
    { name: vname({ Compact: compact ? 'True' : 'False' }), dir: 'v', gap: 6, align: 'center', pad: compact ? [22, 16] : [44, 24], w: 420 },
    frame({ name: 'Icon tile', w: tile, h: tile, radius: 16, fill: '--sg-row-hover-bg', align: 'center', justify: 'center' }, icon('Icon', EMPTY_ICON, 44, '--sg-muted')),
    frame({ name: 'Gap', w: 1, h: 4 }),
    text('No orders yet', { name: 'Title', size: 15, weight: 'semibold' }),
    text('Orders show up here as soon as a customer checks out. You can also add one by hand.', { name: 'Description', size: 13, lineHeight: 20.15, color: '--sg-muted', w: 300, align: 'CENTER' }),
    frame({ name: 'Actions', gap: 8, pad: [8, 0, 0, 0] }, inst(buttonSet, { Variant: 'Primary', Size: 'md', State: 'Default' }, { Label: 'New order' })),
  )
}

// ============================================================= navigation

/** SvBreadcrumb.svelte:48-87: "/" separators, current item 600 in --sg-fg. */
function breadcrumb(collapsed: boolean): ComponentNode {
  const sep = () => text('/', { name: 'Separator', size: 13, color: '--sg-muted' })
  const crumb = (t: string) => text(t, { size: 13, color: '--sg-muted' })
  const items: SceneNode[] = [crumb('Home'), sep()]
  if (collapsed) {
    items.push(
      frame({ name: 'Ellipsis', h: 20, pad: [0, 7], radius: 5, fill: '--sg-row-hover-bg', align: 'center' }, text('…', { size: 13, color: '--sg-muted' })),
      sep(),
      crumb('Europe'),
      sep(),
    )
  } else {
    items.push(crumb('Sales'), sep(), crumb('Orders'), sep())
  }
  items.push(text('#10482', { name: 'Current', size: 13, weight: 'semibold' }))
  return component({ name: vname({ Collapsed: collapsed ? 'True' : 'False' }), gap: 6, align: 'center' }, ...items)
}

/** SvStepper.svelte:58-87: one step (marker + text). */
function step(state: 'Upcoming' | 'Active' | 'Complete'): ComponentNode {
  const marker = frame(
    {
      name: 'Marker',
      w: 28,
      h: 28,
      radius: 999,
      align: 'center',
      justify: 'center',
      fill: state === 'Active' ? '--sg-accent' : state === 'Complete' ? ['--sg-accent', 0.16] : '--sg-row-hover-bg',
      stroke: state === 'Complete' ? ['--sg-accent', 0.45] : undefined,
      strokeWeight: 2,
      strokeInLayout: false,
    },
    text(state === 'Complete' ? '✓' : '2', {
      name: 'Number',
      size: 13,
      weight: 'semibold',
      color: state === 'Active' ? '--sg-on-accent' : state === 'Complete' ? '--sg-accent' : '--sg-muted',
    }),
  )
  return component(
    { name: vname({ State: state }), gap: 10, align: 'center', pad: 4 },
    marker,
    frame(
      { name: 'Text', dir: 'v', gap: 1 },
      text('Profile', { name: 'Label', size: 13, weight: 'semibold', color: state === 'Upcoming' ? '--sg-muted' : '--sg-fg' }),
      text('Name and avatar', { name: 'Description', size: 11.5, color: '--sg-muted' }),
    ),
  )
}

/** SvAccordion.svelte:85-108: one item (header + body when expanded). */
function accordionItem(expanded: boolean, state: string): ComponentNode {
  const chev = icon('Chevron', chevron('m9 18 6-6-6-6', 2.5), 16, '--sg-muted')
  if (expanded) chev.rotation = -90
  const header = frame(
    { name: 'Header', gap: 8, align: 'center', pad: [12, 14], w: 'fill', fill: state === 'Hover' ? '--sg-row-hover-bg' : null, opacity: state === 'Disabled' ? 0.5 : undefined },
    chev,
    text('Shipping', { name: 'Label', size: 14, weight: 'semibold', lineHeight: 21, w: 'fill' }),
  )
  return component(
    { name: vname({ Expanded: expanded ? 'True' : 'False', State: state }), dir: 'v', w: 420, stroke: '--sg-border', strokeWeight: { top: 1 } },
    header,
    expanded
      ? frame(
          { name: 'Panel', pad: [4, 14, 16, 14], w: 'fill' },
          text('Orders placed before 2 pm ship the same day. Tracking numbers arrive by email once the carrier scans the parcel.', { name: 'Body', size: 13.5, lineHeight: 21.6, w: 'fill' }),
        )
      : null,
  )
}

/** SvPopover.svelte:178-196: 10px radius panel, 10px arrow on the anchor side. */
function popover(): ComponentNode {
  const arrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 7"><path d="M0 7 7 0l7 7z" fill="currentColor"/></svg>'
  const panel = frame(
    { name: 'Panel', dir: 'v', gap: 6, pad: [12, 14], w: 300, fill: '--sg-bg', stroke: '--sg-border', radius: 10 },
    text('Share this view', { name: 'Title', size: 13, weight: 'semibold' }),
    text('Anyone with the link sees the same filters, sort and column layout.', { name: 'Body', size: 13, lineHeight: 20.15, color: '--sg-muted', w: 'fill' }),
  )
  shadow(panel, 'Popup')
  return component(
    { name: 'Popover', dir: 'v', align: 'start', description: 'SvPopover, placement bottom-start with the arrow.' },
    frame({ name: 'Arrow row', pad: [0, 0, 0, 16] }, icon('Arrow', arrowSvg, { w: 14, h: 7 }, '--sg-bg')),
    panel,
  )
}

// ================================================================= builders

export type Hosts = Record<string, FrameNode>

export function buildInputs(h: Hosts): UiKit {
  const ta = variantSet('Textarea', h.textarea!, SIZES.flatMap((s) => ['Default', 'Focus', 'Invalid', 'Disabled'].map((st) => textArea(s, st))))
  textProp(ta, 'Label', 'Label', 'Delivery notes')
  textProp(ta, 'Value', 'Value', 'Leave parcels at the side door.\nCall on arrival.')
  boolProp(ta, 'Show count', 'Count', true)
  boolProp(ta, 'Show hint', 'Hint', false)
  matrix(ta, ['Size'], ['State'])

  const ni = variantSet('Number input', h.number!, SIZES.flatMap((s) => ['Default', 'Focus', 'Invalid', 'Disabled'].map((st) => numberInput(s, st))))
  textProp(ni, 'Label', 'Label', 'Quantity')
  textProp(ni, 'Value', 'Value', '1,250')
  boolProp(ni, 'Show hint', 'Hint', false)
  boolProp(ni, 'Spin buttons', 'Spin', true)
  matrix(ni, ['Size'], ['State'])

  const tg = variantSet('Tags input', h.tags!, SIZES.flatMap((s) => ['Default', 'Focus', 'Invalid', 'Disabled'].map((st) => tagsInput(s, st))))
  textProp(tg, 'Label', 'Label', 'Tags')
  boolProp(tg, 'Show hint', 'Hint', false)
  matrix(tg, ['Size'], ['State'])

  const sl = variantSet('Slider', h.slider!, SIZES.flatMap((s) => ['Default', 'Focus', 'Disabled'].map((st) => slider(s, st))))
  boolProp(sl, 'Show value', 'Value', false)
  matrix(sl, ['Size'], ['State'])

  return { Textarea: ta, 'Number input': ni, 'Tags input': tg, Slider: sl }
}

export function buildSelection(h: Hosts): UiKit {
  const sg = variantSet('Segmented', h.segmented!, SIZES.flatMap((s) => ['Default', 'Invalid', 'Disabled'].map((st) => segmented(s, st))))
  matrix(sg, ['Size'], ['State'])
  const rt = variantSet('Rating', h.rating!, SIZES.flatMap((s) => [0, 3, 5].map((v) => rating(s, v))))
  matrix(rt, ['Size'], ['Value'])
  return { Segmented: sg, Rating: rt }
}

export function buildActions(h: Hosts): UiKit {
  const tb = variantSet('Toggle button', h.toggle!, SIZES.flatMap((s) => ['Default', 'Hover', 'Pressed', 'Focus', 'Disabled'].map((st) => toggleButton(s, st))))
  textProp(tb, 'Label', 'Label', 'Bold')
  matrix(tb, ['Size'], ['State'])
  const bg = variantSet(
    'Button group',
    h.group!,
    (['Solid', 'Outline'] as const).flatMap((v) => SIZES.flatMap((s) => ['Default', 'Disabled'].map((st) => buttonGroup(v, s, st)))),
  )
  matrix(bg, ['Variant', 'Size'], ['State'])
  return { 'Toggle button': tb, 'Button group': bg }
}

export function buildDisplay(h: Hosts): UiKit {
  const av = variantSet(
    'Avatar',
    h.avatar!,
    SIZES.flatMap((s) => (['Circle', 'Square'] as const).flatMap((sh) => ['None', 'Online', 'Away', 'Busy', 'Offline'].map((st) => avatar(s, sh, st)))),
  )
  textProp(av, 'Initials', 'Initials', 'AL')
  matrix(av, ['Size', 'Shape'], ['Status'])

  // SvAvatarGroup.svelte:27-47: overlap 0.28 x size, 2px --sg-bg ring, first on top.
  const people = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Ken Thompson']
  const group = component({ name: 'Avatar group', gap: -10, align: 'center', description: 'SvAvatarGroup, max 4, size md.' })
  for (const name of people) {
    const a = inst(av, { Size: 'md', Shape: 'Circle', Status: 'None' }, { Initials: initials(name) })
    a.fills = []
    setFill(a, avatarColor(name))
    setStroke(a, '--sg-bg', 2, 'OUTSIDE')
    put(group, a)
  }
  const more = frame({ name: 'More', w: 36, h: 36, radius: 999, fill: '--sg-row-hover-bg', align: 'center', justify: 'center' }, text('+3', { size: 13, weight: 'semibold', color: '--sg-muted' }))
  setStroke(more, '--sg-bg', 2, 'OUTSIDE')
  put(group, more)
  group.itemReverseZIndex = true
  put(h.avatar!, group)

  const kb = variantSet('Kbd', h.kbd!, [kbd('sm'), kbd('md')])
  textProp(kb, 'Key', 'Key', 'K')
  matrix(kb, [], ['Size'])
  const combo = component(
    { name: 'Kbd combo', gap: 3, align: 'center', description: 'SvKbd with keys: caps joined by the separator.' },
    inst(kb, { Size: 'md' }, { Key: 'Ctrl' }),
    text('+', { size: 11, color: '--sg-muted' }),
    inst(kb, { Size: 'md' }, { Key: 'K' }),
  )
  put(h.kbd!, combo)

  const st = variantSet('Stat', h.stat!, (['Up', 'Down', 'Flat'] as const).map(stat))
  textProp(st, 'Label', 'Label', 'Revenue')
  textProp(st, 'Value', 'Value', '$48.2k')
  textProp(st, 'Hint', 'Hint', 'vs last month')
  matrix(st, [], ['Trend'])

  const cd = variantSet('Card', h.card!, [card('Default'), card('Hover')])
  textProp(cd, 'Title', 'Title', 'Revenue')
  textProp(cd, 'Subtitle', 'Subtitle', 'Last 30 days')
  boolProp(cd, 'Footer', 'Footer', true)
  matrix(cd, [], ['State'])

  return { Avatar: av, 'Avatar group': group, Kbd: kb, Stat: st, Card: cd }
}

export function buildFeedback(h: Hosts, buttonSet: ComponentSetNode): UiKit {
  const ts = variantSet('Toast', h.toast!, ['Info', 'Success', 'Warning', 'Error'].flatMap((v) => [false, true].map((a) => toast(v, a))))
  textProp(ts, 'Title', 'Title', 'Order saved')
  textProp(ts, 'Message', 'Message', 'Order #10482 was saved.')
  boolProp(ts, 'Dismissible', 'Close', true)
  matrix(ts, ['Variant'], ['Actions'])

  const pg = variantSet('Progress', h.progress!, Object.keys(INTENT).flatMap((c) => SIZES.map((s) => progress(c, s))))
  boolProp(pg, 'Show label', 'Label', true)
  matrix(pg, ['Color'], ['Size'])
  const cp = variantSet('Circular progress', h.progress!, Object.keys(INTENT).map(circular))
  boolProp(cp, 'Show label', 'Label', true)
  matrix(cp, [], ['Color'])

  const sp = variantSet('Spinner', h.spinner!, SIZES.map(spinner))
  matrix(sp, [], ['Size'])

  const sk = variantSet('Skeleton', h.skeleton!, (['Text', 'Rect', 'Circle'] as const).map(skeleton))
  matrix(sk, [], ['Variant'])

  const es = variantSet('Empty state', h.empty!, [emptyState(false, buttonSet), emptyState(true, buttonSet)])
  textProp(es, 'Title', 'Title', 'No orders yet')
  textProp(es, 'Description', 'Description', 'Orders show up here as soon as a customer checks out. You can also add one by hand.')
  boolProp(es, 'Actions', 'Actions', true)
  matrix(es, [], ['Compact'])

  return { Toast: ts, Progress: pg, 'Circular progress': cp, Spinner: sp, Skeleton: sk, 'Empty state': es }
}

export function buildNavigation(h: Hosts): UiKit {
  const bc = variantSet('Breadcrumb', h.breadcrumb!, [breadcrumb(false), breadcrumb(true)])
  matrix(bc, ['Collapsed'], [])

  const sp = variantSet('Step', h.stepper!, (['Upcoming', 'Active', 'Complete'] as const).map(step))
  textProp(sp, 'Label', 'Label', 'Profile')
  textProp(sp, 'Description', 'Description', 'Name and avatar')
  textProp(sp, 'Number', 'Number', '2')
  boolProp(sp, 'Show description', 'Description', true)
  matrix(sp, [], ['State'])
  // SvStepper.svelte:84-85: 2px connector, 8px margins; after a completed step it
  // takes color-mix(in srgb, accent 45%, border).
  const line = (done: boolean) => frame({ name: 'Connector', pad: [0, 8], w: 'fill', align: 'center' }, rect('Line', 60, 2, done ? '--sg-x-accent-border-45' : '--sg-border'))
  const stepper = component({ name: 'Stepper', align: 'center', w: 720, description: 'SvStepper, horizontal, current = 1.' })
  const parts: [string, string, string, string][] = [
    ['Complete', 'Account', 'Email and password', '1'],
    ['Active', 'Profile', 'Name and avatar', '2'],
    ['Upcoming', 'Confirm', 'Review and finish', '3'],
  ]
  parts.forEach(([state, label, desc, n], i) => {
    put(stepper, inst(sp, { State: state }, { Label: label, Description: desc, Number: n }))
    if (i < parts.length - 1) {
      const l = line(state === 'Complete')
      put(stepper, l)
      l.layoutSizingHorizontal = 'FILL'
      ;(l.children[0] as RectangleNode).layoutSizingHorizontal = 'FILL'
    }
  })
  put(h.stepper!, stepper)

  const ai = variantSet('Accordion item', h.accordion!, [true, false].flatMap((e) => ['Default', 'Hover', 'Disabled'].map((st) => accordionItem(e, st))))
  textProp(ai, 'Label', 'Label', 'Shipping')
  matrix(ai, ['Expanded'], ['State'])
  const acc = component({ name: 'Accordion', dir: 'v', w: 420, fill: '--sg-bg', stroke: '--sg-border', radius: '--sg-radius', clip: true, description: 'SvAccordion, single expand mode.' })
  const items: [boolean, string, string][] = [
    [true, 'Default', 'Shipping'],
    [false, 'Default', 'Payment'],
    [false, 'Disabled', 'Returns'],
  ]
  items.forEach(([e, st, label], i) => {
    const it = inst(ai, { Expanded: e ? 'True' : 'False', State: st }, { Label: label })
    put(acc, it)
    it.layoutSizingHorizontal = 'FILL'
    if (i === 0) it.strokeTopWeight = 0
  })
  put(h.accordion!, acc)

  return { Breadcrumb: bc, Step: sp, Stepper: stepper, 'Accordion item': ai, Accordion: acc }
}

export function buildPopover(host: FrameNode): UiKit {
  const p = popover()
  put(host, p)
  textProp(p, 'Title', 'Title', 'Share this view')
  textProp(p, 'Body', 'Body', 'Anyone with the link sees the same filters, sort and column layout.')
  return { Popover: p }
}
