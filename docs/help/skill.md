# Agent Skill

The SvGrid **Agent Skill** gives AI coding assistants project-aware
context for writing correct SvGrid code. It is the always-on counterpart
to the [MCP server](./mcp-server.md): the skill carries the API surface and
house style so your assistant follows SvGrid's conventions without being
told, and the MCP server supplies live, version-pinned lookups on demand.

Skills are the [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
format - a `SKILL.md` file with a short description the client loads
automatically, plus reference files it reads when it needs detail. Claude
Code and other skill-aware clients pick it up with no per-prompt setup.

## What it knows

Once installed, the assistant has SvGrid's rules in context whenever you
work in a project that imports from `@svgrid/*`:

- **Project context** - it reads your `package.json` to see whether you
  have `@svgrid/grid` alone or `@svgrid/enterprise` too, confirms Svelte 5,
  and matches your existing theming convention instead of inventing one.
- **The API surface** - `ColumnDef` (every column needs a stable `id`),
  the `<SvGrid>` shortcut props (`sortable` / `filterable` / `pageable` /
  `editable` / `groupable` each inject their feature), the `SvGridApi` from
  `onApiReady`, and `createServerDataSource` for server-side data.
- **Theming** - `--sg-*` tokens, dark mode through your app's selector,
  the shipped design-system presets, and how to bridge to shadcn / Tailwind
  tokens. Never targeting mangled internal class names.
- **The package boundary** - enterprise symbols (`installEnterprise`,
  `setAIProvider`, pivot, export) never leak into a grid-only project.
- **Correct-vs-incorrect pairs** - the reference files show the wrong way
  and the right way side by side, so the model corrects itself.

Crucially, for anything version-specific the skill tells the model to
**look it up rather than guess** - fetching the grounding files or calling
the MCP tools - so its answers track the version you actually have
installed.

## Install

With the [`skills`](https://www.npmjs.com/package/skills) CLI, pointed at
the SvGrid repository:

```bash
npx skills add sv-grid/sv-grid
# or
pnpm dlx skills add sv-grid/sv-grid
```

That installs the skill into your project. Alternatively, copy the folder
straight into your project's skills directory:

```bash
cp -r skills/svgrid your-project/.claude/skills/svgrid
```

The skill lives at [`skills/svgrid/`](https://github.com/sv-grid/sv-grid/tree/main/skills/svgrid)
in the repo, so you can also read or fork it directly.

## What's inside

| File | Covers |
| --- | --- |
| `SKILL.md` | Entry point: project context, the minimal grid, critical rules, grounding, package boundary, scaffolding |
| `rules/columns.md` | `ColumnDef`, custom cell snippets, widths, `type`, conditional formatting, editors |
| `rules/data-and-features.md` | Feature toggles vs. shortcut props, the `SvGridApi`, reactive data, server-side data source |
| `rules/theming.md` | `--sg-*` tokens, dark mode, design-system presets, the shadcn / Tailwind bridge |

## Skill vs. MCP server vs. grounding files

SvGrid ships three ways to make an assistant write correct code; they
layer, they don't compete.

| | Agent Skill | [MCP server](./mcp-server.md) | [Grounding files](./llm-grounding.md) |
| --- | --- | --- | --- |
| **What it is** | Always-on rules + house style | Callable tools (docs, demos, schemas) | Static `llms.txt` / `docs.json` / schemas |
| **How it loads** | Auto, when a `@svgrid/*` project is detected | The model calls a tool | You paste or fetch the file |
| **Best for** | Following SvGrid conventions by default | Version-pinned lookups mid-task | Custom GPTs, rules files, your own agent |
| **Setup** | `npx skills add sv-grid/sv-grid` | One line of MCP config | Upload / fetch a URL |

A common setup is the skill **and** the MCP server: the skill keeps the
model on-convention, and the server answers "what's the exact signature of
`setFilter` in the version I have?" when it matters.

## See also

- [MCP server](./mcp-server.md) - callable tools for Claude Desktop / Cursor / Zed / Claude Code
- [LLM grounding](./llm-grounding.md) - the static files any model can read
- [AI Toolkit](./ai-toolkit.md) - the full build-time and runtime AI surface
- [Agents](./agents.md) - build an agent that drives the live grid
