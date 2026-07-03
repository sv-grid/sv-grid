---
title: Smart UI Wins Gold in the 2025 Visual Studio Magazine Readers' Choice Awards
description: Smart UI, the web-components suite from the team behind SvGrid, earned Gold in the 2025 Visual Studio Magazine Readers' Choice Awards. Here is what that vote actually tells you about the codebase you are running.
date: 2026-05-28
updated: 2026-07-02
category: Company
tags: company, award, smart ui, htmlelements, recognition
author: Boyko Markov
---

The 2025 Visual Studio Magazine Readers' Choice Awards voted Smart UI Gold Winner in the software development service providers category. This is not a jury of analysts or a vendor-sponsored ranking. It is a direct vote from working engineers - people with sprint deadlines, production incidents, and real preferences about what does not break.

Smart UI is the web-components suite that shares an engineering team and a core grid engine with SvGrid. That connection matters beyond brand pride.

## What the award actually signals

Awards mean different things depending on who votes. Readers' Choice is a peer vote from Visual Studio Magazine subscribers - developers who use .NET, C#, TypeScript, React, Angular, Blazor, and increasingly Svelte in production. They are not voting on a demo. They are voting on what held up over the year: consistent releases, predictable API changes, documentation that matched actual behavior, support tickets that got answered.

The 26.0.0 release cycle was cited specifically. That cycle added four Pro Themes (Material 3, Fluent, Strata, Tabula), tightened tree-shaking boundaries at the feature level, and shipped AI-assisted API documentation. More importantly, it did all of that without breaking the contract for existing users. No silent renames. No option removals without a deprecation cycle. That kind of boring reliability is what gets engineers to fill out an award ballot.

SvGrid and Smart UI share the same grid engine. Stability improvements shipped to Smart UI land in `@svgrid/grid`. When the tree-shaking boundaries tightened in 26.0.0, that work is reflected in the feature composition model you use right now in your Svelte projects.

## The feature composition model that earned the trust

The thing that took the longest to get right was not the render layer - it was the feature composition model. `tableFeatures` is a type-level combinator: each feature you pass contributes its own state shape, and TypeScript intersects them into a single inferred type that flows through to `ColumnDef`, `SvGridApi`, and every callback in the system. Features you do not pass are absent from the bundle, not lazy-loaded.

Here is a realistic feature bundle for a CRM pipeline view - sorting, filtering, pagination, and row selection wired together:

```ts
// features.ts - define once, import across all CRM views
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  rowPaginationFeature,
} from '@svgrid/grid'

export type Deal = {
  id: string
  company: string
  owner: string
  arr: number
  stage: 'Lead' | 'Qualified' | 'Proposal' | 'Closed Won' | 'Closed Lost'
  closeDate: string
}

// Removing rowPaginationFeature here drops the entire pagination
// code path from the emitted bundle - roughly 8 kB gzipped.
export const crmFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  rowPaginationFeature,
})
```

Define `crmFeatures` at module scope, not inside a component. If it lives inside `<script>`, Svelte 5 re-evaluates it on every hot-module reload and resets internal feature state mid-session. One module, one definition, imported wherever you need it.

## Putting it to work

The component below renders 200 CRM deals, pins the company column, auto-sizes all columns on first mount, and exports selected rows as XLSX via the enterprise package. The `onApiReady` callback is the correct place to run setup calls - the `api` reference is null until that fires.

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import SvGrid, {
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { crmFeatures, type Deal } from './features'

  const STAGES: Deal['stage'][] = [
    'Lead', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost',
  ]
  const OWNERS = ['Sasha Park', 'Jamie Chen', 'Robin Diaz', 'Casey Singh', 'Drew Olsen']

  const rows: Deal[] = Array.from({ length: 200 }, (_, i) => ({
    id: `deal-${i + 1}`,
    company: `Acme ${String.fromCharCode(65 + (i % 26))}${i + 1}`,
    owner: OWNERS[i % OWNERS.length],
    arr: Math.round(10_000 + Math.random() * 990_000),
    stage: STAGES[i % STAGES.length],
    closeDate: new Date(2025, i % 12, (i % 28) + 1).toISOString().slice(0, 10),
  }))

  const columns: ColumnDef<typeof crmFeatures, Deal>[] = [
    { id: 'company',   field: 'company',   header: 'Company',    width: 200, pinned: 'left' },
    { id: 'owner',     field: 'owner',     header: 'Owner',      width: 140 },
    {
      id: 'arr',
      field: 'arr',
      header: 'ARR ($)',
      width: 120,
      type: 'number',
      cell: ({ value }) => `$${(value as number).toLocaleString()}`,
    },
    { id: 'stage',     field: 'stage',     header: 'Stage',      width: 140 },
    { id: 'closeDate', field: 'closeDate', header: 'Close Date', width: 120 },
  ]

  let api = $state<SvGridApi | null>(null)

  function onReady(gridApi: SvGridApi) {
    api = gridApi
    api.autosizeAllColumns()
  }

  async function exportSelected() {
    if (!api) return
    const selected = api.getSelectedRows()
    if (selected.length === 0) return
    // exportData is available via @svgrid/enterprise when installed
    await (api as any).exportData({ format: 'xlsx', filename: 'crm-deals' })
  }
</script>

<div class="toolbar">
  <span>{rows.length} deals loaded</span>
  <button onclick={exportSelected}>Export selected rows</button>
</div>

<SvGrid
  data={rows}
  {columns}
  sortable
  filterable
  pageable
  enableCellSelection={true}
  onApiReady={onReady}
/>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0;
  }
</style>
```

`getSelectedRows()` returns all selected rows across all pages, not just the visible page. That is the correct behavior for an export action but can surprise you if you are trying to count only visible selections. For that case, cross-reference `api.getDisplayedRows()` with the selected row ids yourself.

## The reliability bet

Choosing a UI component library is an infrastructure decision with a five-year horizon. You are betting on the release cadence, the breaking-change policy, and the support channel. The Readers' Choice vote is one concrete signal from peers who made that bet and felt good enough about it to say so publicly.

Smart UI has been shipping production components since 2011. That history is what gives SvGrid a stable core to build on - not because old age implies quality, but because 15 years of enterprise deployments surfaces edge cases that no spec document predicts: column virtualization under dynamic row heights, filter state that survives page navigation, export formatting that respects the user's locale. The bugs that would embarrass a younger library have mostly already been found and fixed upstream.

The award does not change anything about how `@svgrid/grid` works. But if you are evaluating whether this is a team that will still be shipping fixes in two years - this is the kind of signal that should count.
