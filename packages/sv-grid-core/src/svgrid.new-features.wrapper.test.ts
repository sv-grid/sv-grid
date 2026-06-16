/**
 * Source-level smoke tests for the wrapper additions: `getRowId` prop,
 * `cellClass` / `rowClass` rendering, the column-layout API surface
 * (`setColumnWidth` / `getColumnWidths` / `setColumnPinning` /
 * `getColumnPinning`), the `between` operator UI, and the multi-cell
 * paste / cut keyboard plumbing.
 *
 * These are deliberately source-string assertions, not jsdom mounts -
 * Svelte 5 mount inside vitest is brittle (the existing
 * `svgrid.wrapper.test.ts` follows the same pattern). The behaviour
 * itself is covered by integration probes in the gallery (see the
 * pivot expansion + paste/cut probes that were run during build) and
 * the upstream unit tests of the headless engine + Pro pivot.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve(__dirname, './SvGrid.svelte')
const source = readFileSync(sourcePath, 'utf-8')
const typesPath = resolve(__dirname, './svgrid-wrapper.types.ts')
const types = readFileSync(typesPath, 'utf-8')

describe('SvGrid wrapper - getRowId prop', () => {
  it('declares the getRowId prop on the Props type', () => {
    expect(source).toMatch(/getRowId\?:\s*\(row:\s*TData,\s*index:\s*number\)\s*=>\s*string/)
  })

  it('forwards the prop into createSvGrid options', () => {
    expect(source).toMatch(/get getRowId\(\)[\s\S]*?return props\.getRowId/)
  })
})

describe('SvGrid wrapper - cellClass + rowClass', () => {
  it('declares the rowClass prop on the Props type', () => {
    expect(source).toMatch(/rowClass\?:\s*\(ctx:\s*\{/)
  })

  it('exposes a resolveClassList helper that normalises array / record / string forms', () => {
    expect(source).toMatch(/function resolveClassList\(/)
    expect(source).toMatch(/Array\.isArray\(value\)/)
  })

  it('computes the row-level class once per render row and threads it onto the <tr>', () => {
    expect(source).toMatch(/function computeRowClass/)
    expect(source).toMatch(/userRowClass = computeRowClass\(row, rowIndex\)/)
    expect(source).toMatch(/class=\{`sv-grid-row \$\{userRowClass\}`\}/)
  })

  it('computes the cell-level class per column and threads it onto the <td>', () => {
    expect(source).toMatch(/function computeCellClass/)
    expect(source).toMatch(/userCellClass = computeCellClass\(row, rendered\.column\)/)
    expect(source).toMatch(/class=\{`sv-grid-cell \$\{userCellClass\}`\}/)
  })
})

describe('SvGrid wrapper - column-layout API', () => {
  it('declares setColumnWidth + getColumnWidths in the public type', () => {
    expect(types).toContain('setColumnWidth(columnId: string, width: number): void')
    expect(types).toContain('getColumnWidths(): Record<string, number>')
  })

  it('declares setColumnPinning + getColumnPinning in the public type', () => {
    expect(types).toMatch(/setColumnPinning\(pinning:\s*\{/)
    expect(types).toContain('getColumnPinning(): { left: string[]; right: string[] }')
  })

  it('implements all four methods in the api object', () => {
    expect(source).toMatch(/setColumnWidth\(columnId: string, width: number\)/)
    expect(source).toMatch(/getColumnWidths\(\)/)
    expect(source).toMatch(/setColumnPinning\(pinning\)/)
    expect(source).toMatch(/getColumnPinning\(\)/)
  })

  it('clamps setColumnWidth to MIN_COLUMN_WIDTH', () => {
    // Confirm the clamp is in the code path so a caller can't drop a
    // column below the minimum by passing 0 or a negative number.
    expect(source).toMatch(/Math\.max\(MIN_COLUMN_WIDTH/)
  })

  it('defensive-copies setColumnPinning inputs so callers cannot mutate state', () => {
    expect(source).toMatch(/Array\.from\(new Set\(pinning\.left/)
    expect(source).toMatch(/Array\.from\(new Set\(pinning\.right/)
  })
})

describe('SvGrid wrapper - between filter operator', () => {
  it("includes 'between' in the FilterOperator type", () => {
    expect(source).toMatch(/"between"/)
  })

  it("includes 'between' in NUMBER_OPERATORS + DATE_OPERATORS but NOT in TEXT_OPERATORS", () => {
    // The list literals appear in order, so we slice each block out
    // separately and check membership.
    const numOps = source.match(/const NUMBER_OPERATORS[^]*?\];/)?.[0] ?? ''
    expect(numOps).toContain('"between"')
    const dateOps = source.match(/const DATE_OPERATORS[^]*?\];/)?.[0] ?? ''
    expect(dateOps).toContain('"between"')
    const textOps = source.match(/const TEXT_OPERATORS[^]*?\];/)?.[0] ?? ''
    expect(textOps).not.toContain('"between"')
  })

  it('renders a second input ("To") when the operator is between', () => {
    expect(source).toMatch(/menuActiveOperator === "between"/)
    expect(source).toMatch(/placeholder="To"/)
  })

  it('treats the filter as inactive until BOTH endpoints are non-empty', () => {
    // The active-filters filter() should require value AND valueTo.
    expect(source).toMatch(/if \(f\.operator === "between"\) \{[^}]*f\.value\.trim\(\)\.length > 0[^}]*f\.valueTo[^}]*\.trim\(\)\.length > 0/)
  })

  it('forwards valueTo through applyExcelFilter', () => {
    expect(source).toMatch(/valueTo: filter\.operator === "between" \? filter\.valueTo : undefined/)
  })

  it('publishes valueTo in the onFiltersChange payload only for between clauses', () => {
    expect(source).toMatch(/f\.operator === "between" && f\.valueTo\s*\?\s*\{ valueTo: f\.valueTo \}/)
  })

  it('exposes valueTo on the imperative setFilter input + getFilters output', () => {
    expect(types).toMatch(/setFilter\(\s*columnId: string,[\s\S]*?valueTo\?: string/)
    expect(types).toMatch(/getFilters\(\)[\s\S]*?valueTo\?: string/)
  })
})

describe('SvGrid wrapper - multi-cell paste + cut + delete', () => {
  it('fills the selection range when the clipboard payload is 1x1', () => {
    expect(source).toMatch(/clipboardIsSingleCell\s*=\s*\n?\s*lines\.length === 1 && \(lines\[0\]\?\.split\("\\t"\)\.length \?\? 0\) === 1/)
    expect(source).toMatch(/selectionIsRange = startRow !== endRow \|\| startCol !== endCol/)
    expect(source).toMatch(/fillRange = clipboardIsSingleCell && selectionIsRange/)
  })

  it('walks the entire selection rect when filling', () => {
    expect(source).toMatch(/const rowSpan = fillRange \? endRow - startRow \+ 1 : lines\.length/)
    expect(source).toMatch(/const colSpan = fillRange/)
  })

  it('implements clearSelectedCells() that touches every editable cell in the range', () => {
    expect(source).toMatch(/function clearSelectedCells\(\): boolean/)
    expect(source).toMatch(/parseEditorValue\(editorType, ""\)/)
  })

  it('wires Ctrl/Cmd+X to cutSelectionToClipboard', () => {
    expect(source).toMatch(/lower === "x"/)
    expect(source).toMatch(/void cutSelectionToClipboard\(\)/)
    expect(source).toMatch(/async function cutSelectionToClipboard/)
    // Confirm both calls live inside the cutSelectionToClipboard body
    // (copy first, then clear). A comment between them is fine.
    const body = source.match(
      /async function cutSelectionToClipboard\(\)[^{]*\{([\s\S]*?)^\s\s\}/m,
    )?.[1] ?? ''
    expect(body).toContain('copySelectionToClipboard();')
    expect(body).toContain('clearSelectedCells();')
    expect(body.indexOf('copySelectionToClipboard()')).toBeLessThan(
      body.indexOf('clearSelectedCells()'),
    )
  })

  it('wires Delete + Backspace to clearSelectedCells (without clipboard interaction)', () => {
    expect(source).toMatch(/event\.key === "Delete" \|\| event\.key === "Backspace"/)
    expect(source).toMatch(/if \(clearSelectedCells\(\)\)\s*\{/)
  })
})
