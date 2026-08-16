<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/mcp</h1>

<p align="center"><strong>The official Model Context Protocol server for SvGrid.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/mcp"><img src="https://img.shields.io/npm/v/%40svgrid%2Fmcp.svg?label=%40svgrid%2Fmcp" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/mcp"><img src="https://img.shields.io/npm/dm/%40svgrid%2Fmcp.svg" alt="npm downloads" /></a>
  <a href="https://svgrid.com/pricing/"><img src="https://img.shields.io/badge/license-commercial-blue.svg" alt="Commercial license" /></a>
</p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs/help/mcp-server/">Docs</a> ·
  <a href="https://svgrid.com/pricing/">Pricing</a>
</p>

---

Point any MCP-capable client - Claude Desktop, Claude Code, Cursor, Zed - at this server and the model answers with **accurate, version-pinned** facts about SvGrid: real prop, method, and event names, plus every demo's source as grounding. No hallucinated APIs, no stale blog posts.

**Why this beats pasting docs into the chat.** A model working from memory invents plausible SvGrid APIs, because it learned from a mix of other grids and older versions. Pasting docs helps for one question and then falls out of the context window. This server puts the current API surface and 370+ working demo sources one tool call away, for every question, pinned to the version you installed.

## Tools exposed

| Tool | Purpose |
| --- | --- |
| `list_examples` | Every demo: id, title, and one-line blurb. |
| `get_example_source` | Full `.svelte` source for a demo by id. |
| `list_docs` | Every documentation page (slug + title). |
| `get_doc` | Markdown for a single doc by slug. |
| `search_docs` | Case-insensitive substring search across the docs. |
| `get_api_reference` | The curated public-API surface, grouped by category. |
| `introspect_source` | Studio: infer an `EntitySchema` from a Drizzle file or sample rows. |
| `scaffold_entity` | Studio: generate SvelteKit files for a single entity. |

### Studio: drive the app model (agent co-designer)

The `studio_*` tools let an agent build and edit the **same validated project model the visual designer uses** - add entities, screens, blocks, components, wire data sources, theme, RBAC, auth, the typed data layer, and the deploy target - then generate the full runnable app or export the `studio.config.json` the designer can Load. Every edit runs through the model's own functions + `validateProject`, so the agent can't produce an invalid app.

| Tool | Purpose |
| --- | --- |
| `studio_new_project` / `studio_load_project` | Start fresh, or load an existing `studio.config.json`. |
| `studio_describe_project` / `studio_get_config` | Inspect the model / export it as `studio.config.json`. |
| `studio_capabilities` | List block kinds, component keys, theme presets, data-source kinds, deploy targets. |
| `studio_add_entity` | Add a table/model (+ default screen), by schema or introspection. |
| `studio_add_screen` / `studio_add_block` / `studio_add_component` | Compose screens from data blocks + UI components. |
| `studio_set_entity_source` | Bind an entity to memory / SQL / Supabase / REST / PGlite. |
| `studio_set_theme` / `studio_set_access` / `studio_set_auth` / `studio_set_data_layer` / `studio_set_deploy_target` | Configure app-wide features. |
| `studio_validate` | Report errors + warnings. |
| `studio_generate_app` | Emit every file of the runnable SvelteKit app. |

A typical session: `studio_new_project` → `studio_add_entity` (×N) → `studio_set_entity_source` → `studio_set_data_layer` → `studio_set_auth` → `studio_generate_app` → write the files and run `svelte-check`.

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

Commercial. Part of the SvGrid Enterprise offering; see [svgrid.com/pricing](https://svgrid.com/pricing/).
The MIT [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid) core is free for any use.

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd.
