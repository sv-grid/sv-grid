# sv-grid-mcp

A Model Context Protocol (MCP) server for [SvGrid](https://sv-grid.github.io/sv-grid/).
Point an MCP-capable client (Claude Desktop, Claude Code, Cursor, etc.) at
this server and the model gets accurate, version-pinned answers about
SvGrid - no hallucinated APIs, no stale blog posts.

## What it exposes

| Tool | Purpose |
| --- | --- |
| `list_examples` | All 20 demo ids, titles, blurbs. |
| `get_example_source` | Full `.svelte` source for a demo by id. |
| `list_docs` | Every doc page (slug + title). |
| `get_doc` | Markdown for a single doc by slug. |
| `search_docs` | Case-insensitive substring search across docs. |
| `get_api_reference` | Curated public-API surface, grouped by category. |

## Install + run

```bash
# One-shot via npx (no install)
npx sv-grid-mcp

# Or install + run
npm install -g sv-grid-mcp
sv-grid-mcp
```

The server speaks MCP over **stdio**. Stdout is reserved for JSON-RPC; logs
go to stderr.

## Hook it into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sv-grid": {
      "command": "npx",
      "args": ["-y", "sv-grid-mcp"]
    }
  }
}
```

Restart Claude Desktop. Open a new chat - the tools above are now available.

## Hook it into Claude Code

```bash
claude mcp add sv-grid -- npx -y sv-grid-mcp
```

Then in a session:

> /mcp

…and you'll see `sv-grid` listed. Ask Claude something like *"using sv-grid,
build me a grid that groups by department and shows a sparkline in each
row"* and it will pull the relevant example sources before generating code.

## Build from source

```bash
cd packages/sv-grid-mcp
pnpm build
node dist/index.js
```

`pnpm build` first runs `scripts/build-manifests.mjs`, which reads
`examples/src/demos/*.svelte` and `docs/**/*.md` from the workspace and
inlines them into `src/data.ts` so the published npm package is
self-contained.

## License

MIT. sv-grid-community is also MIT-licensed; sv-grid-pro is a paid companion package under a separate commercial license.
