# Prompt: 83-spreadsheet-formulas

Source: `examples/src/demos/83-spreadsheet-formulas.svelte`
Live:   https://svgrid.com/demos/83-spreadsheet-formulas/

## What this demo proves

83. Spreadsheet formulas
------------------------
SvGrid driving a real spreadsheet: cells can hold either a literal
value (number, string, boolean) or a formula starting with `=`. The
embedded engine supports:

  - Cell refs:       A1, B2, AA10, $C$3 (absolute - same evaluation here)
  - Ranges:          A1:A10, B2:D5
  - Arithmetic:      + - * / ^ % (unary -)
  - Comparison:      = <> < > <= >=
  - String concat:   &
  - Functions:       SUM, AVG / AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTIF,
                     IF, AND, OR, NOT, ROUND, ABS, LEN, LEFT, RIGHT,
                     UPPER, LOWER, CONCAT, TODAY
  - Literals:        numbers (1.5, -3), strings ("hello"), booleans (TRUE/FALSE)

The sheet auto-recomputes on every cell change. Circular dependencies
are detected and reported as `#CYCLE!`; unknown references show
`#REF!`; type mismatches show `#VALUE!`.

Bridges the gap with Excel-like products without bundling HyperFormula -
good enough for budgets, scorecards, conditional reports, lightweight
planning, and any use case that needs in-cell calc.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
