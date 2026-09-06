# TypeScript with the custom element

The element is plain JavaScript at the boundary, so TypeScript needs to be told
it exists. Two declarations get completion and checking back.

## Plain TypeScript

The primitives worth declaring first - they are the ones you set most.

<div data-docs-demo="02-sort-filter-paginate" data-height="460"></div>

Add the element to `HTMLElementTagNameMap`, so `getElementById` and
`querySelector` return something typed:

`Row` must extend `RowData` (`Record<string, unknown>`), because that is the
constraint `ColumnDef` and `SvGridApi` carry:

```ts
// svgrid-elements.d.ts
import type { ColumnDef, RowData, SvGridApi } from '@svgrid/grid'

interface SvGridElement<Row extends RowData = RowData> extends HTMLElement {
  data: readonly Row[]
  columns: ColumnDef<never, Row>[]
  api: SvGridApi<never, Row>

  // A few of the 72 primitives; add the ones you use.
  sortable: boolean
  filterable: boolean
  pageable: boolean
  pageSize: number
  showRowNumbers: boolean
  groupBy: readonly string[]
}

declare global {
  interface HTMLElementTagNameMap {
    'sv-grid': SvGridElement
    'sv-grid-shadow': SvGridElement
  }
}

// With that in scope, both of these are checked:
const grid = document.querySelector('sv-grid')!
grid.columns = [{ field: 'name', header: 'Name' }]
grid.api.exportCsv()
```

The full property list is in the [reference](./sv-grid.md), which is generated
from the grid's own `Props` type - copy the rows you need rather than trying to
mirror all 98.

## JSX (React, Solid, Preact)

JSX needs the tag registered separately, because intrinsic elements are a
different map:

```tsx
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sv-grid': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        sortable?: boolean
        filterable?: boolean
        'page-size'?: number
      }
      'sv-grid-shadow': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}
```

Attributes in JSX are strings, so only the primitives belong here. Arrays and
objects go through a ref - see [React](./react.md).


## Typed events

`cellvaluechange` fires here; the map below types its `detail`.

<div data-docs-demo="05-inline-editing" data-height="470"></div>

`CustomEvent.detail` is `any` by default. Declare the map once:

```ts
interface SvGridEventMap {
  cellvaluechange: CustomEvent<{
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
  }>
  sortingchange: CustomEvent<Array<{ id: string; desc: boolean }>>
  rowselectionchange: CustomEvent<{ selection: Record<string, boolean>; rows: unknown[] }>
  // `rowclick` carries the ROW, not the click event - see the reference.
  rowclick: CustomEvent<Record<string, unknown>>
}

declare global {
  interface HTMLElementEventMap extends SvGridEventMap {}
}

// `HTMLElement`, so addEventListener resolves against HTMLElementEventMap.
// (`querySelector('sv-grid')` gives you an `Element` unless you also add the
// HTMLElementTagNameMap declaration above.)
const el: HTMLElement = document.createElement('sv-grid')
el.addEventListener('cellvaluechange', (e) => {
  e.detail.newValue // typed
})
```

Every event's `detail` shape is listed in the [reference](./sv-grid.md); it is
the corresponding callback's argument, verbatim, with two documented exceptions
kept for backwards compatibility.


## Why these are not shipped

A `.d.ts` in the package would have to be generated from the same source as the
element, and kept correct across a version skew between `@svgrid/grid-wc` and
whatever `@svgrid/grid` types a consumer has installed. Hand-copying the few
props you use is more honest than a declaration file that can silently disagree
with the element you loaded.


## See also

- [`<sv-grid>` reference](./sv-grid.md)
- [React](./react.md) - where the typing matters most.
