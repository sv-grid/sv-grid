---
title: Prompts That Build a Svelte Data Grid (Claude & Cursor)
description: Copy-paste prompts for AI assistants to scaffold SvGrid features correctly - and how the MCP server keeps the generated code from hallucinating.
date: 2026-06-23
category: AI
tags: ai, mcp, claude, cursor, prompts, svelte data grid
author: SvGrid Team
---

If you build with an AI assistant, the difference between a helpful one and a frustrating one is whether its output compiles. These prompts produce working SvGrid code - and the section at the end shows how to ground your assistant so it stops inventing props.

## Ground the assistant first

Before prompting, connect the SvGrid MCP server so the assistant looks up the real API instead of guessing from stale training data:

```json
{
  "mcpServers": {
    "sv-grid": { "command": "npx", "args": ["sv-grid-mcp"] }
  }
}
```

With it connected, the prompts below resolve to props and types that actually exist. See [Build Grids Faster with AI and the MCP server](build-grids-faster-with-ai-and-mcp).

## Prompts that work

Give the assistant your data shape and the behavior you want. Specific beats vague.

**Scaffold a grid from a type:**

> Here is my `Order` type. Build a Svelte 5 component using SvGrid (`sv-grid-community`) with columns for id, customer, a currency `total`, and a `status` badge. Enable sorting and an Excel-style filter menu.

**Add editing with validation:**

> Make the `quantity` column editable with a number editor. In `onCellValueChange`, reject values below 0 and otherwise update my `rows` state. Do not mutate the row directly.

**Server-side data:**

> Convert this grid to server-side mode. On sort/filter/page change, call `fetchOrders(state)` and pass the returned rows as `data` and the total as `rowCount`. Debounce filter changes by 300ms.

**Grouping and totals:**

> Group rows by `region` and show a summed `revenue` total per group, formatted as USD currency.

**Custom cell:**

> Render the `status` column with a Svelte snippet via `renderSnippet` that shows a colored badge, keeping the underlying value sortable.

## Why specificity matters

An assistant grounded by the MCP server still produces better output when you give it the data's shape and the exact behavior. "Build a grid" yields a generic guess; "build a grid over this `Order` type with a currency total and a status badge" yields code you can paste in.

## Review what you get

Even grounded assistants make mistakes. Quick checks:

- Does it format on the column (`format: { type: 'currency' }`) rather than inside an accessor? That keeps sorting correct.
- Does editing go through `onCellValueChange` instead of mutating rows?
- Is the grid in a container with a bounded height so virtualization works?

## Frequently asked questions

### How do I get an AI assistant to write correct SvGrid code?

Connect the `sv-grid-mcp` server so the assistant uses the real examples, docs, and API, then prompt with your data shape and the specific behavior you want. Grounding plus specificity produces code that compiles.

### Why does AI-generated grid code often not compile?

Because models work from stale, averaged training data and invent props from other libraries. An MCP server grounds the assistant in your installed version's real API, so generated code uses props and types that actually exist.
