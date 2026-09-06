# SvGrid in Vue

```bash
npm install @svgrid/grid-wc
```

```vue
<script setup>
import { SvGrid } from '@svgrid/grid-wc/vue'
</script>

<template>
  <SvGrid
    :data="rows"
    :columns="columns"
    sortable
    filterable
    editable
    style="height: 480px"
    @cellvaluechange="save"
  />
</template>
```

The component is generated from `<SvGrid>`'s own types, and it removes the two
things a raw custom element needs in Vue: the `isCustomElement` build config,
and a `.prop` modifier on every object binding.

`shadow` picks the style-isolated element, and a template ref exposes
`api` and `element`.

<!-- BEGIN generated examples - packages/grid-wc/scripts/sync-example-docs.mjs -->

## Examples

Nine complete apps, each one click from running. **Open in StackBlitz**
boots a full editable project - no local install, nothing to configure - and
every one is compiled in this repository's CI, so what you open is what works.

They all share the same typed `data.ts`, so the only thing that changes
between recipes is the grid.

### A first grid

Rows, columns, and the two features almost every table wants.

<div data-docs-sandbox="vue:basic" data-title="A first grid"></div>

```vue {nocheck}
<script setup lang="ts">
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'
</script>

<template>
  <div style="height: 100%; padding: 16px">
    <SvGrid :data="people" :columns="columns" sortable filterable />
  </div>
</template>
```

### Sorting and filtering

A filter row under the headers, multi-column sort, and the current sort read back into your own state.

<div data-docs-sandbox="vue:sorting-filtering" data-title="Sorting and filtering"></div>

```vue {nocheck}
<script setup lang="ts">
import { ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'

const sorting = ref<Array<{ id: string; desc: boolean }>>([])
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <p style="margin: 0; font: 13px system-ui; color: #64748b">
      Sorted by:
      {{
        sorting.length === 0
          ? 'nothing yet - click a header, then shift-click a second one'
          : sorting.map((s) => `${s.id} ${s.desc ? 'desc' : 'asc'}`).join(', ')
      }}
    </p>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="people"
        :columns="columns"
        sortable
        filterable
        show-filter-row
        @sortingchange="sorting = $event"
      />
    </div>
  </div>
</template>
```

### Editing and saving

Inline editing, with each committed edit arriving through `cellvaluechange`. Swap the local update for your save call.

<div data-docs-sandbox="vue:editing" data-title="Editing and saving"></div>

```vue {nocheck}
<script setup lang="ts">
import { computed, ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns, type Person } from '../data'

const rows = ref<Person[]>([...people])
const log = ref<string[]>([])

const editable = computed(() =>
  columns.map((c) => (c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c)),
)

function onEdit(e: { rowIndex: number; columnId: string; newValue: unknown }) {
  const row = rows.value[e.rowIndex]
  if (row) rows.value[e.rowIndex] = { ...row, [e.columnId]: e.newValue } as Person
  log.value.push(`${e.columnId} = ${String(e.newValue)}`)
}
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <p style="margin: 0; font: 13px system-ui; color: #64748b">
      Double-click a Name or Amount cell. Last edits:
      {{ log.slice(-3).join(' · ') || 'none yet' }}
    </p>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="rows"
        :columns="editable"
        sortable
        filterable
        editable
        @cellvaluechange="onEdit"
      />
    </div>
  </div>
</template>
```

### Row selection

Checkboxes, with the selected rows handed straight to you - both the selection map and the rows themselves.

<div data-docs-sandbox="vue:selection" data-title="Row selection"></div>

```vue {nocheck}
<script setup lang="ts">
import { computed, ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns, type Person } from '../data'

const selected = ref<Person[]>([])
const total = computed(() => selected.value.reduce((sum, r) => sum + r.amount, 0))
const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <div style="font: 13px system-ui; color: #64748b">
      {{
        selected.length === 0
          ? 'Tick some rows to total them'
          : `${selected.length} selected · ${money(total)}`
      }}
    </div>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="people"
        :columns="columns"
        sortable
        filterable
        show-row-selection
        @rowselectionchange="selected = $event.rows as Person[]"
      />
    </div>
  </div>
</template>
```

### Grouping and totals

Group by one or two columns with an aggregate in the group row. `groupBy` is an array, so it is one of the props that can only be a property.

<div data-docs-sandbox="vue:grouping" data-title="Grouping and totals"></div>

```vue {nocheck}
<script setup lang="ts">
import { computed, ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'

const groupBy = ref<string[]>(['team'])
const choices: string[][] = [['team'], ['country'], ['team', 'country'], []]
const withTotals = computed(() =>
  columns.map((c) => (c.id === 'amount' ? { ...c, summary: 'sum' } : c)),
)
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 8px; font: 13px system-ui">
      <button
        v-for="choice in choices"
        :key="choice.join('+') || 'none'"
        style="padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer"
        :style="{ background: groupBy.join() === choice.join() ? '#e2e8f0' : '#fff' }"
        @click="groupBy = choice"
      >
        {{ choice.join(' + ') || 'No grouping' }}
      </button>
    </div>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="people"
        :columns="withTotals"
        sortable
        filterable
        groupable
        :group-by="groupBy"
        group-footers
      />
    </div>
  </div>
</template>
```

### Pagination

Client-side paging. `pageSize` is the INITIAL page size, read once at mount.

<div data-docs-sandbox="vue:pagination" data-title="Pagination"></div>

