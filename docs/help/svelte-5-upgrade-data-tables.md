---
seoTitle: Svelte 4 to Svelte 5 Table Upgrade - What Breaks, Three Ways Out
seoDescription: A svelte-headless-table app taken from Svelte 4 to Svelte 5 step by step, every diagnostic captured verbatim. What the install says, what still compiles, what a rune changes, and the fork, TanStack and SvGrid exits.
keywords:
  - svelte 4 to svelte 5 table
  - svelte-headless-table svelte 5
  - svelte 5 upgrade data table
  - svelte 5 peer dependency conflict
  - svelte table migration
---

# Upgrading a Svelte 4 table to Svelte 5: what breaks, what does not, and the three ways out

If your Svelte 4 app has a table built on `svelte-headless-table`, the Svelte 5
upgrade forces a decision about it, and most of what is written about that
decision is guesswork. This page is not. We put the table from the library's
own documentation into a Svelte 4 project, upgraded it to Svelte 5 one step at a
time, and captured every line the tools printed. The script and the captures
are in the repo at
[tools/migration-lab](https://github.com/sv-grid/sv-grid/tree/main/tools/migration-lab);
every code block below is a quote from those files, checked by a test, and the
first line of each capture records the versions it was made with.

<!-- facts:start svelte-headless-table pkg:@humanspeak/svelte-headless-table -->
> **Facts, checked 12 Sep 2026.** `svelte-headless-table` 0.18.3, MIT, last published 28 Oct 2024, 90,100 npm downloads in the 30 days to 10 Sep 2026. `@humanspeak/svelte-headless-table` 6.2.0, MIT, last published 27 Aug 2026, 8,640 npm downloads in the same window. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 95.8 KB JS + 10.5 KB CSS (measured 20 Sep 2026); `svelte-headless-table` 0.18.3 5.7 KB JS, no separate stylesheet, svelte external (measured 12 Sep 2026). svelte-headless-table pricing, as its site states it: svelte-headless-table is MIT and free; no paid licence or support is offered, and the author states there are no plans for a Svelte 5 port (https://github.com/bryanmylee/svelte-headless-table, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs svelte-headless-table](https://svgrid.com/compare/svelte-headless-table/).
<!-- facts:end -->

The short version: the install warns and goes through, the untouched component
keeps compiling, and the trouble starts the day you write your first rune in
that component. The three exits are a maintained fork, TanStack Table v9, and
SvGrid, and they trade different things.

## The component we upgraded

A `PeopleTable` written the way svelte-headless-table's docs teach it: a
`writable` over a prop, a `$:` to keep it in sync, three plugins, the view model
read through `<Subscribe>` and `<Render>`, a pager on `pluginStates.page`, and a
`select` event dispatched from the row.

<!-- captured: fixture/svelte4/PeopleTable.svelte -->
```svelte
<script lang="ts">
  // The table as svelte-headless-table's own docs show it: a store for the
  // data, plugins for behaviour, and a view model read through <Subscribe>
  // and <Render>. Svelte 4 throughout: `export let`, `$:`, a dispatcher,
  // `on:click`, and `let:` slot props.
  import { createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'
  import { createTable, Subscribe, Render } from 'svelte-headless-table'
  import { addSortBy, addColumnFilters, addPagination } from 'svelte-headless-table/plugins'
  import type { Person } from './people'

  export let people: Person[] = []
  export let pageSize = 5

  const dispatch = createEventDispatcher<{ select: Person }>()

  const data = writable<Person[]>(people)
  $: data.set(people)

  const table = createTable(data, {
    sort: addSortBy(),
    filter: addColumnFilters(),
    page: addPagination({ initialPageSize: pageSize }),
  })
```

The full file is 83 lines; the 40 that follow are the `<table>`, three levels
of `<Subscribe let:...>` and a `<p>` with the pager. On the pinned Svelte 4
toolchain it checks clean:

<!-- captured: 01-svelte4-baseline.txt -->
```text
$ npx svelte-check --tsconfig ./tsconfig.json --output human --threshold warning
svelte-check found 0 errors and 0 warnings
```

## Step 1: the install warns and goes through

`svelte-headless-table` declares `peerDependencies: { svelte: "^4.0.0" }`, and
that range is not going to change: the facts box above has the last release
date, and the project's README says there are no plans for a Svelte 5 port.
So what does `npm install svelte@5` do against it? On npm 11, this:

<!-- captured: 02-npm-install-svelte5.txt -->
```text
$ npm install svelte@5.57.1

added 10 packages, removed 10 packages, and changed 2 packages in <time>
npm warn ERESOLVE overriding peer dependency
npm warn While resolving: svgrid-migration-lab@undefined
npm warn Found: svelte@4.2.20
npm warn node_modules/svelte
npm warn   peer svelte@"^4.0.0 || ^5.0.0-next.0" from svelte-check@4.7.6
npm warn   node_modules/svelte-check
npm warn     dev svelte-check@"4.7.6" from the root project
npm warn   5 more (svelte-headless-table, svelte-keyed, svelte-render, ...)
npm warn
npm warn Could not resolve dependency:
npm warn peer svelte@"^4.0.0" from svelte-headless-table@0.18.3
npm warn node_modules/svelte-headless-table
npm warn   dev svelte-headless-table@"0.18.3" from the root project
npm warn ERESOLVE overriding peer dependency
npm warn ERESOLVE overriding peer dependency
npm warn ERESOLVE overriding peer dependency

(exit 0)
```

Exit 0. npm 11 overrides the conflict and tells you so; older npm releases
stopped with an `ERESOLVE` error until you added `--legacy-peer-deps`, and
pnpm prints an unmet-peer warning of its own. Either way, the peer range is a
statement, not a lock: the library's author is telling you it was never run
against the Svelte you now have. Nothing enforces it.

## Step 2: the untouched component still compiles

Svelte 5 compiles Svelte 4 components in legacy mode, so `export let`, `$:`,
`createEventDispatcher`, `on:click` and `let:` slot props all keep working
until you opt a file into runes. With Svelte 5 installed and the component
exactly as it was:

<!-- captured: 03-svelte5-legacy-component.txt -->
```text
$ npx svelte-check --tsconfig ./tsconfig.json --output human --threshold warning
svelte-check found 0 errors and 0 warnings
```

This is the part the scare stories leave out. If your only goal is to be on
Svelte 5, you can install it, keep the table exactly as it is, and ship. The
library's own components (`<Subscribe>`, `<Render>`) compile in legacy mode
too.

## Step 3: the first rune

What you cannot do is make that component a runes component and keep the
table as it is. Port `PeopleTable` by the rules in the
[official migration guide](https://svelte.dev/docs/svelte/v5-migration-guide):
`export let` becomes `$props()`, `$:` becomes `$derived` and `$effect`, the
dispatcher becomes a callback prop, `on:click` becomes `onclick`. Leave the
svelte-headless-table wiring alone, because the guide has nothing to say about
it. The checker now says:

<!-- captured: 04-svelte5-runes-component.txt -->
```text
$ npx svelte-check --tsconfig ./tsconfig.json --output human --threshold warning
<lab>\src\PeopleTable.svelte:19:35
Warn: This reference only captures the initial value of `people`. Did you mean to reference it inside a closure instead?
https://svelte.dev/e/state_referenced_locally (svelte)

<lab>\src\PeopleTable.svelte:27:44
Warn: This reference only captures the initial value of `pageSize`. Did you mean to reference it inside a closure instead?
https://svelte.dev/e/state_referenced_locally (svelte)

====================================
svelte-check found 0 errors and 2 warnings in 1 file
```

Two warnings, no errors, and both are the same fact: the library takes a store,
your data is now a rune, and the `writable(people)` you built to bridge them
captured the first value of `people` and nothing after. The fix is an
`$effect` that writes the prop into the store on every change, which is what
the ported fixture does, and it works. It is also a bridge you now own, in
every component that has a table, between a reactivity model the library was
built for and the one your app is written in.

That is the actual shape of the problem. Not a red build: a component that
compiles, with a store-and-slot-props library bolted to a runes app by code you
maintain, on a package that will not move. The pieces it leans on are the ones
Svelte 5 has deprecated: `let:` slot props and `<slot>` in favour of snippets,
and `<svelte:component>`, which is what `<Render>` uses underneath
(`svelte-render` 2.0.1, `PropsRenderer.svelte`, peer `svelte ^4.0.0`). They
keep working in legacy mode today; deprecated syntax is what the next major
removes, and this library will not be updated when it does.

## The three ways out

You have three honest options, and you should know all of them before picking.

1. **`@humanspeak/svelte-headless-table`**, a maintained fork on Svelte 5 with
   the same API. Its version, publish date and downloads are in the facts box.
   Switching is one package rename; you keep every line of markup and every
   `<Subscribe>`, and you keep the store bridge from step 3. If your table
   works and Svelte 5 is all you need, this is the cheapest exit by a wide
   margin.
2. **TanStack Table v9.** Its Svelte adapter declares a Svelte 5 peer range and
   its state shape is runes-first, so the bridge goes away. It is still
   headless: you write and maintain the `<table>`, the virtualizer, the filter
   UI and the editors yourself. The
   [TanStack migration guide](./migrating-from-tanstack-table.md) covers the
   vocabulary.
3. **SvGrid.** A different trade: you delete the markup and take a renderer.
   The column definitions and the plugin list carry over; the `<table>`, the
   `<Subscribe>` blocks, the pager and the store bridge do not exist any more,
   because `<SvGrid>` renders all of that. The rest of this page is what that
   looks like on the fixture above.

Pick 1 if the markup is fine and the library being dead does not bother you.
Pick 2 if you want the markup and a maintained engine. Pick 3 if the markup is
the part you are tired of.

## Step 4: the codemod

`npx @svgrid/migrate` ports a svelte-headless-table component to SvGrid. It
previews by default and only writes with `--write`, and it says what it could
not map instead of dropping it. On the Svelte 4 original:

<!-- captured: 05-codemod.txt -->
```text
  warning A custom `cell` renderer was found. SvGrid renders cells with a snippet, not `createRender`, so this one needs porting by hand - it is preserved as a comment.
  warning The template still reads `pageIndex`, `pageCount`, `shown` from the view model, which is gone. <SvGrid> renders its own pager and row count (`pageable`, `showPagination`), so remove that markup, or read the grid through `onApiReady` if you need the numbers.
  warning The table markup dispatched `select` from a row; that handler went with the `<tr>`. Wire it to `onRowClick={({ row }) => ...}` (or `onCellClick`) on <SvGrid>, and turn the `createEventDispatcher` into a callback prop if the component is moving to runes.
  note    Column resizing, keyboard navigation and ARIA grid semantics are built into <SvGrid>; the markup that provided them is intentionally gone.

1 file(s) would change, with 3 warning(s).
Re-run with --write to apply.
```

Three warnings, each naming a thing it left for you. Write it, swap the
packages, and check:

<!-- captured: 06-after-codemod.txt -->
```text
$ npm install @svgrid/grid@3.0.4 --legacy-peer-deps

added 1 package in <time>

(exit 0)

$ npm uninstall svelte-headless-table --legacy-peer-deps

removed 4 packages in <time>

(exit 0)

$ npx svelte-check --tsconfig ./tsconfig.json --output human --threshold warning
<lab>\src\PeopleTable.svelte:31:23
Error: `$pageIndex` is an illegal variable name. To reference a global variable called `$pageIndex`, use `globalThis.$pageIndex`
https://svelte.dev/e/global_reference_invalid (svelte)
```

<!-- captured: 06-after-codemod.txt -->
```text
svelte-check found 9 errors and 0 warnings in 1 file
```

All nine are the pager `<p>` the second warning named, reading `shown`,
`$pageIndex` and `$pageCount` from a view model that no longer exists. The
codemod does not delete markup outside the `<table>`, because it cannot know
what else is in there; it tells you what will not compile. Delete the `<p>`
(the grid draws its own pager), turn the `select` event into a callback prop
on `onRowClick` as the third warning says, and:

<!-- captured: 07-hand-edits.txt -->
```text
$ npx svelte-check --tsconfig ./tsconfig.json --output human --threshold warning
svelte-check found 0 errors and 0 warnings
```

## What you end up with

The component after the codemod and the two hand edits:

<!-- captured: PeopleTable.after.svelte -->
```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Person } from './people'
  export let people: Person[] = []
  export let pageSize = 5
  export let onselect: (person: Person) => void = () => {}

  const columns: GridColumns<(typeof people)[number]> = [
    {
      header: 'Name',
      field: 'name',
    },
    {
      header: 'Department',
      field: 'department',
    },
    {
      header: 'City',
      field: 'city',
    },
    {
      header: 'Salary',
      field: 'salary',
      // TODO port: cell: ({ value }) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD
    },
  ]
</script>

<SvGrid data={people} {columns} sortable filterable showColumnFilters pageable pageSize={pageSize}
  onRowClick={({ row }) => onselect(row)} />
```

83 lines became 31. The `TODO port:` comment is the one thing left to do by
hand: the currency cell becomes `format: { type: 'currency', currency: 'USD' }`
on the column, and the comment goes. There is no store, no `$:`, no
`<Subscribe>`, no `let:`, and nothing in the file that Svelte 5 has deprecated,
so the same component moves to runes whenever you like with the official
migration script and nothing else to port.

## What to read next

- [Migrating from svelte-headless-table](./migrating-from-svelte-headless-table.md) -
  the plugin-by-plugin mapping and what the codemod will not do
- [SvGrid vs svelte-headless-table](https://svgrid.com/compare/svelte-headless-table/) -
  the side-by-side, with a source and date for every claim
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md) - exit 2 in detail
- [Migrating from the shadcn-svelte data table](./migrating-from-shadcn-data-table.md) -
  the same codemod on the TanStack-based recipe
- [Why headless?](../why-headless.md) - if you want to keep your own markup
  on a maintained Svelte 5 engine, `@svgrid/grid/core` is that too

## Frequently asked questions

### Does svelte-headless-table work with Svelte 5?

In legacy mode, yes: the install prints a peer-dependency warning and the
untouched component type-checks clean, as the captures above show. What does
not work is moving a component that uses it to runes without maintaining a
store bridge yourself, and the library is not going to be updated for the
deprecations that bridge leans on.

### Is the peer dependency conflict an error?

On npm 11 it is a warning and the install exits 0; on older npm it was an
`ERESOLVE` error until you passed `--legacy-peer-deps`; pnpm warns. It never
stops the code from running. It tells you the library was not built against
the Svelte you have.

### Should I just use the maintained fork?

If your table works and all you need is Svelte 5, yes, and this page says so.
The fork keeps the same API, so you keep the same markup and the same store
bridge. Move to SvGrid when the markup and the bridge are what you want gone.

### How much of the port does the codemod do?

The column definitions, the plugin list and the `<table>` replacement, and it
names what it leaves: custom cell renderers, markup outside the table that read
the view model, and events the rows dispatched. On the fixture that was two
hand edits and one `format` option.

### Can I rerun this myself?

`node tools/migration-lab/run.mjs` in the repo. It installs the pinned Svelte 4
toolchain into its own folder, upgrades it, runs the codemod from the checkout,
and rewrites the captured files; the header of each one records the versions.
Bump the pins to try a newer Svelte.
