# Inputs

Typed text controls. Each emits a clean value and themes from `--sg-*`.

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add inputs"></div>

Prefer to see them first? `npx @svgrid/ui try inputs` opens the whole family in a sandbox - no project needed.

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvTextInput

The base single-line text editor on the shared editor contract (label / hint /
error / RTL / a11y). Handles `text`, `email`, `url`, `tel` and `search`. As a
grid cell editor it honours the interaction contract: Enter commits, Escape
cancels.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvColorInput, SvDurationInput, SvMaskedInput, SvNumberInput, SvOtpInput, SvPasswordInput, SvPhoneInput, SvRichText, SvTextArea, SvTextInput } from '@svgrid/grid'

  // The bound value behind each example below.
  let name = $state('')
  let notes = $state('')
  let qty = $state(1)
  let pw = $state('')
  let code = $state('')
  let color = $state('#2563eb')
  let mins = $state(90)
  let phone = $state('')
  let sku = $state('')
  let note = $state('')
  let html = $state('<p>Release notes</p>')
</script>
```

```svelte {runnable}
<SvTextInput value={name} onChange={(v) => (name = v)} placeholder="Full name" clearable />
```

Props: `value`, `onChange(value)`, `onCommit(value)`, `onCancel()`, `placeholder`,
`type`, `maxlength`, `clearable`, `autocomplete`, `autofocus`, plus the shared
editor-contract props (`label`, `hint`, `error`, `required`, `invalid`, `size`,
`disabled`, `readonly`, `name`, `dir`).

## SvTextArea

A multi-line text editor with optional auto-grow and a character counter. In a
cell: Escape cancels; Ctrl/Cmd+Enter commits (a bare Enter inserts a newline).

```svelte {runnable}
<SvTextArea value={notes} onChange={(v) => (notes = v)} rows={4} autoGrow maxlength={280} showCount />
```

Props: `value`, `onChange`, `onCommit`, `onCancel`, `placeholder`, `rows`,
`maxlength`, `autoGrow`, `showCount`, `autofocus`, plus the shared editor-contract
props.

## SvOtpInput

A segmented one-time-code / PIN entry: N single-char cells with auto-advance,
Backspace-to-previous, arrow navigation, and paste that distributes across cells.

```svelte
<SvOtpInput length={6} value={code} onChange={(v) => (code = v)} onComplete={(v) => verify(v)} />
```

Props: `value`, `onChange(value)`, `onComplete(value)`, `length` (default 6),
`numeric` (digits only, default true), `mask`, `autofocus`, plus `label`, `hint`,
`error`, `required`, `invalid`, `size`, `disabled`, `name`. The pure helpers
`sanitizeOtp`, `otpCells` and `isOtpComplete` are exported.

## SvDurationInput

A duration editor whose value is a number of **minutes** but which accepts the
human forms people type (`1h 30m`, `1:30`, `90`). Shows a formatted value when
unfocused and re-parses on blur / Enter.

```svelte
<SvDurationInput value={mins} onChange={(m) => (mins = m)} style="units" />
```

Props: `value` (minutes | null), `onChange(minutes)`, `onCommit`, `onCancel`,
`style` (`colon` -> `1:30`, or `units` -> `1h 30m`), `placeholder`, `autofocus`,
plus the shared editor-contract props. The pure helpers `parseDuration` and
`formatDuration` are exported.

## SvNumberInput

Numeric input with min/max/step, spinner buttons, optional thousands grouping,
precision, and prefix/suffix.

```svelte
<SvNumberInput value={qty} onChange={(v) => (qty = v)}
  min={0} max={100000} step={10} precision={2} grouping prefix="$" />
```

Props: `value` (number | null), `onChange(value)`, `min`, `max`, `step`,
`precision`, `grouping`, `prefix`, `suffix`, `spinButtons`, `size`, `disabled`,
`readonly`. Arrow keys step; the field commits (and clamps) on blur/Enter.

## SvPasswordInput

Password field with a reveal toggle and an optional 4-level strength meter.

```svelte {runnable}
<SvPasswordInput value={pw} onChange={(v) => (pw = v)} showStrength />
```

Props: `value`, `onChange(value)`, `revealable` (default true), `showStrength`,
`size`, `disabled`, `autocomplete`.

## SvMaskedInput

Pattern-masked text input. Mask tokens: `#` digit, `A` letter, `*` alphanumeric;
any other character is an auto-inserted literal.

```svelte
<SvMaskedInput mask="(###) ###-####" onChange={(masked, raw, complete) => …} />
```

Props: `value`, `mask`, `onChange(masked, raw, complete)`, `size`, `disabled`.

## SvPhoneInput

A country dial-code selector plus a national number field; emits an E.164-style
string (`+<dial><digits>`). Country data is bundled (`COUNTRIES`) and extensible.

```svelte {runnable}
<SvPhoneInput value={phone} country="US"
  onChange={(v, parts) => (phone = v)} />
```

Props: `value`, `country` (ISO code), `onChange(value, { country, dial, national })`,
`size`, `disabled`.

## SvColorInput

A color swatch that opens a portalled popover with a hex field, native picker and
preset palette. Emits a `#rrggbb` string.

```svelte {runnable}
<SvColorInput value={color} onChange={(hex) => (color = hex)} />
```

Props: `value`, `onChange(hex)`, `palette` (string[]), `size`, `disabled`.

## SvRichText

A lightweight WYSIWYG editor over a `contentEditable` region, emitting HTML.
Bold / italic / underline / strike, headings, lists, quote, code block,
alignment, links, undo/redo; configurable toolbar. Bindable `value` (HTML).

```svelte {runnable}
<SvRichText bind:value={html} placeholder="Write something…" />
<SvRichText bind:value={note} tools={['bold', 'italic', '|', 'ul', 'ol', '|', 'link', 'clear']} />
```

Props: `value` (HTML string, bindable), `onChange(html)`, `placeholder`,
`disabled`, `readonly`, `minHeight`, `tools` (`RichTextTool[]`, `'|'` = separator),
`ariaLabel`.

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvTextInput](./sv-text-input.md) - the base single-line text editor.
- [SvTextArea](./sv-text-area.md) - a multi-line editor with auto-grow.
- [SvNumberInput](./sv-number-input.md) - a numeric field with min/max/step spinners.
- [SvPasswordInput](./sv-password-input.md) - a password field with reveal and strength.
- [SvMaskedInput](./sv-masked-input.md) - a pattern-masked text input.
- [SvPhoneInput](./sv-phone-input.md) - a dial-code selector plus national number.
- [SvColorInput](./sv-color-input.md) - a swatch and hex color picker.
- [SvOtpInput](./sv-otp-input.md) - a segmented one-time-code / PIN entry.
- [SvDurationInput](./sv-duration-input.md) - a human-friendly duration-in-minutes editor.
- [SvTagsInput](./sv-tags-input.md) - an editable free-form chips input.

## More examples

### Text inputs

Typed text controls: SvNumberInput (min/max/step, grouping, precision, spinners), SvPasswordInput (reveal + strength), SvMaskedInput (pattern mask), SvPhoneInput (country dial code + national mask) and SvColorInput (swatch + palette popover). Each a SvGrid cell editor, standalone too.

<div data-docs-demo="254-text-inputs" data-height="420"></div>
