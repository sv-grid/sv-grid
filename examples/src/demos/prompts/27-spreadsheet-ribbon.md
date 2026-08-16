# Prompt: 27-spreadsheet-ribbon

Source: `examples/src/demos/27-spreadsheet-ribbon.svelte`
Live:   https://svgrid.com/demos/27-spreadsheet-ribbon/

## What this demo proves

27. Spreadsheet - Excel-style ribbon bar + formulas
---------------------------------------------------
The grid driven by a custom UI shell: a four-tab ribbon, an Excel-
style right-click context menu, a clipboard buffer (cut/copy/paste),
and an embedded formula engine. Cells can hold either a literal
value OR a formula starting with `=`. The engine recomputes on every
change and surfaces error codes (`#REF!`, `#CYCLE!`, `#DIV/0!`,
`#VALUE!`, `#NAME?`, `#PARSE!`).

Ribbon
  Clipboard tab: cut / copy / paste / clear-contents
  Home tab:      bold, italic, strike, font family, font size, alignment
                 (L / C / R), text + fill colours, number format,
                 clear formatting
  Insert tab:    insert row above/below, delete row
  Data tab:      sort asc / desc, clear sort, clear all filters

Cell address space  (Excel-style A1)
  A   = Category
  B-M = Jan ... Dec
  Row 1 = first data row.   So `=SUM(B2:B5)` sums Jan values for
  the rows that are second through fifth in the underlying array.

Formula-on-edit
  Switch to a month cell, press F2 / Enter / start typing. If your
  text starts with `=`, it lands in the formula map and the cell
  displays the computed result. Otherwise it commits as a literal
  number. The formula bar above the grid lets you inspect or edit
  the active cell's formula at any time.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## SvGridApi methods called

- `api.addRow(...)`
- `api.clearAllFilters(...)`
- `api.clearSort(...)`
- `api.removeRow(...)`
- `api.setCellValue(...)`
- `api.setSort(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
