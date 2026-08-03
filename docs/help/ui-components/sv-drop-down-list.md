# SvDropDownList

A single-select dropdown: a trigger button plus a portalled option list, with no
typing. Pick with the mouse or the keyboard (type-ahead included); the panel
escapes any scroll container so it is never clipped.

`SvDropDownList` is the classic `<select>` replacement, restyled to the grid's
`--sg-*` tokens and given a real roving-focus keyboard model. It is controlled via
`value` + `onChange`, groups options by their `group` heading, and can `virtual`ize
long lists. Because the panel is portalled to `<body>` and positioned with
auto-flip, it stays visible even inside a scrolling toolbar or a dialog.

Related: [SvComboBox](sv-combo-box.md) · [SvListBox](sv-list-box.md) · [Selection overview](selection.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDropDownList` starter into your app:

<div data-docs-add="add drop-down-list"></div>

Prefer to see it first? `npx @svgrid/ui try drop-down-list` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvDropDownList` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvDropDownList } from '@svgrid/grid'
```

## Example

<div data-docs-demo="314-dropdownlist" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvDropDownList, type ListOption } from '@svgrid/grid'
  const options: ListOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'wip', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ]
  let value = $state<string | null>(null)
</script>

<SvDropDownList label="Status" {options} {value} onChange={(v) => (value = v)} />
```

## Props

| Prop          | Type                                | Default    | Description                                                  |
| ------------- | ----------------------------------- | ---------- | ------------------------------------------------------------ |
| `options`     | `ReadonlyArray<ListOption>`         | -          | The options. A `group` heading buckets them into sections.   |
| `value`       | `string \| number \| null`          | `null`     | The selected value.                                          |
| `onChange`    | `(value: string \| number) => void` | -          | Fires with the newly picked value.                           |
| `placeholder` | `string`                            | `'Select…'`| Shown on the trigger when nothing is selected.               |
| `autoOpen`    | `boolean`                           | `false`    | Focus the trigger and open the panel on mount.               |
| `virtual`     | `boolean`                           | `false`    | Window the option list for large sets. Flat lists only.      |
| `rowHeight`   | `number`                            | `34`       | Fixed option height in px; must match the CSS.               |
| `resizable`   | `boolean`                           | `false`    | Show a bottom drag grip so users can resize the open panel.  |
| `size`        | `sm \| md \| lg`                    | `md`       | Control height and font size.                                |
| `disabled`    | `boolean`                           | `false`    | Blocks interaction and dims the trigger.                     |
| `label`       | `string`                            | -          | Visible field label, wired to the control.                   |
| `hint`        | `string`                            | -          | Helper text under the control.                               |
| `error`       | `string`                            | -          | Error message; announced and styled when set.                |
| `required`    | `boolean`                           | `false`    | Marks the field required.                                    |
| `invalid`     | `boolean`                           | `false`    | Applies the invalid state.                                   |
| `name`        | `string`                            | -          | Emits a hidden input carrying the value for form posts.      |
| `dir`         | `ltr \| rtl \| auto`                | `auto`     | Text direction.                                             |
| `ariaLabel`   | `string`                            | -          | Accessible name when there is no visible `label`.            |
| `id`          | `string`                            | -          | Root id; label/hint/error ids derive from it.                |

Options use the shared [ListOption](sv-list-box.md#listoption) shape.

## Examples

### Grouped options

Give options a `group` and the panel renders labeled sections automatically:

```svelte
<SvDropDownList {options} label="Priority" />
<!-- options: { value, label, group: 'Urgent' | 'Normal' } -->
```

### Color swatches

Give an option a `color` (any CSS color) and it renders a small swatch before
the label - in the panel and on the selected trigger. Handy when the value *is*
a color, like a status, label, or category:

```svelte
<SvDropDownList {options} label="Role" />
<!-- options: { value: 'Barista', label: 'Barista', color: '#4f46e5' } -->
```

### Required in a form

Set `required` and drive `invalid` / `error` from your validation to surface a
message under the control:

```svelte
<SvDropDownList label="Country" {options} required
  invalid={submitted && !value} error={!value ? 'Pick one' : undefined} />
```

### Virtualized long lists

For hundreds of flat options, add `virtual` so only the visible rows render:

```svelte
<SvDropDownList {options} virtual rowHeight={34} />
```

> Note: a fast scrollbar-thumb drag can outrun windowing for a frame; the panel
> fills the off-screen area with faint placeholder rows (a skeleton) instead of
> flashing blank, so it stays visually filled at any scroll speed.

### Bounds detection (auto flip up/down)

The panel measures the room around its trigger every time it opens and on
scroll/resize. When there is not enough space below and there is more above, it
**flips up**; otherwise it opens down. Either way its height is **capped to the
space that actually fits the viewport**, so a long list near a screen edge
scrolls inside the panel instead of overflowing or clipping off-screen. This is
automatic - no configuration - and applies to every SvGrid dropdown
(`SvComboBox`, `SvAutoComplete`, `SvMultiSelect`, `SvGridSelect`, `SvTreeSelect`,
and the in-grid cell-editor dropdown), since they share one anchoring engine.

### Resizable panel

Add `resizable` to give the open panel a bottom drag grip (a "····" handle). The
user drags it to make the list taller or shorter; the height is clamped so it
never grows past the viewport. The grip appears only while the panel opens
**downward** - on an upward flip there is no room below to grow into, so it is
hidden.

```svelte
<SvDropDownList {options} resizable />
```

### Cascading selects

Feed the second dropdown from the first, and reset the child on every parent
change so it can never keep a value from the old branch:

```svelte
<script lang="ts">
  import { SvDropDownList, type ListOption } from '@svgrid/grid'
  const countries: ListOption[] = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
  ]
  const regionsByCountry: Record<string, ListOption[]> = {
    us: [{ value: 'ca', label: 'California' }, { value: 'ny', label: 'New York' }],
    ca: [{ value: 'on', label: 'Ontario' }, { value: 'bc', label: 'British Columbia' }],
  }
  let country = $state<string | null>(null)
  let region = $state<string | null>(null)
  const regions = $derived(country ? regionsByCountry[country] ?? [] : [])
</script>

<SvDropDownList label="Country" options={countries} value={country}
  onChange={(v) => { country = String(v); region = null }} />
<SvDropDownList label="Region" options={regions} value={region}
  disabled={!country} onChange={(v) => (region = String(v))} />
```

> Tip: `autoOpen` focuses the trigger and opens the panel on mount - handy when
> the dropdown is the first thing a user reaches for in a filter toolbar.

## Accessibility

- The trigger is a real `<button>` with `aria-haspopup="listbox"` /
  `aria-expanded`; the panel is a `role="listbox"` with a roving active option.
- `ArrowUp` / `ArrowDown` open and move, typing does type-ahead, `Enter` / `Escape`
  commit or dismiss, and focus returns to the trigger on close.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvComboBox](sv-combo-box.md) - the same list but type to filter.
- [SvListBox](sv-list-box.md) - the always-visible, inline variant.
