# SvListBox

An inline single or multi-select list - a WAI-ARIA `listbox` with a roving
highlight, full keyboard, type-ahead and optional windowing for huge option sets.

`SvListBox` is the always-visible list picker: no popover, no trigger, just the
options in place. It is controlled through `value` + `onChange`, groups options
by their `group` heading, and each row can be a custom `itemTemplate`. Turn on
`virtual` and it renders only the visible rows, so it scales to tens of thousands
of options while scroll and type-ahead stay instant. Colors come from the grid's
`--sg-*` tokens, so it matches the grid and the rest of the kit in light and dark.

Related: [SvDropDownList](sv-drop-down-list.md) · [SvMultiSelect](sv-multi-select.md) · [Selection overview](selection.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvListBox` starter into your app:

<div data-docs-add="add list-box"></div>

Or install the package and import it directly. `SvListBox` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvListBox } from '@svgrid/grid'
```

## Example

<div data-docs-demo="312-listbox" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvListBox, type ListOption } from '@svgrid/grid'
  const options: ListOption[] = [
    { value: 'eng', label: 'Engineering', group: 'Product' },
    { value: 'des', label: 'Design', group: 'Product' },
    { value: 'sal', label: 'Sales', group: 'Go-to-market' },
  ]
  let value = $state<string | null>(null)
</script>

<SvListBox label="Team" {options} {value} onChange={(v) => (value = v)} />
```

## Props

| Prop           | Type                                                    | Default | Description                                                        |
| -------------- | ------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `options`      | `ReadonlyArray<ListOption>`                             | -       | The options. A `group` heading buckets them into sections.         |
| `value`        | `string \| number \| Array<string \| number> \| null`  | `null`  | Selected value(s). An array when `multiple`.                       |
| `onChange`     | `(value: any) => void`                                  | -       | Fires with the new value (scalar, or array when `multiple`).       |
| `multiple`     | `boolean`                                               | `false` | Allow multiple selections (adds a checkmark column).               |
| `rows`         | `number`                                                | `7`     | Visible height in rows before scrolling.                           |
| `virtual`      | `boolean`                                               | `false` | Window the list (render only visible rows) for large sets. Flat lists only. |
| `rowHeight`    | `number`                                                | `32`    | Fixed row height in px; must match the CSS row height.             |
| `itemTemplate` | `Snippet<[ListOption]>`                                 | -       | Custom per-option content. Receives the option.                   |
| `disabled`     | `boolean`                                               | `false` | Blocks interaction.                                                |
| `label`        | `string`                                                | -       | Visible field label, wired to the control.                        |
| `hint`         | `string`                                                | -       | Helper text under the control.                                    |
| `error`        | `string`                                                | -       | Error message; announced and styled when set.                     |
| `required`     | `boolean`                                               | `false` | Marks the field required.                                         |
| `invalid`      | `boolean`                                               | `false` | Applies the invalid state.                                        |
| `name`         | `string`                                                | -       | Emits hidden input(s) carrying the value for form posts.          |
| `dir`          | `ltr \| rtl \| auto`                                    | `auto`  | Text direction.                                                   |
| `ariaLabel`    | `string`                                                | -       | Accessible name when there is no visible `label`.                 |
| `id`           | `string`                                                | -       | Root id; label/hint/error ids derive from it.                     |

### ListOption

```ts
type ListOption = {
  value: string | number
  label: string
  disabled?: boolean
  group?: string   // optional section heading
}
```

## Examples

### Multi-select with a summary

Set `multiple` and read back the array in `onChange` to drive a live count or
chip summary:

```svelte
<script lang="ts">
  let picked = $state<Array<string | number>>([])
</script>

<SvListBox label="Assignees" {options} multiple
  value={picked} onChange={(v) => (picked = v)} />
<p>{picked.length} selected</p>
```

### Custom rows

Pass an `itemTemplate` snippet to render richer options (avatar, role, meta) while
keeping the list's keyboard and selection behavior:

```svelte
<SvListBox {options}>
  {#snippet itemTemplate(opt)}
    <Avatar name={opt.label} /> <span>{opt.label}</span>
  {/snippet}
</SvListBox>
```

### Virtualized huge lists

For thousands of options, add `virtual` (and keep `rowHeight` in sync with the
CSS). Only the visible rows hit the DOM, so scrolling never reflows:

```svelte
<SvListBox {options} virtual rowHeight={32} />
```

> Tip: `virtual` only takes effect on a flat list - giving options a `group`
> turns windowing off (grouped rows are variable-height), so keep large
> virtualized lists ungrouped.

### Cascading lists

Derive the second list from the first pick, and clear the child when the parent
changes so a stale value never lingers:

```svelte
<script lang="ts">
  import { SvListBox, type ListOption } from '@svgrid/grid'
  const teams: ListOption[] = [
    { value: 'eng', label: 'Engineering' },
    { value: 'des', label: 'Design' },
  ]
  const membersByTeam: Record<string, ListOption[]> = {
    eng: [{ value: 'ada', label: 'Ada' }, { value: 'linus', label: 'Linus' }],
    des: [{ value: 'jony', label: 'Jony' }],
  }
  let team = $state<string | number | null>(null)
  let member = $state<string | number | null>(null)
  const members = $derived(team ? membersByTeam[String(team)] ?? [] : [])
</script>

<SvListBox label="Team" options={teams} value={team}
  onChange={(v) => { team = v; member = null }} />
<SvListBox label="Member" options={members} value={member}
  onChange={(v) => (member = v)} />
```

## Accessibility

- Renders a real `role="listbox"` with a roving highlight; `ArrowUp` / `ArrowDown`
  move, `Home` / `End` jump, and typing does type-ahead.
- Selection state is exposed via `aria-selected`; `multiple` adds
  `aria-multiselectable`.
- `label`, `hint`, and `error` are wired through `aria-describedby`; pass
  `ariaLabel` when there is no visible label.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvDropDownList](sv-drop-down-list.md) - the same single-select model in a popover.
- [SvMultiSelect](sv-multi-select.md) - a multi-select collapsed into a chip trigger.
