# SvGrid in React

```bash
npm install @svgrid/grid-wc
```

```tsx
import { SvGrid } from '@svgrid/grid-wc/react'

export default function Screen() {
  return (
    <div style={{ height: 480 }}>
      <SvGrid
        data={rows}
        columns={columns}
        sortable
        filterable
        editable
        onCellValueChange={(e) => save(e)}
      />
    </div>
  )
}
```

That is the whole integration. The component is generated from `<SvGrid>`'s
own types, so all 98 properties and 20 events are typed props, and it works the
same on React 17, 18 and 19.

## Why the wrapper rather than the raw element

- **React 18 and earlier stringify object props onto attributes.**
  `columns={cols}` becomes the attribute `"[object Object]"` and the grid
  renders empty, with no error. React 19 assigns them as properties; the wrapper
  does so on every version.
- **The element renders before your props arrive.** Both React and Angular
  create the element first and assign properties in an effect, so the grid
  mounts once with nothing. The wrapper handles that ordering.
- **`apiready` fires once, during that first mount** - before React can bind a
  listener, so a raw `addEventListener` misses it entirely. The wrapper replays
  it.
- Typed props and handlers, instead of `el.columns = ...` on an `HTMLElement`.

## Shadow DOM

`shadow` picks the style-isolated element. Same props, same events; the extra
bundle loads only when you ask for it.

```tsx
<SvGrid shadow data={rows} columns={columns} />
```

## The imperative api

```tsx
import { useRef } from 'react'
import { SvGrid, type SvGridHandle } from '@svgrid/grid-wc/react'

export function Screen() {
  const grid = useRef<SvGridHandle>(null)

  const exportCsv = () => {
    // `api` is the grid api; `element` is the host custom element.
    ;(grid.current?.api as { exportCsv(): void } | undefined)?.exportCsv()
  }

  return <SvGrid ref={grid} data={rows} columns={columns} />
}
```

<!-- BEGIN generated examples - packages/grid-wc/scripts/sync-example-docs.mjs -->

## Examples

Nine complete apps, each one click from running. **Open in StackBlitz**
boots a full editable project - no local install, nothing to configure - and
every one is compiled in this repository's CI, so what you open is what works.

They all share the same typed `data.ts`, so the only thing that changes
between recipes is the grid.

### A first grid

Rows, columns, and the two features almost every table wants.

<div data-docs-sandbox="react:basic" data-title="A first grid"></div>

```tsx {nocheck}
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * The smallest useful grid: rows, columns, and the two features almost every
 * table wants. `data` and `columns` are arrays, so they cross as properties -
 * the wrapper handles that on every React version.
 */
export default function App() {
  return (
    <div style={{ height: '100%', padding: 16 }}>
      <SvGrid data={people} columns={columns} sortable filterable />
    </div>
  )
}
```

### Sorting and filtering

A filter row under the headers, multi-column sort, and the current sort read back into your own state.

<div data-docs-sandbox="react:sorting-filtering" data-title="Sorting and filtering"></div>

```tsx {nocheck}
import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * A filter row under the headers, multi-column sort, and the current sort read
 * back into React state. `onSortingChange` hands you the same array the grid
 * holds, so it can drive your own UI.
 */
export default function App() {
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>([])

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, font: '13px system-ui', color: '#64748b' }}>
        Sorted by:{' '}
        {sorting.length === 0
          ? 'nothing yet - click a header, then shift-click a second one'
          : sorting.map((s) => `${s.id} ${s.desc ? 'desc' : 'asc'}`).join(', ')}
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={people}
          columns={columns}
          sortable
          filterable
          showFilterRow
          onSortingChange={setSorting}
        />
      </div>
    </div>
  )
}
```

### Editing and saving

Inline editing, with each committed edit arriving through `cellvaluechange`. Swap the local update for your save call.

<div data-docs-sandbox="react:editing" data-title="Editing and saving"></div>

```tsx {nocheck}
import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns, type Person } from '../data'

/**
 * Inline editing, with the change written back into React state.
 *
 * `cellvaluechange` fires once per committed edit and its detail is typed, so
 * `rowIndex`, `columnId` and `newValue` come through without a cast. Replace
 * the setState with your own save call.
 */
export default function App() {
  const [rows, setRows] = useState<Person[]>(people)
  const [log, setLog] = useState<string[]>([])

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, font: '13px system-ui', color: '#64748b' }}>
        Double-click a Name or Amount cell. Last edits: {log.slice(-3).join(' · ') || 'none yet'}
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={rows}
          columns={columns.map((c) =>
            c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c,
          )}
          sortable
          filterable
          editable
          onCellValueChange={(e) => {
            setRows((prev) =>
              prev.map((row, i) => (i === e.rowIndex ? { ...row, [e.columnId]: e.newValue } : row)),
            )
            setLog((prev) => [...prev, `${e.columnId} = ${String(e.newValue)}`])
          }}
        />
      </div>
    </div>
  )
}
```

