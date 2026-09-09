<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/mcp</h1>

<p align="center"><strong>The official Model Context Protocol server for SvGrid.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/mcp"><img src="https://img.shields.io/npm/v/%40svgrid%2Fmcp.svg?label=%40svgrid%2Fmcp" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/mcp"><img src="https://img.shields.io/npm/dm/%40svgrid%2Fmcp.svg" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT License" /></a>
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

Four. `tools/list` is sent on **every** request, so the tool surface is pure
overhead on every turn - this server used to spend ~4,710 tokens of it on 36
tools, 79% of them Studio tools most sessions never call once.

| Tool | Purpose |
| --- | --- |
| `svgrid_search` | Search the docs, all 378 demos and the API surface **in one call**. No arguments returns an index. |
| `svgrid_get` | Read one thing in full: a doc slug, a demo id, or `api`. |
| `svgrid_check_code` | **Verify** a file against the real API surface + the Svelte compiler. |
| `svgrid_scaffold` | Studio: turn a Drizzle schema, sample rows or an `EntitySchema` into runnable SvelteKit files. |

The docs and demos are also served as **MCP resources**
(`svgrid://doc/<slug>`, `svgrid://example/<id>`), and three **prompts** ship
ready to run: `build_grid`, `explain_api`, `review_grid_code`.

Every pre-3.0 tool name still answers - `search_docs`, `get_doc`,
`list_examples`, `get_example_source`, `list_docs`, `get_api_reference`,
`check_svgrid_code`, `introspect_source`, `scaffold_entity`, and all 27
individual `studio_*` tools. They are not **listed**, because listing is what
costs context and answering an unadvertised name costs nothing. Their response
shape follows 3.0.

### `svgrid_check_code` - the one a retrieval server cannot do

Reading the docs makes a model *likelier* to be right. This makes it *checkable*.
Hand it a file and it answers with line-numbered diagnostics and the exact
replacement for each:

```jsonc
{
  "ok": false,
  "checkedAgainst": "@svgrid/grid@2.6.20",
  "compiler": "svelte",
  "counts": { "errors": 3, "warnings": 0, "info": 0 },
  "diagnostics": [
    { "rule": "svgrid/renamed-prop", "severity": "error", "line": 24,
      "message": "`rowData` is not a SvGrid prop.", "fix": "Use `data`." },
    { "rule": "svgrid/renamed-column-key", "severity": "error", "line": 10,
      "message": "`accessorKey` is not a SvGrid column key.", "fix": "Use `field`." },
    { "rule": "svelte/legacy-event-directive", "severity": "error", "line": 30,
      "message": "`on:rowClick` never fires: SvGrid dispatches no component events, it takes callback props.",
      "fix": "Use `onRowClick={...}`." }
  ]
}
```

What it checks:

- **Every name, against the installed version.** Importable symbols, `<SvGrid>`
  props, `ColumnDef` keys, grid API methods, theme stylesheets. The list is
  generated from the package sources at build time, so it cannot drift from
  what the package exports, and an unknown name comes back with the nearest
  real one.
- **Cross-package mistakes.** A symbol that lives in `@svgrid/enterprise`, or an
  api method that only exists after `installEnterprise(api)`.
- **Svelte 5 rules.** `export let` and `$:` in a runes file (compiler errors),
  `on:` / `<slot>` / `createEventDispatcher` (deprecations), and a plain `let`
  array that gets mutated and silently never re-renders.
- **The file, compiled.** When a Svelte compiler is reachable - the user's
  project copy first, then the one shipped here - real parse errors come back
  too. The result says which of the two ran in its `compiler` field, so
  "no errors" is never mistaken for "this compiles".

It is tuned to shut up when the code is right: it reports **nothing** across all
378 demos in this repo, which is what a CI test asserts. A verifier that cries
wolf is worse than none, because a model will happily "fix" working code.

### Studio: drive the app model (agent co-designer)

The `studio_*` tools let an agent build and edit the **same validated project model the visual designer uses** - add entities, screens, blocks, components, wire data sources, theme, RBAC, auth, the typed data layer, and the deploy target - then generate the full runnable app or export the `studio.config.json` the designer can Load. Every edit runs through the model's own functions + `validateProject`, so the agent can't produce an invalid app.

**Opt-in.** Set `SVGRID_MCP_STUDIO=1`, or a valid `SVGRID_LICENSE_KEY`, in the
server's env. Tools that need a licence to be useful should not cost every
other user context on every request.

| Tool | Purpose |
| --- | --- |
| `studio_project` | `new`, `load`, `describe`, `config`, `capabilities`. |
| `studio_apply` | A **batch** of model changes in order: entities, screens, blocks, components. |
| `studio_configure` | Theme, auth, RBAC, tenancy, data layer, jobs, deploy target, layouts - in one call. |
| `studio_build` | `validate`, then `generate` the full runnable SvelteKit app. |

A typical session: `studio_project` (`new`) → one `studio_apply` batch per
screen → `studio_configure` → `studio_build` (`generate`) → write the files and
run `svelte-check`.

`studio_apply` batches on purpose. Twenty-seven one-per-mutation tools made a
five-screen app twenty-odd round trips; a whole screen is now one call, and a
failure reports which op failed and what already applied.

## Two ways to run it

| | stdio (this package) | remote HTTP |
| --- | --- | --- |
| Install | `npx @svgrid/mcp` | `https://mcp.svgrid.com/mcp` |
| Needs Node | yes | no |
| `check_svgrid_code` compiles | yes | static checks only |
| Studio `studio_*` tools | yes (27) | no |
| Works offline | yes | no |

```bash
# No install: point any MCP client at the hosted server
claude mcp add --transport http svgrid https://mcp.svgrid.com/mcp
```

<p align="center">
  <a href="https://cursor.com/en/install-mcp?name=svgrid&config=eyJ1cmwiOiJodHRwczovL21jcC5zdmdyaWQuY29tL21jcCJ9"><img src="https://img.shields.io/badge/Add%20to-Cursor-000000?logo=cursor&logoColor=white" alt="Add to Cursor" /></a>
  <a href="https://insiders.vscode.dev/redirect/mcp/install?name=svgrid&config=%7B%22name%22%3A%22svgrid%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.svgrid.com%2Fmcp%22%7D"><img src="https://img.shields.io/badge/Add%20to-VS%20Code-0098FF?logo=visualstudiocode&logoColor=white" alt="Add to VS Code" /></a>
</p>

The remote server is live at **https://mcp.svgrid.com/mcp** and carries the six
docs + verification tools ([source](../../workers/svgrid-mcp)). Use stdio when
you want the compiler pass, the Studio tools, or no third-party endpoint in the
loop.

## Run

```bash
# One-shot via npx (no install)
npx @svgrid/mcp

# Or install globally, then run the bin
npm install -g @svgrid/mcp
svgrid-mcp
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

MIT - free to run, no license key. Some tools generate SvGrid Studio projects, and Studio itself is
commercial; see [svgrid.com/pricing](https://svgrid.com/pricing/).
The MIT [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid) core is free for any use.

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd.
