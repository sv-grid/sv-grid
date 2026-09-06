# SvGrid in Angular

```bash
npm install @svgrid/grid-wc
```

```ts
import { Component } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'

@Component({
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <sv-grid
      [data]="rows"
      [columns]="columns"
      [sortable]="true"
      [filterable]="true"
      [editable]="true"
      (cellvaluechange)="save($event)"
      style="height:480px"
    ></sv-grid>
  `,
})
export class Screen {}
```

A standalone component, compiled with ng-packagr in partial-Ivy mode, generated
from `<SvGrid>`'s own types: every property is an `@Input` and every event an
`@Output`.

**The selector is the element's own tag.** The component has no template of its
own - its host element IS the `<sv-grid>` the browser upgrades - so there is no
extra wrapper element in your DOM, and the tag is the same one you would write
in plain HTML. Importing `SvGridComponent` is also what removes the need for
`CUSTOM_ELEMENTS_SCHEMA`: Angular now knows the tag.

For the style-isolated variant, write the other tag - `<sv-grid-shadow>` - which
the same component matches. `.api` on the component gives the grid api.

<!-- BEGIN generated examples - packages/grid-wc/scripts/sync-example-docs.mjs -->

## Examples

Nine complete apps. Each one is **running on this page** - sort it,
filter it, edit a cell - above the code that produces it. **Open in StackBlitz**
then boots the whole project, editable, with no local install and nothing to
configure, and every one is compiled in this repository's CI, so what you open
is what works.

They all share the same typed `data.ts`, so the only thing that changes
between recipes is the grid.

A note on the previews: the grid you can touch is driven by a Svelte host
rather than a Angular one. It is not a recording or a
lookalike - it renders through the same component `<sv-grid>` renders, with
the same data and the same props as the listing below it, so the only thing
that differs from the Angular app is who sets those props. Click **Open in
StackBlitz** to run the real Angular one.

### A first grid

Rows, columns, and the two features almost every table wants.

<div data-docs-mirror="basic" data-height="420"></div>

<div data-docs-sandbox="angular:basic" data-title="A first grid"></div>

```ts {nocheck}
import { Component } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px">
      <sv-grid [data]="people" [columns]="columns" [sortable]="true" [filterable]="true"></sv-grid>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
}
```

### Sorting and filtering

A filter row under the headers, multi-column sort, and the current sort read back into your own state.

<div data-docs-mirror="sorting-filtering" data-height="460"></div>

<div data-docs-sandbox="angular:sorting-filtering" data-title="Sorting and filtering"></div>

```ts {nocheck}
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

type Sort = { id: string; desc: boolean }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <p style="margin:0;font:13px system-ui;color:#64748b">Sorted by: {{ summary() }}</p>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          [showFilterRow]="true"
          (sortingchange)="sorting.set($any($event))"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly sorting = signal<Sort[]>([])

  summary(): string {
    const s = this.sorting()
    if (s.length === 0) return 'nothing yet - click a header, then shift-click a second one'
    return s.map((x) => `${x.id} ${x.desc ? 'desc' : 'asc'}`).join(', ')
  }
}
```

### Editing and saving

Inline editing, with each committed edit arriving through `cellvaluechange`. Swap the local update for your save call.

<div data-docs-mirror="editing" data-height="460"></div>

<div data-docs-sandbox="angular:editing" data-title="Editing and saving"></div>

```ts {nocheck}
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns, type Person } from '../data'

