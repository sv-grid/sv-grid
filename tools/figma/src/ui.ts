/**
 * The UI kit components, built from the measured spec of each Sv*.svelte file.
 * Each builder cites the component it reproduces. Heights assume a border-box
 * reset (the svgrid.com site and most app shells have one); see the README.
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
  ring,
  shadow,
  text,
  textProp,
  variantSet,
} from './lib'
import { BUTTON_ICON, UI_ICONS } from './icons'
import { example, heading, matrix, section, type DocInfo } from './doc'
import { buildActions, buildDisplay, buildFeedback, buildInputs, buildNavigation, buildPopover, buildSelection } from './ui2'

import { type Size, type UiKit, SIZES, R, vname, field, FIELD, borderFor, halo } from './fields'

export type { UiKit }


// ------------------------------------------------------------------ button

/** SvButton.svelte:61-95 */
const BTN: Record<Size, { py: number; px: number; fs: number }> = {
  sm: { py: 5, px: 10, fs: 12 },
  md: { py: 8, px: 14, fs: 13 },
  lg: { py: 11, px: 18, fs: 15 },
}
type ButtonVariant = 'Primary' | 'Secondary' | 'Outline' | 'Ghost' | 'Danger'
const BTN_LOOK: Record<ButtonVariant, { bg: Ink | null; fg: Ink; border: Ink | null; hover: Ink }> = {
  Primary: { bg: '--sg-accent', fg: '--sg-on-accent', border: null, hover: '--sg-x-accent-hover' },
  Secondary: { bg: '--sg-header-bg', fg: '--sg-fg', border: '--sg-border', hover: '--sg-row-hover-bg' },
  Outline: { bg: null, fg: '--sg-accent', border: '--sg-accent', hover: ['--sg-accent', 0.1] },
  Ghost: { bg: null, fg: '--sg-fg', border: null, hover: '--sg-row-hover-bg' },
  // SvButton.svelte:85-86 hard-codes the danger label to #fff.
  Danger: { bg: '--sg-danger', fg: '#ffffff', border: null, hover: '--sg-x-danger-hover' },
}

/** 13px spinner: a 2px ring with the top quarter transparent (SvButton.svelte:90-94). */
const SPINNER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.7" stroke-linecap="butt"><path d="M12 1.85a10.15 10.15 0 1 0 10.15 10.15"/></svg>'

function buttonVariant(variant: ButtonVariant, size: Size, state: string): ComponentNode {
  const s = BTN[size]
  const look = BTN_LOOK[variant]
  // A transparent 1px border still takes space; without a stroke, pad by 1 instead.
  const b = look.border ? 0 : 1
  const c = component(
    {
      name: vname({ Variant: variant, Size: size, State: state }),
      gap: 7,
      align: 'center',
      justify: 'center',
      pad: [s.py + b, s.px + b],
      fill: state === 'Hover' ? look.hover : look.bg,
      stroke: look.border ?? undefined,
      radius: '--sg-radius',
      opacity: state === 'Disabled' || state === 'Loading' ? 0.55 : undefined,
    },
    state === 'Loading' ? icon('Spinner', SPINNER, 13, look.fg) : null,
    icon('Icon', BUTTON_ICON, s.fs, look.fg),
    text('Button', { name: 'Label', size: s.fs, weight: 'semibold', lineHeight: s.fs, color: look.fg }),
  )
  if (state === 'Focus') ring(c, { width: 2, offset: 2, ink: '--sg-focus-ring', radius: R() })
  return c
}

function buttons(host: FrameNode): ComponentSetNode {
  const comps: ComponentNode[] = []
  for (const variant of Object.keys(BTN_LOOK) as ButtonVariant[])
    for (const size of SIZES)
      for (const state of ['Default', 'Hover', 'Focus', 'Disabled', 'Loading']) comps.push(buttonVariant(variant, size, state))
  const set = variantSet('Button', host, comps, { columns: 15, gap: 20, description: 'SvButton. Props: variant, size, disabled, loading, icon snippet.' })
  textProp(set, 'Label', 'Label', 'Button')
  boolProp(set, 'Icon', 'Icon', false)
  matrix(set, ['Variant', 'Size'], ['State'])
  return set
}

// --------------------------------------------------------------- inputs

/** SvTextInput.svelte + SvField.svelte:214-292 */
function textInput(size: Size, state: string): ComponentNode {
  const s = FIELD[size]
  const control = frame(
    {
      name: 'Control',
      align: 'center',
      pad: [0, 10],
      w: 220,
      h: s.h,
      fill: state === 'Read-only' ? '--sg-muted-bg' : '--sg-input-bg',
      stroke: borderFor(state),
      radius: '--sg-radius',
      opacity: state === 'Disabled' ? 0.6 : undefined,
    },
    text('Jane Cooper', { name: 'Value', size: s.fs, w: 'fill', truncate: true }),
    text('Placeholder', { name: 'Placeholder', size: s.fs, color: '--sg-muted', w: 'fill', truncate: true }),
  )
  halo(control, state)
  return field(vname({ Size: size, State: state }), control, state === 'Invalid')
}

function textInputs(host: FrameNode): ComponentSetNode {
  const comps = SIZES.flatMap((size) => ['Default', 'Focus', 'Invalid', 'Disabled', 'Read-only'].map((st) => textInput(size, st)))
  const set = variantSet('Text input', host, comps, {
    columns: 5,
    gap: 32,
    description: 'SvTextInput in its SvField frame. The input has no ::placeholder rule; the kit draws placeholders in text/muted.',
  })
  textProp(set, 'Label', 'Label', 'Label')
  textProp(set, 'Value', 'Value', 'Jane Cooper')
  textProp(set, 'Placeholder', 'Placeholder', 'Placeholder')
  textProp(set, 'Hint', 'Hint', 'Helper text')
  boolProp(set, 'Show label', 'Label', true)
  boolProp(set, 'Show hint', 'Hint', true)
  boolProp(set, 'Filled', 'Value', true)
  boolProp(set, 'Show placeholder', 'Placeholder', false)
  matrix(set, ['Size'], ['State'])
  return set
}

/** SvDropDownList.svelte:308-324 (trigger) */
function selectTrigger(size: Size, state: string): ComponentNode {
  const s = FIELD[size]
  const control = frame(
    {
      name: 'Trigger',
      align: 'center',
      justify: 'between',
      gap: 8,
      pad: [0, 10],
      w: 200,
      h: s.h,
      fill: '--sg-input-bg',
      stroke: borderFor(state),
      radius: '--sg-radius',
      opacity: state === 'Disabled' ? 0.6 : undefined,
    },
    text('Germany', { name: 'Value', size: s.fs, w: 'fill', truncate: true }),
    icon('Chevron', UI_ICONS['select-chevron'], 15, '--sg-muted'),
  )
  halo(control, state)
  return field(vname({ Size: size, State: state }), control, state === 'Invalid')
}

/** SvDropDownList.svelte:342-367 (option) */
function selectOption(state: string): ComponentNode {
  return component(
    {
      name: vname({ State: state }),
      align: 'center',
      pad: [7, 10],
      w: 190,
      radius: 6,
      fill: state === 'Hover' ? '--sg-row-hover-bg' : null,
      opacity: state === 'Disabled' ? 0.4 : undefined,
    },
    text('Option', {
      name: 'Label',
      size: 13,
      w: 'fill',
      truncate: true,
      weight: state === 'Selected' ? 'semibold' : 'regular',
      color: state === 'Selected' ? '--sg-accent' : '--sg-fg',
    }),
  )
}

