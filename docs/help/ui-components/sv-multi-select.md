# SvMultiSelect

A multi-select dropdown: the trigger shows the picked items as chips (collapsing
to "+N"), and a portalled panel holds an optional search box over a checkbox list.
It picks from a fixed set - distinct from [SvTagsInput](selection.md), which takes
free-form tags.

`SvMultiSelect` is the compact way to choose several values without a permanently
open list. It supports `bind:value`, an optional `searchable` box, a `clearable`
control, and remote `loadOptions` for server-backed search. Selections stay open
until the user is done, and a `Done` button (plus `onCommit`) marks the batch as
finished. Colors follow the grid's `--sg-*` tokens.

<div data-docs-demo="334-input-editors" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvMultiSelect, type MultiSelectOption } from '@svgrid/grid'
  const options: MultiSelectOption[] = [
    { value: 'ts', label: 'TypeScript' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'rust', label: 'Rust' },
  ]
  let value = $state<Array<string | number>>([])
</script>

<SvMultiSelect label="Skills" {options} bind:value maxTagCount={2} />
```

## Props

| Prop          | Type                                                | Default     | Description                                                     |
| ------------- | --------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `options`     | `ReadonlyArray<MultiSelectOption>`                  | -           | The options. When `loadOptions` is set, this is the seed list. |
| `value`       | `ReadonlyArray<string \| number>`                   | `[]`        | Selected values. Bindable (`bind:value`).                      |
| `onChange`    | `(value: Array<string \| number>) => void`          | -           | Fires whenever the selection changes.                          |
| `onCommit`    | `(value: Array<string \| number>) => void`          | -           | Fires when the user presses `Done`.                            |
| `onCancel`    | `() => void`                                         | -           | Fires when the panel is dismissed without committing.          |
| `placeholder` | `string`                                            | `'Select…'` | Shown when nothing is selected.                                |
| `searchable`  | `boolean`                                            | `true`      | Show a search box above the list.                              |
| `maxTagCount` | `number`                                            | `3`         | Chips shown in the trigger before collapsing to "+N".          |
| `clearable`   | `boolean`                                            | `true`      | Show a clear-all control when there is a selection.            |
| `loadOptions` | `(query: string) => Promise<MultiSelectOption[]>`   | -           | Remote, debounced search that replaces the list.               |
| `debounceMs`  | `number`                                            | `250`       | Debounce for remote search.                                    |
| `loadingText` | `string`                                            | `'Loading…'`| Text shown while a remote search runs.                         |
| `size`        | `sm \| md \| lg`                                    | `md`        | Trigger height and font size.                                  |
| `disabled`    | `boolean`                                            | `false`     | Blocks interaction.                                            |
| `label`       | `string`                                            | -           | Visible field label, wired to the control.                     |
| `hint`        | `string`                                            | -           | Helper text under the control.                                 |
| `error`       | `string`                                            | -           | Error message; announced and styled when set.                  |
| `required`    | `boolean`                                            | `false`     | Marks the field required.                                      |
| `invalid`     | `boolean`                                            | `false`     | Applies the invalid state.                                     |
| `name`        | `string`                                            | -           | Emits hidden input(s) carrying each value for form posts.      |
| `dir`         | `ltr \| rtl \| auto`                                | `auto`      | Text direction.                                               |
| `ariaLabel`   | `string`                                            | -           | Accessible name when there is no visible `label`.              |
| `id`          | `string`                                            | -           | Root id; label/hint/error ids derive from it.                  |

### MultiSelectOption

```ts
type MultiSelectOption = {
  value: string | number
  label: string
  disabled?: boolean
}
```

## Patterns

### Two-way binding

Bind the array directly and read it anywhere - no `onChange` wiring needed:

```svelte
<SvMultiSelect {options} bind:value={selected} />
<p>{selected.length} chosen</p>
```

### Remote options

Give `loadOptions` an async function; the seed `options` resolve chip labels for
values that are not in the current result page:

```svelte
<SvMultiSelect label="Tags" options={recent}
  loadOptions={async (q) => (await fetch(`/api/tags?q=${q}`)).json()}
  bind:value />
```

### Commit on Done

Use `onCommit` to run work only once the user finishes picking, rather than on
every toggle:

```svelte
<SvMultiSelect {options} bind:value onCommit={(v) => saveFilters(v)} />
```

### As a grid cell editor

Register `SvMultiSelect` under a type name and a column can edit an array-valued
cell (tags, skills) in place. Map the grid's edit context onto the props:

```svelte
<script lang="ts">
  import { SvGrid, SvMultiSelect, registerCellEditor,
    type MultiSelectOption } from '@svgrid/grid'

  const skills: MultiSelectOption[] = [
    { value: 'ts', label: 'TypeScript' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'rust', label: 'Rust' },
  ]
  registerCellEditor('skills', {
    component: SvMultiSelect,
    props: (ctx) => ({
      options: skills,
      value: (ctx.value as Array<string | number>) ?? [],
      onChange: ctx.onChange,
      onCommit: (v: Array<string | number>) => ctx.onCommit(v),
    }),
  })

  const columns = [{ field: 'skills', header: 'Skills', editorType: 'skills' }]
</script>
```

Every toggle flows through `onChange`; `onCommit` ends the edit with the final
array when the user presses `Done`.

> Tip: set `disabled` on a `MultiSelectOption` to keep it visible but unpickable -
> toggling ignores disabled rows rather than hiding them.

## Accessibility

- The trigger carries `aria-haspopup` / `aria-expanded`; the panel list is a
  `role="listbox"` with `aria-multiselectable` and `aria-selected` per option.
- The search box is a `role="combobox"` driving the list via `aria-activedescendant`;
  arrow keys move, `Enter` / `Space` toggle, `Escape` dismisses.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvListBox](sv-list-box.md) - inline multi-select without a popover.
- [SvGridSelect](sv-grid-select.md) - pick a row by more than one column.
