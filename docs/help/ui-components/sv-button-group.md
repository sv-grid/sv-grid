# SvButtonGroup

A segmented button bar - a single-select view switcher, a multi-select toggle
set, or a plain row of action buttons.

`SvButtonGroup` packs a set of related buttons into one bordered bar. Pick
`mode="single"` for radio semantics (one value at a time, like a day/week/month
switcher), `mode="multiple"` for a toggle set (a formatting toolbar), or
`mode="none"` for plain actions. Roving tabindex and arrow-key navigation come
from the headless `createButtonGroup` core, and it carries the shared editor
contract (label, hint, validation, `dir`/RTL) through [SvField](inputs.md).

Related: [SvToggleButton](sv-toggle-button.md) · [SvRadioGroup](sv-radio-group.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvButtonGroup` starter into your app:

<div data-docs-add="add button-group"></div>

Prefer to see it first? `npx @svgrid/ui try button-group` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvButtonGroup` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvButtonGroup } from '@svgrid/grid'
```

## Example

<div data-docs-demo="284-button-group" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvButtonGroup, type ButtonGroupItem } from '@svgrid/grid'

  const views: ButtonGroupItem[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ]
  let view = $state<string | number>('week')
</script>

<SvButtonGroup
  items={views}
  value={view}
  mode="single"
  onChange={(v) => (view = v as string)}
/>
```

## Props

| Prop          | Type                                                                   | Default        | Description                                                            |
| ------------- | ---------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `items`       | `ReadonlyArray<ButtonGroupItem>`                                       | -              | The buttons. Each item is `{ value, label?, disabled? }`.             |
| `value`       | `ButtonGroupValue`                                                     | `null`         | Selected value(s). A scalar in `single`, an array in `multiple`.      |
| `onChange`    | `(value: string \| number \| Array<string \| number>) => void`         | -              | Fires on selection change with the new value.                        |
| `mode`        | `single` \| `multiple` \| `none`                                       | `single`       | `single` = radio, `multiple` = toggle set, `none` = action buttons.  |
| `orientation` | `horizontal` \| `vertical`                                             | `horizontal`   | Bar direction; also sets `aria-orientation` for arrow keys.          |
| `variant`     | `solid` \| `outline`                                                   | `solid`        | Segmented fill (`solid`) or tinted pills (`outline`).                |
| `size`        | `sm` \| `md` \| `lg`                                                   | `md`           | Padding and font size, shared with the rest of the kit.             |
| `disabled`    | `boolean`                                                              | `false`        | Disables the whole bar.                                              |
| `name`        | `string`                                                               | -              | Emits hidden inputs carrying the selected value(s) for form submit. |
| `label`       | `string`                                                               | -              | Visible field label; also names the group for assistive tech.       |
| `hint`        | `string`                                                               | -              | Helper text under the bar.                                          |
| `error`       | `string`                                                               | -              | Error message announced via `aria-describedby`.                     |
| `required`    | `boolean`                                                              | `false`        | Adds `aria-required`.                                                |
| `invalid`     | `boolean`                                                              | `false`        | Marks the bar invalid (danger border).                             |
| `dir`         | `ltr` \| `rtl` \| `auto`                                               | `auto`         | Text direction; under `rtl` the horizontal arrow keys flip.         |
| `ariaLabel`   | `string`                                                               | -              | Accessible name when there is no visible `label`.                   |
| `id`          | `string`                                                               | auto           | Root id; label/hint/error ids derive from it.                       |

Helper type: `ButtonGroupItem = { value: string | number; label?: string; disabled?: boolean }`.

## Examples

### Single-select switcher

With `mode="single"` the group behaves as a radio set - arrow keys move focus
and select in one step, and the selected segment is the only tab stop.

```svelte
<SvButtonGroup items={views} value={view} mode="single"
  onChange={(v) => (view = v as string)} />
```

### Multi-select toolbar

`mode="multiple"` turns each segment into an independent toggle. `value` is an
array, and `onChange` hands you the full set:

```svelte
<script lang="ts">
  let formats = $state<Array<string | number>>(['bold'])
</script>

<SvButtonGroup mode="multiple" value={formats}
  items={[{ value: 'bold', label: 'B' }, { value: 'italic', label: 'I' }]}
  onChange={(v) => (formats = v as string[])} />
```

### Vertical actions

Set `mode="none"` for a plain button row where every button stays tabbable, and
`orientation="vertical"` to stack them.

### Status filter bound to a list

A `single`-mode group is a natural segmented filter. Read the selected `value`
back into a `$derived` list to narrow what you show - here, tickets by status,
with the `outline` variant for a lighter toolbar look:

```svelte
<script lang="ts">
  import { SvButtonGroup, type ButtonGroupItem } from '@svgrid/grid'

  const statuses: ButtonGroupItem[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
  ]
  let status = $state<string | number>('all')
  const visible = $derived(
    status === 'all' ? tickets : tickets.filter((t) => t.status === status),
  )
</script>

<SvButtonGroup
  items={statuses}
  value={status}
  variant="outline"
  onChange={(v) => (status = v as string)}
/>
```

## Accessibility

- The container is a `radiogroup` in `single` mode, otherwise a `group`, with
  `aria-orientation` set from `orientation`.
- Roving tabindex: in `single`/`multiple` only one segment is tabbable and
  arrow keys / Home / End move between the enabled ones. `Space` and `Enter`
  activate.
- Disabled items are skipped by keyboard navigation; a visible `label` names the
  group for screen readers.

## See also

- [SvToggleButton](sv-toggle-button.md) - a single pressed on/off button.
- [SvRadioGroup](sv-radio-group.md) - separate radios with the same select-one behavior.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
