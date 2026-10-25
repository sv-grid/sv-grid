# `@svgrid/grid` · `list-option.ts`

Auto-generated. Source: `packages\grid\src\list-option.ts`.

### `type ListOption`

Shared option shape for the SvGrid UI-kit selection controls.

```ts
export type ListOption = {
  value: string | number
  label: string
  disabled?: boolean
  /** Optional group heading this option belongs under. */
  group?: string
  /** Optional color swatch (any CSS color) shown before the label. */
  color?: string
  /**
   * Optional muted text pinned to the trailing edge of the row - a count, a
   * shortcut, a unit. Not part of the label, so it does not affect matching
   * or the accessible name.
   */
  hint?: string
}
```

### `function normalizeOptions`

Coerce a raw options array into well-formed ListOptions. A primitive item
(`1`, `'a'`) becomes `{ value, label: String(value) }`; an object missing a
`label` or `value` gets the other filled in. This makes a caller who passes
e.g. `[1, 2, 3]` or `['a', 'b']` render sensibly instead of crashing a keyed
`#each` on `undefined`/duplicate `value`s.

```ts
export function normalizeOptions(raw: ReadonlyArray<ListOption | string | number> | null | undefined): ListOption[]
```

### `function filterOptions`

Case-insensitive substring filter over option labels.

```ts
export function filterOptions(options: ReadonlyArray<ListOption>, query: string): ListOption[]
```

### `type IndexedOption`

An option carrying its position in the flat source array (for prop-getters).

```ts
export type IndexedOption = ListOption & { index: number }
```

### `type OptionGroup`

A section of options that share a `group` heading (null = ungrouped).

```ts
export type OptionGroup = { group: string | null; options: IndexedOption[] }
```

### `function groupOptions`

Bucket options by their `group` heading, preserving each option's flat index
so grouped rendering still drives `optionProps(index)` etc. Groups appear in
first-seen order. When no option sets `group`, the result is a single
`group: null` section (render it flat).

```ts
export function groupOptions(options: ReadonlyArray<ListOption>): OptionGroup[]
```

### `function hasGroups`

Whether any option declares a `group` (so headings are worth rendering).

```ts
export function hasGroups(options: ReadonlyArray<ListOption>): boolean
```

### `type RowHeight`

Fixed px, or a per-option function - lets a virtualized list mix row heights.

```ts
export type RowHeight = number | ((opt: IndexedOption, index: number) => number)
```

### `type VirtualListRow`

One row of the flattened virtualization model: a group heading or an option.

```ts
export type VirtualListRow =
  | { type: 'group'; label: string; size: number }
  | { type: 'option'; opt: IndexedOption; size: number }
```

### `type FlatVirtualModel`

A flattened option list plus its measurements, for virtualizing long dropdowns.

```ts
export type FlatVirtualModel = {
  /** Group headings + options in render order, each with its px height. */
  entries: VirtualListRow[]
  /** Whether any group heading rows are present. */
  hasGroups: boolean
  /** Height (px) of the entry at flat index `i` - feeds the virtualizer's `estimateSize`. */
  sizeAt: (i: number) => number
  /** Maps an OPTION index (position in the source options array, as used by
   *  `optionProps(index)`) to its flat entry index - so the active option can
   *  be scrolled into view even with group rows interleaved. */
  optionFlatIndex: number[]
}
```

### `function flattenForVirtual`

Flatten a (possibly grouped) option list into a single virtualization model:
group headings become rows interleaved with their options, and each row
carries its pixel height. This is what lets the selection controls window a
GROUPED list (previously they fell back to rendering every node) and support
variable row heights, while reusing the shared `createSvelteVirtualizer`.

Pure - no DOM. Builds on `groupOptions`, which already tags each option with
its flat `index` (the value `optionProps(index)` expects).

```ts
export function flattenForVirtual(
  options: ReadonlyArray<ListOption>,
  opts: { rowHeight: RowHeight; groupHeaderHeight?: number },
): FlatVirtualModel
```

### `function nextTypeaheadIndex`

Next enabled option index whose label starts with `buffer` (type-ahead),
searching forward from just after `from` and wrapping. Returns -1 for no
match / empty buffer. Case-insensitive.

```ts
export function nextTypeaheadIndex(
  options: ReadonlyArray<ListOption>,
  buffer: string,
  from: number,
): number
```

### `function createTypeaheadBuffer`

A tiny type-ahead buffer: accumulates printable characters within `timeout`
ms of each other, then resets. Frameworkfree; the caller supplies scheduling.

```ts
export function createTypeaheadBuffer(timeout = 600)
```

### `function isTypeaheadKey`

Whether a keydown is a bare printable character (a type-ahead candidate).

```ts
export function isTypeaheadKey(e: KeyboardEvent): boolean
```
