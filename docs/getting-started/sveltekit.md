# SvGrid with SvelteKit

A grid in a SvelteKit app is not the same job as a grid in a Vite SPA. The data
usually comes from a `+page.server.ts` load, the page has to server-render for
crawlers, sorting should survive a refresh and a shared link, and edits go back
through a form action. This page walks all four.

Everything here was run against a real SvelteKit app before it was written -
`sv create`, `sv add`, `svelte-check`, `vite build`, and the server HTML checked
over HTTP.

## Run it before you read it

Everything this page builds is also a template, so you can have it on your
machine in three commands:

```bash
npm create @svgrid@latest people -- --template sveltekit
cd people && npm install && npm run dev
```

That is the app from [the end-to-end section](#the-whole-thing-end-to-end)
below, plus a theme picker in the header - all 20 presets, light and dark,
switched live while the grid is running. Pick the starting theme up front if you
prefer:

```bash
npm create @svgrid@latest people -- --template sveltekit --theme dracula --dark
```

`--theme` writes the preset into `src/app.css`, so the first paint and the
server-rendered HTML are already themed rather than flashing a frame of the
default. Leave `--dark`/`--light` off and the app follows the visitor's OS
setting instead. `npm create @svgrid@latest -- --help` lists every preset id.

The rest of this page builds the same thing by hand, which is the better way to
understand it.

## 1. Scaffold

SvGrid ships an add-on for the [Svelte CLI](https://svelte.dev/docs/cli), so a
new app is two commands:

```bash
npx sv create myapp     # pick SvelteKit, TypeScript
cd myapp
npx sv add @svgrid
```

`sv add` resolves `@svgrid` to `@svgrid/sv`, adds `@svgrid/grid` to your
dependencies, and - if you say yes to the demo - writes a working grid to
`src/routes/svgrid-demo/+page.svelte`. To skip the prompts:

```bash
npx sv add "@svgrid=demo:yes+enterprise:no" --no-download-check
```

Two things worth knowing. `sv add` must run **inside** a project - in an empty
directory it fails with *"Invalid workspace"*, which is the CLI's own guard, not
the add-on. And community add-ons are still marked experimental upstream, so if
`sv` changes under you, `npm install @svgrid/grid` does the same job.

Adding to an existing app is just the install:

```bash
npm install @svgrid/grid
```

## 2. Load data on the server

Put the query in `+page.server.ts` and hand the rows to the page. Nothing about
SvGrid is special here - it takes a plain array.

```ts
// src/routes/people/+page.server.ts
import type { PageServerLoad } from './$types'
import { listPeople } from '$lib/db'

export const load: PageServerLoad = () => {
  return { rows: listPeople() }
}
```

```svelte
<!-- src/routes/people/+page.svelte -->
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Person } from '$lib/db'

  let { data } = $props()

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name' },
    { field: 'role', header: 'Role' },
    { field: 'year', header: 'Year' },
  ]
</script>

<SvGrid data={data.rows} {columns} sortable containerHeight={320} />
```

Type the column array against your row type. `GridColumns<Person>` checks every
`field` against real keys; a bare `GridColumns` widens the row to
`Record<string, unknown>` and stops checking them.

## 3. What actually server-renders

The server HTML contains the header and a **viewport-sized window of rows** with
their real cell values. That is what a crawler indexes and what a reader with JS
disabled sees.

It does *not* contain every row. Virtualization survives SSR, so a 5,000-row
grid does not serialise 5,000 rows into the page - the rest arrive when the
client measures the viewport and takes over. Hydration is clean because the
server and the first client render produce the same markup.

You can check it yourself on any page:

```bash
npm run build && npm run preview
curl -s http://localhost:4173/people | grep -c 'data-svgrid-row'
```

A non-zero count means rows are in the HTML.

> This genuinely did not work before `@svgrid/grid@2.6.8`. Both virtualizers
> learned their row count from an `$effect`, and effects never run during SSR,
> so the server emitted an empty `<tbody>`. If you are on an older version and
> SEO matters, upgrade.

## 4. Sorting that survives a refresh

The idiomatic SvelteKit move is to keep sort state in the URL. The link is then
shareable and bookmarkable, the back button works, and the sorted page is
server-rendered - so it works with JS disabled too.

Sort on the server from the query string:

```ts
// src/routes/people/+page.server.ts
export const load: PageServerLoad = ({ url }) => {
  const sortBy = (url.searchParams.get('sort') ?? 'name') as keyof Person
  const desc = url.searchParams.get('dir') === 'desc'
  return { rows: listPeople(sortBy, desc), sortBy, desc }
}
```

Then tell the grid the server owns the ordering, and push header clicks into the
URL:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  function onSortingChange(sorting: Array<{ id: string; desc: boolean }>) {
    const next = new URL(page.url)
    if (sorting.length === 0) {
      next.searchParams.delete('sort')
      next.searchParams.delete('dir')
    } else {
      next.searchParams.set('sort', sorting[0]!.id)
      next.searchParams.set('dir', sorting[0]!.desc ? 'desc' : 'asc')
    }
    goto(next, { keepFocus: true, noScroll: true })
  }
</script>

<SvGrid
  data={data.rows}
  {columns}
  sortable
  externalSort
  initialSorting={[{ id: data.sortBy, desc: data.desc }]}
  {onSortingChange}
/>
```

`externalSort` is the important prop: the grid keeps rendering sort indicators
and cycling on header click, but stops reordering rows itself - because the rows
arriving from `load` are already in the right order. Without it the grid sorts
the page a second time, which is wasted work and goes wrong the moment the
server is paginating.

`keepFocus` and `noScroll` stop the navigation stealing focus from the header
you just clicked or jumping the page to the top.

## 5. Saving an edit through a form action

Turn on editing, then push each committed change at an action:

```ts
// +page.server.ts
export const actions: Actions = {
  rename: async ({ request }) => {
    const form = await request.formData()
    renamePerson(Number(form.get('id')), String(form.get('name')))
    return { success: true }
  },
}
```

```svelte
<script lang="ts">
  async function onCellValueChange(e: { row: Person; columnId: string; newValue: unknown }) {
    if (e.columnId !== 'name') return
    const body = new FormData()
    body.set('id', String(e.row.id))
    body.set('name', String(e.newValue))
    await fetch('?/rename', { method: 'POST', body })
  }
</script>

<SvGrid data={data.rows} {columns} editable {onCellValueChange} />
```

The grid updates its own copy of the row immediately, so the cell shows the new
value while the request is in flight. Handle a rejected save by reloading
(`invalidateAll()`) or by writing the old value back.

SvelteKit's CSRF protection rejects a cross-origin POST to an action. Browsers
send the `Origin` header themselves so this is invisible in an app - but if you
script the endpoint from Node or curl, set `Origin` or you will get
`403 Cross-site POST form submissions are forbidden`.

## The whole thing, end to end

Four commands and three files. Every line below was run from a clean scaffold
before it was published here: `svelte-check` reports 0 errors, the page
server-renders its rows, clicking a header rewrites the URL, and an edit
survives a reload.

If you would rather run it than type it,
`npm create @svgrid@latest people -- --template sveltekit` gives you this app
with a theme picker already wired in. The files below are what it contains.

```bash
npx sv create people --template minimal --types ts
cd people
npx sv add "@svgrid=demo:no+enterprise:no" --no-download-check
npm install
```

**`src/lib/people.ts`** - stands in for your database.

```ts
export type Person = { id: number; name: string; role: string; year: number }

const people: Person[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Mathematician', year: 1843 },
  { id: 2, name: 'Grace Hopper', role: 'Rear Admiral', year: 1952 },
  { id: 3, name: 'Karen Sparck Jones', role: 'Computer Scientist', year: 1972 },
  { id: 4, name: 'Barbara Liskov', role: 'Computer Scientist', year: 1968 },
  { id: 5, name: 'Margaret Hamilton', role: 'Software Engineer', year: 1969 },
]

export function listPeople(sortBy: keyof Person = 'name', desc = false): Person[] {
  const rows = [...people]
  rows.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : a[sortBy] < b[sortBy] ? -1 : 0))
  return desc ? rows.reverse() : rows
}

