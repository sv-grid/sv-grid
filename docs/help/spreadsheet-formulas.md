# Spreadsheet formulas

A minimal Excel-style formula engine that runs in the browser, with no
dependencies. Cells can hold either a literal value (number, string,
boolean) or a formula starting with `=`. When the formula resolves
against the sheet, the cell shows the computed value; when you click
the cell, the formula bar shows the source.

Useful for budgets, scorecards, cascading totals, conditional reports,
lightweight planning - anything that needs in-cell calc without
bundling a full spreadsheet engine like HyperFormula.

<div data-docs-demo="83-spreadsheet-formulas" data-height="640"></div>

## What's supported

| Category       | Examples                                                           |
|----------------|--------------------------------------------------------------------|
| Cell refs      | `A1`, `B2`, `AA10`, `$C$3` (absolute = relative here)              |
| Ranges         | `A1:A10`, `B2:D5`                                                  |
| Arithmetic     | `+ - * / ^ %`  (unary `-`)                                         |
| Comparison     | `=` `<>` `<` `>` `<=` `>=`                                         |
| String concat  | `&`                                                                |
| Functions      | `SUM`, `AVG`/`AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `COUNTIF` |
|                | `IF`, `AND`, `OR`, `NOT`                                           |
|                | `ROUND`, `ABS`                                                     |
|                | `LEN`, `LEFT`, `RIGHT`, `UPPER`, `LOWER`, `CONCAT`                 |
|                | `TODAY`                                                            |
| Literals       | numbers (`1.5`, `-3`), strings (`"hello"`), booleans (`TRUE`/`FALSE`) |

## Error codes

The engine produces the same error vocabulary as Excel:

| Code        | When                                          |
|-------------|-----------------------------------------------|
| `#REF!`     | Cell reference points outside the sheet       |
| `#CYCLE!`   | Circular dependency                           |
| `#DIV/0!`   | Division by zero                              |
| `#VALUE!`   | Type mismatch (e.g. `="abc"+1`)               |
| `#NAME?`    | Unknown function name                         |
| `#PARSE!`   | Syntax error                                  |

## Complete drop-in example

A self-contained budget sheet. The engine code (≈ 280 lines) is the
same one the demo ships - copy it verbatim, or read the full source
in [demo 83](../../examples/src/demos/83-spreadsheet-formulas.svelte).

