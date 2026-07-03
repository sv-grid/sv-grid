---
title: Using SvGrid with Cursor, Zed, and Windsurf
description: Wire the SvGrid MCP server into Cursor, Zed, Windsurf, or Claude so AI assistants generate grid code that compiles on the first try - no invented props, no wrong import names.
date: 2026-09-14
updated: "2026-07-02"
category: AI
tags: ai, mcp, cursor, zed, windsurf, svelte data grid
author: Victor Vidolov
---

AI assistants are confidently wrong about `@svgrid/grid`. Ask Cursor or Windsurf to add server-side pagination and you will likely get a `columnDefs` array, an `onSortChanged` callback, and a `gridOptions` object - none of which exist in SvGrid. The assistant is pattern-matching against ag-Grid or TanStack Table from its training data and has no idea which props are real in your installed version.

The SvGrid MCP server fixes this at inference time, not after the fact. It gives the assistant a tool it can call mid-generation to look up real export names, correct prop shapes, and working examples from the version of `@svgrid/grid` that is actually installed in your project. The code that comes back compiles.

## One config block, four editors

The server is `@svgrid/mcp`. Every MCP-capable editor runs the same `npx` command - the differences are only in where you paste the config.

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

**Cursor** - save this as `.cursor/mcp.json` at the project root, or paste the `mcpServers` block into Settings > MCP. The `sv-grid` entry will appear in the MCP panel within a few seconds of saving.

**Zed** - Zed uses a different key. Open `~/.config/zed/settings.json` and add it under `context_servers`, not `mcpServers`. Pasting the Cursor block verbatim into Zed silently does nothing:

```json
{
  "context_servers": {
    "sv-grid": {
      "command": "npx",
      "args": ["@svgrid/mcp"]
    }
  }
}
```

**Windsurf (Cascade)** - open the MCP settings panel from the Cascade sidebar and register `npx @svgrid/mcp` as a new server. No JSON editing needed; the UI takes the command and args directly.

**Claude Desktop / Claude Code** - add the `mcpServers` block to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Claude Code picks up the same file automatically.

After saving, restart the editor. Confirm the server registered by asking the assistant: "What tools does the sv-grid MCP server expose?" It should list something like `get_svgrid_docs` and `search_svgrid_api` rather than saying it does not know.

## What grounded output looks like

The fastest way to see the difference is to try the same prompt with and without the server registered. With it active, a prompt like "add a server-side data grid for my orders API with sorting and inline status editing" produces code that actually works.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowPaginationFeature,
    columnFilteringFeature,
    createServerDataSource,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Status = 'pending' | 'paid' | 'fulfilled' | 'returned'

  type Order = {
    id: string
    customer: string
    status: Status
    total: number
    placedAt: string
  }

  const features = tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    columnFilteringFeature,
  })

  const dataSource = createServerDataSource<Order>(async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(sort[0] ? { sortField: sort[0].field, sortDir: sort[0].dir } : {}),
    })
    const res = await fetch(`/api/orders?${params}`)
    const json = await res.json()
    // Return shape must be { rows, totalRows } - not a bare array
    return { rows: json.data, totalRows: json.total }
  })

  const STATUS_COLOR: Record<Status, string> = {
    pending:   '#f59e0b',
    paid:      '#3b82f6',
    fulfilled: '#22c55e',
    returned:  '#94a3b8',
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',       header: 'Order',    width: 120, sortable: true },
    { field: 'customer', header: 'Customer', width: 200, sortable: true },
    {
      field: 'status',
      header: 'Status',
      width: 130,
      sortable: true,
      editorType: 'list',
      editorOptions: (['pending', 'paid', 'fulfilled', 'returned'] as Status[]).map(
        (s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), color: STATUS_COLOR[s] })
      ),
      cell: (ctx) => renderSnippet(StatusBadge, { status: ctx.row.original.status }),
    },
    {
      field: 'total',
      header: 'Total',
      width: 110,
      sortable: true,
      format: { type: 'currency', currency: 'USD', decimals: 2 },
    },
    { field: 'placedAt', header: 'Placed', width: 160, sortable: true },
  ]

  // $state so components that read api re-render when it arrives
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  function handleExport() {
    const rows = api?.getSelectedRows() ?? []
    console.log('exporting', rows.length, 'rows')
  }
