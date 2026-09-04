# MCP server

The SvGrid MCP server does two things for an AI client (Claude Code,
Claude Desktop, Cursor, Zed, Codex, custom agents): it answers questions
about SvGrid from the files this repository ships, and it **checks the
code the model writes** against the real exported surface of the version
you have installed. No API key either way.

![An AI coding agent calls the @svgrid/mcp server over the Model Context Protocol, which runs grid tools and returns structured JSON results back to the agent.](/docs-media/grid-mcp.svg)

> **What is MCP?** Model Context Protocol is the open standard
> ([modelcontextprotocol.io](https://modelcontextprotocol.io)) for
> exposing tools to LLM clients. SvGrid ships an MCP server so the
> model your team already uses can "see" the grid without you having
> to copy-paste docs into prompts.

It runs either way you like: as a local process
([`@svgrid/mcp`](https://www.npmjs.com/package/@svgrid/mcp) on npm), or as
a hosted endpoint at `https://mcp.svgrid.com/mcp` that needs no install at
all. Both are listed in the official MCP registry as `com.svgrid/svgrid`.

## Two ways to connect

**Hosted (nothing to install).** Point any MCP client at the URL:

```
https://mcp.svgrid.com/mcp
```

```bash
claude mcp add --transport http svgrid https://mcp.svgrid.com/mcp
```

One click:
[Add to Cursor](https://cursor.com/en/install-mcp?name=svgrid&config=eyJ1cmwiOiJodHRwczovL21jcC5zdmdyaWQuY29tL21jcCJ9)
· [Add to VS Code](https://insiders.vscode.dev/redirect/mcp/install?name=svgrid&config=%7B%22name%22%3A%22svgrid%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.svgrid.com%2Fmcp%22%7D)

It carries six tools - `search`, `fetch`, `list_examples`,
`get_example_source`, `get_api_reference` and `check_svgrid_code` - and
needs no Node, no config file, and no key.

**Local (`npx @svgrid/mcp`).** Everything the hosted server has, plus
the 27 `studio_*` tools, and `check_svgrid_code` additionally *compiles*
the file with the Svelte compiler rather than checking it statically.
Use it when you want the compile pass, the Studio tools, or no
third-party endpoint in the loop.

|  | Hosted | Local |
| --- | --- | --- |
| Setup | a URL | `npx @svgrid/mcp` |
| Needs Node | no | yes |
| `check_svgrid_code` compiles | no, static checks only | yes |
| `studio_*` tools | no | yes (27) |
| Works offline | no | yes |

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

The local server is a Node binary (`svgrid-mcp`) that speaks MCP over
stdio. There is no daemon to maintain. The hosted server needs no install
step at all - skip to [Wire it into your AI client](#wire-it-into-your-ai-client)
and use the URL.

## Wire it into your AI client

Every snippet below shows the local (stdio) form and the hosted (HTTP)
form. Pick one - running both connects the same tools twice.

### Claude Code

The plugin is the shortest path: it installs the
[Agent Skill](./skill.md) and the hosted server together, so the model
gets the house style *and* the checker in one step.

```
/plugin marketplace add sv-grid/sv-grid
/plugin install svgrid@svgrid
```

Or add the server on its own:

```bash
# hosted, nothing to install
claude mcp add --transport http svgrid https://mcp.svgrid.com/mcp

# or local
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

Or the hosted server, with nothing to install:

```json
{
  "mcpServers": {
    "svgrid": {
      "type": "http",
      "url": "https://mcp.svgrid.com/mcp"
    }
  }
}
```

Restart Claude Desktop, then ask *"using svgrid, build me a grid that
groups by department"* to confirm the tools are exposed.

### Cursor

One click:
[Add to Cursor](https://cursor.com/en/install-mcp?name=svgrid&config=eyJ1cmwiOiJodHRwczovL21jcC5zdmdyaWQuY29tL21jcCJ9)

Or by hand, in `Settings -> MCP -> Add new MCP server`:

```json
{ "url": "https://mcp.svgrid.com/mcp" }
```

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

One click:
[Add to VS Code](https://insiders.vscode.dev/redirect/mcp/install?name=svgrid&config=%7B%22name%22%3A%22svgrid%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.svgrid.com%2Fmcp%22%7D)

Or create `.vscode/mcp.json` in the workspace. Note that VS Code uses
`servers` rather than the `mcpServers` wrapper:

```json
{
  "servers": {
    "svgrid": {
      "type": "http",
      "url": "https://mcp.svgrid.com/mcp"
    }
  }
}
```

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

Point your client's MCP stdio transport at `npx -y @svgrid/mcp`, or its
streamable-HTTP transport at `https://mcp.svgrid.com/mcp`. Any client that
speaks either transport works.

The hosted server names its two retrieval tools `search` and `fetch`
exactly, which is what a connector needs to index it.

## Tools exposed

The **local** server registers 36 tools: 9 for verification,
documentation, examples, and scaffolding, plus 27 `studio_*` tools that
drive the SvGrid Studio project model. None require an API key.

The **hosted** server carries 6 of them: `check_svgrid_code`,
`list_examples`, `get_example_source`, `get_api_reference`, and the
retrieval pair `search` / `fetch` (which stand in for `search_docs`,
`list_docs` and `get_doc`). The Studio tools need a filesystem, so they
stay local - and a model that just wants a data grid should not spend
context on an app builder it will never call.

### Verification

#### `check_svgrid_code`

Checks a file **against the version you have installed** and returns
line-numbered diagnostics with the exact replacement for each. Run it
on SvGrid code before you accept it; fix what it reports and run it
again.

```ts
check_svgrid_code(source: string, filename?: string): string
```

```jsonc
{
  "ok": false,
  "checkedAgainst": "@svgrid/grid@2.6.20",
  "compiler": "svelte",
  "counts": { "errors": 2, "warnings": 0, "info": 0 },
  "diagnostics": [
    { "rule": "svgrid/renamed-prop", "severity": "error", "line": 24,
      "message": "`rowData` is not a SvGrid prop.", "fix": "Use `data`." },
    { "rule": "svgrid/renamed-column-key", "severity": "error", "line": 10,
      "message": "`accessorKey` is not a SvGrid column key.", "fix": "Use `field`." }
  ]
}
```

It checks four things:

- **Names, against the installed version.** Importable symbols,
  `<SvGrid>` props, `ColumnDef` keys, grid API methods, theme
  stylesheets. The list is generated from the package sources at build
  time, so it cannot drift from what the package exports; an unknown
  name comes back with the nearest real one.
- **Cross-package mistakes.** A symbol that lives in
  `@svgrid/enterprise`, or an api method that only exists after
  `installEnterprise(api)`.
- **Svelte 5 rules.** `export let` and `$:` in a runes file (compiler
  errors), `on:` / `<slot>` / `createEventDispatcher` (deprecations),
  and a plain `let` array that is mutated and so never re-renders.
- **The file, compiled.** When a Svelte compiler is reachable - your
  project's copy first, then the one bundled here - real parse errors
  come back too. The `compiler` field says which ran, so `"ok": true`
  is never mistaken for "this compiles".

It is tuned to stay silent on correct code: it reports nothing across
all 373 demos in the SvGrid repo, which a CI test asserts on every
commit. A checker that cries wolf is worse than none, because a model
will rewrite working code to satisfy it.

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

Ask your model: *"What MCP tools do you have from svgrid?"* The local
server answers with 36, including `check_svgrid_code` and the `studio_*`
set; the hosted server answers with 6.

Then give it something to catch:

> Check this with svgrid: `<SvGrid rowData={rows} {columns} />`

It should come back with `rowData` is not a SvGrid prop, use `data`. If
it explains the code instead of calling a tool, the server is not
connected.

If nothing is listed at all, check your client's MCP log. For the local
server the usual cause is `npx` not being on PATH - use the absolute path
to the binary. For the hosted one, confirm the endpoint answers:

```bash
curl https://mcp.svgrid.com/health
```

## Security model

The two ways of running it differ here, so pick deliberately.

**Local (`npx @svgrid/mcp`)**

- Runs on your machine over stdio. No telemetry, no outbound network
  calls, no API key.
- Serves a documentation and example corpus bundled into the package at
  build time, so answers are pinned to the version you installed.
- `check_svgrid_code` reads the source you pass it in-process and never
  sends it anywhere.

**Hosted (`https://mcp.svgrid.com/mcp`)**

- Your client sends tool arguments to a Cloudflare Worker we operate.
  Anything you pass to a tool leaves your machine, and for
  `check_svgrid_code` that means **the source you ask it to check**.
- Each call is logged: tool name, duration, whether it succeeded, and the
  query or id it was given. For `check_svgrid_code` only the **byte
  length** of the submitted source is recorded, never the source itself.
- No account, no key, no cookies. Requests are not tied to a user.
- If your code cannot leave the building, use the local server. That is
  what it is for.

**Both**

- The Studio tools return generated files as data. Writing them to disk
  is your client's decision, not the server's.
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

## Frequently asked questions

### What is the SvGrid MCP server?

A Model Context Protocol server that lets AI clients (Claude Code, Claude
Desktop, Cursor, Zed, custom agents) query SvGrid's documentation, read real
demo source, scaffold SvelteKit CRUD apps, and check the code they write
against the real API - grounded in the files the package ships, so the model
answers from current facts instead of guessing.

### Do I need an API key to run it?

No, on either transport. A `SVGRID_LICENSE_KEY` is optional and only affects
the commercial Studio code generators.

### Local or hosted - which should I use?

Hosted (`https://mcp.svgrid.com/mcp`) if you want it working in one paste,
with no Node and no config file. Local (`npx @svgrid/mcp`) if you want the
Svelte compiler pass in `check_svgrid_code`, the 27 Studio tools, offline
use, or your source never leaving the machine. See
[Security model](#security-model) for what each one sends.

### How does it help AI assistants write better SvGrid code?

Two ways. It exposes the docs, example sources, and API reference as tools,
so the assistant retrieves version-pinned answers instead of hallucinating an
API from training data. And `check_svgrid_code` closes the loop: the model
runs what it wrote past the real exported surface and gets told exactly what
is wrong before you see it. That matters most for Svelte 5, where models
routinely mix in outdated Svelte 4 syntax.

### Does it work with a version of SvGrid I have not upgraded to?

The local server answers for the version bundled in the `@svgrid/mcp` release
you install, so pin it alongside `@svgrid/grid` if you are behind. The hosted
server always tracks the current release. Either way, every
`check_svgrid_code` result names the version it checked against in its
`checkedAgainst` field.

## See also

- [Agent Skill](./skill.md) - the always-on house-style layer; the Claude Code plugin installs it together with this server
- [LLM grounding](./llm-grounding.md) - the same files used by the MCP server, but documented for direct LLM consumption
- [Agents](./agents.md) - how to build an AI agent that drives the live grid
- [AI assistant](./ai.md) - the in-grid AI features (filter / smart-fill / classify / summarise), free in @svgrid/grid