```vue {nocheck}
<script setup lang="ts">
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'
</script>

<template>
  <div style="height: 100%; padding: 16px">
    <SvGrid
      :data="people"
      :columns="columns"
      sortable
      filterable
      pageable
      :page-size="25"
      :page-size-options="[10, 25, 50, 100]"
      pagination-position="bottom"
    />
  </div>
</template>
```

### Server-side data

The grid renders the page you hand it and tells you when the user wants another. `externalSort` and `externalPagination` stop it doing the work locally; `rowCount` is how it knows how many pages exist.

<div data-docs-sandbox="vue:server-data" data-title="Server-side data"></div>

```vue {nocheck}
<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns, type Person } from '../data'

const PAGE_SIZE = 25

const page = ref(0)
const sort = ref<Array<{ id: string; desc: boolean }>>([])
const rows = ref<Person[]>([])
const total = ref(0)
const loading = ref(true)

function fetchPage(): Promise<{ rows: Person[]; total: number }> {
  // Pretend this is a network call.
  const sorted = [...people].sort((a, b) => {
    for (const s of sort.value) {
      const av = a[s.id as keyof Person]
      const bv = b[s.id as keyof Person]
      if (av === bv) continue
      return (av > bv ? 1 : -1) * (s.desc ? -1 : 1)
    }
    return 0
  })
  const start = page.value * PAGE_SIZE
  return new Promise((resolve) =>
    setTimeout(
      () => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }),
      250,
    ),
  )
}

watchEffect(async () => {
  loading.value = true
  const res = await fetchPage()
  rows.value = res.rows
  total.value = res.total
  loading.value = false
})
</script>

<template>
  <div style="height: 100%; padding: 16px">
    <SvGrid
      :data="rows"
      :columns="columns"
      :loading="loading"
      sortable
      external-sort
      external-pagination
      pageable
      :page-size="PAGE_SIZE"
      :row-count="total"
      :page-index="page"
      @sortingchange="((sort = $event), (page = 0))"
      @paginationchange="page = $event.pageIndex"
    />
  </div>
</template>
```

### Theming

The `--sg-*` custom properties. Ordinary CSS custom properties, so they cascade from any ancestor - which is why they also reach inside `<sv-grid-shadow>`.

<div data-docs-sandbox="vue:theming" data-title="Theming"></div>

```vue {nocheck}
<script setup lang="ts">
import { ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
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

const theme = ref('Light')
</script>

<template>
  <div
    style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px"
    :style="THEMES[theme]"
  >
    <div style="display: flex; gap: 8px">
      <button
        v-for="name in Object.keys(THEMES)"
        :key="name"
        style="padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer"
        :style="{ background: theme === name ? '#e2e8f0' : '#fff' }"
        @click="theme = name"
      >
        {{ name }}
      </button>
    </div>
    <div style="flex: 1; min-height: 0">
      <SvGrid :data="people" :columns="columns" sortable filterable zebra-rows />
    </div>
  </div>
</template>
```

### Excel export (Enterprise)

The paid pack from a non-Svelte host. `@svgrid/enterprise/export` is plain JavaScript, so it needs no Svelte in your build - the same goes for `/import`, `/print`, `/pivot` and `/license`. See [Enterprise features](./enterprise.md) for what those subpaths cover and what needs a Svelte-aware bundler.

<div data-docs-sandbox="vue:enterprise" data-title="Excel export (Enterprise)"></div>

```vue {nocheck}
<script setup lang="ts">
import { ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { exportGrid } from '@svgrid/enterprise/export'
import { people, columns } from '../data'

// The wrapper hands `api` over through `expose()`, which Vue does not thread
// into `InstanceType`, so the template ref is typed by shape instead.
const grid = ref<{ api: unknown } | null>(null)
const ready = ref(false)
const busy = ref(false)

async function exportXlsx() {
  const api = grid.value?.api
  if (!api) return
  busy.value = true
  try {
    await exportGrid(api as Parameters<typeof exportGrid>[0], {
      format: 'xlsx',
      filename: 'people',
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <button type="button" :disabled="!ready || busy" @click="exportXlsx">
      {{ busy ? 'Building…' : 'Export to Excel' }}
    </button>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        ref="grid"
        :data="people"
        :columns="columns"
        sortable
        filterable
        @apiready="ready = true"
      />
    </div>
  </div>
</template>
```

<!-- END generated examples -->

## Nuxt

Custom elements are client-only, and so is the wrapper that renders one. Import
it in a client plugin, or keep the grid inside `<ClientOnly>`:

```vue
<ClientOnly>
  <SvGrid :data="rows" :columns="columns" sortable filterable />
</ClientOnly>
```

<div data-docs-demo="02-sort-filter-paginate" data-height="460"></div>

## Rendering into cells

You cannot put a Vue component inside a cell: cell rendering is a Svelte
compile-time feature. Column `format` options, `fieldFn` and HTML-string
renderers cover badges, links and formatted values - see
[limitations](./limitations.md).

## The raw element

Vue binds properties to custom elements natively, so `<sv-grid>` works
directly too. The difference is what you take on: the `isCustomElement` build
config, and a `.prop` modifier on every object binding.

[Quick start](./quick-start.md) covers the element, and the
[reference](./sv-grid.md) lists every property, attribute and event.

## See also

- [All frameworks](./frameworks.md) - the same examples in React and Angular.
- [`<sv-grid>` reference](./sv-grid.md) - every property, attribute and event.
- [Limitations](./limitations.md) - what cannot cross the boundary.
