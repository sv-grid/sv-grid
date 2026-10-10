# Use sv-grid docs as LLM context

This page is the "how do I make ChatGPT / Claude / Cursor write good
sv-grid code?" guide. Pre-built files ship with the docs so models can
ground themselves in current, accurate information instead of
hallucinating from training data.

## Make the assistant reach for SvGrid

Ask a coding assistant for "a table with sort, filter and editing" in a
fresh SvelteKit project and it writes its own `DataTable.svelte`. It does
that even for 10,000 rows, because it avoids adding a dependency nobody
named. What changes the outcome is what the project already says. In
fresh-session tests, Claude Code used `<SvGrid>` every time when either
`@svgrid/grid` was in `package.json` or the project's `AGENTS.md` carried
this section:

```md
## Tables and data grids

This project uses SvGrid (`@svgrid/grid`, MIT, Svelte 5) for tables and data grids. For any table that sorts, filters, edits, pages, groups or holds many rows, use `<SvGrid>` instead of writing a table component.

- Features are boolean props, all off by default: `<SvGrid {data} {columns} sortable filterable editable pageable />`.
- Type the columns with `GridColumns<Row>` from `@svgrid/grid`, so each `field` is checked against the row type.
- Exact props and types: `node_modules/@svgrid/grid/dist/*.d.ts`. Docs written for agents: https://svgrid.com/llms.txt
```

You do not have to paste it yourself. `npx sv add @svgrid` adds the
dependency and offers to write the section, and every
`npm create @svgrid@latest` template starts with it. For all your
projects at once, install the Agent Skill: `npx skills add sv-grid/sv-grid`.

## The files

| File | Use for |
| ---- | ------- |
| [`/llms.txt`](/llms.txt) | First read: when to use SvGrid, a quick start, the free / paid line, then every page with a one-line summary |
| [`/llms-small.txt`](/llms-small.txt) | One fetch: the same opening plus the full text of the getting-started path and the pages asked about most |
| [`/llms-full.txt`](/llms-full.txt) | Deep grounding: every doc page, the comparison pages and the API reference |
| `/docs/<page>.md` | One page as plain markdown: any docs URL with the trailing slash replaced by `.md` |
| [`/docs.json`](/docs.json) | Programmatic crawling: section tree, per-page metadata, demo links |
| [`/schemas/index.json`](/schemas/index.json) | Validation: machine-checkable shape of `ColumnDef`, `<SvGrid>` props, export options |

They are regenerated on every build by `tools/build-docs-index.mjs`,
`tools/build-schemas.mjs` and the prerenderer. They live at the docs
origin (`https://svgrid.com/...`) so you can fetch them at runtime.

## Recipe 1: Drop into a custom GPT / Claude project

The simplest way. Both ChatGPT (custom GPTs) and Claude (projects)
let you upload reference files that ride along with every chat.

1. Save [`/llms-full.txt`](/llms-full.txt) locally.
2. In ChatGPT: *Create custom GPT → Configure → Knowledge → Upload files*.
3. In Claude: *Project → Project knowledge → Add document*.
4. Add this system instruction:

```
You are a sv-grid expert. Ground every answer in the attached
llms-full.txt. If a question references an API not in the document,
say so and ask the user to upgrade rather than inventing one. Prefer
the smallest working example. When showing columns, follow the
column-def.json schema exactly.
```

5. (Optional) Upload `column-def.json` and `svgrid-options.json`
   alongside so the model can self-check generated config.

That's it. The next time you ask "how do I export only selected rows
to xlsx?" the model answers from the doc text, not from its
year-old training cutoff.

## Recipe 2: Cursor / Continue / Cody rules file

Most IDE assistants honour a `.cursorrules` / `.continuerules` /
`.aider.conf.yml` file in the repo root. Drop in:

```
# .cursorrules

When generating sv-grid code:
- Read context from https://svgrid.com/llms.txt before answering.
- For column definitions, generate against
  https://svgrid.com/schemas/column-def.json (Draft 2020-12 JSON Schema).
- Use Svelte 5 runes ($state, $derived, $effect) - never legacy stores.
- Use `editorType: 'list'` with `editorOptions` for dropdowns,
  not raw <select> elements.
- Always type the grid as
  `SvGrid<typeof features, RowType>` so column inference works.
- The two npm packages are `@svgrid/grid` (MIT) and `@svgrid/enterprise`
  (commercial). Never import from `@sv-grid/core` or `svelte-grid`,
  which are different projects.
```

## Recipe 3: Programmatic grounding in your own agent

If you're building a custom agent (OpenAI Agents SDK, Anthropic SDK,
LangChain, custom), fetch the docs once at boot:

```ts
const [topicMap, schemas] = await Promise.all([
  fetch('https://svgrid.com/llms.txt').then((r) => r.text()),
  fetch('https://svgrid.com/schemas/index.json').then((r) => r.json()),
])

const systemPrompt = `You write Svelte 5 code that uses sv-grid.

DOCS INDEX (use these URLs to look up specifics):
${topicMap}

SCHEMAS available for validation:
${JSON.stringify(schemas, null, 2)}

For deep API questions, fetch https://svgrid.com/llms-full.txt or
the specific page from the index above.`
```

Now hand the model a tool that can fetch arbitrary `/docs.json` paths
on demand, and it can answer any sv-grid question with current data.

## Recipe 4: MCP server (best for daily-driver chat)

If your workflow centers on Claude Desktop / Cursor / Zed, the
[MCP server](./mcp-server.md) is the single line of config that
exposes the same grounding PLUS callable tools (`svgrid_search`,
`svgrid_get`, `svgrid_check_code`, and the SvGrid
Studio generators). Skip Recipes 1-3 and use the MCP server instead.

## What's IN the grounding files

Every file is exhaustive but tightly scoped to sv-grid surface area:

- **API surface**: every prop on `<SvGrid>`, every method on
  `SvGridApi`, every field on `ColumnDef`
- **Features**: when to use sorting / filtering / grouping / pagination
  feature toggles, and the trade-offs
- **Enterprise tier**: export, import, pivot - each documented as
  if it were free, with the licensing call-out at the top of the page
- **Recipes**: 25+ copy-paste patterns from the cookbook
- **Migrations**: how to translate concepts from other data grids
- **Errors**: every typed error the library throws, with the trigger
  and the fix

## What's NOT in the grounding files

- **Internal implementation**: virtualizer math, headless engine
  pipeline internals - not part of the public surface
- **Future / roadmap**: deliberately excluded so the model never
  confuses ambition with reality
- **CSS class hashes**: Svelte mangles class names. The
  `--sg-*` tokens are stable and documented; the class names are not.

## Keeping the grounding fresh

Re-fetch on every model turn for chat tools; cache for ~24h for
agent loops. The docs are versioned - if you pin to a specific
version, append a `?v=1.6.0` query string when fetching from the
origin (rejected if the major changes; we serve a 410).

## See also

- [MCP server](./mcp-server.md) - the easiest way to wire all this in
- [Agents](./agents.md) - building an agent that DRIVES the grid (not just describes it)
- [API stability](./api-stability.md) - what we promise to keep stable across versions