### Row selection

Checkboxes, with the selected rows handed straight to you - both the selection map and the rows themselves.

<div data-docs-sandbox="react:selection" data-title="Row selection"></div>

```tsx {nocheck}
import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns, type Person } from '../data'

/**
 * Row checkboxes, with the selected rows handed to React so you can act on
 * them. `rowselectionchange` carries both the selection map and the rows
 * themselves, so you rarely need to look anything up.
 */
export default function App() {
  const [selected, setSelected] = useState<Person[]>([])
  const total = selected.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ font: '13px system-ui', color: '#64748b' }}>
        {selected.length === 0
          ? 'Tick some rows to total them'
          : `${selected.length} selected · ${total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={people}
          columns={columns}
          sortable
          filterable
          showRowSelection
          onRowSelectionChange={(e) => setSelected(e.rows as Person[])}
        />
      </div>
    </div>
  )
}
```

### Grouping and totals

Group by one or two columns with an aggregate in the group row. `groupBy` is an array, so it is one of the props that can only be a property.

<div data-docs-sandbox="react:grouping" data-title="Grouping and totals"></div>

```tsx {nocheck}
import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * Grouping by one or two columns, with an aggregate in the group row.
 *
 * `groupBy` is an array, so it is one of the props that can only be a
 * property - which is the whole reason the React wrapper exists.
 */
export default function App() {
  const [groupBy, setGroupBy] = useState<string[]>(['team'])

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, font: '13px system-ui' }}>
        {[['team'], ['country'], ['team', 'country'], []].map((g) => (
          <button
            key={g.join('+') || 'none'}
            onClick={() => setGroupBy(g)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: groupBy.join() === g.join() ? '#e2e8f0' : '#fff',
              cursor: 'pointer',
            }}
          >
            {g.join(' + ') || 'No grouping'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={people}
          columns={columns.map((c) => (c.id === 'amount' ? { ...c, summary: 'sum' } : c))}
          sortable
          filterable
          groupable
          groupBy={groupBy}
          groupFooters
        />
      </div>
    </div>
  )
}
```

### Pagination

Client-side paging. `pageSize` is the INITIAL page size, read once at mount.

<div data-docs-sandbox="react:pagination" data-title="Pagination"></div>

```tsx {nocheck}
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * Client-side paging. `pageSize` is read once at mount - it is the INITIAL
 * page size - so change pages through the footer or the grid api rather than
 * by reassigning the prop.
 */
export default function App() {
  return (
    <div style={{ height: '100%', padding: 16 }}>
      <SvGrid
        data={people}
        columns={columns}
        sortable
        filterable
        pageable
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        paginationPosition="bottom"
      />
    </div>
  )
}
```

### Server-side data

The grid renders the page you hand it and tells you when the user wants another. `externalSort` and `externalPagination` stop it doing the work locally; `rowCount` is how it knows how many pages exist.

<div data-docs-sandbox="react:server-data" data-title="Server-side data"></div>

```tsx {nocheck}
import { useEffect, useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns, type Person } from '../data'

type Query = { page: number; sort: Array<{ id: string; desc: boolean }> }

/**
 * Server-side data: the grid renders whatever page you hand it and tells you
 * when the user wants a different one.
 *
 * `externalSort` and `externalPagination` stop the grid doing the work
 * locally; `rowCount` is how it knows how many pages exist. `fetchPage` here
 * stands in for your API call.
 */
const PAGE_SIZE = 25

function fetchPage({ page, sort }: Query): Promise<{ rows: Person[]; total: number }> {
  // Pretend this is a network call.
  const sorted = [...people].sort((a, b) => {
    for (const s of sort) {
      const av = a[s.id as keyof Person]
      const bv = b[s.id as keyof Person]
      if (av === bv) continue
      return (av > bv ? 1 : -1) * (s.desc ? -1 : 1)
    }
    return 0
  })
  const start = page * PAGE_SIZE
  return new Promise((resolve) =>
    setTimeout(() => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }), 250),
  )
}

