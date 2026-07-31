# SvGrid Agent Skill

An [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
that gives AI coding assistants (Claude Code, and any skill-aware client)
project-aware context for writing correct [SvGrid](https://svgrid.com)
code: the `ColumnDef` and `<SvGrid>` API, feature toggles, `--sg-*`
theming, server-side data, and the enterprise add-on — plus
correct-vs-incorrect patterns.

It complements the [`@svgrid/mcp`](../../packages/mcp) server: the skill is
the always-on knowledge and house style; the MCP server is the live,
version-pinned lookup (demos, docs, schemas).

## Install

With the [`skills`](https://www.npmjs.com/package/skills) CLI:

```bash
npx skills add sv-grid/sv-grid
# or: pnpm dlx skills add sv-grid/sv-grid
```

Or copy this folder into your project's skills directory:

```bash
cp -r skills/svgrid <your-project>/.claude/skills/svgrid
```

The skill activates automatically when you work in a project that imports
from `@svgrid/*`.

## Contents

| File | What it covers |
| --- | --- |
| `SKILL.md` | Entry point: project context, the minimal grid, critical rules, grounding, package boundary |
| `rules/columns.md` | `ColumnDef`, custom cells, widths, types, conditional formatting, editors |
| `rules/data-and-features.md` | Feature toggles, the `SvGridApi`, reactive data, server-side data source |
| `rules/theming.md` | `--sg-*` tokens, dark mode, design-system presets, the shadcn / Tailwind bridge |

## Keeping it accurate

The rules here are hand-maintained against the public API. For anything
version-specific, the skill points the model at the live grounding files
(`https://svgrid.com/llms.txt`, `/schemas/*.json`) and the `@svgrid/mcp`
tools, so answers track the installed version rather than this file's
snapshot.
