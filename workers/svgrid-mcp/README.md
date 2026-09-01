# svgrid-mcp (Cloudflare Worker)

The SvGrid MCP server over **remote HTTP**, so a client connects with a URL
instead of a local Node install.

The npm package (`npx @svgrid/mcp`) is not going away - it is the right thing
for offline work, for enterprise machines that will not talk to a third-party
endpoint, and it is the only one of the two that can run the Svelte compiler.
This exists because stdio costs us the things that decide whether anyone finds
the server at all:

- one-click connector flows in the web and mobile clients only take a URL;
- no Node, no `claude_desktop_config.json` edit, no version pinning;
- **usage data**. stdio runs on someone else's laptop and tells us nothing.
  Here we can see which tools get called and which searches come back empty,
  which is the only honest input to what the server should do next.

## Endpoints

| Path | What it does |
| --- | --- |
| `POST /mcp` | The MCP endpoint. One JSON-RPC message in, one JSON response out. |
| `GET /mcp` | `405` - this server is stateless and offers no SSE stream. |
| `GET /` | Machine-readable summary: endpoint, tool names, connect snippets. |
| `GET /health` | `ok`. |
| `GET /_data/**` | The doc + demo corpus, served as static assets. Public on purpose. |

## Tools

Six, on purpose. The stdio server also carries 27 `studio_*` project-model
tools; those need a filesystem, and a model that just wants a data grid should
not spend context on an app builder it will never call.

| Tool | Purpose |
| --- | --- |
| `search` | Ranked full-text search over docs + demo metadata. |
| `fetch` | Full text for a result: a doc slug, or `demo:<id>`. |
| `list_examples` | Browse the demo catalogue by category. |
| `get_example_source` | The full `.svelte` source of one demo. |
| `get_api_reference` | The public API surface by category. |
| `check_svgrid_code` | Validate SvGrid code against the real exported surface. |

`search` and `fetch` are named that way deliberately: those two exact names are
what a connector needs to index this server.

`check_svgrid_code` runs the static half only here - a Worker has no Svelte
compiler - and its own `compiler: "unavailable"` field says so, so a caller
never mistakes it for a full compile. Run the npm server for that half.

## Connect

```bash
# Claude Code
claude mcp add --transport http svgrid https://mcp.svgrid.com/mcp
```

```jsonc
// Cursor / VS Code / anything taking an MCP config
{ "mcpServers": { "svgrid": { "url": "https://mcp.svgrid.com/mcp" } } }
```

## Develop

```bash
cd workers/svgrid-mcp
pnpm install --ignore-workspace   # workers/ is outside the pnpm workspace
pnpm --filter @svgrid/mcp build   # from the repo root: build:data reads its dist
pnpm dev                          # wrangler dev on :8787
```

`pnpm build:data` regenerates everything under `public/` and `src/generated/`,
both of which are gitignored - nothing there is written by hand. It also copies
`validate.js` and `search.js` out of the built npm package, so the validator and
the search ranking have exactly one implementation. Editing the copies is
pointless; they are overwritten on the next build.

Why copy instead of depend: `workers/` sits outside the pnpm workspace (as
`svgrid-vote` does), so `"@svgrid/mcp": "workspace:^"` cannot resolve here, and
a `file:` dependency dies on that package's own `workspace:^` deps.

### What goes where, and why

`packages/mcp` bundles the whole corpus (~6 MB) into its JavaScript. A Worker
cannot: that much object literal blows the startup CPU budget on every cold
start. So the split is:

- **bundled** (`src/generated/index.js`, ~150 KB): listings and the API surface,
  needed by `tools/list` and by every `check_svgrid_code` call.
- **assets** (`public/_data/`): doc bodies in one `docs.json`, and one file per
  demo source. Pulled through the `ASSETS` binding on first use and cached in
  module scope for the life of the isolate, so it is one fetch per cold start
  rather than one per call. A demo source never drags the other 372 with it.

The deployed script is ~49 KB gzipped.

## Deploy

```bash
pnpm deploy          # runs build:data, then wrangler deploy
```

Route it at `mcp.svgrid.com` by uncommenting the `[[routes]]` block in
`wrangler.toml` (the zone has to be on Cloudflare). Until then the
`*.workers.dev` URL works and clients can point at it.

Once it is live, advertise it in the official registry by adding a remote to
`packages/mcp/server.json`:

```json
"remotes": [{ "type": "streamable-http", "url": "https://mcp.svgrid.com/mcp" }]
```

Do that only after the URL answers - a registry entry pointing at a 404 is
worse than no entry.

## Logs

Every tool call logs one JSON line: tool name, duration, whether it succeeded,
and the query or id it was given. `check_svgrid_code` logs the **size** of the
submitted source and nothing else - the source itself is never logged. Read
them with `npx wrangler tail`, or in the dashboard (observability is on in
`wrangler.toml`).