function selects(host: FrameNode): { trigger: ComponentSetNode; option: ComponentSetNode; panel: ComponentNode } {
  const trigger = variantSet(
    'Select',
    host,
    SIZES.flatMap((size) => ['Default', 'Open', 'Invalid', 'Disabled'].map((st) => selectTrigger(size, st))),
    { columns: 4, gap: 32, description: 'SvDropDownList trigger. 200px wide by default (the text input is 220px).' },
  )
  textProp(trigger, 'Label', 'Label', 'Country')
  textProp(trigger, 'Value', 'Value', 'Germany')
  textProp(trigger, 'Hint', 'Hint', 'Helper text')
  boolProp(trigger, 'Show label', 'Label', true)
  boolProp(trigger, 'Show hint', 'Hint', false)
  matrix(trigger, ['Size'], ['State'])

  const option = variantSet('Select option', host, ['Default', 'Hover', 'Selected', 'Disabled'].map(selectOption), {
    gap: 12,
    description: 'SvDropDownList option. Selected = accent text at 600; there is no check mark.',
  })
  textProp(option, 'Label', 'Label', 'Option')
  matrix(option, [], ['State'])

  // SvDropDownList.svelte:326-330: 4px padding, 10px radius, popup shadow.
  const panel = component(
    { name: 'Select menu', dir: 'v', pad: 4, w: 200, fill: '--sg-bg', stroke: '--sg-border', radius: 10, description: 'SvDropDownList open panel.' },
  )
  const items: [string, string][] = [
    ['Austria', 'Default'],
    ['Belgium', 'Default'],
    ['France', 'Hover'],
    ['Germany', 'Selected'],
    ['Italy', 'Default'],
    ['Spain', 'Disabled'],
  ]
  for (const [label, state] of items) {
    const i = inst(option, { State: state }, { Label: label })
    put(panel, i)
    i.layoutSizingHorizontal = 'FILL'
  }
  shadow(panel, 'Popup')
  put(host, example('Open menu', panel))
  return { trigger, option, panel }
}

// ------------------------------------------------------------ choices

/** SvCheckBox.svelte:80-101 */
function checkbox(size: Size, checked: string, state: string): ComponentNode {
  const sz = { sm: 15, md: 18, lg: 22 }[size]
  const fs = { sm: 12, md: 13, lg: 15 }[size]
  const on = checked !== 'False'
  const box = frame(
    {
      name: 'Box',
      dir: 'none',
      w: sz,
      h: sz,
      radius: 5,
      fill: on ? '--sg-accent' : '--sg-input-bg',
      stroke: state === 'Invalid' ? '--sg-danger' : on ? '--sg-accent' : '--sg-border',
      strokeWeight: 1.5,
      strokeInLayout: false,
    },
  )
  if (on) absolute(box, icon('Glyph', checked === 'True' ? UI_ICONS.check : UI_ICONS.indeterminate, sz, '--sg-on-accent'), 0, 0)
  if (state === 'Focus') ring(box, { width: 2, offset: 2, ink: '--sg-focus-ring', radius: 5 })
  return component(
    { name: vname({ Size: size, Checked: checked, State: state }), gap: 8, align: 'center', opacity: state === 'Disabled' ? 0.55 : undefined },
    box,
    text('Checkbox label', { name: 'Label', size: fs }),
  )
}

/** SvRadioGroup.svelte:83-106 (dot is 17px at every size) */
function radio(checked: boolean, state: string): ComponentNode {
  const dot = frame(
    {
      name: 'Dot',
      dir: 'h',
      align: 'center',
      justify: 'center',
      w: 17,
      h: 17,
      radius: 999,
      fill: '--sg-input-bg',
      stroke: state === 'Invalid' ? '--sg-danger' : checked ? '--sg-accent' : '--sg-border',
      strokeWeight: 1.5,
      strokeInLayout: false,
    },
    checked ? rect('Inner', 9, 9, '--sg-accent', 999) : null,
  )
  if (state === 'Focus') ring(dot, { width: 2, offset: 2, ink: '--sg-focus-ring', radius: 8.5 })
  return component(
    { name: vname({ Checked: checked ? 'True' : 'False', State: state }), gap: 8, align: 'center', pad: 2, opacity: state === 'Disabled' ? 0.5 : undefined },
    dot,
    text('Radio label', { name: 'Label', size: 13 }),
  )
}

/** SvSwitchButton.svelte:77-107 */
function switchButton(size: Size, checked: boolean, state: string): ComponentNode {
  const { h, w } = { sm: { h: 18, w: 32 }, md: { h: 22, w: 40 }, lg: { h: 28, w: 52 } }[size]
  const track = frame({ name: 'Track', dir: 'none', w, h, radius: h / 2, fill: checked ? '--sg-accent' : '--sg-border' })
  const thumb = rect('Thumb', h - 4, h - 4, '#ffffff', 999)
  shadow(thumb, 'Switch thumb')
  absolute(track, thumb, checked ? w - h + 2 : 2, 2)
  if (state === 'Focus') ring(track, { width: 2, offset: 2, ink: '--sg-focus-ring', radius: h / 2 })
  return component(
    { name: vname({ Size: size, Checked: checked ? 'True' : 'False', State: state }), pad: 2, opacity: state === 'Disabled' ? 0.5 : undefined },
    track,
  )
}

function choices(hosts: { checkbox: FrameNode; radio: FrameNode; switch: FrameNode }): UiKit {
  const cb: ComponentNode[] = []
  for (const size of SIZES)
    for (const checked of ['False', 'True', 'Indeterminate'])
      for (const state of ['Default', 'Focus', 'Disabled', 'Invalid']) cb.push(checkbox(size, checked, state))
  const checkboxSet = variantSet('Checkbox', hosts.checkbox, cb, { columns: 12, gap: 24, description: 'SvCheckBox. The label is the children snippet.' })
  textProp(checkboxSet, 'Label', 'Label', 'Checkbox label')
  boolProp(checkboxSet, 'Show label', 'Label', true)
  matrix(checkboxSet, ['Checked', 'Size'], ['State'])

  const rd: ComponentNode[] = []
  for (const checked of [false, true]) for (const state of ['Default', 'Focus', 'Disabled', 'Invalid']) rd.push(radio(checked, state))
  const radioSet = variantSet('Radio', hosts.radio, rd, { columns: 4, gap: 24, description: 'SvRadioGroup item.' })
  textProp(radioSet, 'Label', 'Label', 'Radio label')
  matrix(radioSet, ['Checked'], ['State'])

  const sw: ComponentNode[] = []
  for (const size of SIZES) for (const checked of [false, true]) for (const state of ['Default', 'Focus', 'Disabled']) sw.push(switchButton(size, checked, state))
  const switchSet = variantSet('Switch', hosts.switch, sw, { columns: 6, gap: 24, description: 'SvSwitchButton. The thumb is a literal #fff in the CSS.' })
  matrix(switchSet, ['Size', 'Checked'], ['State'])
  return { Checkbox: checkboxSet, Radio: radioSet, Switch: switchSet }
}

// ------------------------------------------------------------ chips, badges

const TONES: Record<string, string> = {
  Neutral: '--sg-muted',
  Accent: '--sg-accent',
  Success: '--sg-success',
  Warning: '--sg-warning',
  Danger: '--sg-danger',
  Info: '--sg-info',
}

/** SvChip.svelte:59-87 */
function chip(tone: string, style: string, size: 'sm' | 'md', removable: boolean): ComponentNode {
  const c = TONES[tone]!
  const solid = style === 'Solid'
  const fg: Ink = solid ? '--sg-on-accent' : c
  const pad = size === 'sm' ? { y: 1, start: 8, end: removable ? 4 : 8 } : { y: 2, start: 10, end: removable ? 5 : 10 }
  return component(
    {
      name: vname({ Tone: tone, Style: style, Size: size, Removable: removable ? 'True' : 'False' }),
      gap: 5,
      align: 'center',
      h: size === 'sm' ? 22 : 26,
      pad: [pad.y, pad.end, pad.y, pad.start],
      radius: 999,
      fill: solid ? c : [c, 0.13],
      stroke: solid ? c : [c, 0.22],
    },
    text('Chip', { name: 'Label', size: size === 'sm' ? 11.5 : 12.5, weight: 'medium', color: fg }),
    removable
      ? frame(
          { name: 'Remove', w: 18, h: 18, radius: 999, align: 'center', justify: 'center' },
          text('×', { name: 'Glyph', size: 14, lineHeight: 14, color: fg, opacity: 0.7 }),
        )
      : null,
  )
}

/** SvBadge.svelte:34-53 */
function badge(tone: string, size: 'sm' | 'md', dot: boolean): ComponentNode {
  const c = TONES[tone]!
  const fs = size === 'sm' ? 10.5 : 12
  return component(
    {
      name: vname({ Tone: tone, Size: size, Dot: dot ? 'True' : 'False' }),
      gap: 5,
      align: 'center',
      pad: size === 'sm' ? [2, 7] : [3, 9],
      radius: 999,
      fill: [c, 0.14],
      stroke: [c, 0.26],
    },
    dot ? rect('Dot', 6, 6, c, 999) : null,
    text('Badge', { name: 'Label', size: fs, weight: 'semibold', lineHeight: fs, color: c }),
  )
}

