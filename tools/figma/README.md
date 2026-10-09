# SvGrid Figma kit

Published on Figma Community: https://www.figma.com/community/file/1689644521333526144
(user docs: `docs/help/figma.md`).

A Figma development plugin that builds the SvGrid design kit into the open
Figma file. It is generated from this repo, so the kit tracks the code:
theme colors come from `resolveThemeTokens()` in
`packages/grid/src/themes/index.ts`, the same function that writes
`@svgrid/grid/themes/*.css`.

## Build and run

```bash
pnpm figma:build                              # Ember + shadcn/ui, light + dark
node tools/figma/build.mjs --themes=ember,material,excel
node tools/figma/build.mjs --themes=all       # every preset (needs a plan with enough modes)
```

The output is `tools/figma/dist/manifest.json` and `code.js`. In the Figma
desktop app, open a new design file, choose Plugins > Development > Import
plugin from manifest, and pick `dist/manifest.json`. Then run
"SvGrid Design Kit" from Plugins > Development.

Run it in an empty file the first time. The kit uses three pages, the most
Figma's Starter plan allows per file; it reuses the empty "Page 1". Running it
again updates the variables and styles in place by name and rebuilds the
three kit pages (Overview, Grid, Components). Rebuilt
components are new nodes, so instances of the old ones elsewhere in the same
file lose their main component. Publish the file as a library and update from
there instead of rebuilding a file people are already designing in.

## What it builds

- **Variables.** Collection `SvGrid`: one mode per theme and light/dark, one
  color variable per `--sg-*` token, plus radius and header weight. Code
  syntax is `var(--sg-...)`, so Dev Mode shows the CSS custom property.
  Collection `SvGrid density`: row height, header height and cell padding,
  with modes Default (what a project gets from a theme stylesheet alone:
  `rowHeight` 30, `--sg-cell-px` 7px) and Comfortable (the demo gallery's
  setting).
- **Styles.** Text styles and effect styles under `SvGrid/`.
- **Overview page.** A 1920x1080 cover (also set as the file thumbnail),
  a contents card, then every variable with its value per mode, grouped by
  role, the number variables, the type styles and the shadows.
- **Grid page.** Six groups:
  - Screens and examples: an Orders screen built only from kit instances,
    the example data grid, the same grid in every theme and in Comfortable
    density, and grouping, editing and menu states.
  - Header: header cell, column group headers, inline column filter,
    reorder drop marker.
  - Cells: body cell, badge cell, cell decorations (fill handle, note,
    chips, flash, loading placeholder), selection column, row numbers and
    detail toggle.
  - Rows: group and tree rows, pinned rows, summary cell, group footer,
    grand total.
  - Grid chrome: pager, toolbar, advanced filter chip, status bar, find bar,
    tool panel, filter row, scrollbar, loading bar, skeleton and empty rows,
    the Enterprise selection bar.
  - Menus: column menu, filter popover, context menu, operator menu,
    choose columns, cell tooltip, 13px grid icons.
- **Components page.** 37 component cards in seven groups:
  - Actions: button, toggle button, button group.
  - Inputs: text input, textarea, number input, select, tags input, date
    picker, slider.
  - Selection: checkbox, radio group, switch, segmented control, rating.
  - Navigation: tabs, breadcrumb, stepper, pagination, menu, accordion.
  - Data display: avatar and avatar group, badge, chip, kbd, stat, card.
  - Feedback: alert, toast, progress (linear and circular), spinner,
    skeleton, empty state.
  - Overlays: modal, drawer, popover, tooltip.

Every component sits on a documentation card: a summary, Svelte usage
(checked against `@svgrid/grid` with the MCP server's `svgrid_check_code`,
then against the component source, since the checker does not validate
snippet names), the props that change its look, the source file it was
measured from, and its variants as a labelled matrix in a Light panel and a
Dark panel. The Dark panel holds instances of the same components, themed;
the components themselves exist once.

All cards on a page sit in one vertical auto-layout column and share its
width. If a page fails to build, it shows an error card with the message and
the other pages still build.


## Checking changes

```bash
pnpm figma:check
node tools/figma/check.mjs --preview   # also writes dist/preview/*.html
node tools/figma/check.mjs --shots     # and screenshots them
```

`figma:check` type-checks the plugin against `@figma/plugin-typings`, then
runs the bundle against `mock-figma.mjs`, an in-memory Figma API that throws
where Figma throws (unloaded fonts, FILL outside auto-layout, unknown
component properties, appending into instances, the sync APIs that
`documentAccess: "dynamic-page"` disallows). It runs the plugin with unlimited modes,
then with the Starter plan's limits (one mode per collection, three pages per
file), then a second time in that same file to check a re-run reuses its
pages. It also asserts the page structure: one column per page and no empty
Light or Dark panel. The previews render auto-layout as flexbox; they are for
eyeballing and are not Figma's renderer.

Three Figma behaviors the mock copies because a real run showed them:
binding a color variable to a paint drops the paint's own opacity, so every
translucent color is an `alpha/<token>-<pct>` variable with the alpha in its
value (listed in `ALPHA` in `tokens.mjs`; the plugin throws on a missing
pair); node wrapper objects are not guaranteed to be identical between calls,
so the plugin matches nodes by `id`; and a component cannot be created inside
another component, so examples use instances of a part (the pager) instead of
building it again.

## Figma plan limits

The Starter plan allows one mode per collection and three pages per file.
The kit fits in three pages. For themes, the first mode (Ember Light) goes in
`SvGrid`, and every theme the plan refuses as a mode gets its own one-mode
collection, `SvGrid / Ember Dark` and so on, with the same variable names and
code syntax. Dark panels and theme copies are re-pointed at those variables,
so they stay variable-bound. The Comfortable density copy needs a second mode
and is left out on Starter. On a Professional team every theme is a mode of
`SvGrid` and nothing is re-pointed.

`node tools/figma/check.mjs --starter --shots` previews the Starter build.

## Known differences from the browser

- Inter stands in for the `ui-sans-serif, system-ui` stack.
- The grid inherits the host page's font size. The kit uses 13px, which is
  what the grid's own chrome uses (pager, menus, filter inputs).
- Heights assume a border-box reset. Without one, the text input, the date
  picker field and the radio dot render 2px taller.
- Alert icons and pager arrows are text glyphs in the CSS and render in Inter
  here.
- The text input has no `::placeholder` rule. The kit draws placeholders in
  `text/muted`.
- Focus rings that sit outside a box use the first mode's radius for their
  outer corner, since an offset radius cannot bind to a variable.
- The filter row splits operator and value 2:3 in CSS. In the kit the value
  fills the remaining width.

## Files

| File | Role |
|---|---|
| `build.mjs` | Resolves tokens per theme and bundles `src/` with esbuild |
| `tokens.mjs` | Variable names, groups, CSS fallbacks and derived `color-mix()` values |
| `src/lib.ts` | Variables, bound paints, auto-layout, text, icons, component helpers |
| `src/grid.ts` | Grid parts and the example grids |
| `src/ui.ts` | UI kit components, first half, and the Components page order |
| `src/ui2.ts` | UI kit components, second half |
| `src/fields.ts` | Shared sizes and the SvField frame |
| `src/foundations.ts` | Foundations page |
| `src/icons.ts` | SVG sources, copied from the components |
| `mock-figma.mjs` | Strict Figma API mock and HTML renderer |
| `check.mjs` | Build, run in the mock, preview |
