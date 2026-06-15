---
title: Using SvGrid with Cursor, Zed, and Windsurf
description: Connect the SvGrid MCP server to AI-native editors - Cursor, Zed, Windsurf, and Claude - so their assistants generate grid code that actually compiles.
date: 2026-09-14
category: AI
tags: ai, mcp, cursor, zed, windsurf, svelte data grid
author: Victor Vidolov
---

AI-native editors - Cursor, Zed, Windsurf - and assistants like Claude all write a lot of grid code now. Left to their training data, they hallucinate props. The SvGrid MCP server fixes that across all of them. Here is how to wire it up in each.

## The shared idea: MCP

Model Context Protocol is a standard way to give an AI assistant tools. The `sv-grid-mcp` server exposes SvGrid's real examples, docs, and API reference, so the assistant looks up the current, version-correct answer instead of guessing. Any MCP-capable editor benefits from the same server. See [build grids faster with AI](build-grids-faster-with-ai-and-mcp).

## Cursor

Add the server to Cursor's MCP settings (Settings → MCP), or a project `.cursor/mcp.json`:

```json
{ "mcpServers": { "sv-grid": { "command": "npx", "args": ["sv-grid-mcp"] } } }
```

## Zed

Zed supports MCP via context servers. Add `sv-grid` to your Zed settings' context-server configuration with the same `npx sv-grid-mcp` command, and the assistant can call it while you work.

## Windsurf

Windsurf (Cascade) supports MCP servers in its config. Register `sv-grid` with the `npx sv-grid-mcp` command, and Cascade will pull real SvGrid docs and examples into its answers.

## Claude (Desktop / Code)

Add the same server block to Claude's MCP configuration. Claude Code and Claude Desktop then ground their SvGrid answers in the live API.

```json
{ "mcpServers": { "sv-grid": { "command": "npx", "args": ["sv-grid-mcp"] } } }
```

## Why bother

The difference is whether generated code compiles. Grounded by the MCP server, "add server-side pagination to my SvGrid" produces props and types that exist in your installed version - so you review real code instead of debugging invented APIs. Pair it with good prompts (your data shape, the exact behavior) for the best results - see [prompts that build a Svelte grid](prompts-to-build-svelte-data-grid).

## Frequently asked questions

### How do I use SvGrid with Cursor, Zed, or Windsurf?

Register the `sv-grid-mcp` server in each editor's MCP configuration (the command is `npx sv-grid-mcp`). The editor's assistant can then look up SvGrid's real examples, docs, and API, so the grid code it generates actually compiles.

### Does the SvGrid MCP server work with any AI editor?

Yes - any MCP-capable assistant (Cursor, Zed, Windsurf, Claude Desktop/Code, and others) can use the same `sv-grid-mcp` server. MCP is a shared standard, so one server grounds all of them.
