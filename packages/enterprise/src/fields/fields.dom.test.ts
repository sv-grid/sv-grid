import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableFields } from './index'
import { linkHref, linkText } from './links'
import { BUILTIN_FIELD_TYPES } from './builtin-types'
import { fieldPropsOf, fillFieldColumn, getFieldType, registerFieldType } from './registry.svelte'

for (const t of BUILTIN_FIELD_TYPES) if (!getFieldType(t.id)) registerFieldType(t)

describe('link fields: only the schemes the field means become links', () => {
  it('url: http(s) only, a bare host gets https', () => {
    expect(linkHref('url', 'https://svgrid.com/docs')).toBe('https://svgrid.com/docs')
    expect(linkHref('url', 'svgrid.com/docs')).toBe('https://svgrid.com/docs')
    expect(linkHref('url', 'http://localhost:5174/')).toBe('http://localhost:5174/')
  })

  it('url: script and data URLs, and plain words, stay text', () => {
    expect(linkHref('url', 'javascript:alert(1)')).toBeNull()
    expect(linkHref('url', ' JavaScript:alert(1)')).toBeNull()
    expect(linkHref('url', 'data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(linkHref('url', 'vbscript:msgbox')).toBeNull()
    expect(linkHref('url', 'hello')).toBeNull()
    expect(linkHref('url', '')).toBeNull()
    expect(linkHref('url', null)).toBeNull()
  })

  it('email: a mailto for an address, nothing for anything else', () => {
    expect(linkHref('email', 'ana@example.com')).toBe('mailto:ana@example.com')
    expect(linkHref('email', 'mailto:ana@example.com')).toBe('mailto:ana@example.com')
    expect(linkHref('email', 'ana@example')).toBeNull()
    expect(linkHref('email', 'javascript:alert(1)//@x.com')).toBeNull()
  })

  it('phone: a tel with the separators removed', () => {
    expect(linkHref('phone', '+1 (555) 010-2030')).toBe('tel:+15550102030')
    expect(linkHref('phone', 'call me')).toBeNull()
  })

  it('shows the value without the scheme', () => {
    expect(linkText('url', 'https://svgrid.com/')).toBe('svgrid.com')
    expect(linkText('email', 'mailto:a@b.co')).toBe('a@b.co')
  })
})

describe('field types fill in the column and keep what it set', () => {
  it('currency: a number column in the number editor, right-aligned, symbol and precision from fieldProps', () => {
    const col = fillFieldColumn({ field: 'amt', fieldType: 'currency', fieldProps: { symbol: '€', precision: 0, separators: 'period-comma' } })
    expect(col.cellDataType).toBe('number')
    expect(col.editorType).toBe('fieldNumber')
    expect(col.align).toBe('right')
    const fmt = col.formatter as (c: { value: unknown }) => string
    expect(fmt({ value: 1234567 })).toBe('€1.234.567')
    expect(fmt({ value: -5 })).toBe('-€5')
  })

  it('number: integer or decimal, separators, abbreviation, and refusing negatives', () => {
    const fmt = (p: Record<string, unknown>, v: number) => (fillFieldColumn({ field: 'n', fieldType: 'number', fieldProps: p }).formatter as (c: { value: unknown }) => string)({ value: v })
    expect(fmt({ format: 'decimal', precision: 2, separators: 'space-comma' }, 1234.5)).toBe('1 234,50')
    expect(fmt({ format: 'integer', separators: 'comma-period' }, 1234.5)).toBe('1,235')
    expect(fmt({ format: 'decimal', precision: 1, abbreviation: 'million', separators: 'comma-period' }, 2_340_000)).toBe('2.3M')
    expect(fmt({ format: 'decimal', precision: 1, showThousands: false, separators: 'comma-period' }, 9999)).toBe('9999.0')
    const col = fillFieldColumn({ field: 'n', fieldType: 'number', fieldProps: { allowNegative: false } })
    expect(col.rejectInvalid).toBe(true)
    expect((col.validate as (c: { value: unknown }) => unknown)({ value: -1 })).toMatch(/Negative/)
  })

  it('duration: formats seconds and parses what people type', () => {
    const col = fillFieldColumn({ field: 'd', fieldType: 'duration', fieldProps: { durationFormat: 'h:mm:ss' } })
    expect((col.formatter as (c: { value: unknown }) => string)({ value: 5415 })).toBe('1:30:15')
    const parse = col.valueParser as (p: { newValue: unknown }) => unknown
    expect(parse({ newValue: '1:30' })).toBe(5400)
    expect(parse({ newValue: '2h 15m' })).toBe(8100)
  })

  it('formula: computes from other fields by name, and shows #ERROR for a bad formula', () => {
    const columns = [{ field: 'qty', header: 'Qty' }, { field: 'price', header: 'Unit price' }]
    const ok = fillFieldColumn({ field: 't', fieldType: 'formula', fieldProps: { formula: '{Qty} * {Unit price}', result: 'currency', precision: 2 } }, columns)
    expect((ok.fieldFn as (r: unknown) => unknown)({ qty: 3, price: 2.5 })).toBe(7.5)
    expect((ok.formatter as (c: { value: unknown }) => string)({ value: 7.5 })).toBe('$7.50')
    expect(ok.editable).toBe(false)
    const bad = fillFieldColumn({ field: 'b', fieldType: 'formula', fieldProps: { formula: '{Nope} +' } }, columns)
    expect((bad.fieldFn as (r: unknown) => unknown)({})).toBe('#ERROR')
  })

  it('a column property wins over the type', () => {
    const col = fillFieldColumn({ field: 'n', fieldType: 'number', align: 'left', editorType: 'text' })
    expect(col.align).toBe('left')
    expect(col.editorType).toBe('text')
  })

  it('single and multiple select take their options, colors included', () => {
    const options = [{ value: 'Done', color: '#16a34a' }, { value: 'Todo' }]
    const single = fillFieldColumn({ field: 's', fieldType: 'singleSelect', fieldProps: { options } })
    expect(single.editorType).toBe('fieldSelect')
    expect(single.editorOptions).toEqual([{ value: 'Done', label: 'Done', color: '#16a34a' }, { value: 'Todo', label: 'Todo' }])
    const multi = fillFieldColumn({ field: 't', fieldType: 'multiSelect', fieldProps: { options } })
    expect(multi.editorType).toBe('fieldSelect')
    expect(multi.editorMultiple).toBe(true)
    // A paste is read as option labels, comma-separated for a multiple select.
    const paste = (col: Record<string, unknown>, text: string) => (col.valueParser as (x: Record<string, unknown>) => unknown)({ newValue: text, rawInput: text })
    expect(paste(multi, 'done, Todo, Done')).toEqual(['Done', 'Todo'])
    expect(paste(single, 'todo')).toBe('Todo')
    // Copy and export see the labels.
    expect((multi.formatter as (c: { value: unknown }) => string)({ value: ['Done', 'Gone'] })).toBe('Done, Gone')
  })

  it('date: the five formats, 12 or 24 hour time, and GMT for everyone', () => {
    const fmt = (p: Record<string, unknown>) => (fillFieldColumn({ field: 'd', fieldType: 'date', fieldProps: p }).formatter as (c: { value: unknown }) => string)({ value: '2026-10-14T15:05:00Z' })
    expect(fmt({ dateFormat: 'iso', gmt: true })).toBe('2026-10-14')
    expect(fmt({ dateFormat: 'us', gmt: true })).toBe('10/14/2026')
    expect(fmt({ dateFormat: 'european', gmt: true })).toBe('14/10/2026')
    expect(fmt({ dateFormat: 'iso', time: true, timeFormat: '24hour', gmt: true })).toBe('2026-10-14 15:05')
    expect(fmt({ dateFormat: 'iso', time: true, timeFormat: '12hour', gmt: true, showTimeZone: true })).toBe('2026-10-14 3:05pm GMT')
    expect(fillFieldColumn({ field: 'd', fieldType: 'date', fieldProps: { time: true } }).editorType).toBe('datetime')
  })

  it('merges defaults under fieldProps, and an unknown type passes through', () => {
    expect(fieldPropsOf({ fieldType: 'rating' })).toEqual({ max: 5, icon: 'star', color: '#fcb400' })
    expect(fieldPropsOf({ fieldType: 'rating', fieldProps: { max: 3 } })).toMatchObject({ max: 3, icon: 'star' })
    const unknown = { field: 'x', fieldType: 'nope' }
    expect(fillFieldColumn(unknown)).toBe(unknown)
  })

  it('a type registered later replaces the built-in of the same id', () => {
    const before = getFieldType('text')
    registerFieldType({ id: 'text', label: 'Custom text', fill: (d) => ({ ...d, editorType: 'textarea' }) })
    expect(fillFieldColumn({ field: 'a', fieldType: 'text' }).editorType).toBe('textarea')
    registerFieldType(before!)
  })
})

// The rest mounts a real <SvGrid>: what the module adds is what the grid draws.
enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

type Row = { id: number; site: string; score: number; amount: number; status: string }
const rows: Row[] = [
  { id: 1, site: 'https://svgrid.com', score: 4, amount: 1200, status: 'Done' },
  { id: 2, site: 'javascript:alert(1)', score: 2, amount: 15, status: 'Todo' },
]
const cols = [
  { field: 'site', header: 'Site', fieldType: 'url' },
  { field: 'score', header: 'Score', fieldType: 'rating' },
  { field: 'amount', header: 'Amount', fieldType: 'currency', fieldProps: { symbol: '€', precision: 0 } },
  { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Done', color: '#16a34a' }, { value: 'Todo' }] } },
]
const settle = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(extra: Record<string, unknown> = {}) {
  return new Promise<{ api: any; target: HTMLElement; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: rows,
        columns: cols,
        getRowId: (r: Row) => String(r.id),
        rowHeight: 32,
        containerHeight: 240,
        virtualization: false,
        // jsdom measures a 0 px viewport, so the column window would hold four columns.
        columnVirtualization: false,
        showRowSelection: false,
        ...extra,
        onApiReady: (api: any) => res({ api, target, destroy: () => { unmount(app); target.remove() } }),
      },
    })
    setTimeout(() => rej(new Error('grid did not mount')), 5000)
  })
}
const cell = (target: HTMLElement, row: number, col: string) =>
  target.querySelectorAll('tbody tr.sv-grid-row')[row]?.querySelector(`td[data-col-id="${col}"]`) as HTMLElement