The grid shows the *computed* values; a formula bar above lets the
user inspect or edit the raw formula behind the active cell.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ─────────────────── ENGINE ───────────────────
  type CellVal = string | number | boolean | { error: string }
  type Sheet = string[][]

  function isError(v: CellVal): v is { error: string } {
    return typeof v === 'object' && v !== null && 'error' in v
  }

  function colToLetters(c: number): string {
    let n = c, s = ''
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 }
    return s
  }
  function lettersToCol(l: string): number {
    let c = 0
    for (const ch of l.toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64)
    return c - 1
  }
  function parseRef(ref: string): { row: number; col: number } | null {
    const m = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i)
    return m ? { row: parseInt(m[2]!, 10) - 1, col: lettersToCol(m[1]!) } : null
  }

  // (tokenize / parse / evaluate omitted for brevity - copy from demo 83)
  // Below is the public surface you actually call.

  declare function tokenize(formula: string): unknown[]
  declare function parse(tokens: unknown[]): unknown
  declare function evaluate(ast: unknown, resolve: (r: number, c: number) => CellVal): CellVal

  function computeSheet(sheet: Sheet): CellVal[][] {
    const rowsN = sheet.length
    const colsN = sheet[0]?.length ?? 0
    const computed: (CellVal | undefined)[][] =
      Array.from({ length: rowsN }, () => new Array(colsN))
    const visiting: boolean[][] =
      Array.from({ length: rowsN }, () => new Array(colsN).fill(false))

    function resolve(r: number, c: number): CellVal {
      if (r < 0 || r >= rowsN || c < 0 || c >= colsN) return { error: '#REF!' }
      if (computed[r]![c] !== undefined) return computed[r]![c]!
      if (visiting[r]![c]) return { error: '#CYCLE!' }
      visiting[r]![c] = true
      const raw = (sheet[r]![c] ?? '').trim()
      let value: CellVal
      if (raw === '') value = ''
      else if (raw.startsWith('=')) {
        try { value = evaluate(parse(tokenize(raw.slice(1))), resolve) }
        catch (e) {
          const msg = e instanceof Error ? e.message : '#ERR!'
          value = { error: msg.startsWith('#') ? msg : '#PARSE!' }
        }
      } else {
        const n = Number(raw)
        value = Number.isFinite(n) ? n : raw
      }
      visiting[r]![c] = false
      computed[r]![c] = value
      return value
    }
    for (let r = 0; r < rowsN; r++) for (let c = 0; c < colsN; c++) resolve(r, c)
    return computed.map((row) => row.map((v) => v ?? '')) as CellVal[][]
  }

  // ─────────────────── DEMO ───────────────────
  // raw[row][col] = the text the user typed (formula or literal).
  let raw = $state<Sheet>([
    ['Item',     'Cost', 'Qty', 'Subtotal',         'Total'],
    ['Domain',   '12.99','3',   '=B2*C2',           '=ROUND(D2*1.08,2)'],
    ['Hosting',  '49',   '12',  '=B3*C3',           '=ROUND(D3*1.08,2)'],
    ['SSL',      '85',   '1',   '=B4*C4',           '=ROUND(D4*1.08,2)'],
    ['TOTALS',   '',     '',    '=SUM(D2:D4)',      '=SUM(E2:E4)'],
    ['Status',   '',     '',    '',                 '=IF(E5>500,"REVIEW","OK")'],
  ])
  const computed = $derived(computeSheet(raw))

  let activeRow = $state<number | null>(null)
  let activeCol = $state<number | null>(null)
  const activeRaw = $derived(
    activeRow != null && activeCol != null ? raw[activeRow]?.[activeCol] ?? '' : '',
  )
  let formulaInput = $state('')
  $effect(() => { formulaInput = activeRaw })

  function commit() {
    if (activeRow == null || activeCol == null) return
    const next = raw.map((row) => row.slice())
    next[activeRow]![activeCol] = formulaInput
    raw = next
  }

  function formatValue(v: CellVal): string {
    if (isError(v)) return v.error
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    return String(v)
  }

  // SvGrid columns - one per spreadsheet column. Each row is a SheetRow.
  type SheetRow = { rowIndex: number; cells: CellVal[] }
  const gridRows = $derived<SheetRow[]>(
    computed.slice(1).map((cells, i) => ({ rowIndex: i + 1, cells })),
  )
  const headerCells = $derived(computed[0] ?? [])

  const features = tableFeatures({ rowSortingFeature })
  const columns = $derived<ColumnDef<typeof features, SheetRow>[]>(
    Array.from({ length: 5 }, (_, c) => ({
      id: colToLetters(c),
      header: `${colToLetters(c)} · ${formatValue(headerCells[c] ?? '')}`,
      width: c === 0 ? 160 : 130,
      editable: false,
      cell: (ctx) => renderSnippet(SheetCell, { row: ctx.row.original, col: c }),
    })),
  )
</script>

