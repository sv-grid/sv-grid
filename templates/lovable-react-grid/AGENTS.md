# AGENTS.md

React + Vite app. `src/App.tsx` is the orders screen,
`src/components/DataGrid.tsx` the grid component, `src/lib/orders.ts` the
sample data.

## Tables and data grids

This project uses SvGrid for tables and data grids, through `@svgrid/grid-wc`
(MIT), the web-component build with a React wrapper. For any table that sorts,
filters, edits, pages, groups or holds many rows, render `<DataGrid>` from
`src/components/DataGrid.tsx` instead of writing a table component.

- Never import `@svgrid/grid-wc` or `@svgrid/grid-wc/react` anywhere except
  `DataGrid.tsx`. The grid is a custom element; `DataGrid` loads it in the
  browser only, which keeps server rendering (TanStack Start, Next.js) working.
- Do not install `@svgrid/grid`. It is the Svelte component; this is a React app.
- Features are boolean props, all off by default:
  `<DataGrid data={rows} columns={columns} sortable filterable editable pageable height={520} />`.
- Columns: `{ field, header, width, align, editorType, editorOptions, format, aggregate }`.
  `editorType` is `'text' | 'number' | 'date' | 'select' | 'checkbox'`;
  `format` is for example `{ type: 'currency', currency: 'USD' }`.
- The grid does not write into `data`. Apply an edit in `onCellValueChange`
  (`e.row`, `e.columnId`, `e.newValue`) and save it there.
- Selected rows arrive in `onRowSelectionChange` as `e.rows` (with `showRowSelection`).
- `pageSize` is the initial page size, read once when the grid mounts.
- A cell cannot render a React component. Use column `format` for numbers,
  currency and dates.
- Colors come from the `--sg-*` custom properties. The `.svgrid-theme` block
  in `src/index.css` points them at the shadcn variables, so the grid follows
  the app's theme and `.dark`. Do not restyle the grid with Tailwind classes.
- Docs written for agents: https://svgrid.com/llms.txt and
  https://svgrid.com/docs/help/web-components/react.md
