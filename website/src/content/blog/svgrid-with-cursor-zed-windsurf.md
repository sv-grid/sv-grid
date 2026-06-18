---
title: Using SvGrid with Cursor, Zed, and Windsurf
description: Connect the SvGrid MCP server to AI-native editors - Cursor, Zed, Windsurf, and Claude - so their assistants generate grid code that actually compiles.
date: 2026-09-14
category: AI
tags: ai, mcp, cursor, zed, windsurf, svelte data grid
author: Victor Vidolov
---

Cursor, Zed, Windsurf, Claude, whatever you drive, an AI assistant is writing a real share of your grid code now, and left to its training data it will confidently invent props that do not exist. The SvGrid MCP server fixes that for all of them at once. Here is how to wire it up in each.

![A natural-language filter bar in SvGrid.](/blog-media/nl-filter.png)
*A natural-language filter bar in SvGrid.*

## The shared idea: MCP

Model Context Protocol is a standard way to give an AI assistant tools. The `@svgrid/mcp` server exposes SvGrid's real examples, docs, and API reference, so the assistant looks up the current, version-correct answer instead of guessing. Any MCP-capable editor benefits from the same server. See [build grids faster with AI](build-grids-faster-with-ai-and-mcp).

## Cursor

Add the server to Cursor's MCP settings (Settings → MCP), or a project `.cursor/mcp.json`:

```json
{ "mcpServers": { "sv-grid": { "command": "npx", "args": ["@svgrid/mcp"] } } }
```

## Zed

Zed supports MCP via context servers. Add `sv-grid` to your Zed settings' context-server configuration with the same `npx @svgrid/mcp` command, and the assistant can call it while you work.

## Windsurf

Windsurf (Cascade) supports MCP servers in its config. Register `sv-grid` with the `npx @svgrid/mcp` command, and Cascade will pull real SvGrid docs and examples into its answers.

## Claude (Desktop / Code)

Add the same server block to Claude's MCP configuration. Claude Code and Claude Desktop then ground their SvGrid answers in the live API.

```json
{ "mcpServers": { "sv-grid": { "command": "npx", "args": ["@svgrid/mcp"] } } }
```

## Why bother

The difference is whether generated code compiles. Grounded by the MCP server, "add server-side pagination to my SvGrid" produces props and types that exist in your installed version - so you review real code instead of debugging invented APIs. Pair it with good prompts (your data shape, the exact behavior) for the best results - see [prompts that build a Svelte grid](prompts-to-build-svelte-data-grid).