function tags(hosts: { chip: FrameNode; badge: FrameNode }): UiKit {
  const chips: ComponentNode[] = []
  for (const tone of Object.keys(TONES))
    for (const style of ['Soft', 'Solid'])
      for (const size of ['sm', 'md'] as const) for (const rm of [false, true]) chips.push(chip(tone, style, size, rm))
  const chipSet = variantSet('Chip', hosts.chip, chips, { columns: 8, gap: 16, description: 'SvChip. Solid text is --sg-on-accent on every tone.' })
  textProp(chipSet, 'Label', 'Label', 'Chip')
  matrix(chipSet, ['Tone'], ['Style', 'Size', 'Removable'])

  const badges: ComponentNode[] = []
  for (const tone of Object.keys(TONES)) for (const size of ['sm', 'md'] as const) for (const dot of [false, true]) badges.push(badge(tone, size, dot))
  const badgeSet = variantSet('Badge', hosts.badge, badges, { columns: 4, gap: 16, description: 'SvBadge (pill). There is no solid badge.' })
  textProp(badgeSet, 'Label', 'Label', 'Badge')
  matrix(badgeSet, ['Tone'], ['Size', 'Dot'])
  return { Chip: chipSet, Badge: badgeSet }
}

// ------------------------------------------------------------------- tabs

/** SvTabs.svelte:177-227 */
function tab(variant: 'Line' | 'Pill', state: string): ComponentNode {
  const active = state === 'Active'
  const pill = variant === 'Pill'
  const c = component(
    {
      name: vname({ Variant: variant, State: state }),
      align: 'center',
      pad: pill ? [7, 14] : [9, 14],
      radius: pill ? 7 : 0,
      fill: pill && active ? '--sg-bg' : null,
      opacity: state === 'Disabled' ? 0.45 : undefined,
    },
    text('Tab', {
      name: 'Label',
      size: 13,
      weight: 'semibold',
      color: active ? (pill ? '--sg-fg' : '--sg-accent') : state === 'Hover' ? '--sg-fg' : '--sg-muted',
    }),
  )
  if (pill && active) shadow(c, 'Pill tab')
  if (!pill && active) {
    // ::after, 2px, inset 8px from each edge, 1px over the list divider.
    const bar = rect('Indicator', Math.max(c.width - 16, 1), 2, '--sg-accent')
    absolute(c, bar, 8, c.height - 1)
    bar.constraints = { horizontal: 'STRETCH', vertical: 'MAX' }
    c.clipsContent = false
  }
  return c
}

function tabs(host: FrameNode): UiKit {
  const tabSet = variantSet(
    'Tab',
    host,
    (['Line', 'Pill'] as const).flatMap((variant) => ['Default', 'Hover', 'Active', 'Disabled'].map((st) => tab(variant, st))),
    { columns: 4, gap: 16, description: 'SvTabs tab button.' },
  )
  textProp(tabSet, 'Label', 'Label', 'Tab')
  matrix(tabSet, ['Variant'], ['State'])

  const bar = (variant: 'Line' | 'Pill') => {
    const pill = variant === 'Pill'
    const list = component({
      name: vname({ Variant: variant }),
      gap: pill ? 3 : 2,
      pad: pill ? 3 : 0,
      radius: pill ? 9 : 0,
      fill: pill ? '--sg-header-bg' : null,
      stroke: pill ? undefined : '--sg-border',
      strokeWeight: pill ? undefined : { bottom: 1 },
    })
    ;['Overview', 'Orders', 'Customers', 'Settings'].forEach((label, i) => {
      put(list, inst(tabSet, { Variant: variant, State: i === 0 ? 'Active' : i === 3 ? 'Disabled' : 'Default' }, { Label: label }))
    })
    return list
  }
  const barSet = variantSet('Tabs', host, [bar('Line'), bar('Pill')], { gap: 24, description: 'SvTabs list. Line variant: 1px divider under the list.' })
  matrix(barSet, ['Variant'], [])
  return { Tab: tabSet, Tabs: barSet }
}

// ---------------------------------------------------------------- overlays

/** Modal/drawer header, body and footer (SvModal.svelte:209-224, SvDrawer.svelte:239-253). */
function dialogParts(buttonSet: ComponentSetNode, bodyFill: boolean): SceneNode[] {
  const header = frame(
    { name: 'Header', align: 'center', gap: 12, pad: [13, 16], w: 'fill', stroke: '--sg-border', strokeWeight: { bottom: 1 } },
    text('Edit customer', { name: 'Title', size: 15, weight: 'semibold', w: 'fill' }),
    frame(
      { name: 'Close', w: 28, h: 28, radius: 6, align: 'center', justify: 'center' },
      text('×', { name: 'Glyph', size: 20, lineHeight: 20, color: '--sg-muted' }),
    ),
  )
  const body = frame(
    { name: 'Body', dir: 'v', gap: 12, pad: 16, w: 'fill', h: bodyFill ? 'fill' : 'hug' },
    text('Changes apply to every open view of this customer. Saved rows are pushed to the server on close.', {
      name: 'Body text',
      size: 13.5,
      lineHeight: 21.6,
      w: 'fill',
    }),
  )
  const footer = frame(
    { name: 'Footer', justify: 'end', gap: 8, pad: [12, 16], w: 'fill', stroke: '--sg-border', strokeWeight: { top: 1 } },
    inst(buttonSet, { Variant: 'Secondary', Size: 'md', State: 'Default' }, { Label: 'Cancel' }),
    inst(buttonSet, { Variant: 'Primary', Size: 'md', State: 'Default' }, { Label: 'Save changes' }),
  )
  return [header, body, footer]
}

