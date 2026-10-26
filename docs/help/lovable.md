---
seoTitle: Lovable data grid - SvGrid, the Svelte grid, in React
seoDescription: Add a sortable, filterable, editable data grid to a Lovable app. One component that survives TanStack Start server rendering, shadcn theming, prompts and MCP setup.
keywords: lovable data grid, lovable table component, lovable react table, lovable tanstack start, lovable shadcn table, lovable mcp server, react data grid web component
---

# SvGrid in Lovable

Lovable builds React apps, so SvGrid goes in through `@svgrid/grid-wc`, the
web-component build of the grid with a React wrapper. It is the same grid as
the Svelte package, compiled into a custom element, so the React app needs no
Svelte toolchain.

One file does the integration: `DataGrid.tsx`, which loads the grid in the
browser only. Lovable's default template since May 2026 is TanStack Start,
which renders pages on the server, and a custom element has nothing to render
there. With `DataGrid` in place, everything else is ordinary props.

![The Lovable starter in dark mode: summary cards, grouping buttons with By status active, and the grid grouped into New, Refunded, Paid and Shipped rows with row counts, quantity and amount totals, in the app's own neutral shadcn palette.](/docs-media/ai-builders-lovable-dark.png)

## Start from a prompt

Lovable's [Build with URL](https://docs.lovable.dev/integrations/build-with-url)
opens a new project with a prompt already in the chat box. It waits for you
to press send. This prompt carries the `DataGrid` file and the theme block
verbatim, so the agent does not have to invent either:

```text
Build an orders admin page with a data grid.

Use SvGrid through the npm package @svgrid/grid-wc; its React wrapper is @svgrid/grid-wc/react. Do not install @svgrid/grid, which is the Svelte version.

1. Create src/components/DataGrid.tsx with exactly this code. It loads the grid in the browser only, because the grid is a custom element and this app renders on the server:

import { forwardRef, lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import type { SvGridHandle, SvGridProps } from '@svgrid/grid-wc/react'

const SvGrid = lazy(() => import('@svgrid/grid-wc/react').then((m) => ({ default: m.SvGrid })))

export type DataGridProps = Omit<SvGridProps, 'className' | 'style'> & {
  height?: CSSProperties['height']
  className?: string
  style?: CSSProperties
}

export const DataGrid = forwardRef<SvGridHandle, DataGridProps>(function DataGrid(
  { height = 480, className, style, ...props },
  ref,
) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <div className={`svgrid-theme ${className ?? ''}`.trim()} style={{ height, ...style }}>
      {mounted && (
        <Suspense fallback={null}>
          <SvGrid ref={ref} {...props} />
        </Suspense>
      )}
    </div>
  )
})

2. Never import @svgrid/grid-wc anywhere except DataGrid.tsx.

3. Add this to the main CSS file, after the shadcn variables, so the grid uses the app's colors and dark mode. If the variables hold bare HSL parts (0 0% 100%), wrap each as hsl(var(--background)):

.svgrid-theme {
  --sg-bg: var(--background);
  --sg-fg: var(--foreground);
  --sg-muted: var(--muted-foreground);
  --sg-border: var(--border);
  --sg-header-bg: var(--muted);
  --sg-header-fg: var(--muted-foreground);
  --sg-bg-subtle: var(--muted);
  --sg-muted-bg: var(--muted);
  --sg-row-alt-bg: var(--background);
  --sg-row-hover-bg: var(--accent);
  --sg-selection-bg: var(--accent);
  --sg-input-bg: var(--background);
  --sg-input-border: var(--input);
  --sg-accent: var(--primary);
  --sg-on-accent: var(--primary-foreground);
  --sg-focus-ring: var(--ring);
  --sg-radius: calc(var(--radius) - 2px);
}

4. Build an Orders page with 200 sample orders (id, customer, region, status: New/Paid/Shipped/Refunded, quantity, amount, orderedOn, priority). Render:
<DataGrid height={560} data={orders} columns={columns} getRowId={(row) => row.id} sortable filterable editable pageable pageSize={25} showRowSelection groupable />
Columns look like { field: 'amount', header: 'Amount', width: 130, align: 'right', editorType: 'number', format: { type: 'currency', currency: 'USD' } }. Region and status use editorType 'select' with editorOptions; priority uses editorType 'checkbox'.

5. The grid never changes the data array. In onCellValueChange(e) update state with e.row, e.columnId and e.newValue. Show the total amount of the selected rows in a card above the grid; onRowSelectionChange(e) gives e.rows.

Docs written for agents: https://svgrid.com/docs/help/lovable.md
```

[**Open this prompt in Lovable**](https://lovable.dev/#prompt=Build%20an%20orders%20admin%20page%20with%20a%20data%20grid.%0A%0AUse%20SvGrid%20through%20the%20npm%20package%20%40svgrid%2Fgrid-wc%3B%20its%20React%20wrapper%20is%20%40svgrid%2Fgrid-wc%2Freact.%20Do%20not%20install%20%40svgrid%2Fgrid%2C%20which%20is%20the%20Svelte%20version.%0A%0A1.%20Create%20src%2Fcomponents%2FDataGrid.tsx%20with%20exactly%20this%20code.%20It%20loads%20the%20grid%20in%20the%20browser%20only%2C%20because%20the%20grid%20is%20a%20custom%20element%20and%20this%20app%20renders%20on%20the%20server%3A%0A%0Aimport%20%7B%20forwardRef%2C%20lazy%2C%20Suspense%2C%20useEffect%2C%20useState%2C%20type%20CSSProperties%20%7D%20from%20%27react%27%0Aimport%20type%20%7B%20SvGridHandle%2C%20SvGridProps%20%7D%20from%20%27%40svgrid%2Fgrid-wc%2Freact%27%0A%0Aconst%20SvGrid%20%3D%20lazy%28%28%29%20%3D%3E%20import%28%27%40svgrid%2Fgrid-wc%2Freact%27%29.then%28%28m%29%20%3D%3E%20%28%7B%20default%3A%20m.SvGrid%20%7D%29%29%29%0A%0Aexport%20type%20DataGridProps%20%3D%20Omit%3CSvGridProps%2C%20%27className%27%20%7C%20%27style%27%3E%20%26%20%7B%0A%20%20height%3F%3A%20CSSProperties%5B%27height%27%5D%0A%20%20className%3F%3A%20string%0A%20%20style%3F%3A%20CSSProperties%0A%7D%0A%0Aexport%20const%20DataGrid%20%3D%20forwardRef%3CSvGridHandle%2C%20DataGridProps%3E%28function%20DataGrid%28%0A%20%20%7B%20height%20%3D%20480%2C%20className%2C%20style%2C%20...props%20%7D%2C%0A%20%20ref%2C%0A%29%20%7B%0A%20%20const%20%5Bmounted%2C%20setMounted%5D%20%3D%20useState%28false%29%0A%20%20useEffect%28%28%29%20%3D%3E%20setMounted%28true%29%2C%20%5B%5D%29%0A%20%20return%20%28%0A%20%20%20%20%3Cdiv%20className%3D%7B%60svgrid-theme%20%24%7BclassName%20%3F%3F%20%27%27%7D%60.trim%28%29%7D%20style%3D%7B%7B%20height%2C%20...style%20%7D%7D%3E%0A%20%20%20%20%20%20%7Bmounted%20%26%26%20%28%0A%20%20%20%20%20%20%20%20%3CSuspense%20fallback%3D%7Bnull%7D%3E%0A%20%20%20%20%20%20%20%20%20%20%3CSvGrid%20ref%3D%7Bref%7D%20%7B...props%7D%20%2F%3E%0A%20%20%20%20%20%20%20%20%3C%2FSuspense%3E%0A%20%20%20%20%20%20%29%7D%0A%20%20%20%20%3C%2Fdiv%3E%0A%20%20%29%0A%7D%29%0A%0A2.%20Never%20import%20%40svgrid%2Fgrid-wc%20anywhere%20except%20DataGrid.tsx.%0A%0A3.%20Add%20this%20to%20the%20main%20CSS%20file%2C%20after%20the%20shadcn%20variables%2C%20so%20the%20grid%20uses%20the%20app%27s%20colors%20and%20dark%20mode.%20If%20the%20variables%20hold%20bare%20HSL%20parts%20%280%200%25%20100%25%29%2C%20wrap%20each%20as%20hsl%28var%28--background%29%29%3A%0A%0A.svgrid-theme%20%7B%0A%20%20--sg-bg%3A%20var%28--background%29%3B%0A%20%20--sg-fg%3A%20var%28--foreground%29%3B%0A%20%20--sg-muted%3A%20var%28--muted-foreground%29%3B%0A%20%20--sg-border%3A%20var%28--border%29%3B%0A%20%20--sg-header-bg%3A%20var%28--muted%29%3B%0A%20%20--sg-header-fg%3A%20var%28--muted-foreground%29%3B%0A%20%20--sg-bg-subtle%3A%20var%28--muted%29%3B%0A%20%20--sg-muted-bg%3A%20var%28--muted%29%3B%0A%20%20--sg-row-alt-bg%3A%20var%28--background%29%3B%0A%20%20--sg-row-hover-bg%3A%20var%28--accent%29%3B%0A%20%20--sg-selection-bg%3A%20var%28--accent%29%3B%0A%20%20--sg-input-bg%3A%20var%28--background%29%3B%0A%20%20--sg-input-border%3A%20var%28--input%29%3B%0A%20%20--sg-accent%3A%20var%28--primary%29%3B%0A%20%20--sg-on-accent%3A%20var%28--primary-foreground%29%3B%0A%20%20--sg-focus-ring%3A%20var%28--ring%29%3B%0A%20%20--sg-radius%3A%20calc%28var%28--radius%29%20-%202px%29%3B%0A%7D%0A%0A4.%20Build%20an%20Orders%20page%20with%20200%20sample%20orders%20%28id%2C%20customer%2C%20region%2C%20status%3A%20New%2FPaid%2FShipped%2FRefunded%2C%20quantity%2C%20amount%2C%20orderedOn%2C%20priority%29.%20Render%3A%0A%3CDataGrid%20height%3D%7B560%7D%20data%3D%7Borders%7D%20columns%3D%7Bcolumns%7D%20getRowId%3D%7B%28row%29%20%3D%3E%20row.id%7D%20sortable%20filterable%20editable%20pageable%20pageSize%3D%7B25%7D%20showRowSelection%20groupable%20%2F%3E%0AColumns%20look%20like%20%7B%20field%3A%20%27amount%27%2C%20header%3A%20%27Amount%27%2C%20width%3A%20130%2C%20align%3A%20%27right%27%2C%20editorType%3A%20%27number%27%2C%20format%3A%20%7B%20type%3A%20%27currency%27%2C%20currency%3A%20%27USD%27%20%7D%20%7D.%20Region%20and%20status%20use%20editorType%20%27select%27%20with%20editorOptions%3B%20priority%20uses%20editorType%20%27checkbox%27.%0A%0A5.%20The%20grid%20never%20changes%20the%20data%20array.%20In%20onCellValueChange%28e%29%20update%20state%20with%20e.row%2C%20e.columnId%20and%20e.newValue.%20Show%20the%20total%20amount%20of%20the%20selected%20rows%20in%20a%20card%20above%20the%20grid%3B%20onRowSelectionChange%28e%29%20gives%20e.rows.%0A%0ADocs%20written%20for%20agents%3A%20https%3A%2F%2Fsvgrid.com%2Fdocs%2Fhelp%2Flovable.md)

What Lovable writes from a prompt varies from run to run. The starter below is
the tested reference: the same screen, with every file in place.

## Try the starter without Lovable

[**Open the starter in StackBlitz**](https://stackblitz.com/github/sv-grid/sv-grid/tree/main/templates/lovable-react-grid)
· [Source on GitHub](https://github.com/sv-grid/sv-grid/tree/main/templates/lovable-react-grid)

Lovable cannot import a GitHub repository, so the starter is a plain React +
Vite app you can run anywhere. It is laid out the way a Lovable project is
(`src/components`, `src/lib`, shadcn variables in `src/index.css`); the two
pieces to carry into Lovable are `src/components/DataGrid.tsx` and the
`.svgrid-theme` block.

![The React starter in light mode: Orders heading, cards for 240 orders, revenue and three selected rows, grouping buttons, and the grid with three rows ticked, the edited Amount cell focused and a pager reading 1 to 25 of 240.](/docs-media/ai-builders-lovable-starter.png)

## Why the grid waits for the browser

![On the server, TanStack Start renders DataGrid as an empty box of the grid's height and no grid code runs. In the browser React hydrates the same box, an effect marks the component mounted, it lazily imports @svgrid/grid-wc/react, which registers the sv-grid element, and the grid mounts with its props, themed through the svgrid-theme class.](/docs-media/ai-builders-lovable-ssr.svg)

The file, with its comments:

```tsx {nocheck}
import { forwardRef, lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import type { SvGridHandle, SvGridProps } from '@svgrid/grid-wc/react'

// Loaded on first render in the browser, never on the server.
const SvGrid = lazy(() => import('@svgrid/grid-wc/react').then((m) => ({ default: m.SvGrid })))

export type DataGridProps = Omit<SvGridProps, 'className' | 'style'> & {
  /** The grid fills this box, so the box needs a height. Default 480. */
  height?: CSSProperties['height']
  className?: string
  style?: CSSProperties
}

export const DataGrid = forwardRef<SvGridHandle, DataGridProps>(function DataGrid(
  { height = 480, className, style, ...props },
  ref,
) {
  // false on the server and on the first client render, so both emit the
  // same empty box: no hydration mismatch, no layout jump.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className={`svgrid-theme ${className ?? ''}`.trim()} style={{ height, ...style }}>
      {mounted && (
        <Suspense fallback={null}>
          <SvGrid ref={ref} {...props} />
        </Suspense>
      )}
    </div>
  )
})
```

Three things it settles:

- **Server rendering.** The `import type` line is erased at build time, and
  the real import runs inside `lazy`, which only fires in the browser.
  `@svgrid/grid-wc` 3.0.35 and earlier threw `customElements is not defined`
  when a server imported it; later releases guard that, but the grid still has
  nothing to draw on a server, so loading it in the browser stays the right
  call.
- **Height.** The grid fills its parent. `height` sizes the box on the server
  too, so the page does not jump when the grid arrives.
- **Props and the ref** pass straight through to the wrapper. Every prop on
  [SvGrid in React](./web-components/react.md) works, and `ref` gives you
  `api` and `element` once the grid has mounted.

## Match the app's theme

The grid draws with `--sg-*` CSS custom properties. Lovable apps keep their
palette in shadcn variables (`--background`, `--border`, `--primary`), with
dark mode as a `.dark` class on `<html>`. The `.svgrid-theme` block in the
prompt points one set at the other, so the grid follows the app's colors and
switches with its dark mode; `DataGrid` puts the class on its box.

The block assumes variables that hold whole colors, such as
`--background: oklch(1 0 0)`. Older shadcn projects store bare HSL parts,
`--background: 0 0% 100%`; there, write each value as
`hsl(var(--background))`.

To use one of the grid's own palettes instead, drop the block and set the
tokens yourself; [Theme and density](../getting-started/5-theme-and-density.md)
lists them.

## Ground the agent

### Project knowledge

**Project settings**, **Knowledge**. Project knowledge holds up to 10,000
characters; this is well under:

```md
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
```

It is the starter's `AGENTS.md` from the second heading down. Workspace
knowledge takes the same text if every project in the workspace should know it.

### The MCP server as a chat connector

**Connectors**, **Add custom**, **MCP server**:

| Field | Value |
| --- | --- |
| Server name | `svgrid` |
| Server URL | `https://mcp.svgrid.com/mcp` |
| Authentication | No authentication |

Lovable offers custom MCP servers on all plans. A chat connector feeds the
agent while it builds and is never part of the published app. The server is
public and read-only; its `search`, `get_api_reference` and
`get_example_source` tools answer the agent's API questions, and
`check_svgrid_code` checks a snippet. The examples it returns are Svelte, so
the knowledge block above is what keeps the agent on `DataGrid`.

## Troubleshooting

**`customElements is not defined` during server rendering.** Something
imports `@svgrid/grid-wc` outside `DataGrid.tsx`, usually a route file the
agent edited. Move the usage to `<DataGrid>`.

**The grid area stays empty.** Give `DataGrid` a `height`. Inside a flex
column, the box also needs `min-height: 0` to shrink.

**Columns show `[object Object]` or the grid is empty with no error.** The
code renders the raw `<sv-grid>` element in React 18 or earlier, which sets
arrays as attributes. Use `DataGrid`; the wrapper assigns them as properties.

**`pageSize` is ignored and the grid shows 10 rows a page.** A bug in the
React wrapper of `@svgrid/grid-wc` 3.0.35 and earlier, which assigned props
after the grid had mounted. Update the package.

**The agent installed `@svgrid/grid`.** That is the Svelte component and will
not render in React. Remove it and keep `@svgrid/grid-wc`; the knowledge block
prevents a repeat.

**Cells need a button or a badge.** A cell cannot render a React component.
Column `format` covers numbers, currency and dates; for more, see
[what crosses the boundary](./web-components/limitations.md).

## Frequently asked questions

### Can I use a data grid component in Lovable?

Yes. Install `@svgrid/grid-wc` and render it through a `DataGrid` component
that loads the grid in the browser only. Sorting, filtering, inline editing,
row selection, grouping and paging are boolean props.

### Does SvGrid work with TanStack Start server rendering?

Yes, through `DataGrid`. The server renders an empty box with the grid's
height and the browser loads the grid after hydration. Importing
`@svgrid/grid-wc` at the top of a route file throws
`customElements is not defined` on the server in versions 3.0.35 and earlier.

### Will the grid match my Lovable app's shadcn theme?

Yes. The `.svgrid-theme` block points the grid's `--sg-*` tokens at the shadcn
variables, so it follows the app's palette and its `.dark` mode.

### Is it free?

`@svgrid/grid-wc` is MIT and needs no key. Excel and PDF export, import and
pivot are in the paid `@svgrid/enterprise` package, which also runs from React.

## See also

- [SvGrid in AI app builders](./ai-app-builders.md) - Lovable and Bolt side by side
- [SvGrid in React](./web-components/react.md) - every prop, event and example of the wrapper
- [SvGrid in Bolt.new](./bolt-new.md) - the Svelte path
- [MCP server](./mcp-server.md) - the hosted endpoint and its tools
- [Web component limitations](./web-components/limitations.md)
