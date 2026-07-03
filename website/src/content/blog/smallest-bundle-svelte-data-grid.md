---
title: Bundle Size of Svelte Data Grids - How to Compare
description: README bundle numbers are nearly useless. Here is how to measure the real delta a data grid adds to your Svelte app, and why feature-gated architectures change the math entirely.
date: 2026-09-05
updated: "2026-07-02"
category: Comparisons
tags: bundle size, performance, comparison, svelte data grid
author: Boyko Markov
---

The README says "12 KB gzipped." You add the grid, rebuild, and the bundle grows by 80 KB. Both numbers are technically true. The 12 KB is the library core measured in isolation, stripped of dependencies and measured before your bundler figures out what it actually needs. The 80 KB is what your app now ships to users. The delta method - build once without, build once with, subtract - is the only measurement worth trusting.

## Why headline numbers lie

Most published bundle sizes are measured with a tool like Bundlephobia, which resolves the package in isolation without a host app. Your Vite build is different in three ways that matter.

First, if the library ships a barrel file with side effects, tree-shaking fails silently. You import `{ rowSortingFeature }` but get the full feature registry anyway because the barrel ran module-level registration code.

Second, dependencies compound. A grid depending on `date-fns`, `floating-ui`, and an icon set pulls those in too. Bundlephobia might show the peer deps separately or not at all.

Third, the parse cost is hidden. A library advertised as "18 KB gzipped" decompresses to somewhere between 55 and 90 KB of JavaScript the browser still has to parse and JIT-compile. On a mid-range Android device, every 50 KB of script costs roughly 150-300 ms of CPU time before the first frame is painted.

The fix is a repeatable delta script you can run against every candidate.

## Measuring the actual cost

The cleanest approach is two builds from the same entry point: one where the grid is imported and one where it is not. Here is a Node script that does exactly that:

```ts
// scripts/measure-grid-delta.ts
// Run with: npx tsx scripts/measure-grid-delta.ts
import { execSync } from 'node:child_process'
import { statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function jsBytesInDir(dir: string): number {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .reduce((sum, f) => sum + statSync(join(dir, f)).size, 0)
}

// Build 1: baseline (comment out grid import in your entry first)
execSync('VITE_GRID=0 vite build --outDir dist-baseline', { stdio: 'inherit' })
const baseline = jsBytesInDir('dist-baseline')

// Build 2: with grid
execSync('VITE_GRID=1 vite build --outDir dist-grid', { stdio: 'inherit' })
const withGrid = jsBytesInDir('dist-grid')

const deltaKb = ((withGrid - baseline) / 1024).toFixed(1)
const gzipEstKb = (Number(deltaKb) / 3.5).toFixed(1)

console.log(`Uncompressed delta : ${deltaKb} KB`)
console.log(`Gzip estimate      : ${gzipEstKb} KB`)
console.log(`Parse budget note  : ~${(Number(deltaKb) * 3).toFixed(0)} ms on mid-range Android`)
```

Gate your grid import in the entry with `import.meta.env.VITE_GRID !== '0'` and the script becomes reusable against any candidate. Run it on the same machine, same Vite version, same feature set each time.

The parse budget line is the number that changes decision-making. A grid that looks small by transfer might still be expensive if it ships compiled class hierarchies, many closures, and runtime registration logic the bundler cannot eliminate.

## How SvGrid structures features to keep the math honest

SvGrid passes features explicitly to `tableFeatures([...])`. Each feature is a plain object - no module-level side effects, no global registry. Vite sees two imported identifiers when you pass `[rowSortingFeature, columnFilteringFeature]` and drops everything else during tree-shaking.

A real read-only employee directory that only needs sort and filter looks like this:

