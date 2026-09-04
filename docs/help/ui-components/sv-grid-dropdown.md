# SvGridDropdown

The themeable dropdown / listbox that powers the grid's `list` and `chips` cell
editors. It is a deliberate replacement for the native `<select>`, whose option
list cannot be styled to match the grid theme and fights the dark theme on Windows.

`SvGridDropdown` is the low-level single or multi picker used inside a grid cell,
but it is exported so you can reach for the exact in-cell control directly. It runs
in `single` mode (picking fires `onChange` + `onCommit`) or `multiple` mode
(toggling fires `onChange`, then `Done` / Enter fires `onCommit`), can render the
selection as removable chips, and portals its panel to `<body>` so it never gets
clipped by the grid's scroll container. Options may carry a `color` to render as
pills. Every color comes from the grid's `--sg-*` tokens.

Related: [SvDropDownList](sv-drop-down-list.md) · [SvMultiSelect](sv-multi-select.md) · [Selection overview](selection.md)

## Installation

`SvGridDropdown` ships free in `@svgrid/grid` and is **part of the grid's editor
kit** - the same control SvGrid mounts when you edit a `list` or `chips` cell.
Most apps use [SvDropDownList](sv-drop-down-list.md) or [SvListBox](sv-list-box.md)
instead; reach for this when you need the exact surface the grid's cell editors use.

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvGridDropdown } from '@svgrid/grid'
```

## Example

```svelte
<script lang="ts">
  import { SvGridDropdown } from '@svgrid/grid'
  import type { CellEditorOption } from '@svgrid/grid'
  const options: CellEditorOption[] = [
    { value: 'open', label: 'Open', color: '#2563eb' },
    { value: 'done', label: 'Done', color: '#16a34a' },
  ]
  let value = $state<unknown>('open')
</script>

<SvGridDropdown {options} {value} autoOpen={false}
  onChange={(next) => (value = next)} onCommit={() => save(value)} />
```

## Props

| Prop                   | Type                                 | Default     | Description                                                       |
| ---------------------- | ------------------------------------ | ----------- | ---------------------------------------------------------------- |
| `options`              | `ReadonlyArray<CellEditorOption>`    | -           | The options. A `color` renders the option as a pill.             |
| `value`                | `unknown`                            | -           | Current value: a scalar for single, an array for multi.          |
| `multiple`             | `boolean`                            | `false`     | Multi-select mode (checkmarks + a `Done` footer).                |
| `placeholder`          | `string`                             | `'Select…'` | Trigger text when nothing is selected.                           |
| `renderChipsInTrigger` | `boolean`                            | `false`     | Show the current value(s) as removable chips in the trigger.     |
| `searchable`           | `boolean`                            | `false`     | Add a type-ahead filter box at the top of the panel.             |
| `autoOpen`             | `boolean`                            | `true`      | Focus and open on mount (true for in-cell; set `false` for forms).|
| `onChange`             | `(next: unknown) => void`            | -           | Fires with the full new value (scalar or array).                 |
| `onCommit`             | `() => void`                         | -           | Fires when the selection is finalized (pick, Enter, blur).       |
| `onCancel`             | `() => void`                         | -           | Fires on dismiss (Escape, blur with no change).                  |

### CellEditorOption

```ts
type CellEditorOption = {
  value: string | number
  label: string
  color?: string   // renders the option (and trigger chip) as a colored pill
}
```

## Examples

### Standalone form field

Inside a grid cell the control auto-opens; as a standalone field pass
`autoOpen={false}` so it stays closed and unfocused until the user acts:

```svelte
<SvGridDropdown {options} {value} autoOpen={false} onChange={(v) => (value = v)} />
```

### Multi-select with chips

Combine `multiple` and `renderChipsInTrigger` for a token-style trigger where each
selected option is a removable pill; the batch commits on `Done`:

```svelte
<SvGridDropdown {options} {value} multiple renderChipsInTrigger
  onChange={(v) => (value = v)} onCommit={commit} />
```

### Searchable long lists

Add `searchable` to filter the options as the user types - the same box the grid's
rich-select editor uses.

### Powering a grid cell editor

This is exactly what the grid's `list` / `chips` editors mount internally, but you
can register it for your own type. In a cell it should open on mount, so keep the
default `autoOpen`:

```svelte
<script lang="ts">
  import { SvGrid, SvGridDropdown, registerCellEditor,
    type CellEditorOption } from '@svgrid/grid'

  const status: CellEditorOption[] = [
    { value: 'open', label: 'Open', color: '#2563eb' },
    { value: 'done', label: 'Done', color: '#16a34a' },
  ]
  registerCellEditor('status', {
    component: SvGridDropdown,
    props: (ctx) => ({
      options: status,
      value: ctx.value,
      onChange: ctx.onChange,
      onCommit: () => ctx.onCommit(),
      onCancel: ctx.onCancel,
    }),
  })

  const columns = [{ field: 'status', header: 'Status', editorType: 'status' }]
</script>
```

An option `color` renders it (and the trigger chip) as a colored pill, matching
how the value looks in the cell when it is not being edited.

## Accessibility

- The trigger is a `<button>` with `aria-haspopup="listbox"` / `aria-expanded`; the
  panel is a `role="listbox"` (with `aria-multiselectable` in multi mode).
- `ArrowUp` / `ArrowDown` open and move the highlight, `Home` / `End` jump, `Enter`
  / `Space` toggle, `Escape` cancels, and `Tab` commits and lets focus escape.
- The panel is portalled to `<body>` and auto-flips upward when there is no room
  below the trigger, so it is never clipped by the grid.

## Try it

```svelte {runnable}
<script lang="ts">
  import { SvGridDropdown } from '@svgrid/grid'
  import type { CellEditorOption } from '@svgrid/grid'

  const options: CellEditorOption[] = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'active',  label: 'Active',  color: '#f59e0b' },
    { value: 'done',    label: 'Done',    color: '#22c55e' },
  ]

  let value = $state<unknown>('active')
  let picked = $state<unknown>(['active'])
</script>

<SvGridDropdown {options} {value} autoOpen={false} onChange={(v) => (value = v)} />

<SvGridDropdown
  {options}
  value={picked}
  multiple
  renderChipsInTrigger
  autoOpen={false}
  onChange={(v) => (picked = v)}
/>
```

`autoOpen` defaults to `true` because the grid mounts this the moment a cell
enters edit mode. Standalone you almost always want it off, as above.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvDropDownList](sv-drop-down-list.md) - the standalone, form-first single-select.
- [SvMultiSelect](sv-multi-select.md) - a multi-select with a chip trigger.