type CellEdit = { rowIndex: number; columnId: string; newValue: unknown }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <p style="margin:0;font:13px system-ui;color:#64748b">
        Double-click a Name or Amount cell. Last edits: {{ log().slice(-3).join(' · ') || 'none yet' }}
      </p>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="rows()"
          [columns]="editableColumns"
          [sortable]="true"
          [filterable]="true"
          [editable]="true"
          (cellvaluechange)="onEdit($any($event))"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly rows = signal<Person[]>([...people])
  readonly log = signal<string[]>([])
  readonly editableColumns = columns.map((c) =>
    c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c,
  )

  onEdit(e: CellEdit): void {
    this.rows.update((rows) =>
      rows.map((row, i) => (i === e.rowIndex ? ({ ...row, [e.columnId]: e.newValue } as Person) : row)),
    )
    this.log.update((l) => [...l, `${e.columnId} = ${String(e.newValue)}`])
  }
}
```

### Row selection

Checkboxes, with the selected rows handed straight to you - both the selection map and the rows themselves.

<div data-docs-mirror="selection" data-height="460"></div>

<div data-docs-sandbox="angular:selection" data-title="Row selection"></div>

```ts {nocheck}
import { Component, computed, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns, type Person } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <div style="font:13px system-ui;color:#64748b">{{ summary() }}</div>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          [showRowSelection]="true"
          (rowselectionchange)="selected.set($any($event).rows)"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly selected = signal<Person[]>([])
  readonly total = computed(() => this.selected().reduce((sum, r) => sum + r.amount, 0))

  summary(): string {
    const n = this.selected().length
    if (n === 0) return 'Tick some rows to total them'
    const money = this.total().toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
    return `${n} selected · ${money}`
  }
}
```

### Grouping and totals

Group by one or two columns with an aggregate in the group row. `groupBy` is an array, so it is one of the props that can only be a property.

<div data-docs-mirror="grouping" data-height="470"></div>

<div data-docs-sandbox="angular:grouping" data-title="Grouping and totals"></div>

```ts {nocheck}
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:8px;font:13px system-ui">
        @for (choice of choices; track choice.join('+')) {
          <button
            style="padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer"
            [style.background]="groupBy().join() === choice.join() ? '#e2e8f0' : '#fff'"
            (click)="groupBy.set(choice)"
          >
            {{ choice.join(' + ') || 'No grouping' }}
          </button>
        }
      </div>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="withTotals"
          [sortable]="true"
          [filterable]="true"
          [groupable]="true"
          [groupBy]="groupBy()"
          [groupFooters]="true"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly choices: string[][] = [['team'], ['country'], ['team', 'country'], []]
  readonly groupBy = signal<string[]>(['team'])
  readonly withTotals = columns.map((c) => (c.id === 'amount' ? { ...c, aggregate: 'sum' } : c))
}
```

### Pagination

Client-side paging. `pageSize` is the INITIAL page size, read once at mount.

<div data-docs-mirror="pagination" data-height="440"></div>

<div data-docs-sandbox="angular:pagination" data-title="Pagination"></div>

```ts {nocheck}
import { Component } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px">
      <sv-grid
        [data]="people"
        [columns]="columns"
        [sortable]="true"
        [filterable]="true"
        [pageable]="true"
        [pageSize]="25"
        [pageSizeOptions]="[10, 25, 50, 100]"
        paginationPosition="bottom"
      ></sv-grid>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
}
```

### Server-side data

The grid renders the page you hand it and tells you when the user wants another. `externalSort` and `externalPagination` stop it doing the work locally; `rowCount` is how it knows how many pages exist.

<div data-docs-mirror="server-data" data-height="440"></div>

<div data-docs-sandbox="angular:server-data" data-title="Server-side data"></div>

```ts {nocheck}
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns, type Person } from '../data'

const PAGE_SIZE = 25
type Sort = { id: string; desc: boolean }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px">
      <sv-grid
        [data]="rows()"
        [columns]="columns"
        [loading]="loading()"
        [sortable]="true"
        [externalSort]="true"
        [externalPagination]="true"
        [pageable]="true"
        [pageSize]="pageSize"
        [rowCount]="total()"
        [pageIndex]="page()"
        (sortingchange)="onSort($any($event))"
        (paginationchange)="onPage($any($event).pageIndex)"
      ></sv-grid>
    </div>
  `,
})
export class AppComponent {
  readonly columns = columns
  readonly pageSize = PAGE_SIZE
  readonly rows = signal<Person[]>([])
  readonly total = signal(0)
  readonly loading = signal(true)
  readonly page = signal(0)
  private sort: Sort[] = []

  constructor() {
    void this.load()
  }

  onSort(sort: Sort[]): void {
    this.sort = sort
    this.page.set(0)
    void this.load()
  }

  onPage(pageIndex: number): void {
    this.page.set(pageIndex)
    void this.load()
  }

  private async load(): Promise<void> {
    this.loading.set(true)
    const res = await this.fetchPage()
    this.rows.set(res.rows)
    this.total.set(res.total)
    this.loading.set(false)
  }

  /** Pretend this is a network call. */
  private fetchPage(): Promise<{ rows: Person[]; total: number }> {
    const sorted = [...people].sort((a, b) => {
      for (const s of this.sort) {
        const av = a[s.id as keyof Person]
        const bv = b[s.id as keyof Person]
        if (av === bv) continue
        return (av > bv ? 1 : -1) * (s.desc ? -1 : 1)
      }
      return 0
    })
    const start = this.page() * PAGE_SIZE
    return new Promise((resolve) =>
      setTimeout(
        () => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }),
        250,
      ),
    )
  }
}
```

