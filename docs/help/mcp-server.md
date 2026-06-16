# MCP server

The sv-grid MCP server lets AI clients (Claude Desktop, Cursor, Zed,
Continue, custom agents) query the documentation, scaffold column
definitions, and preview exports - all grounded in the same schemas
the library ships with. No API key required; everything runs locally
against your installed copy.

> **What is MCP?** Model Context Protocol is the open standard
> ([modelcontextprotocol.io](https://modelcontextprotocol.io)) for
> exposing tools / resources / prompts to LLM clients. sv-grid ships an
> MCP server out of the box so the model your team already uses can
> "see" the grid without you having to copy-paste docs into prompts.

## Install

```bash
# Inside any project that already depends on @svgrid/grid
pnpm add -D @sv-grid/mcp-server
```

The server is a Node binary. Run it on demand from the package's
`bin` field - no daemon to maintain.

## Wire it into your AI client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sv-grid": {
      "command": "npx",
      "args": ["-y", "@sv-grid/mcp-server"]
    }
  }
}
```

Restart Claude Desktop. Type `@sv-grid` in any chat to confirm the
tools are exposed.

### Cursor

`Settings → MCP → Add new MCP server`:

```json
{ "command": "npx", "args": ["-y", "@sv-grid/mcp-server"] }
```

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "sv-grid": { "command": { "path": "npx", "args": ["-y", "@sv-grid/mcp-server"] } }
  }
}
```

### Custom agents (OpenAI Agents SDK, Anthropic SDK, LangChain)

Point your client's MCP transport at:

```
npx -y @sv-grid/mcp-server
```

Any client that speaks MCP stdio works.

## Tools exposed

The server registers six tools. All return structured JSON; none
require an API key or network access.

### `searchDocs`

Ground the model in the doc set without dumping the whole corpus.

```ts
searchDocs({ query: string, limit?: number }):
  Array<{ path, title, summary, score, snippet }>
```

Backed by the same `docs.json` manifest you can fetch directly.

### `getDocPage`

Pull the full markdown of one page by URL or path.

```ts
getDocPage({ path: '/help/pivot.md' }): { title, source, demoIds }
```

### `scaffoldColumns`

Generate a `ColumnDef[]` from a sample row. Picks reasonable widths,
inferred editor types, sensible header labels, and format options for
numbers / currencies / ISO dates.

```ts
scaffoldColumns({
  sampleRow: { id: 'r1', sellDate: '2026-05-12', price: 1499.99, currency: 'USD' },
  inferFormat?: boolean,    // default true
  language?: 'ts' | 'js',   // default 'ts'
})
// → { code: string, columns: ColumnDef[] }
```

### `validateColumns`

Check a `ColumnDef[]` payload against `column-def.json`. Returns the
list of issues with file / line hints (when the input is a code
string). Useful for agents that generate columns and want a self-check
before showing the result.

```ts
validateColumns({ columns: ColumnDef[] | string }):
  { valid: boolean, issues: Array<{ path, message, severity }> }
```

### `previewExport`

Dry-run an `api.exportData({...})` call. Returns the rows + header
layout the exporter WOULD write, without actually triggering a
download. Useful when an agent is composing a multi-sheet export and
wants to verify column ordering before committing.

```ts
previewExport({ format: 'xlsx', rows: [...], columns: [...] }):
  { sheets: Array<{ label, header, rows }> }
```

### `listDemos`

Returns every demo in `examples/src/demos/` with its title, blurb,
category, source path, and the prompt sidecar (see
[LLM grounding](./llm-grounding.md)).

```ts
listDemos({ category?: string }):
  Array<{ id, title, blurb, category, source, prompt }>
```

## Resources exposed

In addition to tools, the server exposes three MCP **resources** -
read-only documents the client can browse:

| URI                            | Content                                           |
| ------------------------------ | ------------------------------------------------- |
| `svgrid://docs/llms.txt`       | Topic map (see [llms.txt](/llms.txt))             |
| `svgrid://docs/llms-full.txt`  | Concatenated full text of every doc              |
| `svgrid://docs/manifest`       | `docs.json` route manifest                        |
| `svgrid://schemas/column-def`  | JSON Schema for `ColumnDef`                       |
| `svgrid://schemas/svgrid-options` | JSON Schema for `<SvGrid>` props              |
| `svgrid://schemas/export-options` | JSON Schema for `api.exportData({...})`        |

## Prompts exposed

Pre-built MCP prompts you can invoke directly from a chat:

- **`/svgrid:scaffold-grid`** - paste a sample row, get a complete
  `<SvGrid>` + `tableFeatures` + `ColumnDef[]` setup
- **`/svgrid:refactor-to-pivot`** - hand it a flat-grid component, get
  a pivot-grid version
- **`/svgrid:wire-server-side`** - convert client-side data to a
  server-side adapter with sort / filter / paginate round-trips

## Verifying it works

After wiring the server, ask your model: *"What MCP tools do you have
from sv-grid?"* You should see all six tools listed. If not, check
your client's MCP log; the most common issue is `npx` not being on
PATH (use the absolute path to the binary instead).

## Security model

- The server runs **locally**. No telemetry, no outbound network calls.
- File reads are scoped to your project's `node_modules/@sv-grid/*`
  and any `docs/` folder you explicitly pass via the `--docs <dir>` flag.
- `scaffoldColumns` and `previewExport` are pure functions - they
  inspect input and emit text. They never write to disk or fetch from
  the network.
- See [security](./security.md) for the general supply-chain posture.

## Building your own MCP integrations

The same `docs.json` + JSON Schemas + `llms.txt` files the server uses
are also accessible directly from your docs site
([https://svgrid.com](https://svgrid.com)):

```ts
const docs    = await fetch('https://svgrid.com/docs.json').then((r) => r.json())
const schemas = await fetch('https://svgrid.com/schemas/index.json').then((r) => r.json())
const llms    = await fetch('https://svgrid.com/llms-full.txt').then((r) => r.text())
```

If you don't want to run the MCP server, building these into your
agent's system prompt gives ~80% of the same value.

## See also

- [LLM grounding](./llm-grounding.md) - the same files used by the MCP server, but documented for direct LLM consumption
- [Agents](./agents.md) - how to build an AI agent that drives the live grid
- [AI assistant - Enterprise](./ai.md) - the in-grid AI features (filter / smart-fill / classify / summarise)

## Frequently asked questions

### What is the sv-grid MCP server?

A Model Context Protocol server that lets AI clients (Claude Desktop, Cursor,
Zed, Continue, custom agents) query SvGrid's documentation, scaffold column
definitions, and preview exports - all grounded in the schemas the library
ships with, so the model answers from current facts instead of guessing.

### Do I need an API key to run it?

No. The MCP server runs locally against your installed copy of SvGrid. There is
no key and no external call.

### How does it help AI assistants write better SvGrid code?

It exposes example sources, the docs, and the API reference as MCP tools, so the
assistant retrieves accurate, version-pinned answers rather than hallucinating
an API from training data.
