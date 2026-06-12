# Use SvGrid from React (custom-element bridge)

SvGrid is Svelte-5-native, but you can drop it into a React app via a thin **custom element** wrapper. The wrapper publishes one `<sv-grid-element>` tag, React renders it like any other DOM element, and data + columns cross the boundary as serialised properties.

> **When to choose this.** You have a React app and only need the grid in one place (an admin tool, a back-office screen). You want SvGrid's headless engine + virtualization + Excel-style filters without rewriting your stack in Svelte.
>
> **When NOT to choose this.** You need rich JSX cell renderers, React-Query / Recoil / Redux state inside cells, or you'd want to embed React Suspense / Portals in cell bodies. For deeper React integration, use our sister product [htmlelements.com](https://www.htmlelements.com) - purpose-built for React/Angular/Vue/web-components.

## What crosses the boundary

| Across cleanly | Needs a workaround |
| --- | --- |
| `data` (array of plain objects) | Snippet-based cell renderers (`renderSnippet`) - use `cellClass` + `format` + the HTML-string renderer below instead |
| `columns` (array of `ColumnDef` literals) | Svelte components as cell content |
| All built-in editors (`text`, `number`, `select`, `date`, `checkbox`, `textarea`, `list`, `chips`, `rich-select`) | React components inside the grid |
| Sort / filter / group / virtualization | React Suspense, Portals, Context inside cells |
| `onCellValueChange`, `onCellSelectionChange`, `onSortingChange`, `onFiltersChange`, `onRowSelectionChange`, `onColumnOrderChange` → `CustomEvent`s | Two-way `bind:` (use one-way property + event readback) |

## 1. Author the custom element

In your Svelte package (a thin wrapper over `sv-grid-community`):

```svelte
<!-- packages/sv-grid-element/src/SvGridElement.svelte -->
<svelte:options customElement={{
  tag: 'sv-grid-element',
  // Map DOM attributes / JS properties onto Svelte props.
  // 'json' types let React pass arrays / objects via .data = [...]
  props: {
    data:           { type: 'Object', reflect: false },  // Array<TData>
    columns:        { type: 'Object', reflect: false },  // Array<ColumnDef>
    rowHeight:      { type: 'Number', reflect: false },
    enableInlineEditing: { type: 'Boolean', reflect: false },
    enableCellSelection: { type: 'Boolean', reflect: false },
    filterLocale:   { type: 'String',  reflect: false },
    enableColumnReorder: { type: 'Boolean', reflect: false },
  },
}} />

<script lang="ts">
  import {
    SvGrid, tableFeatures,
    rowSortingFeature, columnFilteringFeature,
    rowSelectionFeature, rowPaginationFeature,
  } from 'sv-grid-community'

  // Re-export every prop the React side might want to set.
  let {
    data = [],
    columns = [],
    rowHeight = 32,
    enableInlineEditing = false,
    enableCellSelection = true,
    filterLocale = undefined,
    enableColumnReorder = false,
  }: {
    data: ReadonlyArray<Record<string, unknown>>
    columns: ReadonlyArray<unknown>
    rowHeight?: number
    enableInlineEditing?: boolean
    enableCellSelection?: boolean
    filterLocale?: string
    enableColumnReorder?: boolean
  } = $props()

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
  })

  // Bridge SvGrid's callback props onto DOM CustomEvents so the React
  // side can do `el.addEventListener('cellvaluechange', ...)`.
  function emit(name: string, detail: unknown) {
    const host = (event?.currentTarget as HTMLElement | undefined) ?? document
    host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }
</script>

<SvGrid
  data={data as never[]}
  columns={columns as never[]}
  {features}
  {rowHeight}
  {enableInlineEditing}
  {enableCellSelection}
  {filterLocale}
  {enableColumnReorder}
  filterMode="menu"
  containerHeight="100%"
  showPagination={false}
  enableRowSummaries={false}
  onCellValueChange={(e) => emit('cellvaluechange', e)}
  onCellSelectionChange={(ranges) => emit('cellselectionchange', { ranges })}
  onSortingChange={(s) => emit('sortingchange', { sorting: s })}
  onFiltersChange={(f) => emit('filterschange', f)}
  onRowSelectionChange={(sel, rows) => emit('rowselectionchange', { selection: sel, rows })}
  onColumnOrderChange={(order) => emit('columnorderchange', { order })}
/>
```

Build it (`vite build --lib`, `svelte-package`, or any custom-element target):

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ compilerOptions: { customElement: true } })],
  build: {
    lib: {
      entry: 'src/SvGridElement.svelte',
      name:  'SvGridElement',
      formats: ['es'],
      fileName: 'sv-grid-element',
    },
  },
})
```

Publish as `@your-org/sv-grid-element` (or vendor the built file straight into your React app).

## 2. Use it from React

```tsx
// App.tsx
import { useEffect, useRef, useState } from 'react'
import '@your-org/sv-grid-element' // side-effect: registers <sv-grid-element>

type Row = { id: string; name: string; status: 'active' | 'inactive'; salary: number }

// Tell TypeScript the custom element is a valid JSX tag.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sv-grid-element': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

