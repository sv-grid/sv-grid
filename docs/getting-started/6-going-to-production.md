# 6. Going to production

> Step 6 of 6 · [← Theme and density](./5-theme-and-density.md)

You have a working grid. This page is the checklist that turns it into
something you'd ship.

## 1. Server-side data

For datasets that don't fit in memory, drive the grid from the server.
Pair `externalSort` + `externalFilter` with the corresponding callbacks
so the grid records the user's intent but doesn't try to re-order rows
it didn't fetch.

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte {runnable}
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature,
           columnFilteringFeature } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let sort    = $state<Array<{ id: string; desc: boolean }>>([])
  let filters = $state<Array<{ id: string; operator: string; value: string }>>([])
  let page    = $state(0)
  const pageSize = 50

  let rows    = $state<Person[]>([])
  let total   = $state(0)
  let loading = $state(false)
  let controller: AbortController | null = null

  async function load() {
    controller?.abort()
    controller = new AbortController()
    loading = true
    try {
      const res = await fetch('/api/people?' + new URLSearchParams({
        sort:    JSON.stringify(sort),
        filters: JSON.stringify(filters),
        page:    String(page),
        size:    String(pageSize),
      }), { signal: controller.signal })
      const body = await res.json()
      rows  = body.rows
      total = body.total
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err
    } finally {
      loading = false
    }
  }

  $effect(() => { sort; filters; page; load() })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  externalSort={true}
  externalFilter={true}
  showPagination={false}
  onSortingChange={(next) => { sort = next; page = 0 }}
  onFiltersChange={(next) => { filters = next.columns; page = 0 }}
/>
```

The [`09-server-side` demo](../../examples/src/demos/09-server-side.svelte)
has the full runnable version with debounce + abort + a 60 ms mock
latency. The [server-side guide](../help/server-side-data.md) covers
sparse infinite scroll, velocity-aware chunk loading, and
backpressure.

<div data-docs-demo="09-server-side" data-height="520"></div>

## 2. Virtualization for large datasets

For more than ~2k rows, enable row virtualization. For very wide grids
(50+ columns) also enable column virtualization. Both are opt-in so
small grids don't pay the cost.

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  virtualization={true}
  columnVirtualization={true}
  overscan={8}
  columnOverscan={3}
  rowHeight={32}
  containerHeight={600}
/>
```

The wrapper's row + column virtualizers handle variable row heights via
the headless `createSvelteVirtualizer` / `createColumnVirtualizer`. See
[demo 06](../../examples/src/demos/06-large-dataset.svelte) for 100k
rows × 100 columns with smooth scroll.

<div data-docs-demo="06-large-dataset" data-height="520"></div>

## 3. Accessibility

The grid implements the WAI-ARIA 1.2 grid pattern out of the box. Every
node has the right role, the active cell carries focus, the keyboard
map matches what assistive tech expects.

You don't need to add anything for a baseline accessible grid. To go
further:

- Add `aria-live` announcements for changes outside the grid (filter
  applied, X rows selected) - see [demo 17](../../examples/src/demos/17-accessibility.svelte).
- Toggle a high-contrast focus outline for users who need it -
  also in demo 17.
- Read [Accessibility](../help/accessibility.md) for the WCAG 2.1 AA
  mapping, forced-colors-mode behaviour, and reduced-motion handling.

<div data-docs-demo="17-accessibility" data-height="500"></div>

## 4. SSR-friendly markup

The render component produces meaningful HTML before hydration. In a
SvelteKit `+page.server.ts` load, the grid's markup hits the browser
already filled with data - first paint shows the table, hydration only
attaches event listeners.

```svelte {runnable}
<!-- +page.svelte -->
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature } from '@svgrid/grid'
  let { data } = $props()
</script>

<SvGrid
  data={data.rows}
  columns={columns}
  features={tableFeatures({ rowSortingFeature })}
/>
```

What is and is not in the server HTML:

- **In it:** the header, and a viewport-sized window of rows with their real
  cell values. Enough for a crawler to index the content and for a no-JS client
  to read the table.
- **Not in it:** rows below that first window. Virtualization survives SSR, so a
  5,000-row grid does not serialise 5,000 rows into the page; the rest arrive
  when the client measures the viewport and takes over.

`pnpm ssr:check` asserts this against a real `generate: 'server'` build and runs
in CI. It exists because the grid silently stopped server-rendering rows for a
while: both virtualizers learn their row and column count from an `$effect`, and
effects never run during SSR, so the server emitted an empty `<tbody>` while
this page claimed otherwise.

[Demo 19 - SSR](../../examples/src/demos/19-ssr.svelte) illustrates the *shape*
of the pre-hydration markup by snapshotting the rendered grid into a
script-blocked iframe. Note it snapshots the client-rendered DOM, so it shows
what the markup looks like without JS - it does not measure the server output.
`pnpm ssr:check` is what actually verifies that.

## 5. Content Security Policy

SvGrid runs cleanly under a strict CSP - no `eval`, no `new Function`,
no inline scripts, no inline event handlers. The recommended header:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

Note: no `'unsafe-eval'` and no `'unsafe-inline'` on `script-src`.
[Demo 16 - CSP-compliant](../../examples/src/demos/16-csp-compliant.svelte)
runs a live runtime self-check + a violation listener inside a working
grid.