</script>

{#snippet StatusBadge({ status }: { status: Status })}
  <span style="
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem;
    background: color-mix(in srgb, {STATUS_COLOR[status]} 15%, transparent);
    color: {STATUS_COLOR[status]};
    border: 1px solid color-mix(in srgb, {STATUS_COLOR[status]} 35%, transparent);
  ">{status}</span>
{/snippet}

<button onclick={handleExport} disabled={!api}>Export selected</button>

<SvGrid
  {features}
  {columns}
  data={dataSource}
  pageable
  sortable
  filterable
  editable
  rowHeight={36}
  height="580px"
  onApiReady={(a) => { api = a }}
/>
```

Without the MCP server, the same prompt typically comes back with `gridOptions`, `columnDefs`, `onCellValueChanged`, and a `datasource` prop shaped like ag-Grid's `IServerSideDatasource`. None of those compile against `@svgrid/grid`. The MCP tool gives the assistant the actual signatures before it writes a single line.

## How the protocol works

When the assistant receives your prompt, it checks which MCP tools are registered and calls the `sv-grid` server before generating code. The editor spawned `npx @svgrid/mcp` as a subprocess when it started; the assistant sends a JSON-RPC message over stdio asking for the API surface relevant to your prompt, gets structured data back, and uses that as grounding for the reply.

Because the server reads from your project's `node_modules`, the docs it returns match what is installed - not some snapshot from training data. If you are on `@svgrid/grid@0.8` and the latest is `1.0`, the assistant sees the `0.8` API. This is the property you actually want: correctness against the version you are running.

You can also prompt explicitly if you want to be sure the tool fires: "Use the sv-grid MCP tool to look up the correct signature for `createServerDataSource` before writing any code." Most editors call it automatically, but an explicit nudge helps in sessions where the assistant has been doing unrelated work and might skip the lookup.

## Three things that cause silent failures

**Returning the wrong shape from `createServerDataSource`.** The callback must return `{ rows, totalRows }`. If you return a bare array or use `total` instead of `totalRows`, the grid renders 0 rows with nothing in the console. The MCP server returns the correct return type, but if you are editing the fetch callback by hand, keep this in mind.

**Storing the API handle in a plain `let` instead of `$state`.** `onApiReady` fires once after first render. If you write `let api: SvGridApi | null = null`, Svelte 5's reactivity system does not track that assignment, so any component that conditionally renders based on `api` will not update when the handle arrives. The fix is `let api = $state<SvGridApi<...> | null>(null)` as shown above.

**Zed ignoring your config.** Zed's key is `context_servers`. If you paste the Cursor `mcpServers` block into your Zed settings without changing the outer key, Zed silently ignores it and the server never starts. Check the Zed output panel - it logs available context servers on startup.

## Getting prompt quality up

The MCP server provides API facts. It does not know your data shape, your backend conventions, or your component architecture. The most reliable prompt pattern combines the MCP grounding with a concrete type:

```
Using the sv-grid MCP tool for API reference, generate an SvGrid component
for the following type:

type Invoice = {
  id: string
  vendor: string
  amount: number
  dueDate: string
  status: 'draft' | 'sent' | 'overdue' | 'paid'
}

Requirements:
- Server-side pagination and sorting via /api/invoices
- Inline editing on the status column (list editor)
- Conditional formatting: overdue rows in red
- Export selected rows via api.getSelectedRows()
```

That combination - explicit type, concrete requirements, and MCP grounding - consistently produces first-pass code that works without editing. The assistant knows what props are legal, what your data looks like, and what behavior you expect. There is not much room left for hallucination.

The MCP server is published to npm as `@svgrid/mcp`. If `npx` hangs on the first call, check your registry config or install globally with `npm i -g @svgrid/mcp` and point the config at `svgrid-mcp` as the command instead.
