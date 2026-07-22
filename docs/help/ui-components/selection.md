# Selection

List and overlay pickers. The overlay controls portal their panel to `<body>`
(carrying theme tokens) so they never clip, and share a common option shape:

```ts
type ListOption = { value: string | number; label: string; disabled?: boolean; group?: string }
```

## SvMultiSelect

A multi-select dropdown: a trigger showing the picked items as chips (collapsing
to "+N"), and a portalled panel with an optional search box and a checkbox list.
Built on the shared primitives (portal + dismissable layer), so it is
self-contained. Distinct from `SvTagsInput` (free-form tags) - this picks from a
fixed option set.

```svelte
<SvMultiSelect options={topics} value={picked} onChange={(v) => (picked = v)}
  searchable maxTagCount={3} />
```

Props: `options` (`MultiSelectOption[]`), `value` (array), `onChange(values)`,
`onCommit`, `onCancel`, `placeholder`, `searchable`, `maxTagCount`, `clearable`,
plus the shared editor-contract props. Keyboard: ArrowDown opens; arrows move,
Space/Enter toggles, Escape closes; the panel wires a WAI-ARIA combobox with
`aria-activedescendant`.

**Async / remote options.** Pass `loadOptions(query) => Promise<Option[]>` and the
search box calls it debounced (`debounceMs`, default 250), showing `loadingText`
while it resolves and dropping stale responses:

```svelte
<SvMultiSelect value={picked} onChange={(v) => (picked = v)}
  loadOptions={async (q) => (await fetch(`/api/tags?q=${q}`)).json()} />
```

## SvTreeSelect

A single-select dropdown that shows a collapsible, indented tree in its panel
(the tree-select / cascader pattern). Self-contained (its own panel, not
`SvTree`). Emits the picked node's value.

```svelte
<SvTreeSelect nodes={places} value={city} onChange={(v) => (city = v)}
  expandedIds={['asia']} showPath />
```

Props: `nodes` (`TreeSelectNode[]` = `{ value, label, children?, disabled? }`),
`value`, `onChange(value)`, `onCommit`, `onCancel`, `placeholder`, `showPath`
(root -> node label), `expandedIds`, plus the shared editor-contract props.
Keyboard: arrows move, Right/Left expand/collapse, Enter selects, Escape closes.
The pure helpers `flattenVisible`, `findNodePath` and `branchValues` are exported.

## SvGridSelect

A "grid in a dropdown" single-select: the panel shows the options as a compact
multi-column table (header row + search), so you can pick by more than a label
(name + email + role). Built on its own panel - it does **not** embed the full
`SvGrid`. Emits the chosen row's id.

```svelte
<SvGridSelect
  columns={[{ field: 'name', header: 'Name' }, { field: 'email', header: 'Email' }]}
  options={people} value={id} onChange={(id, row) => (assignee = id)} labelField="name" />
```

Props: `columns` (`GridSelectColumn[]` = `{ field, header, width? }`), `options`
(row records), `idField` (default `'id'`), `labelField` (trigger label; default
first column), `value`, `onChange(id, row)`, `onCommit`, `onCancel`,
`placeholder`, `searchable`, plus the shared editor-contract props. The pure
helper `filterGridRows` is exported. Like `SvMultiSelect`, it accepts
`loadOptions(query) => Promise<Row[]>` for debounced remote rows.

## SvListBox

An inline single/multi-select list (ARIA listbox) with roving highlight and full
keyboard (arrows, Home/End, Space/Enter).

```svelte
<SvListBox options={fruit} value={picked} multiple onChange={(v) => (picked = v)} rows={7} />
```

Props: `options`, `value` (scalar or array), `multiple`, `onChange`, `rows`, `disabled`.

## SvDropDownList

A single-select dropdown (trigger + portalled list, no typing).

```svelte
<SvDropDownList options={fruit} value={sel} onChange={(v) => (sel = v)} />
```

Props: `options`, `value`, `onChange(value)`, `placeholder`, `size`, `disabled`.

## SvComboBox

An editable combobox: type to filter the list, pick a value from it.

```svelte
<SvComboBox options={fruit} value={sel} onChange={(v) => (sel = v)} />
```

Props: `options`, `value`, `onChange(value)`, `placeholder`, `size`, `disabled`.
Unmatched typed text reverts on blur.

## SvAutoComplete

A free-text input with a suggestion list. Unlike the combobox it accepts **any**
value; suggestions are shortcuts.

```svelte
<SvAutoComplete value={text} suggestions={['Svelte','React','Vue']}
  onChange={(v) => (text = v)} />
```

Props: `value`, `suggestions` (string[] or ListOption[]), `minChars`, `onChange(text)`.

## SvTagsInput

An editable chips input. Enter or comma adds; Backspace removes the last; click × on
a chip to remove it.

```svelte
<SvTagsInput value={tags} onChange={(t) => (tags = t)} />
```

Props: `value` (string[]), `onChange(tags)`, `unique` (default true), `max`, `disabled`.

## SvCountryInput

A searchable country picker (flag + name + dial code) emitting the ISO alpha-2 code.

```svelte
<SvCountryInput value={country} showDial onChange={(code) => (country = code)} />
```

Props: `value` (ISO code), `onChange(code)`, `showDial`, `placeholder`, `size`, `disabled`.

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvListBox](./sv-list-box.md) - an inline single/multi-select list.
- [SvDropDownList](./sv-drop-down-list.md) - a single-select dropdown with no typing.
- [SvComboBox](./sv-combo-box.md) - an editable combobox that filters as you type.
- [SvAutoComplete](./sv-auto-complete.md) - a free-text input with suggestions.
- [SvMultiSelect](./sv-multi-select.md) - a multi-select dropdown with chips.
- [SvTreeSelect](./sv-tree-select.md) - a single-select dropdown over a tree.
- [SvGridSelect](./sv-grid-select.md) - a multi-column grid in a dropdown.
- [SvGridDropdown](./sv-grid-dropdown.md) - the themeable listbox behind grid cell editors.
- [SvCountryInput](./sv-country-input.md) - a searchable country picker with flags.