```svelte
<!-- EmployeeGrid.svelte -->
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Employee = {
    id: string
    name: string
    department: string
    location: string
    startDate: string
    salary: number
  }

  let { data }: { data: Employee[] } = $props()
  let api: SvGridApi | undefined = $state()

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  const columns: ColumnDef<typeof features, Employee>[] = [
    { id: 'name',       field: 'name',       header: 'Name',       width: 220, pinned: 'left' },
    { id: 'department', field: 'department', header: 'Department', width: 160 },
    { id: 'location',   field: 'location',   header: 'Location',   width: 150 },
    { id: 'startDate',  field: 'startDate',  header: 'Start Date', width: 130 },
    {
      id: 'salary',
      field: 'salary',
      header: 'Salary',
      width: 120,
      type: 'number',
    },
  ]
</script>

<SvGrid
  {data}
  {columns}
  {features}
  sortable
  filterable
  showFilterRow={true}
  rowHeight={36}
  virtualization={true}
  onApiReady={(a) => { api = a }}
/>
```

Grouping, pagination, row selection, row expansion - none of those exist in this bundle because none of those identifiers were imported. That is not a marketing claim, it is how ES modules and static analysis work. You can verify it yourself: after `vite build`, open `dist/assets/*.js` and search for `columnGroupingFeature`. If the string is absent, tree-shaking worked.

## Incremental cost when you add features

The first feature you import also pulls in the SvGrid renderer and virtual scroll core - roughly 16 KB gzipped combined. After that, each additional feature adds 1.5 to 3 KB gzipped. The table below shows approximate deltas from the delta script for common feature combinations:

| Feature set | Gzip est. |
|---|---|
| Sort + filter (above) | ~22 KB |
| + row selection | ~25 KB |
| + pagination | ~27 KB |
| + grouping | ~31 KB |
| + server-side data source | ~34 KB |

Those numbers assume no other shared dependencies between your app and the grid. If your app already imports a `$state`-heavy Svelte component library, the Svelte runtime is already loaded and the grid's Svelte footprint shrinks further.

Enterprise features - Excel export, pivot model, chart rendering - live in `@svgrid/enterprise` and are never part of the community bundle. Within that package, heavy dependencies like file generation are loaded lazily at the call site, not at import time:

```ts
// Export only loaded when user clicks export - not at grid mount
import { createPivotModel } from '@svgrid/enterprise'

// The chart builder is also lazy-compatible:
import { SvGridChart, buildSparkline } from '@svgrid/grid'

// In a column def, a sparkline does not load canvas rendering
// until that column is actually rendered:
const sparklineColumn: ColumnDef<typeof features, MyRow> = {
  id: 'trend',
  header: 'Trend',
  width: 100,
  cell: buildSparkline({ field: 'values', color: 'var(--sg-accent)' }),
}
```

This matters when you are building a dashboard where some users never open the export panel. You pay for what you use at runtime, not what you import at build time.

## What to watch for in competing libraries

Three things that break the "small bundle" claim in practice:

**Side-effectful barrels.** Open `node_modules/the-grid/dist/index.js` and look at the first 50 lines. If you see `registerFeature(...)` or `GridRegistry.add(...)` calls at the module level, the bundler cannot remove those branches. Every feature registered there is in your bundle regardless of your imports.

**Missing `sideEffects: false`.** Without this field in `package.json`, bundlers assume every file has side effects and skip tree-shaking entire modules. Check with `cat node_modules/the-grid/package.json | grep sideEffects`. If the field is absent or set to `true`, you are carrying the whole library.

**Dependencies you did not ask for.** Install the grid, then run `npx vite-bundle-visualizer` (or add `rollup-plugin-visualizer` to your `vite.config.ts`). If you see `luxon`, `date-fns`, `lodash`, or any icon set showing up in the treemap for a grid that claims to have no dependencies, those are embedded in the dist files.

SvGrid's MIT core has no mandatory peer dependencies beyond Svelte 5. The `package.json` ships with `"sideEffects": false`. Both are verifiable before you commit to the library.

## The comparison that actually matters

Bundle size is one axis. You also need to weigh what you give up to stay small. A grid at 8 KB gzipped with no virtualization forces you to implement row windowing yourself - call it 4-6 KB of custom code plus ongoing maintenance cost whenever Svelte updates. A grid at 22 KB with a solid virtual scroller you never have to write or debug is almost certainly the cheaper option over two years of product development.

Pick the smallest bundle that covers your feature set without making you write the missing pieces yourself. Then measure the delta, not the marketing number.
