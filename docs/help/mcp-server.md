# MCP server

The SvGrid MCP server lets AI clients (Claude Code, Claude Desktop,
Cursor, Zed, Codex, custom agents) query the documentation, read real
demo source, and scaffold SvelteKit CRUD apps - all grounded in the
files this repository ships. No API key required; everything runs
locally over stdio.

![An AI coding agent calls the @svgrid/mcp server over the Model Context Protocol, which runs grid tools and returns structured JSON results back to the agent.](/docs-media/grid-mcp.svg)

> **What is MCP?** Model Context Protocol is the open standard
> ([modelcontextprotocol.io](https://modelcontextprotocol.io)) for
> exposing tools to LLM clients. SvGrid ships an MCP server so the
> model your team already uses can "see" the grid without you having
> to copy-paste docs into prompts.

The package is [`@svgrid/mcp`](https://www.npmjs.com/package/@svgrid/mcp)
on npm, and it is listed in the official MCP registry as
`com.svgrid/svgrid`.

## Install

No install step is required - `npx` fetches it on demand:

```bash
# One-shot, from any project
npx -y @svgrid/mcp
```

To pin it as a dev dependency instead:

```bash
pnpm add -D @svgrid/mcp
```

The server is a Node binary (`svgrid-mcp`) that speaks MCP over stdio.
There is no daemon to maintain.

## Wire it into your AI client

### Claude Code

One command:

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
```

Then run `/mcp` in a session and you will see `svgrid` listed.

To share the server with your team, add `--scope project`. That writes
a `.mcp.json` at the repository root which you can commit, so everyone
who clones the repo gets the same tooling with no per-machine setup:

```bash
claude mcp add svgrid --scope project -- npx -y @svgrid/mcp
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop, then ask *"using svgrid, build me a grid that
groups by department"* to confirm the tools are exposed.

### Cursor

`Settings -> MCP -> Add new MCP server`:

```json
{ "command": "npx", "args": ["-y", "@svgrid/mcp"] }
```

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "svgrid": {
      "command": "npx",
      "args": ["-y", "@svgrid/mcp"],
      "env": {}
    }
  }
}
```

### VS Code

Create `.vscode/mcp.json` in the workspace. Note that VS Code uses
`servers` rather than the `mcpServers` wrapper:

```json
{
  "servers": {
    "svgrid": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@svgrid/mcp"]
    }
  }
}
```

### Custom agents (OpenAI Agents SDK, Anthropic SDK, LangChain)

Point your client's MCP stdio transport at:

```
npx -y @svgrid/mcp
```

Any client that speaks MCP stdio works.

## Tools exposed

The server registers 35 tools: 8 for documentation, examples, and
scaffolding, plus 27 `studio_*` tools that drive the SvGrid Studio
project model. All run locally; none require an API key or a network
call.

### Documentation and examples

These six are free and need no license key.

#### `list_examples`

List every demo with `id`, `title`, and a one-line blurb. Use it to
discover what exists before fetching source.

```ts
list_examples(): Array<{ id, title, blurb, path }>
```

#### `get_example_source`

Return the full `.svelte` source of one demo, verbatim, including
imports - the same file a user would copy into a project.

```ts
get_example_source({ id: '11-stock-market' }): string
```

#### `list_docs`

List every documentation page with slug and title. Slugs use forward
slashes, for example `help/columns/column-definitions`.

```ts
list_docs(): Array<{ slug, title }>
```

#### `get_doc`

Return the markdown of a single page by slug.

```ts
get_doc({ slug: 'getting-started' }): string
```

#### `search_docs`

Case-insensitive substring search across all docs. Returns matching
slugs with a one-line excerpt around the first hit.

`limit` is optional and defaults to 10.

```ts
search_docs({ query: 'row virtualization', limit: 10 })
```

#### `get_api_reference`

The curated public-API surface, grouped by category (components,
headless, scheduler, data ops, export, row models, features,
virtualization, accessibility, utilities).

```ts
get_api_reference(): string
```

### SvGrid Studio (commercial)

These tools generate application code. They still run without a
license key, but generated files are prefixed with a comment pointing
at [pricing](https://svgrid.com/pricing/). Set `SVGRID_LICENSE_KEY` in
the MCP server's environment for licensed use (see
[Licensing](#licensing) below).

#### `introspect_source`

Infer a draft `EntitySchema` from a data source: either a Drizzle
schema file (`kind: "drizzle"`, `source`: the file text) or sample
rows (`kind: "json"`, `rows`, `name`). Review and refine the draft
before scaffolding.

```ts
introspect_source({ kind: 'drizzle', source: '...' })
introspect_source({ kind: 'json', rows: [...], name: 'orders' })
```

#### `scaffold_entity`

Generate runnable SvelteKit files from an `EntitySchema`: the `$lib`
schema module, a `+server.ts` API route using `createKitHandlers`, and
a `+page.svelte` with `SvGrid` and `SvGridEditPanel`.

`route` defaults to the schema name and `apiRoute` to `/api/{route}`.

```ts {nocheck}
scaffold_entity(args: {
  schema: EntitySchema
  route?: string
  apiRoute?: string
}): Array<{ path: string; contents: string; description: string }>
```

Generated bodies are wrapped in `svgrid:managed` markers, so
regeneration preserves your edits outside them. After writing the
files, run the project's own `svelte-check` or `tsc` to verify they
compile.

#### The `studio_*` tools

27 tools let an agent build and edit the same validated project model
the visual designer uses, then generate the app:

| Area | Tools |
| ---- | ----- |
| Project | `studio_new_project`, `studio_load_project`, `studio_describe_project`, `studio_validate`, `studio_capabilities`, `studio_get_config`, `studio_generate_app` |
| Entities | `studio_add_entity`, `studio_set_entity_source` |
| Screens | `studio_add_screen`, `studio_update_screen`, `studio_remove_screen`, `studio_set_screen_layout` |
| Blocks and components | `studio_add_block`, `studio_update_block`, `studio_move_block`, `studio_remove_block`, `studio_add_component` |
| Forms | `studio_set_form_layout`, `studio_set_field_conditions` |
| Platform | `studio_set_auth`, `studio_set_access`, `studio_set_tenancy`, `studio_set_data_layer`, `studio_set_deploy_target`, `studio_set_theme`, `studio_set_job` |

Call `studio_capabilities` first: it reports exactly what the
installed version supports, so the agent does not have to guess.

## Licensing

The documentation and example tools are free. The Studio code
generators are part of the commercial offering: they run unlicensed,
but prepend a notice comment to generated files. To license them, set
the key in your MCP client's server config:

```json
{
  "mcpServers": {
    "svgrid": {
      "command": "npx",
      "args": ["-y", "@svgrid/mcp"],
      "env": { "SVGRID_LICENSE_KEY": "SVENTERPRISE-..." }
    }
  }
}
```

## Verifying it works

After wiring the server, ask your model: *"What MCP tools do you have
from svgrid?"* You should see the documentation tools and the
`studio_*` set. If not, check your client's MCP log; the most common
issue is `npx` not being on PATH (use the absolute path to the binary
instead).

## Security model

- The server runs **locally** over stdio. No telemetry, no outbound
  network calls, no API key.
- It serves a documentation and example corpus bundled into the
  package at build time, so answers are pinned to the version you
  installed.
- The Studio tools return generated files as data. Writing them to
  disk is your client's decision, not the server's.
- See [security](./security.md) for the general supply-chain posture.

## Building your own MCP integrations

The same docs manifest, JSON Schemas, and `llms.txt` files are also
served directly from the docs site:

```ts
const docs    = await fetch('https://svgrid.com/docs.json').then((r) => r.json())
const schemas = await fetch('https://svgrid.com/schemas/index.json').then((r) => r.json())
const llms    = await fetch('https://svgrid.com/llms-full.txt').then((r) => r.text())
```

If you do not want to run the MCP server, building these into your
agent's system prompt gives most of the same grounding.

## See also

- [LLM grounding](./llm-grounding.md) - the same files used by the MCP server, but documented for direct LLM consumption
- [Agents](./agents.md) - how to build an AI agent that drives the live grid
- [AI assistant](./ai.md) - the in-grid AI features (filter / smart-fill / classify / summarise), free in @svgrid/grid

## Frequently asked questions

### What is the SvGrid MCP server?

A Model Context Protocol server that lets AI clients (Claude Code, Claude
Desktop, Cursor, Zed, custom agents) query SvGrid's documentation, read real
demo source, and scaffold SvelteKit CRUD apps - grounded in the files the
package ships, so the model answers from current facts instead of guessing.

### Do I need an API key to run it?

No. The MCP server runs locally over stdio. There is no key and no external
call. A `SVGRID_LICENSE_KEY` is optional and only affects the commercial
Studio code generators.

### How does it help AI assistants write better SvGrid code?

It exposes example sources, the docs, and the API reference as MCP tools, so
the assistant retrieves accurate, version-pinned answers rather than
hallucinating an API from training data. That matters most for Svelte 5, where
models routinely mix in outdated Svelte 4 syntax.