function overlays(hosts: { modal: FrameNode; drawer: FrameNode; tooltip: FrameNode; alert: FrameNode }, buttonSet: ComponentSetNode): UiKit {
  // SvModal.svelte:194-206: widths sm 360, md 520, lg 720; radius 12.
  const modals = (['sm', 'md', 'lg'] as const).map((size) => {
    const c = component(
      { name: vname({ Size: size }), dir: 'v', w: { sm: 360, md: 520, lg: 720 }[size], fill: '--sg-bg', stroke: '--sg-border', radius: 12, clip: true, strokeInLayout: false },
      ...dialogParts(buttonSet, false),
    )
    shadow(c, 'Dialog')
    return c
  })
  const modalSet = variantSet('Modal', hosts.modal, modals, { gap: 40, description: 'SvModal. Backdrop is rgba(15, 23, 42, 0.45) with a 1.5px blur.' })
  textProp(modalSet, 'Title', 'Title', 'Edit customer')
  textProp(modalSet, 'Body', 'Body text', 'Changes apply to every open view of this customer. Saved rows are pushed to the server on close.')
  boolProp(modalSet, 'Footer', 'Footer', true)
  matrix(modalSet, [], ['Size'])

  // SvDrawer.svelte:189-214: right side, min(400px, 92vw), border on the inner edge only.
  const drawer = component(
    { name: 'Drawer', dir: 'v', w: 400, h: 640, fill: '--sg-bg', stroke: '--sg-border', strokeWeight: { left: 1 }, description: 'SvDrawer, side="right".' },
    ...dialogParts(buttonSet, true),
  )
  shadow(drawer, 'Dialog')
  put(hosts.drawer, drawer)
  textProp(drawer, 'Title', 'Title', 'Edit customer')

  // SvTooltip.svelte:144-160: arrow is an 8px rotated square, 3px past the edge.
  const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"><path d="M0 0h10L5 5z" fill="currentColor"/></svg>'
  const tips = (['Top', 'Bottom'] as const).map((placement) => {
    const bubble = frame(
      { name: 'Bubble', pad: [5, 9], radius: 6, fill: '--sg-fg' },
      text('Copy row link', { name: 'Label', size: 12, weight: 'medium', lineHeight: 16.8, color: '--sg-bg' }),
    )
    shadow(bubble, 'Tooltip')
    const arrow = icon('Arrow', ARROW, { w: 10, h: 5 }, '--sg-fg')
    if (placement === 'Bottom') arrow.rotation = 180
    const c = component({ name: vname({ Placement: placement }), dir: 'v', gap: 0, align: 'start' })
    if (placement === 'Top') put(c, bubble, frame({ name: 'Arrow row', pad: [0, 0, 0, 12] }, arrow))
    else put(c, frame({ name: 'Arrow row', pad: [0, 0, 0, 12] }, arrow), bubble)
    return c
  })
  const tipSet = variantSet('Tooltip', hosts.tooltip, tips, { gap: 24, description: 'SvTooltip. Inverted: --sg-fg fill, --sg-bg text.' })
  textProp(tipSet, 'Label', 'Label', 'Copy row link')
  matrix(tipSet, [], ['Placement'])

  // SvAlert.svelte:68-91
  const ALERT: Record<string, { c: string; glyph: string; key: string }> = {
    Info: { c: '--sg-info', glyph: 'ℹ', key: 'info' },
    Success: { c: '--sg-success', glyph: '✓', key: 'success' },
    Warning: { c: '--sg-warning', glyph: '⚠', key: 'warning' },
    Danger: { c: '--sg-danger', glyph: '✕', key: 'danger' },
    Neutral: { c: '--sg-muted', glyph: '•', key: 'neutral' },
  }
  const alerts: ComponentNode[] = []
  for (const [tone, a] of Object.entries(ALERT)) {
    for (const style of ['Outline', 'Soft']) {
      const soft = style === 'Soft'
      const c = component(
        {
          name: vname({ Tone: tone, Style: style }),
          gap: 10,
          align: 'start',
          // Outline: 1px border all round plus a 3px start border (drawn below), so 12 + 3 - 1.
          pad: soft ? [11, 12] : [10, 11, 10, 14],
          w: 420,
          radius: 10,
          clip: true,
          fill: soft ? [a.c, 0.12] : '--sg-bg',
          stroke: soft ? undefined : `--sg-x-alert-${a.key}-border`,
        },
        frame(
          { name: 'Icon', w: 18, h: 18, align: 'center', justify: 'center' },
          text(a.glyph, { name: 'Glyph', size: 13, weight: 'bold', color: a.c }),
        ),
        frame(
          { name: 'Content', dir: 'v', gap: 1, w: 'fill' },
          text('Import finished', { name: 'Title', size: 13, weight: 'semibold', lineHeight: 19.5 }),
          text('412 rows were added. 3 rows were skipped because their IDs already exist.', { name: 'Message', size: 13, lineHeight: 19.5, w: 'fill' }),
        ),
        frame(
          { name: 'Dismiss', w: 22, h: 22, radius: 5, align: 'center', justify: 'center' },
          text('×', { name: 'Glyph', size: 17, lineHeight: 17, color: '--sg-muted' }),
        ),
      )
      if (!soft) {
        const edge = rect('Start border', 3, c.height, a.c)
        absolute(c, edge, 0, 0)
        edge.constraints = { horizontal: 'MIN', vertical: 'STRETCH' }
      }
      alerts.push(c)
    }
  }
  const alertSet = variantSet('Alert', hosts.alert, alerts, { columns: 2, gap: 24, description: 'SvAlert. Icons are text glyphs in the CSS, drawn here in Inter.' })
  textProp(alertSet, 'Title', 'Title', 'Import finished')
  textProp(alertSet, 'Message', 'Message', '412 rows were added. 3 rows were skipped because their IDs already exist.')
  boolProp(alertSet, 'Show title', 'Title', true)
  boolProp(alertSet, 'Dismissible', 'Dismiss', false)
  matrix(alertSet, ['Tone'], ['Style'])

  return { Modal: modalSet, Drawer: drawer, Tooltip: tipSet, Alert: alertSet }
}

// --------------------------------------------------------------- menus

/** SvMenuList.svelte:121-145 */
function menuItem(state: string): ComponentNode {
  return component(
    {
      name: vname({ State: state }),
      gap: 9,
      align: 'center',
      pad: [7, 10],
      w: 190,
      radius: 6,
      fill: state === 'Hover' ? '--sg-row-hover-bg' : null,
      opacity: state === 'Disabled' ? 0.45 : undefined,
    },
    frame({ name: 'Icon', w: 16, h: 16, align: 'center', justify: 'center' }, icon('Glyph', BUTTON_ICON, 14, '--sg-muted')),
    text('Menu item', { name: 'Label', size: 13, w: 'fill', truncate: true }),
    text('⌘K', { name: 'Shortcut', size: 11.5, color: '--sg-muted' }),
    icon('Submenu', UI_ICONS['menu-chevron'], 13, '--sg-muted'),
  )
}

function menus(host: FrameNode): UiKit {
  const itemSet = variantSet('Menu item', host, ['Default', 'Hover', 'Disabled'].map(menuItem), { gap: 12, description: 'SvMenuList item.' })
  textProp(itemSet, 'Label', 'Label', 'Menu item')
  textProp(itemSet, 'Shortcut', 'Shortcut', '⌘K')
  boolProp(itemSet, 'Show icon', 'Icon', true)
  boolProp(itemSet, 'Show shortcut', 'Shortcut', false)
  boolProp(itemSet, 'Submenu', 'Submenu', false)
  matrix(itemSet, [], ['State'])

  const sep = component({ name: 'Menu separator', pad: [4, 6], w: 190 }, rect('Line', 178, 1, '--sg-border'))
  const line = sep.children[0] as RectangleNode
  line.layoutSizingHorizontal = 'FILL'
  put(host, example('Separator', sep))

  const menu = component({ name: 'Menu', dir: 'v', pad: 4, w: 200, fill: '--sg-bg', stroke: '--sg-border', radius: 10, description: 'SvMenu surface.' })
  const add = (node: InstanceNode) => {
    put(menu, node)
    node.layoutSizingHorizontal = 'FILL'
  }
  add(inst(itemSet, { State: 'Default' }, { Label: 'Cut', Shortcut: '⌘X', 'Show shortcut': true }))
  add(inst(itemSet, { State: 'Hover' }, { Label: 'Copy', Shortcut: '⌘C', 'Show shortcut': true }))
  add(inst(itemSet, { State: 'Default' }, { Label: 'Paste', Shortcut: '⌘V', 'Show shortcut': true }))
  add(sep.createInstance())
  add(inst(itemSet, { State: 'Default' }, { Label: 'Export', Submenu: true }))
  add(inst(itemSet, { State: 'Disabled' }, { Label: 'Share' }))
  shadow(menu, 'Popup')
  put(host, example('Open menu', menu))
  return { 'Menu item': itemSet, 'Menu separator': sep, Menu: menu }
}

// ------------------------------------------------------------ pagination

/** SvPagination.svelte:84-99 (md) */
function pageButton(state: string): ComponentNode {
  const active = state === 'Active'
  return component(
    {
      name: vname({ State: state }),
      align: 'center',
      justify: 'center',
      pad: [0, 7],
      h: 32,
      fill: active ? '--sg-accent' : state === 'Hover' ? '--sg-row-hover-bg' : '--sg-input-bg',
      stroke: active ? '--sg-accent' : state === 'Hover' ? '--sg-x-page-hover-border' : '--sg-border',
      radius: '--sg-radius',
      opacity: state === 'Disabled' ? 0.45 : undefined,
    },
    text('1', { name: 'Label', size: 13, align: 'CENTER', weight: active ? 'semibold' : 'regular', color: active ? '--sg-on-accent' : '--sg-fg' }),
  )
}

function pagination(host: FrameNode): UiKit {
  const comps = ['Default', 'Hover', 'Active', 'Disabled'].map(pageButton)
  for (const c of comps) c.minWidth = 32
  const btn = variantSet('Page button', host, comps, { gap: 12, description: 'SvPagination button, size md: 32px min.' })
  textProp(btn, 'Label', 'Label', '1')
  matrix(btn, [], ['State'])

  const pager = component({ name: 'Pagination', gap: 4, align: 'center', description: 'SvPagination, siblingCount 1, boundaryCount 1.' })
  const add = (label: string, state = 'Default') => put(pager, inst(btn, { State: state }, { Label: label }))
  add('‹', 'Disabled')
  add('1', 'Active')
  add('2')
  add('3')
  put(pager, frame({ name: 'Ellipsis', w: 32, h: 32, align: 'center', justify: 'center' }, text('…', { size: 13, color: '--sg-muted' })))
  add('20')
  add('›')
  put(host, example('Pagination', pager))
  return { 'Page button': btn, Pagination: pager }
}

// ----------------------------------------------------------- date picker

