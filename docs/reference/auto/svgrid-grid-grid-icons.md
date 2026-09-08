# `@svgrid/grid` · `grid-icons.ts`

Auto-generated. Source: `packages\grid\src\grid-icons.ts`.

### `type GridIconName`

Every icon `<SvGrid>` draws for its own chrome. Pass any subset of these to
the `icons` prop to swap the built-in glyph for your own markup.

```ts
export type GridIconName =
  // ---- Header + column menu ----
  | 'sort'
  | 'sort-asc'
  | 'sort-desc'
  | 'filter'
  | 'menu'
  | 'group'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'autosize'
  | 'columns'
  | 'reset'
```

### `type GridIcons`

Consumer icon overrides, keyed by name. Any subset; names you leave out keep
their built-in glyph, so `icons` never has to be exhaustive.

```ts
export type GridIcons = Partial<Record<GridIconName, Snippet>>
```

### `const GRID_ICON_GLYPHS`

Icons whose built-in form is a character rather than an SVG path. Kept as
data so `<SvGrid>`, its footer and the standalone `SvRowGroupPanel` render
the same defaults instead of three copies drifting apart.

Each is the exact character that shipped inline before, so a grid that sets
no `icons` renders byte-for-byte what it always did.

```ts
export const GRID_ICON_GLYPHS: Partial<Record<GridIconName, string>> = {
  close: '✕', // multiplication X
  clear: '✕',
  remove: '×', // multiplication sign
  'row-number': '#',
  'pinned-row-top': '↑', // upwards arrow
  'pinned-row-bottom': '↓', // downwards arrow
  'find-prev': '↑',
  'find-next': '↓',
  'move-up': '↑',
  'move-down': '↓',
  'group-add': '⊞', // squared plus
  'page-first': '⇤', // leftwards arrow to bar
  'page-prev': '‹', // single left-pointing angle quote
  'page-next': '›', // single right-pointing angle quote
  'page-last': '⇥', // rightwards arrow to bar
  'page-size-caret': '▾', // black down-pointing small triangle
  'drag-handle': '⠿', // braille pattern dots-123456, the grip
  'breadcrumb-separator': '›',
}
```

### `const GRID_ICON_NAMES`

Every icon name, in catalogue order. Exported for tests and docs generation;
the grid itself never reads it, so it costs a consumer's bundle nothing.

```ts
export const GRID_ICON_NAMES: ReadonlyArray<GridIconName> = [
  'sort',
  'sort-asc',
  'sort-desc',
  'filter',
  'menu',
  'group',
  'x',
  'chevron-down',
  'chevron-right',
  'autosize',
  'columns',
  'reset',
  'op-contains',
  'op-notContains',
  'op-equals',
  'op-notEquals',
  'op-startsWith',
  'op-endsWith',
  'op-regex',
  'op-in',
  'op-notIn',
  'op-greaterThan',
  'op-lessThan',
  'op-between',
  'op-isBlank',
  'op-isNotBlank',
  'pin-left',
  'pin-right',
  'unpin',
  'search',
  'tool-panel',
  'chart',
  'advanced-filter',
  'column-group-caret',
  'close',
  'clear',
  'remove',
  'row-number',
  'pinned-row-top',
  'pinned-row-bottom',
  'find-prev',
  'find-next',
  'move-up',
  'move-down',
  'group-add',
  'page-first',
  'page-prev',
  'page-next',
  'page-last',
  'page-size-caret',
  'drag-handle',
  'breadcrumb-separator',
]
```