export function renamePerson(id: number, name: string): void {
  const row = people.find((p) => p.id === id)
  if (row) row.name = name
}
```

**`src/routes/people/+page.server.ts`** - sorts from the query string, and takes
the edit.

```ts
import type { Actions, PageServerLoad } from './$types'
import { listPeople, renamePerson, type Person } from '$lib/people'

export const load: PageServerLoad = ({ url }) => {
  const sortBy = (url.searchParams.get('sort') ?? 'name') as keyof Person
  const desc = url.searchParams.get('dir') === 'desc'
  return { rows: listPeople(sortBy, desc), sortBy, desc }
}

export const actions: Actions = {
  rename: async ({ request }) => {
    const data = await request.formData()
    renamePerson(Number(data.get('id')), String(data.get('name')))
    return { success: true }
  },
}
```

**`src/routes/people/+page.svelte`**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Person } from '$lib/people'

  let { data } = $props()

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', editable: true },
    { field: 'role', header: 'Role' },
    { field: 'year', header: 'Year' },
  ]

  // Header click -> URL -> server sorts -> load returns ordered rows.
  function onSortingChange(sorting: Array<{ id: string; desc: boolean }>) {
    const next = new URL(page.url)
    if (sorting.length === 0) {
      next.searchParams.delete('sort')
      next.searchParams.delete('dir')
    } else {
      next.searchParams.set('sort', sorting[0]!.id)
      next.searchParams.set('dir', sorting[0]!.desc ? 'desc' : 'asc')
    }
    goto(next, { keepFocus: true, noScroll: true })
  }

  // Committed edit -> form action -> database.
  async function onCellValueChange(e: { row: Person; columnId: string; newValue: unknown }) {
    if (e.columnId !== 'name') return
    const body = new FormData()
    body.set('id', String(e.row.id))
    body.set('name', String(e.newValue))
    await fetch('?/rename', { method: 'POST', body })
  }
</script>

<h1>People</h1>
<p>Click a header to sort - the order lives in the URL. Double-click a name to edit it.</p>

<SvGrid
  data={data.rows}
  {columns}
  sortable
  editable
  externalSort
  initialSorting={[{ id: data.sortBy, desc: data.desc }]}
  {onSortingChange}
  {onCellValueChange}
  containerHeight={320}
/>
```

