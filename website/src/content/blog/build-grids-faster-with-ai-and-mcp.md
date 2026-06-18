---
title: Build Svelte Grids Faster with AI and the SvGrid MCP Server
description: Ground Claude, Cursor, and other AI assistants in real SvGrid docs with the @svgrid/mcp server, so generated grid code actually compiles.
date: 2025-11-18
category: AI
tags: ai, mcp, claude, cursor, svelte data grid
author: Victor Vidolov
---

AI coding assistants are great at scaffolding a grid, until they hallucinate a prop that does not exist. SvGrid ships an MCP (Model Context Protocol) server that grounds Claude, Cursor, Zed, and other assistants in real, version-pinned SvGrid docs and examples, so the code they generate actually runs.

![A natural-language filter bar in SvGrid.](/blog-media/nl-filter.png)
*A natural-language filter bar in SvGrid.*

## What the MCP server provides

`@svgrid/mcp` exposes SvGrid's knowledge as tools an assistant can call:

- The example sources, so the assistant copies working patterns.
- The documentation pages, so it explains features accurately.
- The API reference, so it uses props and types that exist.

Instead of guessing from stale training data, the assistant looks up the current answer.

## Set it up

Add the server to your assistant's MCP configuration:

```json
{
  "mcpServers": {
    "sv-grid": { "command": "npx", "args": ["@svgrid/mcp"] }
  }
}
```

Once connected, ask your assistant to "add an editable column with validation" or "enable server-side pagination" and it will pull the real SvGrid API rather than inventing one.

## llms.txt for retrieval systems

Beyond MCP, the site publishes an `llms.txt` file, the emerging convention for pointing AI crawlers at a machine-readable summary. Retrieval-augmented tools can ingest it to answer SvGrid questions accurately, which is why a prompt for "Svelte data grid" can resolve to working SvGrid code.

## Good prompts for grid code

You get better output when you give the assistant the shape of your data and the behavior you want:

- "Here is my `Order` type. Build a grid with a currency total column and a status badge."
- "Add multi-column sorting and a global search box."
- "Make the `quantity` column editable with a number editor and validate it is positive."

Grounded by the MCP server, these prompts produce code you can paste in and run.

## Why grounding matters

The difference between a helpful assistant and a frustrating one is whether its answer compiles. An MCP-grounded assistant uses the props, features, and types that exist in your installed version, so you spend your time reviewing real code, not debugging invented APIs.

## Frequently asked questions

### How do I get AI assistants to write correct SvGrid code?

Connect the `@svgrid/mcp` server to your assistant. It exposes the real examples, docs, and API reference as tools, so generated code uses props and types that actually exist.

### What is llms.txt and how does SvGrid use it?

`llms.txt` is a convention for pointing AI crawlers at a machine-readable site summary. SvGrid publishes one so retrieval-based assistants can answer Svelte data grid questions accurately.