export default function App() {
  const [query, setQuery] = useState<Query>({ page: 0, sort: [] })
  const [rows, setRows] = useState<Person[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPage(query).then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setTotal(res.total)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div style={{ height: '100%', padding: 16 }}>
      <SvGrid
        data={rows}
        columns={columns}
        loading={loading}
        sortable
        externalSort
        externalPagination
        pageable
        pageSize={PAGE_SIZE}
        rowCount={total}
        pageIndex={query.page}
        onSortingChange={(sort) => setQuery((q) => ({ ...q, sort, page: 0 }))}
        onPaginationChange={(p) => setQuery((q) => ({ ...q, page: (p as { pageIndex: number }).pageIndex }))}
      />
    </div>
  )
}
```

### Theming

The `--sg-*` custom properties. Ordinary CSS custom properties, so they cascade from any ancestor - which is why they also reach inside `<sv-grid-shadow>`.

<div data-docs-sandbox="react:theming" data-title="Theming"></div>

```tsx {nocheck}
import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * Theming through `--sg-*` custom properties.
 *
 * They are ordinary CSS custom properties, so they cascade: set them on any
 * ancestor and the grid inherits. That is also why they reach into
 * `<sv-grid-shadow>` - inheritance crosses a shadow boundary.
 */
const THEMES = {
  Light: {},
  Dark: {
    '--sg-bg': '#0b1220',
    '--sg-fg': '#e2e8f0',
    '--sg-border': '#1e293b',
    '--sg-header-bg': '#111a2e',
    '--sg-row-hover': '#111a2e',
  },
  Warm: {
    '--sg-bg': '#fffaf5',
    '--sg-fg': '#42302a',
    '--sg-border': '#f0dcc9',
    '--sg-header-bg': '#fdf1e4',
    '--sg-accent': '#c2410c',
  },
} satisfies Record<string, Record<string, string>>