## 6. TypeScript notes

```ts
import type {
  ColumnDef,
  SvGridApi,
  SortingState,
  TableFeatures,
} from '@svgrid/grid'

// 1. Constrain ColumnDef to your row type so editors and accessors stay typed.
type Row = { id: string; firstName: string; age: number }
const columns: GridColumns<Row> = [
  { field: 'firstName', header: 'First' },   // OK
  { field: 'middleName', header: 'Mid' },    // ✗ "middleName" not on Row
]

// 2. The api type matches your features + row type.
let api = $state<SvGridApi<typeof features, Row> | null>(null)
```

The features generic on `ColumnDef` is the type of the `features`
object - `tableFeatures({ rowSortingFeature })` produces a different
type than `tableFeatures({})`. Pass `typeof features` so column-level
inference picks up which capabilities your grid has.

## 7. What's next

- [Why headless?](../why-headless.md) - the layered architecture and
  when to drop down to the headless core.
- [Enterprise features](../enterprise/README.md) - export, import, AI, pivot.
- [Help index](../help/index.md) - the topic-page catalogue.
- [Recipes](../help/recipes.md) - 20+ copy-paste patterns.
- [How SvGrid compares](../help/comparison.md) - what
  evaluators read.
- [Missing features](../help/missing-features.md) - the honest gap list.

<!-- tutorial:learn-10-production -->
<figure class="docs-tutorial" id="tutorial-learn-10-production" data-docs-tutorial="learn-10-production">
<video class="docs-tutorial-video" src="/tutorials/learn-10-production.mp4" poster="/tutorials/learn-10-production.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Learn SvGrid 10: going to production, 108 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/learn-10-production.vtt" default>Your browser does not play embedded video. <a href="/tutorials/learn-10-production.mp4">Download the MP4</a>.</video>
<figcaption><strong>Learn SvGrid 10: going to production</strong> (108 s, silent). <a href="https://www.youtube.com/watch?v=VfZuJIwldwY" rel="noopener">Watch with narration on YouTube</a></figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>Your grid works. This last lesson is the review a colleague would give it: the four things that decide whether it survives contact with real data and real users.</p>
<p>First, scale. Virtualization is on by default, so only the rows in view have DOM nodes. Fifty thousand rows by seventy-seven columns scroll in both directions, and the count of nodes stays roughly the same as it was with ten rows.</p>
<p>What you do have to give it is a height. A grid inside a container with no height cannot know what is on screen, and that is the single most common reason a large table feels slow.</p>
<p>Second, accessibility, which you mostly already have. It is a real table element carrying the ARIA grid pattern, so a screen reader announces rows and columns, and every cell is reachable from the keyboard.</p>
<p>What is on you is the rest of the page: a label on the grid, contrast that passes, and not removing the focus ring. There is a high-contrast preset in the box if procurement asks.</p>
<p>Third, the markup server-renders, so a viewport of real rows reaches the browser before hydration. And fourth, the habit that costs nothing: type the column array as GridColumns of your row. A bare GridColumns widens the row and stops checking field names, and a typo becomes a blank column nobody notices until a user does.</p>
<p>That is the course. You can build a grid, shape its columns, sort and filter it, edit it, group it, theme it, feed it from a server and ship it. Everything past this point is a feature you turn on when you need it, and the demos on the site show each one running.</p>
</details>
</figure>
<!-- /tutorial:learn-10-production -->

<!-- tutorial:learn-8-server-data -->
<figure class="docs-tutorial" id="tutorial-learn-8-server-data" data-docs-tutorial="learn-8-server-data">
<video class="docs-tutorial-video" src="/tutorials/learn-8-server-data.mp4" poster="/tutorials/learn-8-server-data.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Learn SvGrid 8: data from a server, 106 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/learn-8-server-data.vtt" default>Your browser does not play embedded video. <a href="/tutorials/learn-8-server-data.mp4">Download the MP4</a>.</video>
<figcaption><strong>Learn SvGrid 8: data from a server</strong> (106 s, silent). <a href="https://www.youtube.com/watch?v=JPkoLN20sPQ" rel="noopener">Watch with narration on YouTube</a></figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>Everything so far held every row in memory. That works to tens of thousands of rows. Past that, the sorting and filtering have to move to the server, and the grid has to ask for what it needs.</p>
<p>The state the grid hands you is small: which column is sorted, which filters are set, which page you are on. Keep those in runes.</p>
<p>Then one function that turns that state into a request. Notice the abort controller: when the user types another letter, the request already in flight is cancelled, so a slow earlier response cannot overwrite a newer one. That race is the most common bug in a server-backed table.</p>
<p>An effect reruns it whenever sort, filters or page change, and the component passes the rows down with the total, so the pager knows how many pages there are without counting rows it never received.</p>
<p>Here is that pattern running against a real endpoint. Sorting goes to the server and comes back sorted; typing in the search box is debounced, so one request goes out rather than one per keystroke.</p>
<p>The loading state lives on the rows rather than as a spinner over the page, so the header and the controls stay usable while the next page arrives.</p>
<p>Past a million rows there is a dedicated row model that lazily loads groups and blocks; it is linked from the page below. Lesson nine puts all of this in a SvelteKit app.</p>
</details>
</figure>
<!-- /tutorial:learn-8-server-data -->
