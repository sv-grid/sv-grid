# Concepts

The mental model behind Studio: one `EntitySchema` drives the screens, the data
binding, and the generated code. This page walks that pipeline once, defines
every Studio term, and ends with a table for picking which build tool fits how
you work. Ten minutes here makes every other Studio page shorter.

![One EntitySchema drives the grid, edit form, dashboard, generated app, and every data source; author it with the visual designer, the CLI, or the AI generator.](/docs-media/studio-architecture.svg)

## The pipeline

Everything in Studio is one flow, left to right:

1. **An `EntitySchema` describes your data.** Field names, types, validation,
   labels, relations. You get one by introspection (a live database table, a
   Drizzle or Prisma schema file, an OpenAPI spec, a CSV, sample JSON) or by
   authoring it in the designer. See [The EntitySchema](./schema.md).
2. **Screens arrange blocks over entities.** A screen is one route in your app.
   It holds blocks - a grid, a chart, a KPI tile, a board, a calendar - each
   bound to an entity. The visual [app designer](./app-designer.md) is where
   you compose them; the CLI and AI produce the same structures.
3. **A `ServerDataSource` moves the data.** Read, create, update, delete - one
   small contract that every backend implements (SQL databases, Supabase,
   REST, in-memory, Postgres-in-the-browser). Sorting, filtering, paging, and
   editing work identically no matter where the data lives. See
   [Data binding](./data-binding.md).
4. **Codegen writes real SvelteKit files.** The schema, a `+server.ts` API
   route, and a `+page.svelte` screen - plain code you own, no runtime, no
   proprietary host. Generated sections sit inside `svgrid:managed` region
   markers, so re-generating updates them without touching your edits. See
   [Code generation](./code-generation.md).

![How a grid request flows: the grid emits sort / filter / page events, the ServerDataSource turns them into one query, the backend answers with rows + count.](/docs-media/studio-data-flow.svg)

A change flows forward automatically: add a field to the schema and the grid
column, the form input, its validation, and the generated code all pick it up.

## The project model

The designer edits a single JSON document - the **project** - with this shape:

- **project** - title, theme, default data source, plus optional
  [auth](./auth.md), [access control](./access-control.md),
  [audit](./audit-log.md), [i18n](./i18n.md), and deploy settings.
  - **entities** - one `EntitySchema` per table / collection.
  - **screens** - one per route. Each screen has:
    - **blocks** - the data-bound building pieces (grid, form, chart,
      dashboard, kpi, gauge, tree, tabs, accordion, master-detail, lookup,
      pivot, filter, record, board, calendar, detail, component).
    - a **layout** - `grid` (12-column flow, the default), `stack`, `split`
      (resizable panes), `dock` (dockable / floatable panes, see
      [Dock layout](./dock-layout.md)), or `canvas` (free-form placement on a
      12-column cell grid).
    - a **render mode** - `spa` (default; the page fetches through the data
      source in the browser) or `ssr` (emits idiomatic SvelteKit
      `+page.server.ts` load + form actions).
    - optional **code-behind** - a user-owned `handlers.ts` companion for
      event handlers, written once and never regenerated.

When you run the [local designer](./launch.md), the project auto-saves to
`studio.config.json` in your working folder as you edit; **Generate app** turns
it into the SvelteKit project. The same file is what the
[MCP tools](./ai-generation.md) read and write, so a coding agent and the
designer can work on one project interchangeably.

## Glossary

| Term | Meaning |
| --- | --- |
| **EntitySchema** | The model of one entity: fields, types, validation, labels, relations. Everything else derives from it. [Schema](./schema.md) |
| **Screen** | One route / page of the generated app; holds blocks and a layout. [App designer](./app-designer.md) |
| **Block** | A data-bound piece placed on a screen: grid, chart, KPI, board, calendar, and so on. [App designer](./app-designer.md) |
| **Companion block** | A block that works alongside a grid on the same screen and shares its data, like a filter panel or a record panel. [App designer](./app-designer.md) |
| **Project model** | The single JSON document (`studio.config.json`) holding entities, screens, sources, theme, auth. This page, above |
| **ServerDataSource** | The read + create + update + delete contract every backend implements. [Data binding](./data-binding.md) |
| **Managed region** | A `svgrid:managed` marker pair in a generated file; regeneration rewrites only what is inside. [Code generation](./code-generation.md) |
| **Code-behind** | A user-owned `handlers.ts` next to a generated screen for typed event handlers; created once, never overwritten. [Code-behind](./code-behind.md) |
| **Scaffold** | The codegen step: schema in, SvelteKit files out. Shared by the CLI, the designer, and the AI path. [CLI](./cli.md) |
| **Introspection** | Reading an existing source (database table, Drizzle / Prisma schema, OpenAPI spec, CSV) to produce an `EntitySchema`. [Databases](./databases.md) |
| **Soft gate** | Enterprise licensing without a hard stop: unlicensed use shows a watermark and a console notice, nothing breaks. [Licensing](../licensing.md) |

## Which tool when

All three build paths share one scaffold core and produce the same output, so
this is a workflow choice, not a feature choice - and you can switch anytime.

| Tool | Pick it if | Page |
| --- | --- | --- |
| **CLI** - `npx @svgrid/studio add ...` | you want one deterministic command per screen, in scripts or CI, no AI involved | [The Studio CLI](./cli.md) |
| **AI via MCP** - `@svgrid/mcp` | you already work in a coding agent (Claude Code, Cursor, ...) and want to describe screens in plain language | [AI generation](./ai-generation.md) |
| **Visual designer** - `npx @svgrid/studio designer` | you want to see the app while composing it, or you are not writing code at all | [Visual app designer](./app-designer.md) |

## See also

- [Getting started](./getting-started.md) - build your first screen step by step
- [Data binding](./data-binding.md) - the `ServerDataSource` contract in detail
- [Code generation](./code-generation.md) - the emitted files and safe regeneration
