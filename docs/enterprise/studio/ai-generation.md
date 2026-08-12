# AI generation

The `@svgrid/mcp` server exposes Studio to AI coding agents (Claude Code, Cursor,
Codex, ...) through the Model Context Protocol. Ask your agent to build a screen
for a table and it introspects, scaffolds, and verifies - producing the same code
the [CLI](./cli.md) and [designer](./designer.md) do.

![The generated files: schema module, +server.ts API route, and +page.svelte screen, with svgrid:managed markers.](/docs-media/studio-generated-code.png)

## How it fits together

The MCP server makes **no model calls of its own**. It hands your agent a set of
tools; the agent's own model decides when to call them. So the loop is:

```
you  ->  your agent (its model)  ->  svgrid MCP tools  ->  files on disk
                    ^                                          |
                    +--------  svelte-check verify  <----------+
```

Your schema and data stay on your machine; nothing is sent to our servers.

## Configure the MCP server

Add it to your agent's MCP config (the key is passed as an env var, since the
server runs in a Node process):

```jsonc
{
  "mcpServers": {
    "svgrid": {
      "command": "npx",
      "args": ["@svgrid/mcp"],
      "env": { "SVGRID_LICENSE_KEY": "SVENTERPRISE-..." }
    }
  }
}
```

The same block works across hosts - only the file it lives in differs:

| Host | Config location |
| --- | --- |
| Claude Code | `.mcp.json` at the project root, or `claude mcp add` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Codex / other | the host's `mcpServers` config |

Restart (or reload) the agent so it picks up the server, then confirm the
`svgrid` tools are listed.

## The tools

Alongside the read-only knowledge tools (examples, docs, API reference), the
server exposes two generation tools:

| Tool | What it does |
| --- | --- |
| `introspect_source` | Infer an `EntitySchema` from a Drizzle schema file (`kind:"drizzle"`) or sample JSON rows (`kind:"json"`). Returns a **draft** to review. |
| `scaffold_entity` | Generate the SvelteKit files from an `EntitySchema`. The output is **compile-verified** (the generated page is run through the Svelte compiler) before it comes back, and each file carries `svgrid:managed` markers. |

## Drive the whole project model

Beyond single screens, the server exposes the full
[project model](./concepts.md#the-project-model) - the same
`studio.config.json` the visual designer edits - as a set of `studio_*` tools.
Your agent can build a complete multi-screen app, or continue editing one the
designer produced, and hand it back:

| Tool | What it does |
| --- | --- |
| `studio_new_project` | Start a new, empty project |
| `studio_load_project` | Load an existing `studio.config.json` to continue editing it |
| `studio_describe_project` | Summarize the current project: entities, screens + block ids, theme, RBAC, auth, deploy |
| `studio_get_config` | Return the project as a `studio.config.json` string - write it to disk and the designer opens it (round-trip) |
| `studio_capabilities` | List what can be added: block kinds, UI component keys, theme presets, source kinds, deploy targets |
| `studio_add_entity` | Add an entity + its default screen, from an `EntitySchema`, a Drizzle source, or sample JSON rows |
| `studio_add_screen` | Add an entity-bound screen (default grid) or a freestanding page |
| `studio_add_block` | Add a data block (grid, chart, kpi, gauge, tree, tabs, accordion, pivot, board, calendar, detail, master-detail, filter, record, lookup, dashboard) to a screen |
| `studio_add_component` | Add a UI component block (button, badge, alert, card, stat, timeline, sparkline, chip, ...) with prop overrides |
| `studio_set_entity_source` | Bind an entity to a data source: `sql`, `supabase`, `rest`, `pglite`, or `memory` |
| `studio_set_theme` | Set the theme preset, light/dark mode, and accent color |
| `studio_set_access` | Configure [RBAC](./access-control.md): roles gating screens and create/update/delete actions |
| `studio_set_auth` | Configure the [auth starter](./auth.md): protect, register, user admin, 2FA, email, OAuth (`github` / `google` / `oidc`) |
| `studio_set_data_layer` | Turn the typed Drizzle data layer (schema + repositories + migrations) on or off |
| `studio_set_deploy_target` | Set `auto` / `vercel` / `netlify` / `cloudflare` / `node` - picks the adapter and emits CI/CD config |
| `studio_validate` | Validate the current project; returns errors + warnings |
| `studio_generate_app` | Emit the full runnable SvelteKit app - every file, ready to write and `svelte-check` |

A prompt that exercises the loop end to end:

> "Using the svgrid MCP: new project 'Support desk'. Add a `tickets` entity from
> these sample rows, a dashboard screen with a KPI and a chart over tickets,
> RBAC with an agent role that cannot delete, dark theme, then validate and
> generate the app."

## Step by step

1. **Point it at a source.** A Drizzle schema file, or a handful of sample rows.
2. **Introspect.** The agent calls `introspect_source` and shows you the drafted
   `EntitySchema` - field names, types, primary key, guessed formats.
3. **Refine (optional).** Correct a type, mark a field hidden or read-only, add
   validation - in chat, or later in the [visual designer](./app-designer.md).
4. **Scaffold.** The agent calls `scaffold_entity`; the files come back already
   run through the Svelte compiler.
5. **Verify.** The agent runs your project's `svelte-check`; if anything fails it
   iterates. This is the loop that keeps AI output trustworthy.

## Prompts that work

From a Drizzle schema:

> "Using the svgrid MCP, build a CRUD screen for the `customers` table in
> `src/lib/db/schema.ts`."

From sample data, when there is no schema yet:

> "Here are five example rows of our invoices. Use the svgrid MCP to introspect a
> schema, then scaffold a CRUD screen at `/invoices`."
>
> ```json
> [{ "id": "INV-1", "customer": "Acme", "amount": 4200, "paid": true, "due": "2026-07-01" }]
> ```

Refining before you commit:

> "Show me the drafted schema first. Mark `internalNotes` hidden, make `email`
> required, and set `status` to an enum of draft/sent/paid before scaffolding."

## What comes back

`scaffold_entity` writes three files (the same layout as the CLI and designer):

```
src/lib/customers.schema.ts     # the EntitySchema + row type
src/routes/api/customers/+server.ts  # createKitHandlers data endpoint
src/routes/customers/+page.svelte    # the grid + edit-panel screen
```

Each carries `svgrid:managed` markers so a re-generation updates the managed
regions and leaves your hand-written code untouched. See
[code generation](./code-generation.md) for the anatomy of each file.

## Bring your own key

The generator uses **your** agent's model and API key - your schema and data
never touch our servers. The MCP server itself makes no model calls; it provides
introspection + scaffolding + verification tools that the host agent drives.

## Licensing

Generation is soft-gated: it runs unlicensed and prepends a one-line commercial
notice, and the generated app carries the usual watermark until you call
`setLicenseKey()`. Set `SVGRID_LICENSE_KEY` in the MCP config to license it. See
[licensing](../licensing.md#studio-data-app-generator).

## See also

- [The Studio CLI](./cli.md) - the deterministic, no-AI path
- [Visual app designer](./app-designer.md) - refine an AI draft by hand before generating
- [Code generation](./code-generation.md) - the anatomy of the emitted files
- [MCP server](../../help/mcp-server.md) - full MCP reference