/** SvCalendar.svelte:421-479 day cell */
function day(state: string): ComponentNode {
  const selected = state === 'Selected'
  const today = state === 'Today'
  const c = component(
    {
      name: vname({ State: state }),
      align: 'center',
      justify: 'center',
      w: 34,
      h: 34,
      radius: '--sg-radius',
      fill: state === 'Hover' ? '--sg-row-hover-bg' : null,
      pad: selected ? 2 : 0,
    },
  )
  const label = text('14', {
    name: 'Day',
    size: 12.5,
    align: 'CENTER',
    weight: selected ? 'semibold' : today ? 'bold' : 'regular',
    color: selected ? '--sg-on-accent' : state === 'Outside' || state === 'Disabled' ? '--sg-muted' : '--sg-fg',
    opacity: state === 'Outside' ? 0.55 : state === 'Disabled' ? 0.35 : undefined,
    strike: state === 'Disabled',
  })
  if (selected) {
    // padding 2px + background-clip: content-box: a 30px fill inside the 34px cell.
    const fill = frame({ name: 'Fill', w: 'fill', h: 'fill', radius: Math.max(R() - 2, 0), fill: '--sg-accent', align: 'center', justify: 'center' }, label)
    put(c, fill)
  } else {
    put(c, label)
  }
  // box-shadow: inset 0 0 0 1px accent, so the ring sits inside the cell.
  if (today) ring(c, { width: 1, offset: -1, ink: '--sg-accent', radius: R(), name: 'Today ring' })
  return c
}

function datePicker(host: FrameNode): UiKit {
  const daySet = variantSet('Calendar day', host, ['Default', 'Hover', 'Today', 'Selected', 'Outside', 'Disabled'].map(day), {
    gap: 12,
    description: 'SvCalendar day cell, 34px. Selected fill is 30px (2px padding, content-box clip).',
  })
  textProp(daySet, 'Day', 'Day', '14')
  matrix(daySet, [], ['State'])

  // October 2026, firstDayOfWeek 0, today = the 7th, selected = the 14th.
  const navBtn = (name: string, svg: string) =>
    frame({ name, w: 30, h: 30, radius: '--sg-radius', align: 'center', justify: 'center' }, icon('Chevron', svg, 16, '--sg-muted'))
  const header = frame(
    { name: 'Header', gap: 4, align: 'center', w: 'fill' },
    navBtn('Previous', UI_ICONS['month-prev']),
    frame({ name: 'Title', w: 'fill', pad: [6, 8], justify: 'center', radius: '--sg-radius' }, text('October 2026', { size: 13.5, weight: 'semibold' })),
    navBtn('Next', UI_ICONS['month-next']),
  )
  const weekdays = frame(
    { name: 'Weekdays' },
    ...['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) =>
      frame({ name: d, w: 34, h: 28, align: 'center', justify: 'center' }, text(d, { size: 11, weight: 'semibold', color: '--sg-muted', upper: true, letterSpacing: 0.22 })),
    ),
  )
  const grid = frame({ name: 'Days', dir: 'v' })
  const first = new Date(2026, 9, 1).getDay()
  const start = new Date(2026, 9, 1 - first)
  for (let w = 0; w < 6; w++) {
    const row = frame({ name: `Week ${w + 1}` })
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      const n = date.getDate()
      const inMonth = date.getMonth() === 9
      const state = !inMonth ? 'Outside' : n === 14 ? 'Selected' : n === 7 ? 'Today' : 'Default'
      put(row, inst(daySet, { State: state }, { Day: String(n) }))
    }
    put(grid, row)
  }
  const calendar = component(
    {
      name: 'Calendar',
      dir: 'v',
      gap: 6,
      pad: 10,
      fill: '--sg-bg',
      stroke: '--sg-border',
      radius: R() + 4,
      description: 'SvCalendar, single month. Radius is calc(var(--sg-radius) + 4px).',
    },
    header,
    weekdays,
    grid,
  )
  put(host, example('Calendar', calendar))

  // SvDateTimePicker.svelte:254-289 trigger, always 34px.
  const iconBtn = (name: string, child: SceneNode) => frame({ name, w: 26, h: 26, radius: 6, align: 'center', justify: 'center' }, child)
  const triggers = ['Default', 'Focus', 'Disabled'].map((state) => {
    const control = frame(
      {
        name: 'Field',
        gap: 2,
        align: 'center',
        pad: [0, 4, 0, 0],
        w: 240,
        h: 34,
        fill: '--sg-input-bg',
        stroke: borderFor(state),
        radius: '--sg-radius',
        opacity: state === 'Disabled' ? 0.6 : undefined,
      },
      frame({ name: 'Input', pad: [0, 8], w: 'fill' }, text('2026-10-14 09:30', { name: 'Value', size: 13 })),
      iconBtn('Clear', text('×', { size: 17, lineHeight: 17, color: '--sg-muted' })),
      iconBtn('Toggle', icon('Calendar', UI_ICONS.calendar, 16, '--sg-muted')),
    )
    halo(control, state)
    return field(vname({ State: state }), control, false)
  })
  const triggerSet = variantSet('Date picker', host, triggers, { gap: 32, description: 'SvDateTimePicker trigger. No size prop: always 34px.' })
  textProp(triggerSet, 'Label', 'Label', 'Delivery date')
  textProp(triggerSet, 'Value', 'Value', '2026-10-14 09:30')
  boolProp(triggerSet, 'Show hint', 'Hint', false)
  matrix(triggerSet, [], ['State'])

  // SvDateTimePicker.svelte:292-307 popup: DATE / TIME tabs over the calendar.
  const tabBtn = (label: string, active: boolean) =>
    frame(
      { name: label, w: 'fill', pad: [9, 9], justify: 'center', stroke: active ? '--sg-accent' : undefined, strokeWeight: { bottom: 2 } },
      text(label, { size: 11, weight: 'bold', upper: true, letterSpacing: 0.44, color: active ? '--sg-accent' : '--sg-muted' }),
    )
  const panel = component(
    { name: 'Date picker panel', dir: 'v', fill: '--sg-bg', stroke: '--sg-border', radius: 12, clip: true, description: 'SvDateTimePicker popup, date tab.' },
    frame({ name: 'Tabs', w: 'fill', stroke: '--sg-border', strokeWeight: { bottom: 1 } }, tabBtn('Date', true), tabBtn('Time', false)),
    frame({ name: 'Body', pad: 8, justify: 'center', w: 'fill' }, calendar.createInstance()),
  )
  shadow(panel, 'Popup')
  put(host, example('Open panel', panel))
  return { 'Calendar day': daySet, Calendar: calendar, 'Date picker': triggerSet, 'Date picker panel': panel }
}

// ---------------------------------------------------------------- build

/**
 * Build every UI card, grouped by category. Card stages are created in page
 * order first, then filled in dependency order (buttons before the dialogs
 * and empty state that use them). Returns the page's frames in order.
 */