export default function App() {
  const [theme, setTheme] = useState<keyof typeof THEMES>('Light')

  return (
    <div
      style={{
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...THEMES[theme],
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((name) => (
          <button
            key={name}
            onClick={() => setTheme(name)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: theme === name ? '#e2e8f0' : '#fff',
              cursor: 'pointer',
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid data={people} columns={columns} sortable filterable zebraRows />
      </div>
    </div>
  )
}
```

### Excel export (Enterprise)

The paid pack from a non-Svelte host. `@svgrid/enterprise/export` is plain JavaScript, so it needs no Svelte in your build - the same goes for `/import`, `/print`, `/pivot` and `/license`. See [Enterprise features](./enterprise.md) for what those subpaths cover and what needs a Svelte-aware bundler.

<div data-docs-sandbox="react:enterprise" data-title="Excel export (Enterprise)"></div>

```tsx {nocheck}
import { useRef, useState } from 'react'
import { SvGrid, type SvGridHandle } from '@svgrid/grid-wc/react'
import { exportGrid } from '@svgrid/enterprise/export'
import { people, columns } from '../data'

/**
 * Excel export from a React host.
 *
 * `@svgrid/enterprise/export` is plain JavaScript - no Svelte in your build -
 * so this works in any bundler. The same is true of `/import`, `/print`,
 * `/pivot` and `/license`. The Kanban and scheduler views are the exception:
 * they are Svelte components, so they need a Svelte-aware bundler.
 *
 * The api arrives on the handle once `apiready` has fired. It is typed
 * `unknown` there because the wrapper does not depend on the grid's types, so
 * the enterprise call needs a cast.
 */
export default function App() {
  const grid = useRef<SvGridHandle>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  async function exportXlsx() {
    if (!grid.current?.api) return
    setBusy(true)
    try {
      await exportGrid(grid.current.api as Parameters<typeof exportGrid>[0], {
        format: 'xlsx',
        filename: 'people',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={exportXlsx} disabled={!ready || busy}>
        {busy ? 'Building…' : 'Export to Excel'}
      </button>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          ref={grid}
          data={people}
          columns={columns}
          sortable
          filterable
          onApiReady={() => setReady(true)}
        />
      </div>
    </div>
  )
}
```

<!-- END generated examples -->

## Using the raw element instead

The wrapper is a thin layer over `<sv-grid>`; nothing stops you using the
element directly, and the rest of this page shows how. Do that if you want to
avoid the extra dependency edge, or if you are already managing the element
yourself.

### The React version matters

- **React 19+** passes non-primitive props to a custom element as
  **properties**. `<sv-grid columns={cols} data={rows} />` works directly.
- **React 18 and earlier** stringify every prop onto an **attribute**, so
  `columns` arrives as `"[object Object]"` and the grid renders empty. You must
  assign objects through a ref.

The ref approach works on both, so it is what the examples below use.

## A working grid

The editing grid the code below builds, running as the Svelte component.

<div data-docs-demo="05-inline-editing" data-height="470"></div>

```tsx
import { useEffect, useRef, useState } from 'react'
import '@svgrid/grid-wc' // side effect: registers <sv-grid>

type Row = { id: string; name: string; status: 'active' | 'inactive'; salary: number }

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sv-grid': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        sortable?: boolean
        filterable?: boolean
        'enable-inline-editing'?: boolean
      }
    }
  }
}

export default function GridScreen() {
  const ref = useRef<HTMLElement | null>(null)
  const [rows, setRows] = useState<Row[]>([
    { id: 'P-1', name: 'Ada Lovelace', status: 'active', salary: 145_000 },
    { id: 'P-2', name: 'Linus Torvalds', status: 'active', salary: 188_000 },
    { id: 'P-3', name: 'Grace Hopper', status: 'inactive', salary: 152_000 },
  ])

  // Arrays and objects are PROPERTIES. There is no attribute form for them.
  useEffect(() => {
    const el = ref.current as never as { data: Row[]; columns: unknown[] } | null
    if (!el) return
    el.columns = [
      { field: 'id', header: 'ID', width: 100, editable: false },
      { field: 'name', header: 'Name', width: 220, editorType: 'text' },
      {
        field: 'status',
        header: 'Status',
        width: 130,
        editorType: 'select',
        editorOptions: ['active', 'inactive'],
      },
      {
        field: 'salary',
        header: 'Salary',
        width: 140,
        align: 'right',
        format: { type: 'number', options: { style: 'currency', currency: 'USD' } },
      },
    ]
    el.data = rows
  }, [rows])

  // Grid callbacks arrive as DOM CustomEvents; detail is the callback argument.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onEdit = (e: Event) => {
      const { rowIndex, columnId, newValue } = (e as CustomEvent).detail
      setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [columnId]: newValue } : r)))
    }
    el.addEventListener('cellvaluechange', onEdit)
    return () => el.removeEventListener('cellvaluechange', onEdit)
  }, [])

  return (
    <div style={{ height: 480 }}>
      {/* Primitives can stay in JSX as attributes. */}
      <sv-grid ref={ref as React.RefObject<HTMLElement>} sortable filterable enable-inline-editing />
    </div>
  )
}
```


## A small hook, if you set many props

`groupBy` and `pinnedTopRows` are arrays, which is exactly what the hook is for.

<div data-docs-demo="07-grouping-aggregation" data-height="470"></div>

Rather than one `useEffect` per prop, assign a bag of them:

```ts
function useGridProps(ref: React.RefObject<HTMLElement | null>, props: Record<string, unknown>) {
  useEffect(() => {
    const el = ref.current as never as Record<string, unknown> | null
    if (!el) return
    for (const [k, v] of Object.entries(props)) el[k] = v
  }, [ref, props])
}
```

```tsx
useGridProps(ref, {
  columns,
  data: rows,
  groupBy: ['status'],
  pageable: true,
  pinnedTopRows: [totals],
})
```

Memoise the object (`useMemo`) or it re-assigns on every render.


## Calling the grid

```tsx
useEffect(() => {
  const el = ref.current as never as { api?: { exportCsv(): void } } | null
  el?.api?.exportCsv()
}, [])
```

`apiready` fires once at mount, and the handle is also parked on the element, so
reading `el.api` later works even if you never bound a listener.

## Style isolation

If the grid is going into a page whose CSS you do not control - a host app with
aggressive global resets, a CMS template - swap the tag for
[`<sv-grid-shadow>`](./shadow-dom.md). Same props, same events; page CSS stops
at the boundary.


## What you give up

Column `format` and HTML-string renderers: the substitute for a React component in a cell.

<div data-docs-demo="10-custom-cells-and-themes" data-height="480"></div>

You cannot render a React component inside a cell. Column `format` options,
`fieldFn` and HTML-string renderers cover badges, links and formatted values;
anything richer needs the Svelte component. See
[limitations](./limitations.md).

## Why it lives in `@svgrid/grid-wc`

Rather than a separate `@svgrid/react` package: one version to keep in step
with the element instead of two, and `react` is an OPTIONAL peer dependency, so
a plain-HTML consumer of `@svgrid/grid-wc` never installs React. The wrapper is
a subpath import and about 1.5 KB - it reuses the one element bundle rather
than shipping a second copy of the grid.

## See also

- [`<sv-grid>` reference](./sv-grid.md) - every property, attribute and event.
- [TypeScript](./typescript.md) - typing the element and its events.
- [Vue](./vue.md) and [Angular](./angular.md).
