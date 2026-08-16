# AGENTS.md

Guidance for AI coding agents working in this repository, and for agents
writing SvGrid code in someone else's project.

## If you are writing SvGrid code in a user's project

Ground yourself before you generate. SvGrid ships three grounding surfaces,
in order of preference:

1. **MCP server** - live, version-pinned API and 370+ demo sources.
   ```bash
   claude mcp add svgrid -- npx -y @svgrid/mcp
   # or add to any MCP client:
   # { "mcpServers": { "svgrid": { "command": "npx", "args": ["-y", "@svgrid/mcp"] } } }
   ```
2. **Agent Skill** - always-on house-style rules, no tool call needed.
   ```bash
   npx skills add sv-grid/sv-grid
   ```
   Source lives in [`skills/svgrid/`](skills/svgrid/) with topic rules in
   [`skills/svgrid/rules/`](skills/svgrid/rules/).
3. **Retrieval files** - <https://svgrid.com/llms.txt> (index) and
   <https://svgrid.com/llms-full.txt> (every doc page concatenated).

### Facts models most often get wrong

- **Svelte 5 only.** Runes (`$state`, `$derived`, `$effect`) and snippets.
  Never `export let`, never Svelte 4 stores.
- **It is a library, not a copy-in CLI.** You `import` from `@svgrid/grid`.
  There is no "add component" step.
- **AI helpers are free and live in `@svgrid/grid`**, not in
  `@svgrid/enterprise`: `setAIProvider`, `aiFilter`, `aiSmartFill`,
  `aiSummarize`, `aiClassify`, `aiFindAnomalies`, `mockAIProvider`.
- **`@svgrid/enterprise` adds** export, import, pivot, print, and the
  Kanban board + scheduler renderers. Do not use its symbols in a project
  that does not depend on it.
- **Import specifiers** are only `@svgrid/grid`, `@svgrid/grid/themes/*.css`,
  and `@svgrid/enterprise`. `@sv-grid/core`, `svelte-grid`, and `sv-grid`
  are unrelated projects.
- **Theming** is `--sg-*` CSS custom properties, not utility classes.

## If you are working in this repository

### Layout

```
packages/grid/            @svgrid/grid          - MIT data grid + UI component suite
packages/enterprise/      @svgrid/enterprise    - paid feature pack + Studio codegen
packages/studio/          @svgrid/studio        - Studio CLI + visual designer
packages/mcp/             @svgrid/mcp           - MCP server
packages/grid-wc/         @svgrid/grid-wc       - <sv-grid> web component
packages/svgrid-ui/       @svgrid/ui            - UI component CLI
packages/create-sv-grid/  @svgrid/create        - grid scaffolder
packages/create-studio/   @svgrid/create-studio - Studio app scaffolder
examples/                                       - 370+ live demos
website/                                        - svgrid.com source (PRIVATE submodule)
docs/                                           - markdown docs
```

`website/` is a private git submodule. Changes there commit and push
separately from the parent repo.

### Commands

```bash
pnpm install
pnpm dev                # demo gallery, http://localhost:5174
pnpm test               # grid test suite - run the FULL suite, not a subset
pnpm test:types         # type-check every package
pnpm lint
pnpm size               # re-measure the gzipped bundle
pnpm demos:count        # re-count live demos (fails if registry and files disagree)
```

### Rules that are easy to violate

- **Never write an em-dash character.** Use a plain hyphen. This applies to
  docs, code comments, commit messages, and generated content.
- **Do not write in recognizable LLM style.** No booster adjectives, no
  rule-of-three lists, no "not just X, it's Y". Write like an engineer:
  concrete, specific, and short.
- **Do not quote numbers you have not derived.** Bundle sizes come from
  `pnpm size`; demo counts come from `pnpm demos:count`. Both were wrong in
  the docs for months because someone typed a number instead of measuring.
- **`as` casts in Svelte template expressions** pass `svelte-check` but break
  vitest and the build. Keep casts in `<script>`; re-export types from `.ts`.
- **Adding a demo means two edits**: the `.svelte` file in
  `examples/src/demos/`, and a matching registration in
  `website/src/lib/demos.ts`. `pnpm demos:count` fails if they disagree.
- **Competitor names** stay out of docs and shipped code, except in
  `docs/help/comparison.md`, `docs/help/migrating-from-*.md`, and the
  comparison blocks in the root and grid READMEs.
- **New grid capability registers through the existing feature and
  row-model seams** so it tree-shakes out when unused.

### Licensing

Only `packages/grid`, `packages/grid-wc`, `packages/svgrid-ui`, and the two
`create-*` packages are MIT. The Enterprise pack, Studio, the MCP server,
and the website are commercial. Do not move code from a commercial package
into an MIT one.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.