export default function GridScreen() {
  const ref = useRef<HTMLElement | null>(null)
  const [rows, setRows] = useState<Row[]>([
    { id: 'P-1', name: 'Ada Lovelace',  status: 'active',   salary: 145_000 },
    { id: 'P-2', name: 'Linus Torvalds', status: 'active',  salary: 188_000 },
    { id: 'P-3', name: 'Grace Hopper',   status: 'inactive', salary: 152_000 },
  ])

  // Push data + columns onto the custom element via .properties (not
  // attributes - attributes are strings, properties keep object identity).
  useEffect(() => {
    if (!ref.current) return
    ;(ref.current as any).data = rows
    ;(ref.current as any).columns = [
      { field: 'id',     header: 'ID',     width: 100, editable: false },
      { field: 'name',   header: 'Name',   width: 220, editorType: 'text' },
      { field: 'status', header: 'Status', width: 130, editorType: 'select',
        editorOptions: ['active', 'inactive'],
        // Built-in styling via cellClass survives the boundary fine - it's
        // a function, but plain JS without Svelte/React state inside.
        cellClass: (ctx: { getValue: () => unknown }) =>
          ctx.getValue() === 'active' ? 'pill ok' : 'pill bad' },
      { field: 'salary', header: 'Salary', width: 140, editorType: 'number',
        align: 'right',
        format: { type: 'number', options: { style: 'currency', currency: 'USD' } } },
    ]
  }, [rows])

  // Listen for grid events. CustomEvent.detail mirrors the callback
  // payloads from the Svelte API verbatim.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onEdit = (e: Event) => {
      const { rowIndex, columnId, newValue } = (e as CustomEvent).detail
      setRows((prev) => prev.map((r, i) =>
        i === rowIndex ? { ...r, [columnId]: newValue } : r))
    }
    el.addEventListener('cellvaluechange', onEdit)
    return () => el.removeEventListener('cellvaluechange', onEdit)
  }, [])

  return (
    <div style={{ height: 480 }}>
      <sv-grid-element
        ref={ref as React.RefObject<HTMLElement>}
        // Boolean attrs in JSX: presence = true; pass strings for numbers
        // for SSR safety, then re-apply via property in the effect above.
      />
    </div>
  )
}
```

## 3. Custom cell content (HTML-string renderer)

The biggest constraint of the custom-element bridge is that you can't render a React component INSIDE a cell. For lightweight cases (badges, links, formatted numbers, sparklines built in inline SVG), declare an HTML-string renderer on the column:

```ts
{
  field: 'status',
  header: 'Status',
  width: 110,
  cell: (ctx: { getValue: () => unknown }) => {
    // The grid accepts a returned string and renders it via {@html}.
    const v = String(ctx.getValue())
    const cls = v === 'active' ? 'pill ok' : 'pill bad'
    return `<span class="${cls}">${v}</span>`
  },
}
```

CSS that styles `.pill` lives in your React app's stylesheet - the custom element inherits the page's CSS variables and global classes.

For anything richer (a React `<Avatar>` with hover card, a `<MUI/Chip>`, etc.) you'd need to **portal a React tree into a placeholder element** the grid renders. That's possible but fiddly, and at that point you're better served by [htmlelements.com](https://www.htmlelements.com), which has first-class React bindings.

## 4. Imperative API

`SvGrid`'s API surface - `setFilter`, `setColumnPinning`, `setColumnOrder`, `selectCells`, `getDisplayedRows`, `undo`, `redo`, `openFind`, … - works through `onApiReady`. To expose it across the custom-element boundary, add a `getApi()` method to the wrapper:

```svelte
<!-- inside SvGridElement.svelte -->
<script lang="ts">
  let api: any = null
  // Exposed on the host element as `el.getApi()`.
  export function getApi() { return api }
</script>

<SvGrid ... onApiReady={(next) => (api = next)} />
```

```tsx
// React side
const api = (ref.current as any)?.getApi?.()
api?.setColumnOrder(['id', 'salary', 'name', 'status'])
```

## Caveats - the honest version

- **No React state inside cells.** Cell renderers are HTML strings or built-in formatters; if you need a React component per cell, this bridge isn't enough.
- **No two-way `bind:`.** React sets properties; the wrapper emits `CustomEvent`s for changes. One-way data flow.
- **Theme tokens leak both ways.** The custom element inherits page CSS via the `--sg-*` variables. That's usually a feature; if it isn't, scope the element with a wrapping `<div style="--sg-bg: ...">`.
- **`composed: true` events** cross shadow boundaries. Make sure your React `addEventListener` is on the same element you handed to `ref` - otherwise events from other custom elements on the page can leak through bubbling.
- **Re-renders are coarse.** Reassigning `el.data` is what triggers a re-render. For high-frequency updates (streaming feeds, 10+ updates / sec), prefer setting a single property once per animation frame rather than per delta.

## See also

- [Architecture](../help/architecture.md) - why the engine is headless.
- [Use SvGrid imperatively from outside the component](../help/api-reference.md) - the same API the wrapper hands back.
- [htmlelements.com](https://www.htmlelements.com) - the recommended option for React-first apps.