{#snippet SheetCell(props: { row: SheetRow; col: number })}
  {@const r = props.row.rowIndex}
  {@const c = props.col}
  {@const v = props.row.cells[c] ?? ''}
  {@const active = activeRow === r && activeCol === c}
  <span
    onclick={() => { activeRow = r; activeCol = c }}
    style="display: inline-block; width: 100%; cursor: pointer;
           {active ? 'background: rgba(99,102,241,0.10); box-shadow: inset 0 0 0 2px #6366f1;' : ''}
           {isError(v) ? 'color: #dc2626; font-family: ui-monospace, Menlo, monospace;' : ''}"
    title={raw[r]?.[c] ?? ''}
  >{formatValue(v)}</span>
{/snippet}

<section style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
  <!-- Formula bar -->
  <div style="display: flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 8px;">
    <span style="background: #f1f5f9; padding: 8px 12px; font-family: ui-monospace, Menlo, monospace; font-weight: 700; min-width: 64px; text-align: center;">
      {activeRow != null && activeCol != null ? `${colToLetters(activeCol)}${activeRow + 1}` : '-'}
    </span>
    <input
      type="text"
      bind:value={formulaInput}
      placeholder="Click a cell, then type =SUM(D2:D4) here…"
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
      onblur={commit}
      style="flex: 1; border: 0; outline: none; font-family: ui-monospace, Menlo, monospace; padding: 7px 8px;"
    />
  </div>

  <div style="flex: 1; min-height: 0;">
    <SvGrid
      data={gridRows}
      columns={columns}
      features={features}
      enableInlineEditing={false}
      enableCellSelection={false}
      showRowNumbers={true}
      rowNumberWidth={48}
      rowHeight={32}
      containerHeight="100%"
    />
  </div>
</section>
```

> The `tokenize` / `parse` / `evaluate` functions are declared but not
> defined inline above - they are ~ 200 lines of TypeScript. Copy
> them from the
> [demo source](../../examples/src/demos/83-spreadsheet-formulas.svelte)
> which is fully self-contained.

## How the recompute works

`computeSheet(raw)` runs every time the raw sheet changes. It walks
every cell once, lazily resolving references:

1. **Literal** - try `Number(raw)`, fall back to the string.
2. **Formula** - tokenize, parse to an AST, evaluate against the
   resolver.
3. **Memoize** - once a cell is computed, its value is cached so
   downstream cells don't re-parse the same formula.
4. **Cycle detection** - a `visiting` flag per cell. If a resolver
   tries to read a cell that's currently being computed, it returns
   `#CYCLE!` instead of looping forever.

The `$derived` wrapper (`computed = $derived(computeSheet(raw))`)
re-runs the whole sheet whenever any cell changes. For sheets under
~ 10 000 cells this is fast - the demo's 16 × 8 sheet recomputes in
under a millisecond.

For very large sheets, switch to incremental recompute by tracking
which cells depend on which (build a forward edges graph during the
first pass) and recomputing only the affected sub-DAG. The shape of
the resolver doesn't change.

## Try these formulas

In the formula bar of the demo, click a cell and type:

```text
=SUM(D2:D4)               // sum a range
=AVG(E2:E4)               // average
=IF(E5>500,"REVIEW","OK") // conditional text
=COUNTIF(F2:F4,"REVIEW")  // count matches
=B2*C2&" units"           // arithmetic + string concat
=ROUND(E2/E$5*100,1)      // percentage with rounding
=TODAY()                  // today's date as YYYY-MM-DD
```

Each commits immediately on `Enter` and recomputes the whole sheet.

## Bridging to xlsx export

The engine stores raw formulas as text. When you export to xlsx via
`@svgrid/enterprise`, you have two choices:

1. **Export computed values** - default. The xlsx receives numbers
   and strings, Excel sees them as values.
2. **Export formulas** - mark formula cells with a leading `=` in the
   exported value. Excel parses them and recomputes on open. Useful
   when the recipient wants to drill into the math.

Both modes preserve cell formatting (currency, dates) you set on the
columns.

## Limitations & when to reach for HyperFormula

The bundled engine intentionally covers ~80% of common spreadsheet
formulas. It does NOT support:

- VLOOKUP / INDEX / MATCH (planned)
- Volatile functions beyond `TODAY()` (`NOW`, `RAND`, `RANDBETWEEN`)
- Array formulas
- Named ranges
- 3-D references across multiple sheets

If you need full Excel parity, integrate
[HyperFormula](https://hyperformula.handsontable.com) - it's a 600 KB
add-on that drops in alongside SvGrid. Reach for it only when you
actually need it; the bundled engine is < 5 KB minified.

## See also

- [Demo 83 - Spreadsheet + formulas](../../examples/src/demos/83-spreadsheet-formulas.svelte) - the full engine source
- [Demo 27 - Spreadsheet + Ribbon bar](../../examples/src/demos/27-spreadsheet-ribbon.svelte) - bold / colour / format ribbon
- [Demo 18 - Cascade editing](../../examples/src/demos/18-cascade-editing.svelte) - the alternative when you want JS-driven recompute instead of formulas
- [Export and print](./export.md) - xlsx export for the computed sheet
