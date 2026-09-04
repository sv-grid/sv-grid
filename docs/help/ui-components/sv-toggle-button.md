# SvToggleButton

A button with a sticky pressed on/off state, exposed to assistive tech via
`aria-pressed`.

`SvToggleButton` looks like a button but remembers whether it is on. Use it for
binary controls where the label stays constant - bold/italic in a formatting
toolbar, a pin, a mute, a "live" toggle. It is controlled: drive `pressed` from
your state and flip it in `onChange`. It carries the shared editor contract
(label, hint, validation, `dir`/RTL) through [SvField](inputs.md).

Related: [SvSwitchButton](sv-switch-button.md) · [SvButtonGroup](sv-button-group.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvToggleButton` starter into your app:

<div data-docs-add="add toggle-button"></div>

Prefer to see it first? `npx @svgrid/ui try toggle-button` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvToggleButton` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  let rows = $state<Person[]>(people)
</script>
```

```ts
import { SvToggleButton } from '@svgrid/grid'
```

## Example

<div data-docs-demo="307-toggle-button" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvToggleButton } from '@svgrid/grid'
  let bold = $state(false)
</script>

<SvToggleButton pressed={bold} onChange={(v) => (bold = v)}>Bold</SvToggleButton>
```

## Props

| Prop        | Type                        | Default | Description                                                       |
| ----------- | --------------------------- | ------- | ---------------------------------------------------------------- |
| `pressed`   | `boolean`                   | `false` | Current on/off state (controlled).                              |
| `onChange`  | `(pressed: boolean) => void`| -       | Fires with the next state when toggled.                         |
| `disabled`  | `boolean`                   | `false` | Blocks toggling and dims the control.                           |
| `size`      | `sm` \| `md` \| `lg`        | `md`    | Padding and font size, shared with the rest of the kit.        |
| `label`     | `string`                    | -       | Visible field label, rendered above the button.                |
| `hint`      | `string`                    | -       | Helper text under the button.                                  |
| `error`     | `string`                    | -       | Error message announced via `aria-describedby`.                |
| `required`  | `boolean`                   | `false` | Adds `aria-required`.                                          |
| `invalid`   | `boolean`                   | `false` | Marks the control invalid (danger border).                    |
| `dir`       | `ltr` \| `rtl` \| `auto`    | `auto`  | Text direction.                                                |
| `ariaLabel` | `string`                    | -       | Accessible name for an icon-only toggle.                       |
| `id`        | `string`                    | auto    | Root id; label/hint/error ids derive from it.                  |
| `children`  | `Snippet`                   | -       | The button label.                                              |

## Examples

### Formatting toolbar

A row of toggles, each bound to its own state, reads as an inline formatting bar:

```svelte
<SvToggleButton pressed={bold} onChange={(v) => (bold = v)}>B</SvToggleButton>
<SvToggleButton pressed={italic} onChange={(v) => (italic = v)}>I</SvToggleButton>
```

### Icon toggle with a label

Give an icon-only toggle an `ariaLabel` so the on/off state is announced with a
name:

```svelte
<SvToggleButton ariaLabel="Pin row" pressed={pinned} onChange={(v) => (pinned = v)}>📌</SvToggleButton>
```

### Reflecting external state

Because it is controlled, the pressed look always mirrors your state - toggle it
from anywhere and the button follows:

```svelte
<SvToggleButton pressed={isLive} onChange={(v) => setLive(v)}>Live</SvToggleButton>
```

### Toolbar filter toggle

A toggle whose pressed state drives a `$derived` list makes a compact "show
only" filter - the button stays lit while the filter is active:

```svelte
<script lang="ts">
  import { SvToggleButton } from '@svgrid/grid'
  let favoritesOnly = $state(false)
  const shown = $derived(favoritesOnly ? rows.filter((r) => r.starred) : rows)
</script>

<SvToggleButton pressed={favoritesOnly} onChange={(v) => (favoritesOnly = v)}>
  ★ Favorites only
</SvToggleButton>
```

## Accessibility

- Renders a native `<button>` with `aria-pressed` reflecting `pressed`, so
  screen readers announce it as a toggle button.
- `Enter` and `Space` flip the state; focus and `Tab` order are the browser's.
- Icon-only toggles must set `ariaLabel` - there is no visible text to announce.

## More examples

### Toggle button - headless

Styled SvToggleButton plus a custom on/off pill, one bound pressed value with a readout.

<div data-docs-demo="271-headless-togglebutton" data-height="420"></div>

### Buttons & toggles

The UI kit press/toggle primitives: SvButton (variants/sizes/loading), SvRepeatButton (hold-to-repeat), SvToggleButton, SvSwitchButton, SvCheckBox (+ indeterminate), SvRadioGroup (arrow-key nav) and SvRating (half stars). Theme-driven, standalone or as grid cell controls.

<div data-docs-demo="253-buttons-toggles" data-height="420"></div>

## See also

- [SvSwitchButton](sv-switch-button.md) - the same on/off state as a sliding switch.
- [SvButtonGroup](sv-button-group.md) - a multi-select set of toggles in one bar.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
