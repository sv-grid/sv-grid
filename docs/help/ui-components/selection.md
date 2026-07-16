# Selection

List and overlay pickers. The overlay controls portal their panel to `<body>`
(carrying theme tokens) so they never clip, and share a common option shape:

```ts
type ListOption = { value: string | number; label: string; disabled?: boolean; group?: string }
```

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