export function buildUi(): { sections: FrameNode[]; kit: UiKit } {
  const sections: FrameNode[] = []
  const kit: UiKit = {}
  const cat = (title: string, blurb: string) => sections.push(heading(title, blurb))
  const sec = (title: string, source: string, note: string | undefined, doc: DocInfo) => {
    const s = section(title, source, note, doc)
    sections.push(s)
    return s
  }
  const SEVERITY = "'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' = 'neutral'"

  // ------------------------------------------------------------- Actions
  cat('Actions', 'Things people press: a single action, a pressed/unpressed toggle, and a group of related actions.')
  const sButton = sec('Button', 'packages/grid/src/SvButton.svelte', 'Heights follow from padding plus a 1px border at line-height 1: 24, 31 and 39px. There is no pressed style in the CSS.', {
    summary: 'Actions. Primary is the one accent-filled action on a surface; danger confirms something destructive.',
    usage: '<SvButton variant="primary" size="md">\n  Save changes\n</SvButton>\n<SvButton variant="secondary" loading>\n  Saving\n</SvButton>',
    props: [
      ['variant', "'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' = 'primary'"],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['loading', 'boolean = false'],
      ['disabled', 'boolean = false'],
      ['block', 'boolean = false'],
      ['href', 'string (renders an <a>)'],
      ['icon', 'Snippet'],
    ],
  })
  const sToggle = sec('Toggle button', 'packages/grid/src/SvToggleButton.svelte', 'Pressed fills with the accent. pressed is not bindable: pass it and update it in onChange.', {
    summary: 'An on/off button for a formatting or view option.',
    usage: '<SvToggleButton\n  pressed={bold}\n  onChange={(p) => (bold = p)}\n  ariaLabel="Bold">Bold</SvToggleButton>',
    props: [
      ['pressed', 'boolean = false'],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['disabled', 'boolean = false'],
      ['invalid', 'boolean = false'],
    ],
  })
  const sGroup = sec('Button group', 'packages/grid/src/SvButtonGroup.svelte', 'Line height is inherited, so button heights follow the host font; the kit uses Inter at 1.21.', {
    summary: 'Related actions or a single choice in one bordered strip.',
    usage: "<SvButtonGroup\n  items={[\n    { value: 'left', label: 'Left' },\n    { value: 'center', label: 'Center' },\n  ]}\n  value={align}\n  onChange={(v) => (align = v)}\n/>",
    props: [
      ['items', 'ButtonGroupItem[] ({ value, label?, disabled? })'],
      ['mode', "'single' | 'multiple' | 'none' = 'single'"],
      ['variant', "'solid' | 'outline' = 'solid'"],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['orientation', "'horizontal' | 'vertical' = 'horizontal'"],
    ],
  })

  // -------------------------------------------------------------- Inputs
  cat('Inputs', 'Text, numbers, dates and lists of values. All share the SvField frame: label above, hint or error below.')
  const sText = sec('Text input', 'packages/grid/src/SvTextInput.svelte, SvField.svelte', 'The input has no ::placeholder rule; placeholders here use text/muted. Switch with the Filled and Show placeholder properties.', {
    summary: 'Single-line text entry in the shared field frame: label, control, then hint or error.',
    usage: '<SvTextInput\n  label="Name"\n  hint="As it appears on invoices"\n  placeholder="Jane Cooper"\n  bind:value={name}\n/>',
    props: [
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['type', "'text' | 'email' | 'url' | 'tel' | 'search' = 'text'"],
      ['label / hint / error', 'string'],
      ['invalid', 'boolean = false'],
      ['readonly', 'boolean = false'],
      ['clearable', 'boolean = false'],
      ['labelMode', "'static' | 'floating' = 'static'"],
    ],
  })
  const sTextarea = sec('Textarea', 'packages/grid/src/SvTextArea.svelte', 'Width 260px. The textarea inherits its line height, so row height follows the host font.', {
    summary: 'Multi-line text, with an optional character count.',
    usage: '<SvTextArea\n  label="Notes"\n  bind:value={notes}\n  rows={3}\n  maxlength={200}\n  showCount\n/>',
    props: [
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['rows', 'number = 3'],
      ['maxlength / showCount', 'number / boolean = false'],
      ['autoGrow', 'boolean = false'],
      ['invalid', 'boolean = false'],
    ],
  })
  const sNumber = sec('Number input', 'packages/grid/src/SvNumberInput.svelte', 'The value aligns right. Width defaults to 150px.', {
    summary: 'Numeric entry with step buttons, min and max.',
    usage: '<SvNumberInput\n  label="Quantity"\n  bind:value={qty}\n  min={0}\n  max={99}\n/>',
    props: [
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['width', 'number = 150'],
      ['spinButtons', 'boolean = true'],
      ['clearable', 'boolean = false'],
      ['prefix / suffix', "string = '' (formatted into the value)"],
    ],
  })
  const sSelect = sec('Select', 'packages/grid/src/SvDropDownList.svelte', 'The trigger is 200px wide by default; the text input is 220px. The selected option is accent text at 600, with no check mark.', {
    summary: 'Pick one value from a list. The open panel shows up to maxRows options before it scrolls.',
    usage: "<SvDropDownList\n  label=\"Country\"\n  options={[\n    { value: 'de', label: 'Germany' },\n    { value: 'fr', label: 'France' },\n  ]}\n  bind:value={country}\n/>",
    props: [
      ['options', 'ListOption[] ({ value, label, disabled?, group? })'],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['placeholder', "string = 'Select…'"],
      ['rowHeight', 'number = 34'],
      ['maxRows', 'number = 8'],
    ],
  })
  const sTags = sec('Tags input', 'packages/grid/src/SvTagsInput.svelte', 'An sm box still renders 34px tall: its 24px input plus padding exceeds the 28px minimum.', {
    summary: 'Free-form values typed one at a time, shown as removable tags.',
    usage: '<SvTagsInput label="Tags" bind:value={tags} />',
    props: [
      ['value', 'string[] = [] (bindable)'],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['placeholder', "string = 'Add tag…'"],
      ['invalid / disabled', 'boolean = false'],
    ],
  })
  const sDate = sec('Date picker', 'SvDateTimePicker.svelte, SvCalendar.svelte', 'The trigger has no size prop and is always 34px. Today has a 1px accent ring; the selected day fills 30px inside its 34px cell.', {
    summary: 'Date and time entry with a calendar panel.',
    usage: '<SvDateTimePicker\n  label="Delivery date"\n  bind:value={due}\n/>',
    props: [
      ['value', 'DateTimeValue (bindable)'],
      ['formatString', "string = 'yyyy-MM-dd HH:mm'"],
      ['firstDayOfWeek', 'number = 0'],
      ['hourFormat', "'24-hour' | '12-hour' = '24-hour'"],
      ['dropDownDisplayMode', "'date' | 'time' | 'both' = 'both'"],
    ],
  })
  const sSlider = sec('Slider', 'packages/grid/src/SvSlider.svelte', 'The thumb is a literal #fff in the CSS, so it stays white in dark themes. value is not bindable: use onChange.', {
    summary: 'A value picked along a range. Use showValue for the bubble above the thumb.',
    usage: '<SvSlider\n  label="Volume"\n  value={volume}\n  onChange={(v) => (volume = v)}\n  showValue\n/>',
    props: [
      ['size', "'sm' | 'md' | 'lg' = 'md' (180 / 240 / 300px)"],
      ['min / max', 'number = 0 / 100'],
      ['range', 'boolean = false'],
      ['showValue', 'boolean = false'],
      ['labels', "'none' | 'endpoints' | 'all' = 'none'"],
    ],
  })

  // ----------------------------------------------------------- Selection
  cat('Selection', 'Choosing from a fixed set: one option, several, on or off, or a score.')
  const sCheck = sec('Checkbox', 'packages/grid/src/SvCheckBox.svelte', undefined, {
    summary: 'A yes/no choice. The label is the children snippet; indeterminate shows a dash for a partly selected group.',
    usage: '<SvCheckBox bind:checked={agree}>\n  Email me a receipt\n</SvCheckBox>',
    props: [
      ['checked', 'boolean = false'],
      ['indeterminate', 'boolean = false'],
      ['size', "'sm' | 'md' | 'lg' = 'md' (15 / 18 / 22px)"],
      ['invalid', 'boolean = false'],
    ],
  })
  const sRadio = sec('Radio group', 'packages/grid/src/SvRadioGroup.svelte', 'The dot is 17px at every size; size only changes the label.', {
    summary: 'One choice from a short, visible list.',
    usage: "<SvRadioGroup\n  options={[\n    { value: 'free', label: 'Free' },\n    { value: 'pro', label: 'Pro' },\n  ]}\n  bind:value={plan}\n/>",
    props: [
      ['options', 'RadioOption[]'],
      ['orientation', "'vertical' | 'horizontal' = 'vertical'"],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
    ],
  })
  const sSwitch = sec('Switch', 'packages/grid/src/SvSwitchButton.svelte', 'The thumb is a literal #fff in the CSS, so it stays white in dark themes.', {
    summary: 'An on/off setting that applies immediately.',
    usage: '<SvSwitchButton bind:checked={alerts} label="Alerts" />',
    props: [
      ['checked', 'boolean = false'],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['onLabel / offLabel', 'string'],
    ],
  })
  const sSeg = sec('Segmented control', 'packages/grid/src/SvSegmented.svelte', 'The track radius is calc(var(--sg-radius) + 2px).', {
    summary: 'A compact single choice between two to five views or modes.',
    usage: "<SvSegmented\n  label=\"View\"\n  options={[\n    { value: 'list', label: 'List' },\n    { value: 'grid', label: 'Grid' },\n  ]}\n  bind:value={view}\n/>",
    props: [
      ['options', '{ value, label, disabled?, icon? }[]'],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['block', 'boolean = false'],
      ['invalid / disabled', 'boolean = false'],
    ],
  })
  const sRating = sec('Rating', 'packages/grid/src/SvRating.svelte', 'Half stars (allowHalf) draw a hard-stop gradient and are not modelled here.', {
    summary: 'A score out of max stars.',
    usage: '<SvRating\n  label="Score"\n  value={stars}\n  onChange={(v) => (stars = v)}\n/>',
    props: [
      ['value', 'number = 0'],
      ['max', 'number = 5'],
      ['allowHalf', 'boolean = false'],
      ['size', "'sm' | 'md' | 'lg' = 'md' (16 / 22 / 30px)"],
      ['readonly', 'boolean = false'],
    ],
  })

  // ---------------------------------------------------------- Navigation
  cat('Navigation', 'Moving between views, steps, pages and sections.')
  const sTabs = sec('Tabs', 'packages/grid/src/SvTabs.svelte', undefined, {
    summary: 'Switch between views of the same context. Line tabs sit on a divider; pill tabs sit in a tray.',
    usage: "<SvTabs\n  tabs={[\n    { id: 'overview', label: 'Overview' },\n    { id: 'orders', label: 'Orders' },\n  ]}\n  bind:value={tab}\n  variant=\"line\"\n/>",
    props: [
      ['tabs', 'TabItem[] ({ id, label, disabled?, closable? })'],
      ['variant', "'line' | 'pill' = 'line'"],
      ['tabPosition', "'top' | 'bottom' | 'left' | 'right' = 'top'"],
      ['activation', "'automatic' | 'manual' = 'automatic'"],
    ],
  })
  const sCrumb = sec('Breadcrumb', 'packages/grid/src/SvBreadcrumb.svelte', 'The default separator is the text "/" (the prop comment says chevron; the code says "/"). Past maxItems the middle collapses into an ellipsis button.', {
    summary: 'Where the current page sits in the hierarchy.',
    usage: "<SvBreadcrumb\n  items={[\n    { label: 'Home', href: '/' },\n    { label: 'Orders', href: '/orders' },\n    { label: '#1024' },\n  ]}\n/>",
    props: [
      ['items', 'BreadcrumbItem[] ({ label, href?, onClick?, icon? })'],
      ['separator', "string = '/'"],
      ['maxItems', 'number'],
    ],
  })
  const sStepper = sec('Stepper', 'packages/grid/src/SvStepper.svelte', 'Steps before current are complete, current is active, the rest upcoming. There is no hover or disabled look.', {
    summary: 'Progress through a fixed sequence, such as a checkout or a setup flow.',
    usage: "<SvStepper\n  steps={[\n    { label: 'Account' },\n    { label: 'Profile', optional: true },\n    { label: 'Confirm' },\n  ]}\n  current={step}\n  onChange={(n) => (step = n)}\n/>",
    props: [
      ['steps', 'StepItem[] ({ label, description?, optional? })'],
      ['current', 'number (0-based)'],
      ['linear', 'boolean = true'],
      ['orientation', "'horizontal' | 'vertical' = 'horizontal'"],
    ],
  })
  const sPager = sec('Pagination', 'packages/grid/src/SvPagination.svelte', 'The grid has its own pager in its footer; this is the standalone control.', {
    summary: 'Page through a list that is not a grid, or a grid with its pager turned off.',
    usage: '<SvPagination bind:page pageCount={20} />',
    props: [
      ['page / pageCount', 'number'],
      ['size', "'sm' | 'md' | 'lg' = 'md'"],
      ['siblingCount', 'number = 1'],
      ['boundaryCount', 'number = 1'],
      ['showFirstLast', 'boolean = false'],
    ],
  })
  const sMenu = sec('Menu', 'SvMenu.svelte, SvMenuList.svelte', 'Items are 7px 10px with a 16px icon column. Submenus open in a flyout with a slightly smaller shadow.', {
    summary: 'A list of commands opened from a trigger.',
    usage: "<SvMenu\n  items={[\n    { label: 'Copy', shortcut: 'Ctrl+C' },\n    { separator: true },\n    { label: 'Delete' },\n  ]}\n  bind:open={menuOpen}\n/>",
    props: [
      ['items', 'MenuItem[] ({ label, icon?, shortcut?, disabled?, separator?, items? })'],
      ['open', 'boolean = false (bindable)'],
    ],
  })
  const sAcc = sec('Accordion', 'packages/grid/src/SvAccordion.svelte', 'Header height follows the inherited line height; the kit assumes 1.5. A disabled accordion renders headers at 0.6 x 0.5 opacity.', {
    summary: 'Sections that expand one at a time (or several, with expandMode="multiple").',
    usage: "<SvAccordion items={sections} bind:expanded={open}>\n  {#snippet panel(item)}\n    <p>Details for {item.label}.</p>\n  {/snippet}\n</SvAccordion>",
    props: [
      ['items', 'AccordionItem[] ({ id, label, disabled? })'],
      ['expanded', 'string[] = [] (bindable)'],
      ['expandMode', "'single' | 'multiple' = 'single'"],
    ],
  })

  // -------------------------------------------------------- Data display
  cat('Data display', 'People, keys, numbers and status, shown compactly.')
  const sAvatar = sec('Avatar', 'packages/grid/src/SvAvatar.svelte, avatar.ts', 'Without an image the background is hsl(h 62% 45%), where h hashes the name, and the initials are a literal #fff. The kit uses "Ada Lovelace" (hue 235).', {
    summary: 'A person: their photo, or initials on a color derived from their name. Groups overlap by 28% of the size.',
    usage: '<SvAvatar name="Ada Lovelace" status="online" />\n<SvAvatarGroup avatars={team} max={3} />',
    props: [
      ['name', "string = ''"],
      ['src', 'string'],
      ['size', "'sm' | 'md' | 'lg' | number = 'md' (28 / 36 / 48)"],
      ['shape', "'circle' | 'square' = 'circle'"],
      ['status', "'online' | 'offline' | 'busy' | 'away'"],
    ],
  })
  const sBadge = sec('Badge', 'packages/grid/src/SvBadge.svelte', 'Fill is the tone at 14%, border at 26%. There is no solid badge.', {
    summary: 'A status label. In the grid, badge cells carry row status.',
    usage: '<SvBadge variant="success" dot>\n  Active\n</SvBadge>',
    props: [
      ['variant', SEVERITY],
      ['size', "'sm' | 'md' = 'md'"],
      ['dot', 'boolean = false'],
      ['pill', 'boolean = true'],
    ],
  })
  const sChip = sec('Chip', 'packages/grid/src/SvChip.svelte', 'Soft chips fill with the tone at 13% and outline it at 22%: color-mix(in srgb, tone N%, transparent).', {
    summary: 'A compact value, filter or selection. Removable chips end in a dismiss button.',
    usage: '<SvChip variant="accent" removable>\n  Germany\n</SvChip>',
    props: [
      ['variant', SEVERITY],
      ['size', "'sm' | 'md' = 'md' (22 / 26px)"],
      ['solid', 'boolean = false'],
      ['removable', 'boolean = false'],
    ],
  })
  const sKbd = sec('Kbd', 'packages/grid/src/SvKbd.svelte', 'The only component that sets a font family: --sg-font-mono, which no theme defines, so it falls back to ui-monospace.', {
    summary: 'A key or shortcut, as in "press Ctrl + K".',
    usage: "<SvKbd keys={['Ctrl', 'K']} />\n<SvKbd>Esc</SvKbd>",
    props: [
      ['keys', 'string[]'],
      ['separator', "string = '+'"],
      ['size', "'sm' | 'md' = 'md'"],
    ],
  })
  const sStat = sec('Stat', 'packages/grid/src/SvStat.svelte', 'A string delta only shows when trend is passed too; a numeric delta infers it.', {
    summary: 'One number with its label and change, for dashboards above a grid.',
    usage: '<SvStat\n  label="Revenue"\n  value="$48.2k"\n  delta={12.4}\n  hint="vs last month"\n/>',
    props: [
      ['label / value', 'string / string | number'],
      ['delta', 'string | number'],
      ['trend', "'up' | 'down' | 'flat' (inferred from a numeric delta)"],
      ['invert', 'boolean = false (down is good)'],
      ['hint', 'string'],
    ],
  })
  const sCard = sec('Card', 'packages/grid/src/SvCard.svelte', 'Radius is --sg-radius-lg. Hover applies only with hoverable.', {
    summary: 'A titled surface for related content, with an optional footer.',
    usage: '<SvCard title="Revenue" subtitle="Last 30 days" hoverable>\n  <p>$48.2k</p>\n</SvCard>',
    props: [
      ['title / subtitle', 'string'],
      ['hoverable', 'boolean = false'],
      ['flush', 'boolean = false (no body padding)'],
      ['header / footer', 'Snippet'],
    ],
  })

  // ------------------------------------------------------------ Feedback
  cat('Feedback', 'What the app tells people: results, progress, waiting and empty views.')
  const sAlert = sec('Alert', 'packages/grid/src/SvAlert.svelte', 'Icons are text glyphs in the CSS and render in Inter here.', {
    summary: 'A message about the current view: an import result, a warning, a failed save.',
    usage: '<SvAlert variant="success" title="Import finished">\n  412 rows were added.\n</SvAlert>',
    props: [
      ['variant', "'info' | 'success' | 'warning' | 'danger' | 'neutral' = 'info'"],
      ['soft', 'boolean = false'],
      ['dismissible', 'boolean = false'],
      ['title', 'string'],
    ],
  })
  const sToast = sec('Toast', 'packages/grid/src/SvToaster.svelte, toast-store.svelte.ts', 'Info toasts use --sg-accent, not --sg-info, so in Ember they are orange. Cancel renders before the action.', {
    summary: 'A short-lived message about something that just happened, raised from code.',
    usage: "<SvToaster position=\"bottom-right\" />\n\ntoast.success('Order saved', {\n  action: { label: 'Undo' },\n})",
    props: [
      ['variant', "'info' | 'success' | 'warning' | 'error' = 'info'"],
      ['title', 'string'],
      ['action / cancel', '{ label, onClick?, keepOpen? }'],
      ['dismissible', 'boolean = true'],
      ['duration', 'number = 4000 (ms, 0 = sticky)'],
    ],
  })
  const sProgress = sec('Progress', 'SvProgress.svelte, SvCircularProgress.svelte', 'Linear track heights are 5, 8 and 12px. The circular arc starts at 12 o\'clock with round caps; r = (size - thickness) / 2.', {
    summary: 'How far along a known amount of work is.',
    usage: '<SvProgress value={uploaded} showLabel />\n<SvCircularProgress value={72} showLabel />',
    props: [
      ['value / max', 'number = 0 / 100'],
      ['color', "'accent' | 'success' | 'warning' | 'danger' = 'accent'"],
      ['size', "'sm' | 'md' | 'lg' = 'md' (linear); number = 48 (circular)"],
      ['indeterminate', 'boolean = false'],
      ['showLabel', 'boolean = false'],
    ],
  })
  const sSpinner = sec('Spinner', 'packages/grid/src/SvSpinner.svelte', 'A 2px ring at 25% of the color, with the top quarter at full color. It turns once every 0.6s.', {
    summary: 'Waiting on work of unknown length.',
    usage: '<SvSpinner size="lg" label="Loading results" />',
    props: [
      ['size', "'sm' | 'md' | 'lg' | number = 'md' (15 / 20 / 28px)"],
      ['color', 'string (defaults to --sg-accent)'],
    ],
  })
  const sSkeleton = sec('Skeleton', 'packages/grid/src/SvSkeleton.svelte', 'The shimmer is motion; the kit shows the flat --sg-skeleton-bg fill.', {
    summary: 'The shape of content that is still loading.',
    usage: '<SvSkeleton variant="text" lines={3} />\n<SvSkeleton variant="circle" />',
    props: [
      ['variant', "'text' | 'rect' | 'circle' = 'text'"],
      ['lines', 'number = 1 (the last line is 60% wide)'],
      ['width / height / radius', 'string'],
      ['animated', 'boolean = true'],
    ],
  })
  const sEmpty = sec('Empty state', 'packages/grid/src/SvEmptyState.svelte', undefined, {
    summary: 'What an empty list or grid shows, with the action that fills it.',
    usage: '<SvEmptyState\n  title="No orders yet"\n  description="Create your first order.">\n  <SvButton>New order</SvButton>\n</SvEmptyState>',
    props: [
      ['title / description', 'string'],
      ['compact', 'boolean = false'],
      ['icon', 'Snippet (replaces the default tile icon)'],
    ],
  })

  // ------------------------------------------------------------ Overlays
  cat('Overlays', 'Content that floats above the page: dialogs, panels, popovers and tooltips.')
  const sModal = sec('Modal', 'packages/grid/src/SvModal.svelte', 'The backdrop is rgba(15, 23, 42, 0.45) with a 1.5px blur.', {
    summary: 'A focused task that blocks the page until it is finished or dismissed.',
    usage: '<SvModal bind:open title="Edit customer" size="md">\n  Changes apply to every open view.\n</SvModal>',
    props: [
      ['open', 'boolean = false (bindable)'],
      ['size', "'sm' | 'md' | 'lg' = 'md' (360 / 520 / 720px)"],
      ['width', 'number (overrides size)'],
      ['draggable / resizable', 'boolean = false'],
      ['closeOnBackdrop / closeOnEsc', 'boolean = true'],
    ],
  })
  const sDrawer = sec('Drawer', 'packages/grid/src/SvDrawer.svelte', 'Side panels are min(400px, 92vw) and draw a border on the inner edge only.', {
    summary: 'Detail or edit panels that keep the page in view, such as a record opened from a grid row.',
    usage: '<SvDrawer bind:open title="Edit customer" side="right">\n  Details\n</SvDrawer>',
    props: [
      ['side', "'right' | 'left' | 'top' | 'bottom' = 'right'"],
      ['size', 'CSS length'],
      ['sheet', 'boolean = false (bottom sheet)'],
    ],
  })
  const sPopover = sec('Popover', 'packages/grid/src/SvPopover.svelte', 'Max width min(92vw, 360px). The arrow is a 10px rotated square with the panel border on its outer sides.', {
    summary: 'Rich content anchored to a trigger: a share panel, a small form, details on demand.',
    usage: '<SvPopover>\n  {#snippet anchor()}<button>Share</button>{/snippet}\n  Anyone with the link sees this view.\n</SvPopover>',
    props: [
      ['placement', "Placement = 'bottom-start'"],
      ['offset', 'number = 8'],
      ['arrow', 'boolean = true'],
      ['trigger', "'click' | 'hover' | 'manual' = 'click'"],
      ['anchor', 'Snippet (the element that opens it)'],
    ],
  })
  const sTip = sec('Tooltip', 'packages/grid/src/SvTooltip.svelte', 'Inverted surface: --sg-fg fill, --sg-bg text. Max width 240px.', {
    summary: 'A short label for an icon or truncated text, shown on hover and focus.',
    usage: '<SvTooltip text="Copy row link">\n  <button>Copy</button>\n</SvTooltip>',
    props: [
      ['text', 'string'],
      ['placement', "'top' | 'bottom' | 'left' | 'right' = 'top'"],
      ['delay', 'number = 300 (ms)'],
      ['interactive', 'boolean = false'],
    ],
  })

  // ---------------------------------------------------- fill, in order of use
  const buttonSet = buttons(sButton)
  kit.Button = buttonSet
  Object.assign(kit, buildActions({ toggle: sToggle, group: sGroup }))
  kit['Text input'] = textInputs(sText)
  const sel = selects(sSelect)
  Object.assign(kit, { Select: sel.trigger, 'Select option': sel.option, 'Select menu': sel.panel })
  Object.assign(kit, buildInputs({ textarea: sTextarea, number: sNumber, tags: sTags, slider: sSlider }))
  Object.assign(kit, datePicker(sDate))
  Object.assign(kit, choices({ checkbox: sCheck, radio: sRadio, switch: sSwitch }))
  Object.assign(kit, buildSelection({ segmented: sSeg, rating: sRating }))
  Object.assign(kit, tabs(sTabs))
  Object.assign(kit, buildNavigation({ breadcrumb: sCrumb, stepper: sStepper, accordion: sAcc }))
  Object.assign(kit, pagination(sPager))
  Object.assign(kit, menus(sMenu))
  Object.assign(kit, tags({ chip: sChip, badge: sBadge }))
  Object.assign(kit, buildDisplay({ avatar: sAvatar, kbd: sKbd, stat: sStat, card: sCard }))
  Object.assign(kit, buildFeedback({ toast: sToast, progress: sProgress, spinner: sSpinner, skeleton: sSkeleton, empty: sEmpty }, buttonSet))
  Object.assign(kit, buildPopover(sPopover))
  Object.assign(kit, overlays({ modal: sModal, drawer: sDrawer, tooltip: sTip, alert: sAlert }, buttonSet))

  return { sections, kit }
}