### Theming

The `--sg-*` custom properties. Ordinary CSS custom properties, so they cascade from any ancestor - which is why they also reach inside `<sv-grid-shadow>`.

<div data-docs-mirror="theming" data-height="470"></div>

<div data-docs-sandbox="angular:theming" data-title="Theming"></div>

```ts {nocheck}
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

const THEMES: Record<string, Record<string, string>> = {
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
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div
      style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px"
      [style]="tokens()"
    >
      <div style="display:flex;gap:8px">
        @for (name of themeNames; track name) {
          <button
            style="padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer"
            [style.background]="theme() === name ? '#e2e8f0' : '#fff'"
            (click)="theme.set(name)"
          >
            {{ name }}
          </button>
        }
      </div>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          [zebraRows]="true"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly themeNames = Object.keys(THEMES)
  readonly theme = signal('Light')

  tokens(): Record<string, string> {
    return THEMES[this.theme()] ?? {}
  }
}
```

### Excel export (Enterprise)

The paid pack from a non-Svelte host. `@svgrid/enterprise/export` is plain JavaScript, so it needs no Svelte in your build - the same goes for `/import`, `/print`, `/pivot` and `/license`. See [Enterprise features](./enterprise.md) for what those subpaths cover and what needs a Svelte-aware bundler.

<div data-docs-mirror="enterprise" data-height="460"></div>

<div data-docs-sandbox="angular:enterprise" data-title="Excel export (Enterprise)"></div>

```ts {nocheck}
import { Component, ViewChild } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { exportGrid } from '@svgrid/enterprise/export'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <button type="button" [disabled]="!ready || busy" (click)="exportXlsx()">
        {{ busy ? 'Building…' : 'Export to Excel' }}
      </button>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          (apiready)="ready = true"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  ready = false
  busy = false

  @ViewChild(SvGridComponent) grid?: SvGridComponent

  async exportXlsx(): Promise<void> {
    const api = this.grid?.api
    if (!api) return
    this.busy = true
    try {
      await exportGrid(api as Parameters<typeof exportGrid>[0], {
        format: 'xlsx',
        filename: 'people',
      })
    } finally {
      this.busy = false
    }
  }
}
```

<!-- END generated examples -->

## Change detection

The element manages its own rendering, so Angular's change detection does not
need to see inside it. Replace arrays rather than mutating them -
`rows.update(...)`, not `rows().push(...)` - so the property assignment
actually changes and the grid sees new data.

Grouping through `[groupBy]` is the clearest case: replace the array.

<div data-docs-demo="07-grouping-aggregation" data-height="470"></div>

## Server-side rendering

A custom element only exists in the browser. Under Angular Universal, import
`@svgrid/grid-wc/angular` in a browser-only path, or guard on
`isPlatformBrowser`.

## Rendering into cells

You cannot put an Angular component inside a cell: cell rendering is a Svelte
compile-time feature. Column `format` options, `fieldFn` and HTML-string
renderers cover badges, links and formatted values - see
[limitations](./limitations.md).

## The raw element

Angular binds `[prop]` and `(event)` to custom elements natively, so
`<sv-grid>` works without the wrapper - but then it is an unknown element:
every component that shows one needs `CUSTOM_ELEMENTS_SCHEMA`, and no input
is typed. Importing `SvGridComponent` is what removes both, which is why the
selector is the element's own tag.

[Quick start](./quick-start.md) covers the element, and the
[reference](./sv-grid.md) lists every property, attribute and event.

## See also

- [All frameworks](./frameworks.md) - the same examples in React and Vue.
- [`<sv-grid>` reference](./sv-grid.md) - every property, attribute and event.
- [Limitations](./limitations.md) - what cannot cross the boundary.
