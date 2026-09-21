/**
 * The ribbon is data, so it is tested as data: no mounting, no DOM.
 *
 * The two things worth holding down are that the model is well-formed (a
 * renderer can trust every item), and that the buttons run the SAME actions
 * the keymap binds rather than a parallel implementation.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { RIBBON_TABS, ribbonItems, withDecimals } from './ribbon'
import { setFormatTarget, setWorkbook, applyFormat } from './shortcuts'
import { setStructureTarget } from './structure'
import { createFormatStore } from './format-store'
import { createWorkbook } from './workbook'
import { FORMAT_PRESETS } from './number-format'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

const ROWS = 5
const COLS = 4
const LETTERS = ['a', 'b', 'c', 'd']

function makeCmd(over: Partial<GridCommandContext> = {}): GridCommandContext {
  const values = new Map<string, unknown>()
  return {
    api: { copyToClipboard: vi.fn(async () => '') } as never,
    editing: false,
    activeCell: { rowIndex: 0, colIndex: 0, columnId: 'a' },
    rowCount: ROWS,
    colCount: COLS,
    ranges: [[0, 0, 1, 1]],
    columnIdAt: (c: number) => LETTERS[c] ?? null,
    getCellValue: (r: number, c: number) => values.get(`${r}:${c}`),
    setCellValue: (r: number, c: number, v: unknown) => values.set(`${r}:${c}`, v),
    setActiveCell: vi.fn(),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
    focus: vi.fn(),
    paste: vi.fn(async () => {}),
    copy: vi.fn(),
    cut: vi.fn(async () => {}),
    recordUndo: vi.fn(),
    ...over,
  } as GridCommandContext
}

function attachStore() {
  const store = createFormatStore()
  const onChange = vi.fn()
  setFormatTarget({
    store,
    lookup: {
      rowIdAt: (i: number) => (i >= 0 && i < ROWS ? `r${i}` : null),
      columnIdAt: (i: number) => LETTERS[i] ?? null,
    },
    onChange,
  })
  return { store, onChange }
}

beforeEach(() => {
  setFormatTarget(null)
  setWorkbook(null)
})

describe('the model is well-formed', () => {
  it('ships the eight tabs that have something behind them', () => {
    expect(RIBBON_TABS.map((t) => t.id)).toEqual(['file', 'home', 'insert', 'page-layout', 'formulas', 'data', 'review', 'view'])
  })

  it('File raises New, Open, the three Save As, Export CSV and Print for the shell', () => {
    const file = RIBBON_TABS.find((t) => t.id === 'file')!
    expect(file.groups.flatMap((g) => g.items.map((i) => i.emits)))
      .toEqual(['file-new', 'file-open', 'file-save-xlsx', 'file-save-ods', 'file-save-xls', 'file-export-csv', 'file-print'])
  })

  it('Page Layout raises the setup as dropdown entries, Print Titles, the launcher and two toggles', () => {
    const tab = RIBBON_TABS.find((t) => t.id === 'page-layout')!
    expect(tab.groups.map((g) => [g.id, g.launcher])).toEqual([['page-setup', 'page-setup'], ['sheet-options', undefined]])
    const setup = tab.groups[0]!.items
    expect(setup.map((i) => [i.id, i.kind])).toEqual([['margins', 'dropdown'], ['orientation', 'dropdown'], ['paper', 'dropdown'], ['print-area', 'dropdown'], ['print-titles', 'button']])
    expect(setup.flatMap((i) => (i.options ?? []).map((o) => o.emits))).toEqual([
      'margins-normal', 'margins-narrow', 'margins-wide', 'page-portrait', 'page-landscape',
      'paper-letter', 'paper-legal', 'paper-tabloid', 'paper-a3', 'paper-a4', 'paper-a5', 'print-area-set', 'print-area-clear',
    ])
    expect(tab.groups[1]!.items.map((i) => [i.kind, i.emits])).toEqual([['toggle', 'print-gridlines'], ['toggle', 'print-headings']])
  })

  it('View > Show carries Excel\'s three toggles, raised for the shell', () => {
    const view = RIBBON_TABS.find((t) => t.id === 'view')!
    expect(view.groups.map((g) => g.id)).toEqual(['show', 'window'])
    const show = view.groups[0]!.items
    expect(show.map((i) => [i.kind, i.row, i.emits])).toEqual([
      ['toggle', 1, 'toggle-gridlines'],
      ['toggle', 2, 'toggle-formula-bar'],
      ['toggle', 3, 'toggle-headings'],
    ])
  })

  it('carries Excel\'s Top/Middle/Bottom Align toggles on Home > Alignment', () => {
    const home = RIBBON_TABS.find((t) => t.id === 'home')!
    const alignment = home.groups.find((g) => g.id === 'alignment')!
    const ids = alignment.items.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining(['valign-top', 'valign-center', 'valign-bottom']))
    for (const id of ['valign-top', 'valign-center', 'valign-bottom']) {
      expect(alignment.items.find((i) => i.id === id)!.kind).toBe('toggle')
    }
  })

  it('files each Conditional Formatting command under its own heading', () => {
    // The Clear and New Rule headings were once swapped with their items, so
    // two headings rendered back-to-back (an empty section) and the clear
    // commands sat under "New Rule". Every heading must own the items below it.
    const home = RIBBON_TABS.find((t) => t.id === 'home')!
    const cf = home.groups.flatMap((g) => g.items).find((i) => i.id === 'conditional-formatting')!
    const opts = cf.options!
    opts.forEach((o, i) => {
      if (o.heading) expect(opts[i + 1]?.heading, `"${o.label}" heading has no items`).toBeFalsy()
    })
    const at = (label: string) => opts.findIndex((o) => o.label === label)
    expect(at('Use a Formula...')).toBe(at('New Rule') + 1)
    expect(at('Clear Rules from Selected Cells')).toBe(at('Clear Rules') + 1)
    expect(at('Clear Rules from Entire Sheet')).toBe(at('Clear Rules') + 2)
  })

  it('Freeze Panes lives on View > Window as Excel\'s dropdown, and Home > Cells is one column', () => {
    const view = RIBBON_TABS.find((t) => t.id === 'view')!
    const freeze = view.groups.find((g) => g.id === 'window')!.items[0]!
    expect(freeze).toMatchObject({ id: 'freeze', kind: 'dropdown', size: 'large' })
    expect(freeze.options!.map((o) => o.emits)).toEqual(['freeze-panes', 'freeze-top-row', 'freeze-first-column', 'unfreeze-panes'])
    const cells = RIBBON_TABS.find((t) => t.id === 'home')!.groups.find((g) => g.id === 'cells')!
    expect(cells.items.map((i) => i.id)).toEqual(['insert', 'delete', 'format'])
  })

  it('Home > Styles is the Conditional Formatting dropdown, every entry raised', () => {
    const styles = RIBBON_TABS.find((t) => t.id === 'home')!.groups.find((g) => g.id === 'styles')!
    const cf = styles.items[0]!
    expect(cf).toMatchObject({ id: 'conditional-formatting', kind: 'dropdown', size: 'large' })
    const raised = cf.options!.filter((o) => !o.heading).map((o) => o.emits)
    expect(raised).toEqual([
      'cf-greater', 'cf-less', 'cf-between', 'cf-equal', 'cf-text', 'cf-duplicates',
      'cf-top10', 'cf-bottom10', 'cf-above-average', 'cf-below-average',
      'cf-data-bar', 'cf-color-scale-3', 'cf-color-scale-2', 'cf-icon-set', 'cf-formula',
      'cf-clear-selection', 'cf-clear-sheet', 'cf-manage',
    ])
  })

  it('the Review tab raises the comment actions and Protect / Unprotect Sheet for the shell', () => {
    const review = RIBBON_TABS.find((t) => t.id === 'review')!
    expect(review.groups.map((g) => g.label)).toEqual(['Comments', 'Protect'])
    const ids = review.groups.flatMap((g) => g.items.map((i) => [i.id, i.emits]))
    expect(ids).toEqual([
      ['new-comment', 'new-comment'], ['delete-comment', 'delete-comment'],
      ['prev-comment', 'prev-comment'], ['next-comment', 'next-comment'],
      ['toggle-comments', 'toggle-comments'],
      ['protect-sheet', 'protect-sheet'], ['unprotect-sheet', 'unprotect-sheet'], ['allow-edit-ranges', 'allow-edit-ranges'],
    ])
  })

  it('Home > Alignment carries Merge & Center as a split dropdown, every kind raised', () => {
    const merge = ribbonItems().find((i) => i.id === 'merge')!
    expect(merge).toMatchObject({ kind: 'dropdown', split: true, row: 3 })
    expect(merge.options!.map((o) => o.emits)).toEqual(['merge-center', 'merge-across', 'merge-cells', 'unmerge-cells'])
    expect(merge.lit).toBe('merge-center')
    expect(typeof merge.run).toBe('function')
  })

  it('Data > Data Tools raises Data Validation, Circle Invalid Data and Clear Validation Circles', () => {
    const item = ribbonItems().find((i) => i.id === 'data-validation')!
    expect(item).toMatchObject({ kind: 'dropdown', size: 'large' })
    expect(item.options!.map((o) => o.emits)).toEqual(['data-validation', 'circle-invalid', 'clear-circles'])
  })

  it('the Format menu carries Lock Cell as a toggle under Protection', () => {
    const format = ribbonItems().find((i) => i.id === 'format')!
    const options = format.options!
    const heading = options.findIndex((o) => o.heading && o.label === 'Protection')
    expect(options[heading + 1]).toMatchObject({ label: 'Lock Cell', emits: 'toggle-lock', toggle: true })
  })

  it('gives every item a unique id', () => {
    const ids = ribbonItems().map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every item a label and a title', () => {
    for (const item of ribbonItems()) {
      expect(item.label, item.id).toBeTruthy()
      expect(item.title, item.id).toBeTruthy()
    }
  })

  it('gives every item exactly one of `run` or `emits`, and every dropdown entry the same', () => {
    for (const item of ribbonItems()) {
      if (item.kind === 'dropdown') {
        // A dropdown acts through its entries: each one emits, or the item
        // runs with the entry's value. Headings are labels, not entries. A
        // split dropdown's `run` is its face, so its entries may emit as well.
        expect(item.emits, `${item.id} is a dropdown and cannot emit itself`).toBeUndefined()
        if (item.split) expect(item.run, `${item.id} is split and needs a face action`).toBeTypeOf('function')
        for (const option of item.options ?? []) {
          if (option.heading) continue
          const has = Number(Boolean(option.emits)) + Number(Boolean(item.run))
          if (item.split) expect(has, `${item.id}/${option.value} must have a way to act`).toBeGreaterThan(0)
          else expect(has, `${item.id}/${option.value} must emit or be run by the item`).toBe(1)
        }
        continue
      }
      const has = Number(Boolean(item.run)) + Number(Boolean(item.emits))
      expect(has, `${item.id} must either run or emit, not both or neither`).toBe(1)
    }
  })

  it('gives every select and menu its options', () => {
    for (const item of ribbonItems()) {
      if (item.kind === 'select' || item.kind === 'menu' || item.kind === 'dropdown') {
        expect(item.options?.length, item.id).toBeGreaterThan(0)
      }
    }
  })

  it('gives every group a label, because that is what makes it a ribbon', () => {
    for (const tab of RIBBON_TABS) {
      expect(tab.groups.length, tab.id).toBeGreaterThan(0)
      for (const group of tab.groups) expect(group.label, group.id).toBeTruthy()
    }
  })

  it('gives every group an icon of its own for the button it folds into', () => {
    // A folded group is one large button; without its own icon it borrowed
    // its first item's, which gave Font a "grow" arrow and Number a dollar.
    for (const tab of RIBBON_TABS) {
      for (const group of tab.groups) expect(group.icon, group.id).toBeTruthy()
    }
  })
})

function item(id: string) {
  const found = ribbonItems().find((i) => i.id === id)
  if (!found) throw new Error(`no ribbon item "${id}"`)
  return found
}

describe('the buttons drive the real actions', () => {
  it('Bold writes through the attached format store', () => {
    const { store, onChange } = attachStore()
    const cmd = makeCmd()
    expect(item('bold').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.bold).toBe(true)
    expect(store.get('r1', 'b')?.bold).toBe(true)
    expect(onChange).toHaveBeenCalled()
  })

  it('Bold reports itself on only when EVERY selected cell is bold', () => {
    const { store } = attachStore()
    const cmd = makeCmd()
    expect(item('bold').isOn!(cmd)).toBe(false)
    store.set([[0, 0, 0, 0]], { bold: true }, {
      rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => LETTERS[i] ?? null,
    })
    // One of four is bold, so the button stays off and pressing turns all on.
    expect(item('bold').isOn!(cmd)).toBe(false)
    item('bold').run!(cmd)
    expect(item('bold').isOn!(cmd)).toBe(true)
  })

  it('greys the formatting buttons where the target refuses, and lights them where it allows', () => {
    const store = createFormatStore()
    let allow = false
    setFormatTarget({
      store,
      lookup: { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => LETTERS[i] ?? null },
      guard: () => allow,
    })
    const cmd = makeCmd()
    for (const id of ['bold', 'italic', 'fmt-currency', 'align-left', 'wrap', 'clear-formats']) {
      expect(item(id).isEnabled!(cmd), id).toBe(false)
    }
    expect(item('wrap').run!(cmd)).toBe(false)
    expect(store.get('r0', 'a')).toBeUndefined()
    allow = true
    expect(item('bold').isEnabled!(cmd)).toBe(true)
    expect(item('wrap').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.wrap).toBe(true)
  })

  it('greys Merge & Center where the target refuses formatting, as Excel does on a protected sheet', () => {
    setFormatTarget({
      store: createFormatStore(),
      lookup: { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => LETTERS[i] ?? null },
      guard: () => false,
    })
    expect(item('merge').isEnabled!(makeCmd())).toBe(false)
  })

  it('greys Insert and Delete where the structure target refuses', () => {
    const cmd = makeCmd()
    expect(item('insert').isEnabled!(cmd)).toBe(true)
    setStructureTarget({ getRaw: () => '', setRaw: () => {}, apply: () => {}, canApply: () => false })
    try {
      for (const id of ['insert', 'delete', 'insert-rows', 'delete-rows']) {
        expect(item(id).isEnabled!(cmd), id).toBe(false)
      }
    } finally {
      setStructureTarget(null)
    }
  })

  it('declines every formatting button when no store is attached', () => {
    const cmd = makeCmd()
    for (const id of ['bold', 'italic', 'fmt-currency', 'align-left', 'wrap', 'clear-formats']) {
      expect(item(id).isEnabled!(cmd), id).toBe(false)
      expect(item(id).run!(cmd), id).toBe(false)
    }
  })

  it('applies a number preset and lights the matching button', () => {
    attachStore()
    const cmd = makeCmd()
    expect(item('fmt-currency').run!(cmd)).toBe(true)
    expect(item('fmt-currency').isOn!(cmd)).toBe(true)
    expect(item('fmt-percent').isOn!(cmd)).toBe(false)
  })

  it('AutoSum opens the editor on a SUM over the run above, as Excel proposes it', () => {
    const cmd = makeCmd({
      activeCell: { rowIndex: 3, colIndex: 0, columnId: 'a' },
      ranges: [],
      getCellValue: (r: number) => (r < 3 ? 10 : undefined),
    })
    const written: unknown[] = []
    const startEditing = vi.fn(() => true)
    const spy = makeCmd({
      ...cmd,
      startEditing,
      setCellValue: (_r: number, _c: number, v: unknown) => { written.push(v) },
    } as never)
    expect(item('autosum').run!(spy)).toBe(true)
    expect(startEditing).toHaveBeenCalledWith(3, 0, '=SUM(A1:A3)')
    expect(written).toEqual([])
    // A selection wider than one cell has the sum written outright.
    const wide = makeCmd({
      ...cmd,
      ranges: [[0, 0, 3, 0]],
      startEditing,
      setCellValue: (_r: number, _c: number, v: unknown) => { written.push(v) },
    } as never)
    expect(item('autosum').run!(wide)).toBe(true)
    expect(written[0]).toBe('=SUM(A1:A3)')
  })

  it('Copy and Cut are the selection copy and cut Ctrl+C and Ctrl+X run, not the export', () => {
    // The api's copyToClipboard exports the displayed rows with their
    // headers; the buttons went there and put the whole sheet on the
    // clipboard whatever was selected.
    const api = { copyToClipboard: vi.fn(async () => 'x') }
    const copy = vi.fn()
    const cut = vi.fn(async () => {})
    const cmd = makeCmd({ api: api as never, copy, cut })
    expect(item('copy').run!(cmd)).toBe(true)
    expect(copy).toHaveBeenCalledTimes(1)
    expect(item('cut').run!(cmd)).toBe(true)
    expect(cut).toHaveBeenCalledTimes(1)
    expect(api.copyToClipboard).not.toHaveBeenCalled()
  })

  it('New sheet declines without a workbook and adds one with it', () => {
    const cmd = makeCmd()
    expect(item('new-sheet').isEnabled!(cmd)).toBe(false)
    expect(item('new-sheet').run!(cmd)).toBe(false)

    const wb = createWorkbook([{ name: 'One', cells: [] }])
    setWorkbook(wb)
    expect(item('new-sheet').isEnabled!(cmd)).toBe(true)
    expect(item('new-sheet').run!(cmd)).toBe(true)
    expect(wb.sheets).toEqual(['One', 'Sheet1'])
  })
})

describe('increase / decrease decimal', () => {
  it('walks a plain pattern up and down', () => {
    expect(withDecimals('0', 1)).toBe('0.0')
    expect(withDecimals('0.0', 1)).toBe('0.00')
    expect(withDecimals('0.00', -1)).toBe('0.0')
    expect(withDecimals('0.0', -1)).toBe('0')
  })

  it('keeps the prefix and the suffix', () => {
    expect(withDecimals('$#,##0.00', 1)).toBe('$#,##0.000')
    expect(withDecimals('0.0%', 1)).toBe('0.00%')
    expect(withDecimals('0.0%', -1)).toBe('0%')
    expect(withDecimals('$#,##0', 1)).toBe('$#,##0.0')
  })

  it('stops at zero and at Excel"s 30-place ceiling', () => {
    expect(withDecimals('0', -1)).toBeNull()
    expect(withDecimals(`0.${'0'.repeat(30)}`, 1)).toBeNull()
  })

  it('moves EVERY section, so positives and negatives keep one precision', () => {
    expect(withDecimals('0.00;[Red]0.00', 1)).toBe('0.000;[Red]0.000')
    // The currency preset, which is the pattern this matters most for.
    expect(withDecimals('$#,##0.00;($#,##0.00)', 1)).toBe('$#,##0.000;($#,##0.000)')
    expect(withDecimals('$#,##0.00;($#,##0.00)', -1)).toBe('$#,##0.0;($#,##0.0)')
  })

  it('declines all sections when any one of them cannot move', () => {
    // The second section is already at zero, so decreasing would desync the
    // two. Better to do nothing than to half-apply.
    expect(withDecimals('0.0;0', -1)).toBeNull()
  })

  it('declines a pattern with a quoted literal rather than mangling it', () => {
    // A quoted literal may contain the ';' that sections are split on.
    expect(withDecimals('0.00" items"', 1)).toBeNull()
  })

  it('moves the decimals of the active cell through the button', () => {
    const { store } = attachStore()
    const cmd = makeCmd()
    item('fmt-currency').run!(cmd)
    expect(store.get('r0', 'a')?.numFmt).toBe(FORMAT_PRESETS.accounting)
    expect(item('dec-more').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.numFmt).toBe('_($* #,##0.000_);_($* (#,##0.000);_($* "-"???_);_(@_)')
    expect(item('dec-less').run!(cmd)).toBe(true)
    expect(item('dec-less').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.numFmt).toBe('_($* #,##0.0_);_($* (#,##0.0);_($* "-"?_);_(@_)')
  })

  it('moves the decimals of a currency pattern through both sections', () => {
    const { store } = attachStore()
    const cmd = makeCmd()
    applyFormat(cmd, { numFmt: FORMAT_PRESETS.currency })
    expect(item('dec-more').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.numFmt).toBe('$#,##0.000;($#,##0.000)')
    expect(item('dec-less').run!(cmd)).toBe(true)
    expect(item('dec-less').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.numFmt).toBe('$#,##0.0;($#,##0.0)')
  })
})