describe('enableFields on a mounted grid', () => {
  it('draws rating, url, currency and select fields', async () => {
    const g = await mountGrid()
    try {
      await settle()
      const rating = cell(g.target, 0, "score")
      expect(rating.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('4 of 5')
      expect(rating.querySelectorAll('.sv-frt-icon.is-on')).toHaveLength(4)

      const link = cell(g.target, 0, 'site').querySelector('a')
      expect(link?.getAttribute('href')).toBe('https://svgrid.com/')
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
      // A script URL in the data is drawn as text, never as a link.
      expect(cell(g.target, 1, 'site').querySelector('a')).toBeNull()
      expect(cell(g.target, 1, 'site').textContent).toContain('javascript:alert(1)')

      expect(cell(g.target, 0, 'amount').textContent).toMatch(/1[,.  ]?200/)
      expect(cell(g.target, 0, 'amount').textContent).toContain('€')

      // Single select draws as the grid's colored chip.
      expect(cell(g.target, 0, 'status').textContent).toContain('Done')
    } finally {
      g.destroy()
    }
  })

  it('fills a field column added through the api', async () => {
    const g = await mountGrid()
    try {
      g.api.addColumn({ field: 'score', id: 'score2', header: 'Score 2', fieldType: 'rating', fieldProps: { max: 3 } })
      await settle()
      const added = cell(g.target, 0, "score2")
      expect(added.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('3 of 3')
    } finally {
      g.destroy()
    }
  })
})

describe('rowAdder', () => {
  it('draws nothing without the prop', async () => {
    const g = await mountGrid()
    try {
      await settle()
      expect(g.target.querySelector('.sv-field-row-adder')).toBeNull()
    } finally {
      g.destroy()
    }
  })

  it('appends a row with the defaults, starts editing it and reports it', async () => {
    const added: unknown[] = []
    const g = await mountGrid({
      editable: true,
      rowAdder: { label: 'New task', defaults: () => ({ status: 'Todo' }) },
      onRowAdd: (e: { row: unknown }) => added.push(e.row),
    })
    try {
      await settle()
      const line = g.target.querySelector('tbody.sv-grid-body > tr:last-child')
      expect(line?.classList.contains('sv-field-row-adder')).toBe(true)
      const button = line!.querySelector('button')!
      expect(button.textContent?.trim()).toBe('New task')
      button.click()
      await settle()
      await settle()
      expect(g.api.getData()).toHaveLength(3)
      // The rows carry ids, so the new one gets its own.
      expect(added).toEqual([{ status: 'Todo', id: expect.stringMatching(/^rec/) }])
      expect(g.api.getData()[2]).toBe(added[0])
      // The first editable cell of the new row is in edit mode.
      expect(g.target.querySelector('.sv-grid-cell-editing')).not.toBeNull()
    } finally {
      g.destroy()
    }
  })
})

describe('rowColor', () => {
  const rowsEls = (t: HTMLElement) => [...t.querySelectorAll<HTMLElement>('tbody tr.sv-grid-row:not(.sv-field-row-adder)')]

  it('colors each row from its select option, labels the row header, and names the target', async () => {
    const g = await mountGrid({ showRowNumbers: true, rowColor: { field: 'status' } })
    try {
      await settle()
      const [done, todo] = rowsEls(g.target)
      expect(done!.style.getPropertyValue('--sv-row-mark')).toBe('#16a34a')
      // 'Todo' has no color in its option, so no mark - but still a label.
      expect(todo!.style.getPropertyValue('--sv-row-mark')).toBe('')
      expect(done!.querySelector('.sv-grid-row-number-cell')?.getAttribute('title')).toBe('Done')
      expect(todo!.querySelector('.sv-grid-row-number-cell')?.getAttribute('title')).toBe('Todo')
      expect(g.target.querySelector('.sv-grid-root')?.className).toContain('sv-fields-rowcolor-header')
    } finally {
      g.destroy()
    }
  })

  it('takes the first matching rule, and a rule that throws is skipped', async () => {
    const g = await mountGrid({
      showRowNumbers: true,
      rowColor: {
        target: 'row',
        rules: [
          { when: () => { throw new Error('bad rule') }, color: '#000000' },
          { when: (r: { amount: number }) => r.amount > 100, color: '#f59e0b', label: 'Over budget' },
        ],
      },
    })
    try {
      await settle()
      const [big, small] = rowsEls(g.target)
      expect(big!.style.getPropertyValue('--sv-row-mark')).toBe('#f59e0b')
      expect(small!.style.getPropertyValue('--sv-row-mark')).toBe('')
      expect(big!.querySelector('.sv-grid-row-number-cell')?.getAttribute('title')).toBe('Over budget')
      expect(g.target.querySelector('.sv-grid-root')?.className).toContain('sv-fields-rowcolor-row')
    } finally {
      g.destroy()
    }
  })

  it('does nothing without the prop', async () => {
    const g = await mountGrid({ showRowNumbers: true })
    try {
      await settle()
      expect(rowsEls(g.target)[0]!.style.getPropertyValue('--sv-row-mark')).toBe('')
      expect(g.target.querySelector('.sv-grid-root')?.className).not.toContain('sv-fields-rowcolor')
    } finally {
      g.destroy()
    }
  })
})
