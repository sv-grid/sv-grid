---
title: Build Svelte Grids Faster with AI and the SvGrid MCP Server
description: The @svgrid/mcp server grounds Claude, Cursor, and other AI assistants in real SvGrid API docs so generated grid code compiles the first time.
date: 2025-11-18
updated: 2026-07-02
category: AI
tags: ai, mcp, claude, cursor, svelte data grid
author: Victor Vidolov
---

AI assistants are confident liars about data grid APIs. Ask Claude to build a sortable, filterable SvGrid table and it will write code that looks completely reasonable - until TypeScript tells you that `onCellValidate`, `computedFields`, and `inputMode` have never existed in `@svgrid/grid`. The model is not being careless. It genuinely does not know what changed in the last three releases, and data grids change fast.

The `@svgrid/mcp` server fixes this by giving your assistant a live, version-pinned lookup into real SvGrid examples and API references. Instead of guessing from stale training data, the assistant calls MCP tools to fetch accurate information before writing a single import.

## Why grids break AI code generation

Most component libraries have stable, slow-moving APIs. A button component from six months ago is a button component today. Data grids are different. SvGrid has shipped eleven minor releases in fourteen months. Column definition shapes change, new features appear, old patterns get deprecated. A model trained on documentation from eight months ago is working from a snapshot that may be two to six versions behind your installed package.

The specific failure mode is predictable: the model invents plausible-sounding props. `validateCell` instead of `editable` + editor config. `getRows` instead of `getDisplayedRows`. `formula` as a column property instead of `renderSnippet` with a derived function. Each one compiles to a TypeScript error that requires you to go read the actual source to understand what the real API is - which is exactly what you were trying to avoid.

Version pinning is what makes `@svgrid/mcp` worth using. The server resolves against the `@svgrid/grid` version in your project's lockfile, so examples it returns match your actual API surface, not a generic latest-stable snapshot.

## Installing the MCP server

One JSON entry in your assistant's config file. Claude Desktop reads from `~/Library/Application Support/Claude/claude_desktop_config.json`. Cursor reads from `.cursor/mcp.json` at the project root. VS Code Copilot follows the same pattern.

```json
{
  "mcpServers": {
    "sv-grid": {
      "command": "npx",
      "args": ["@svgrid/mcp"]
    }
  }
}
```

Restart the assistant and the tools are available. The server boots in a couple of seconds on first use because `npx` downloads and caches the package. Subsequent calls are local. No API key, no cloud dependency, no configuration beyond this block.

## Building a real grid with AI grounding

The prompt I use to test grounded sessions is deliberately demanding: "Build a purchase-order line-item grid. Rows are editable with inline number inputs for unit cost and quantity. Derived columns show subtotal, tax at 8%, and total using real-time calculation. Add a row button below the grid. TypeScript, Svelte 5."

Without MCP grounding this prompt reliably produces invented props and a non-functional component. With grounding, the assistant fetches the real `ColumnDef` shape and `renderSnippet` signature before writing anything. Here is the output from a grounded session, with every import and prop verified:

