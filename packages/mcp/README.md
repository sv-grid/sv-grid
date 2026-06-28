<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/mcp</h1>

<p align="center"><strong>The official Model Context Protocol server for SvGrid.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/mcp"><img src="https://img.shields.io/npm/v/%40svgrid%2Fmcp.svg?label=%40svgrid%2Fmcp" alt="npm version" /></a>
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs">Docs</a>
</p>

---

Point any MCP-capable client - Claude Desktop, Claude Code, Cursor, Zed - at this server and the model answers with **accurate, version-pinned** facts about SvGrid: real prop, method, and event names, plus every demo's source as grounding. No hallucinated APIs, no stale blog posts.

## Tools exposed

| Tool | Purpose |
| --- | --- |
| `list_examples` | Every demo: id, title, and one-line blurb. |
| `get_example_source` | Full `.svelte` source for a demo by id. |
| `list_docs` | Every documentation page (slug + title). |
| `get_doc` | Markdown for a single doc by slug. |
| `search_docs` | Case-insensitive substring search across the docs. |
| `get_api_reference` | The curated public-API surface, grouped by category. |

## Run

```bash
# One-shot via npx (no install)
npx @svgrid/mcp

# Or install globally, then run the bin
npm install -g @svgrid/mcp
@svgrid/mcp
```

The server speaks MCP over **stdio**: stdout is reserved for JSON-RPC, logs go to stderr.

## Connect Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "svgrid": {
      "command": "npx",
      "args": ["-y", "@svgrid/mcp"]
    }
  }
}
```

Restart Claude Desktop and open a new chat - the tools above are now available.

## Connect Claude Code

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
```

Then run `/mcp` in a session to confirm `svgrid` is listed. Ask something like
*"using svgrid, build a grid that groups by department and shows a sparkline per row"*
and the model will pull the relevant demo sources before generating code.

## Connect Cursor / Zed

Add the same `mcpServers` block to the editor's MCP configuration:

```json
{
  "mcpServers": {
    "svgrid": { "command": "npx", "args": ["-y", "@svgrid/mcp"] }
  }
}
```

## Build from source

```bash
cd packages/mcp
pnpm build
node dist/index.js
```

`pnpm build` first runs `scripts/build-manifests.mjs`, which reads
`examples/src/demos/*.svelte` and `docs/**/*.md` from the workspace and inlines
them into `src/data.ts`, so the published package is fully self-contained.

## Licensing

Commercial. Part of the SvGrid Enterprise offering; see [svgrid.com/pricing](https://svgrid.com/pricing).
The MIT [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid) core is free for any use.

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd.