Then:

```bash
npm run dev    # http://localhost:5173/people
```

Three things to try, in this order:

1. **Click the `Year` header.** The URL becomes `?sort=year&dir=asc`. Copy that
   link into a new tab - it opens already sorted, because the server did it.
2. **Double-click a name, change it, press Enter, then reload.** The edit went
   through the form action and survived.
3. **View source, or `curl localhost:5173/people`.** The rows are in the HTML,
   not just injected by JS. That is what a crawler sees.

## 6. Going further

- **Server-side paging and filtering** for large tables: `externalFilter` and
  `externalPagination` are the equivalents of `externalSort` above. See
  [server paging](../help/server/server-paging.md),
  [server filtering](../help/server/server-filtering.md) and the
  [server row model](../help/server/server-row-model.md), which wraps the whole
  request shape rather than wiring each prop by hand.
- **Owning the markup.** If you need a table only you could write, the headless
  engine is importable on its own from `@svgrid/grid/core` and runs anywhere,
  including inside a load function. See [Why headless?](../why-headless.md).
- **Themes and dark mode.** Set the theme attribute before first paint from an
  inline script in `app.html`, or the page renders in the wrong palette for a
  frame. The `sveltekit` template above ships that script plus a runtime picker
  built on `resolveThemeTokens` from `@svgrid/grid/themes`, which is the short
  way to see the pattern. [Theme and density](./5-theme-and-density.md) covers
  it properly.
- **Gating it behind a login.** The `sveltekit` template ships an auth scaffold:
  a cookie session, PBKDF2 password hashing over Web Crypto (so it still runs on
  an edge adapter), and one `PROTECTED` list in `hooks.server.ts` that gates routes
  before any load runs. The role check sits in the form action, not only in the
  UI - hiding an edit button stops nobody from posting the action by hand.
- **Deployment.** SvGrid is a normal client dependency with no build step or
  server runtime of its own, so any SvelteKit adapter works unchanged.

## See also

- [Going to production](./6-going-to-production.md) - CSP, SSR, accessibility
- [First grid](./2-first-grid.md) - the framework-agnostic walkthrough
- [Why headless?](../why-headless.md) - when to skip the render component