```svelte
<script lang="ts">
  import SvGrid, {
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
    type SvGridOptions,
  } from '@svgrid/grid'

  type LineItem = {
    id: string
    description: string
    unitCost: number
    quantity: number
  }

  const TAX_RATE = 0.08

  let rows = $state<LineItem[]>([
    { id: 'a', description: 'Domain registration',  unitCost: 12.99,  quantity: 3    },
    { id: 'b', description: 'Hosting (monthly)',     unitCost: 49.00,  quantity: 12   },
    { id: 'c', description: 'SSL certificate',       unitCost: 85.00,  quantity: 1    },
    { id: 'd', description: 'CDN bandwidth (GB)',    unitCost: 0.085,  quantity: 5000 },
    { id: 'e', description: 'Email seats',           unitCost: 6.00,   quantity: 20   },
    { id: 'f', description: 'Analytics',             unitCost: 79.00,  quantity: 5    },
    { id: 'g', description: 'Design license',        unitCost: 52.00,  quantity: 3    },
    { id: 'h', description: 'Object storage (TB)',   unitCost: 23.00,  quantity: 4    },
    { id: 'i', description: 'Backup retention',      unitCost: 15.00,  quantity: 12   },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

  const sub   = (r: LineItem) => r.unitCost * r.quantity
  const tax   = (r: LineItem) => sub(r) * TAX_RATE
  const total = (r: LineItem) => sub(r) + tax(r)

  const grandTotal = $derived(rows.reduce((acc, r) => acc + total(r), 0))

  let api = $state<SvGridApi<typeof features, LineItem> | null>(null)

  const columns: ColumnDef<typeof features, LineItem>[] = [
    {
      field: 'description',
      header: 'Description',
      editorType: 'text',
      width: 240,
    },
    {
      field: 'unitCost',
      header: 'Unit cost',
      editorType: 'number',
      width: 120,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
    {
      field: 'quantity',
      header: 'Qty',
      editorType: 'number',
      width: 80,
      align: 'right',
    },
    {
      id: 'subtotal',
      header: 'Subtotal',
      width: 120,
      align: 'right',
      editable: false,
      cell: ({ row }) => renderSnippet(MoneyCell, { value: sub(row.original) }),
    },
    {
      id: 'tax',
      header: 'Tax (8%)',
      width: 100,
      align: 'right',
      editable: false,
      cell: ({ row }) => renderSnippet(MoneyCell, { value: tax(row.original) }),
    },
    {
      id: 'total',
      header: 'Total',
      width: 120,
      align: 'right',
      editable: false,
      cell: ({ row }) => renderSnippet(MoneyCell, { value: total(row.original) }),
    },
  ]
</script>

{#snippet MoneyCell({ value }: { value: number })}
  <span style="font-variant-numeric: tabular-nums">{money.format(value)}</span>
{/snippet}

<SvGrid
  {features}
  {columns}
  bind:data={rows}
  sortable
  onApiReady={(a) => { api = a }}
  height={440}
/>

<div class="po-footer">
  <span class="grand-total">Grand total: {money.format(grandTotal)}</span>
  <button onclick={() => api?.addRow({
    id: crypto.randomUUID(),
    description: '',
    unitCost: 0,
    quantity: 1,
  })}>
    Add line item
  </button>
</div>

<style>
  .po-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
  }
  .grand-total { font-weight: 600; }
</style>
```

The derived columns react automatically because `rows` is `$state` and the helper functions are plain arithmetic. Edit `unitCost` or `quantity` inline and every dependent cell in that row updates. No formula engine, no special reactive primitives - just Svelte 5's fine-grained reactivity doing what it does.

## The part that trips people up: the API object

`SvGridApi` is not available synchronously. It arrives through `onApiReady`, and if you try to call `api.addRow` before that fires you will get a null reference. The pattern is to store the reference in a `$state` variable and gate anything that calls the API on its existence.

```ts
let api = $state<SvGridApi<typeof features, LineItem> | null>(null)

// Safe to call any time after onApiReady
function removeSelected() {
  const selected = api?.getSelectedRows() ?? []
  for (const row of selected) {
    api?.removeRow(row.index)
  }
}

function exportToJSON() {
  return JSON.stringify(api?.getData() ?? [], null, 2)
}

function jumpToBottom() {
  const displayed = api?.getDisplayedRows() ?? []
  if (displayed.length > 0) {
    api?.scrollToRow(displayed.at(-1)!.index)
  }
}
```

Without MCP grounding, an assistant will frequently invent `api.getRows()`, `api.export()`, or `api.scrollTo()` - all plausible, none real. The MCP server returns the actual method list from your installed version, so you get `getDisplayedRows`, `getData`, and `scrollToRow`.

## What changes about the actual workflow

The practical difference is where your attention goes. In an ungrounded session, most of the time after the first draft goes toward debugging invented props - checking source, checking docs, figuring out what the real API is and manually fixing the generated code. In a grounded session, the first draft is usually structurally correct and the remaining work is application logic: what should the grid actually do for your users.

The MCP server does not require better prompts or a lengthy system-prompt preamble describing the SvGrid API. It intercepts the lookup at the moment the assistant needs it and returns accurate data. You describe the feature you want in plain terms and the assistant does the API lookup itself.

For straightforward grids - sortable, filterable, maybe editable - the first draft from a grounded session is deployable after a quick review. For more complex scenarios like grouped rows, server-side data, or cell selection, you might need one round of refinement. Either way, you are not spending time correcting hallucinated props.

The config block near the top of this post is the complete installation. One JSON entry, restart the assistant, done.
