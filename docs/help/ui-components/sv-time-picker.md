# SvTimePicker

An analog clock-dial time picker - 12- or 24-hour, minute snapping, and an
hour-to-minute auto-switch. Drag the hand or click a number.

`SvTimePicker` is a styled renderer over the headless `createTimePicker` core:
the core owns the value math, dial geometry, keyboard and ARIA, while the
component keeps the DOM-bound pointer capture and hit-testing. All visuals come
from the grid's `--sg-*` tokens, so every theme applies for free, in light and
dark. It is the editor SvGrid mounts for a `time` cell, and it works standalone
anywhere.

<div data-docs-demo="251-timepicker" data-height="460"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvTimePicker } from '@svgrid/grid'
  let time = $state(new Date())
</script>

<SvTimePicker
  value={time}
  format="12-hour"
  minuteInterval={5}
  footer
  onChange={(d) => (time = d)}
/>
```

## Props

| Prop                  | Type                       | Default     | Description                                                       |
| --------------------- | -------------------------- | ----------- | ---------------------------------------------------------------- |
| `value`               | `TimeValue`                | `null`      | A `Date`, `"HH:MM[:SS]"` string, or epoch ms.                    |
| `onChange`            | `(value: Date) => void`    | -           | Fires with a `Date` (today's date carrying the picked time).     |
| `format`              | `12-hour` \| `24-hour`     | `24-hour`   | Clock face and readout format.                                   |
| `minuteInterval`      | `number`                   | `1`         | Snap minutes to this step.                                       |
| `autoSwitchToMinutes` | `boolean`                  | `true`      | After picking an hour, jump the dial to minutes.                 |
| `footer`              | `boolean`                  | `false`     | Show the `Now` footer button.                                    |
| `disabled`            | `boolean`                  | `false`     | Blocks interaction and dims the control.                         |
| `readonly`            | `boolean`                  | `false`     | Shows the value but blocks changes.                              |
| `name`                | `string`                   | -           | Emits a hidden input carrying `HH:MM`.                           |
| `selection`           | `hour` \| `minute`         | `hour`      | Which dial opens first.                                          |
| `dir`                 | `ltr` \| `rtl` \| `auto`   | `auto`      | Text direction; `rtl` mirrors the layout.                        |
| `messages`            | `Partial<TimeMessages>`    | -           | Override the built-in strings (group label + AM/PM/Now).         |

### Helper types

- `TimeValue = Date | string | number | null`
- `TimeFormat = '12-hour' | '24-hour'`
- `TimeSelection = 'hour' | 'minute'`

## Patterns

### Quarter-hour scheduling

Constrain to coarse steps with `minuteInterval` so bookings land on clean
boundaries; the dial snaps the hand to the nearest allowed minute:

```svelte
<SvTimePicker value={slot} minuteInterval={15} onChange={(d) => (slot = d)} />
```

### String value in, Date out

Feed a plain `"HH:MM"` string (handy for form state) and read a `Date` back from
`onChange`:

```svelte
<script lang="ts">
  let raw = $state('09:30')
</script>

<SvTimePicker value={raw} onChange={(d) => (raw = d.toTimeString().slice(0, 5))} />
```

### 12-hour with a Now shortcut

Turn on `footer` for a one-click `Now`, and `format="12-hour"` adds the AM/PM
toggle beside the readout:

```svelte
<SvTimePicker format="12-hour" footer onChange={(d) => (time = d)} />
```

### Adjusting an existing time (minutes first)

Open the minute dial directly with `selection="minute"`, and keep it there by
turning off the hour-to-minute auto-switch, so a small tweak to an existing value
does not jump dials:

```svelte
<SvTimePicker
  value={existing}
  selection="minute"
  autoSwitchToMinutes={false}
  onChange={(d) => (existing = d)}
/>
```

Tip: `onChange` always emits a `Date` carrying today's date with the picked time,
even when you feed a `"HH:MM"` string in - convert back with
`d.toTimeString().slice(0, 5)` if your state is a string.

## Accessibility

- Renders a `role="group"` with a labelled dial; the core owns the ARIA and
  keyboard model.
- Keyboard: arrow keys nudge the active field (hour or minute); the hour /
  minute segment buttons switch focus between dials.
- Pointer drag uses pointer capture, so dragging the hand keeps tracking outside
  the dial and works with touch.
- `disabled` and `readonly` block interaction; `dir="rtl"` mirrors the layout.

## See also

- [Date & time overview](date-time.md) - the whole family at a glance.
- [SvDateTimePicker](sv-date-time-picker.md) - composes this picker behind a TIME tab.
- [SvCalendar](sv-calendar.md) - the date half of the pair.
