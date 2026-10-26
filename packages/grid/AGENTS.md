# @svgrid/grid - notes for coding agents

You are reading the copy that shipped with the installed version. The types
next to it are the API for exactly this version: `dist/index.d.ts` (entry),
`dist/SvGrid.types.d.ts` (every `<SvGrid>` prop, with JSDoc), and `src/` (the
source). Prefer them over anything you remember.

## Facts models get wrong

- **Svelte 5 only.** Runes (`$state`, `$derived`, `$props`) and snippets.
  Never `export let`, never Svelte 4 stores.
- **Callback props, not events.** `<SvGrid onCellClick={...}>`. An
  `on:cellClick` directive compiles and never fires; the grid dispatches no
  component events.
- **Columns** are `{ field, header }`. Not `key`, `title`, `headerName`,
  `accessorKey`. Type them with `GridColumns<Row>`.
- **Features are off until their prop is set:** `sortable`, `filterable`,
  `editable`, `groupable`, `pageable`. Selection is the exception:
  `selectionMode` defaults to `'both'` (cell ranges and the checkbox
  column); `selectionMode="none"` turns both off.
- **It is a library.** `import { SvGrid } from '@svgrid/grid'`; there is no
  "add component" step. Import paths are `@svgrid/grid`, its subpaths in
  `package.json` `exports`, and `@svgrid/grid/themes/<name>.css`.
  `svelte-grid`, `sv-grid` and `@sv-grid/*` are unrelated projects.
- **Theming** is `--sg-*` CSS custom properties, not utility classes.
- **The AI helpers are here, free:** `setAIProvider`, `aiFilter`,
  `aiSmartFill`, `aiSummarize`, `aiClassify`, `aiFindAnomalies`,
  `mockAIProvider`.
- **`@svgrid/enterprise`** (commercial) adds export to Excel and PDF,
  import, pivot, print, the Kanban board, scheduler and Gantt renderers, and
  the spreadsheet. Do not use its symbols in a project that does not depend
  on it.

## Smallest working grid

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { name: string; age: number }
  let rows: Person[] = $state([{ name: 'Ada', age: 36 }])
  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name' },
    { field: 'age', header: 'Age' },
  ]
</script>

<SvGrid data={rows} {columns} sortable filterable />
```

## Checking what you wrote

The SvGrid MCP server checks a file against the real API, compiles it and
returns a corrected copy: `npx -y @svgrid/mcp` (tool `svgrid_check_code`),
or the hosted `https://mcp.svgrid.com/mcp`. Docs as markdown:
<https://svgrid.com/llms.txt>; one export by name:
`https://svgrid.com/api/<name lowercased>.json`.
