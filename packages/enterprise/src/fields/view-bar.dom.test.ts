/**
 * A table with views (SvBase): the view bar's buttons say what is set,
 * a filter of field conditions filters, views keep their own settings, the
 * gallery and form views draw and add records, groups get field headers,
 * and the primary field stays first and pinned.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'
import { getGridExtension } from '@svgrid/grid'
import { closeRecord, enableFields, openRecord, SvBase, type FieldFilter, type FieldView } from './index'
import { gridOf } from './grid-access'
import { getLinkedRecords } from './editor-request.svelte'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 200; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

const STATUS = [
  { value: 'Todo', color: '#64748b' },
  { value: 'Done', color: '#16a34a' },
]
type Task = { id: number; no: number; task: string; status: string; tags: string[]; budget: number }
const DATA: Task[] = [
  { id: 1, no: 1, task: 'Registry', status: 'Done', tags: ['Backend'], budget: 1800 },
  { id: 2, no: 2, task: 'Cell', status: 'Todo', tags: ['Frontend'], budget: 3200 },
  { id: 3, no: 3, task: 'Docs', status: 'Todo', tags: ['Docs'], budget: 600 },
]
const COLUMNS = [
  { field: 'no', header: 'No', fieldType: 'autoNumber' },
  { field: 'task', header: 'Task', fieldType: 'text' },
  { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: STATUS } },
  { field: 'tags', header: 'Tags', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'Backend' }, { value: 'Frontend' }, { value: 'Docs' }] } },
  { field: 'budget', header: 'Budget', description: 'Approved spend', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } },
]

/** Props an app changes after mount (as `bind:` on its state would): read and written through a reactive map. */
function withLive(props: Record<string, unknown>, live?: SvelteMap<string, unknown>): Record<string, unknown> {
  if (!live) return props
  for (const key of live.keys()) {
    delete props[key]
    Object.defineProperty(props, key, { enumerable: true, get: () => live.get(key), set: (v) => live.set(key, v) })
  }
  return props
}

function mountBase(views: FieldView[], extra: Record<string, unknown> = {}, live?: SvelteMap<string, unknown>) {
  const added: unknown[] = []
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: any = null
  const app = mount(SvBase as any, {
    target,
    props: withLive({
      data: DATA.map((r) => ({ ...r, tags: [...r.tags] })),
      columns: COLUMNS,
      views,
      getRowId: (r: Task) => String(r.id),
      primaryField: 'task',
      editable: true,
      showRowNumbers: true,
      expandRows: true,
      fieldMenu: true,
      rowAdder: { defaults: () => ({ id: 99, tags: [] }) },
      onRowAdd: (e: { row: unknown }) => added.push(e.row),
      containerHeight: 400,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: unknown) => (api = a),
      ...extra,
    }, live),
  })
  flushSync()
  const bar = () => target.querySelector('.sv-fvb')
  const barText = () => (bar()?.textContent ?? '').replace(/\s+/g, ' ').trim()
  return {
    target,
    added,
    get api() {
      return api
    },
    bar,
    barText,
    destroy: () => {
      unmount(app)
      target.remove()
      document.querySelectorAll('.sv-pop__panel, .sv-modal').forEach((n) => n.remove())
    },
  }
}

const statusIs = (v: string): FieldFilter => ({ kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: v }] })

describe('SvBase and the view bar', () => {
  it('keeps the primary field first and pinned, and says what each button has set', async () => {
    const t = mountBase([{ id: 'all', name: 'All tasks', type: 'grid' }])
    try {
      await until(() => !!t.bar(), 'the bar')
      await until(() => t.target.querySelector('thead th[data-pinned="left"]')?.getAttribute('data-svgrid-header-col') === 'task', 'the primary field pinned')
      const head = [...t.target.querySelectorAll('thead th[data-svgrid-header-col]')].map((th) => th.getAttribute('data-svgrid-header-col'))
      expect(head[0]).toBe('task')
      expect(t.barText()).toContain('All tasks')
      expect(t.barText()).toContain('3 records')

      t.api.setAdvancedFilter(statusIs('Todo'))
      await until(() => t.barText().includes('Filtered by Status'), 'the filter label')
      expect(t.barText()).toContain('2 records')
      // The grid's own filter chip gives way to the bar's button.
      expect(t.target.querySelector('.sv-grid-root')?.classList.contains('sv-fields-own-filter')).toBe(true)

      t.api.setColumnVisible('tags', false)
      await until(() => t.barText().includes('1 hidden field'), 'the hidden count')
      // The primary field is not hidden, whatever asks.
      t.api.setColumnVisible('task', false)
      await until(() => !!t.target.querySelector('thead th[data-svgrid-header-col="task"]'), 'the primary field back')

      // The field's description shows on its header; the menu sorts as numbers.
      expect(t.target.querySelector('thead th[data-svgrid-header-col="budget"] .sv-grid-header-note')?.getAttribute('title')).toBe('Approved spend')
      const ext = getGridExtension()!
      expect(ext.sortLabels?.(COLUMNS[4])).toEqual(['1 → 9', '9 → 1'])
      const ctrl = gridOf(t.api)
      expect(ext.lockColumn?.(ctrl, 'task')).toBe(true)
      const items = ext.columnMenuItems?.(ctrl, 'task').map((i) => i.key) ?? []
      expect(items).not.toContain('field-hide')
      expect(items).not.toContain('field-delete')
      expect(ext.columnMenuItems?.(ctrl, 'status').map((i) => i.key)).toContain('field-filter')
    } finally {
      t.destroy()
    }
  })

  it('switches views, each keeping its own filter, and shows a gallery and a form', async () => {
    const views: FieldView[] = [
      { id: 'all', name: 'All tasks', type: 'grid' },
      { id: 'gallery', name: 'Cards', type: 'gallery' },
      { id: 'form', name: 'Request', type: 'form', formFields: ['task', 'status'] },
    ]
    let saved: FieldView[] = []
    const t = mountBase(views, { onViewsChange: (v: FieldView[]) => (saved = v) })
    try {
      await until(() => !!t.bar(), 'the bar')
      t.api.setAdvancedFilter(statusIs('Done'))
      await until(() => t.barText().includes('1 record'), 'the filtered count')

      const pick = async (name: string) => {
        ;(t.target.querySelector('.sv-fvb-view') as HTMLElement).click()
        flushSync()
        await until(() => [...document.querySelectorAll('.sv-fviews-pick')].some((b) => b.textContent?.includes(name)), 'the views menu')
        ;([...document.querySelectorAll('.sv-fviews-pick')].find((b) => b.textContent?.includes(name)) as HTMLElement).click()
        flushSync()
      }

      // A view not shown before starts plain: every record.
      await pick('Cards')
      await until(() => t.target.querySelectorAll('.sv-gal-card').length === 3, 'three cards')
      expect(t.target.querySelector('.sv-gal-title')?.textContent?.trim()).toBe('Registry')
      // The view left kept its filter.
      expect((saved.find((v) => v.id === 'all')?.state as { advancedFilter?: FieldFilter })?.advancedFilter?.kind).toBe('fieldFilter')

      await pick('All tasks')
      await until(() => t.barText().includes('Filtered by Status') && t.barText().includes('1 record'), 'the filter back')

      await pick('Request')
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      const labels = [...t.target.querySelectorAll('.sv-fform-label')].map((l) => l.textContent?.trim())
      expect(labels).toEqual(['Task', 'Status'])
      ;(t.target.querySelector('.sv-fform .sv-frv-box') as HTMLElement).click()
      flushSync()
      await until(() => !!t.target.querySelector('.sv-fform .sv-frv-input'), 'the task box')
      const input = t.target.querySelector('.sv-fform .sv-frv-input') as HTMLInputElement
      input.value = 'From the form'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      flushSync()
      ;(t.target.querySelector('.sv-fform-submit') as HTMLElement).click()
      flushSync()
      await until(() => t.added.length === 1, 'the added row')
      expect(t.added[0]).toMatchObject({ task: 'From the form', id: 99, no: 4 })
      expect(t.target.querySelector('.sv-fform-done')).not.toBeNull()
    } finally {
      t.destroy()
    }
  })

  it('draws group headers with the value, the count, the group\'s summary and "+"', async () => {
    const t = mountBase([{ id: 'all', name: 'All tasks', type: 'grid' }])
    try {
      await until(() => !!t.bar(), 'the bar')
      t.api.setGroupBy(['status'])
      await until(() => t.target.querySelectorAll('.sv-fgh').length === 2, 'two groups')
      const texts = [...t.target.querySelectorAll('.sv-fgh')].map((g) => g.textContent?.replace(/\s+/g, ' ').trim())
      expect(texts.some((x) => x?.includes('Todo') && x.includes('2 records') && x.includes('$3,800'))).toBe(true)
      await until(() => t.barText().includes('Grouped by 1 field') && t.barText().includes('3 records'), 'the group label')

      // "+" in the Todo group adds a Todo record.
      const todo = [...t.target.querySelectorAll('.sv-fgh')].find((g) => g.textContent?.includes('Todo'))!
      ;(todo.querySelector('.sv-fgh-add') as HTMLElement).click()
      await until(() => t.added.length === 1, 'the added row')
      expect(t.added[0]).toMatchObject({ status: 'Todo', id: 99 })
    } finally {
      t.destroy()
    }
  })

  it('counts and sums only what the filter keeps in collapsed groups', async () => {
    const t = mountBase([{ id: 'all', name: 'All tasks', type: 'grid' }], { summary: true })
    try {
      await until(() => !!t.bar(), 'the bar')
      t.api.setGroupBy(['status'])
      t.api.setAdvancedFilter({ kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'budget', kind: 'number', op: 'gt', value: 1000 }] })
      await until(() => t.target.querySelectorAll('.sv-fgh').length === 2, 'both groups')
      const todo = [...t.target.querySelectorAll('.sv-fgh')].find((g) => g.textContent?.includes('Todo'))!
      const text = todo.textContent?.replace(/\s+/g, ' ') ?? ''
      expect(text).toContain('1 record')
      expect(text).toContain('$3,200')
      await until(() => t.barText().includes('2 records'), 'the filtered count')
      await until(() => (t.target.querySelector('.sv-grid-summary-row')?.textContent ?? '').includes('$5,000'), 'the footer total')
    } finally {
      t.destroy()
    }
  })

  it('keeps a record\'s changes and comments in the expanded record', async () => {
    const t = mountBase([{ id: 'all', name: 'All tasks', type: 'grid' }])
    try {
      await until(() => !!t.bar(), 'the bar')
      const ctrl = gridOf(t.api)
      expect(ctrl.startEditing(0, 'budget')).toBe(true)
      ctrl.updateEditingCellValue(2000)
      ctrl.saveEditingCell()
      flushSync()
      ;(t.target.querySelector('tbody .sv-frh-expand') as HTMLElement).click()
      await until(() => !!document.querySelector('.sv-frv-feed'), 'the record')
      expect(document.querySelector('.sv-frv-feed')?.textContent).toContain('changed Budget')
      expect(document.querySelector('.sv-frv-feed')?.textContent).toContain('$2,000')
      const box = document.querySelector('.sv-frv-comment textarea') as HTMLTextAreaElement
      box.value = 'Approved'
      box.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      ;(document.querySelector('.sv-frv-comment button[type="submit"]') as HTMLElement).click()
      await until(() => !!document.querySelector('.sv-frv-feed')?.textContent?.includes('Approved'), 'the comment')
      expect(getLinkedRecords()).toEqual([])
    } finally {
      t.destroy()
    }
  })
})

describe('views the app sets after mount, colors and the bar\'s props', () => {
  const PLAIN = { sorting: [], grouping: [], hiddenColumns: [] }
  const filtered = (v: string): Record<string, unknown> => ({ ...PLAIN, advancedFilter: statusIs(v) })
  const filterOf = (v: FieldView | undefined) => (v?.state as { advancedFilter?: FieldFilter } | undefined)?.advancedFilter
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  it('applies a list loaded after mount, and never saves the grid over it first', async () => {
    const live = new SvelteMap<string, unknown>([
      ['views', [{ id: 'all', name: 'All tasks', type: 'grid' }]],
      ['activeView', ''],
    ])
    const t = mountBase([], {}, live)
    try {
      await until(() => t.barText().includes('3 records'), 'the bar')
      // The server's copy of the same view, with a filter.
      live.set('views', [{ id: 'all', name: 'All tasks', type: 'grid', state: filtered('Done') }])
      await until(() => t.barText().includes('Filtered by Status') && t.barText().includes('1 record'), 'the loaded filter')
      // Past the autosave, the view still holds the filter it was loaded with.
      await wait(600)
      expect(filterOf((live.get('views') as FieldView[])[0])?.conditions).toEqual(statusIs('Done').conditions)

      // Another view picked by the app shows with its own settings.
      live.set('views', [...(live.get('views') as FieldView[]), { id: 'todo', name: 'To do', type: 'grid', state: filtered('Todo') }])
      live.set('activeView', 'todo')
      await until(() => t.barText().includes('To do') && t.barText().includes('2 records'), 'the other view')
    } finally {
      t.destroy()
    }
  })

  it('a board card shows the fields the view shows: Hide fields takes one off the cards', async () => {
    const t = mountBase([{ id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' }])
    const labels = () => [...t.target.querySelectorAll('.sv-board-card')][0]?.querySelectorAll('.sv-board-card-meta dt') ?? []
    const shown = () => [...labels()].map((d) => d.textContent?.trim())
    try {
      await until(() => shown().includes('Budget'), 'the card fields')
      // The primary field is the title and the stacked field is the lane: neither is repeated.
      expect(shown()).not.toContain('Task')
      expect(shown()).not.toContain('Status')
      t.api.setColumnVisible('budget', false)
      await until(() => !shown().includes('Budget'), 'Budget off the card')
      expect(shown()).toContain('Tags')
    } finally {
      t.destroy()
    }
  })

  it('keeps the rowColor prop on a view with no color, and its target on a view colored by a field', async () => {
    const views: FieldView[] = [
      { id: 'plain', name: 'Plain', type: 'grid', state: { ...PLAIN } },
      { id: 'tags', name: 'By tag', type: 'grid', state: { ...PLAIN }, color: { mode: 'field', field: 'tags' } },
    ]
    const live = new SvelteMap<string, unknown>([['activeView', 'plain']])
    const t = mountBase(views, { rowColor: { field: 'status', target: 'row' } }, live)
    const tinted = () => !!t.target.querySelector('.sv-grid-root')?.classList.contains('sv-fields-rowcolor-row')
    try {
      await until(() => !!t.bar(), 'the bar')
      await wait(50)
      expect(tinted()).toBe(true)
      expect(t.barText()).toContain('Colored by Status')
      live.set('activeView', 'tags')
      await until(() => t.barText().includes('Colored by Tags'), 'the view\'s color')
      expect(tinted()).toBe(true)
    } finally {
      t.destroy()
    }
  })

  it('offers Customize chart on a chart view declared without a chart', async () => {
    const t = mountBase([{ id: 'c', name: 'Chart', type: 'chart' }])
    try {
      await until(() => t.barText().includes('Customize chart'), 'the chart button')
      expect(t.target.querySelector('.sv-fchart-empty')?.textContent).toContain('Choose a field')
      const button = [...t.target.querySelectorAll('.sv-fvb-btn')].find((b) => b.textContent?.includes('Customize chart')) as HTMLElement
      button.click()
      flushSync()
      await until(() => !!document.querySelector('.sv-fchart-panel'), 'the panel')
      const groupBy = document.querySelectorAll<HTMLSelectElement>('.sv-fchart-panel select')[1]!
      expect(groupBy.selectedOptions[0]?.textContent).toBe('Choose a field')
      groupBy.value = 'status'
      groupBy.dispatchEvent(new Event('change', { bubbles: true }))
      flushSync()
      await until(() => !t.target.querySelector('.sv-fchart-empty'), 'the chart')
    } finally {
      t.destroy()
    }
  })

  it('hands SvBase\'s rowHeights to its bar', async () => {
    const t = mountBase([{ id: 'all', name: 'All tasks', type: 'grid' }], { rowHeights: [{ label: 'Compact', height: 30 }, { label: 'Roomy', height: 70 }] })
    try {
      await until(() => !!t.bar(), 'the bar')
      ;(t.target.querySelector('.sv-fvb-btn[aria-label="Row height"]') as HTMLElement).click()
      flushSync()
      await until(() => document.querySelectorAll('.sv-fvb-height').length > 0, 'the row height menu')
      expect([...document.querySelectorAll('.sv-fvb-height')].map((b) => b.textContent?.trim())).toEqual(['Compact', 'Roomy'])
    } finally {
      t.destroy()
    }
  })
})

describe('a formatter outside the grid cell', () => {
  it('gets the row as a grid cell does, { id, original }, in a group header, the record title and its fields', async () => {
    const rows: any[] = []
    const formatter = ({ value, row }: { value: unknown; row: any }) => (rows.push(row), `${value} #${row?.original?.no ?? '?'}`)
    const columns = COLUMNS.map((c) => (c.field === 'task' ? { ...c, formatter } : c))
    const t = mountBase([{ id: 'all', name: 'All tasks', type: 'grid' }], { columns })
    const modalText = () => (document.querySelector('.sv-modal')?.textContent ?? '').replace(/\s+/g, ' ')
    try {
      await until(() => !!t.api && (t.target.textContent ?? '').includes('Cell #2'), 'the grid cell')
      t.api.setGroupBy(['task'])
      await until(() => [...t.target.querySelectorAll('.sv-fgh')].some((g) => g.textContent?.includes('Docs #3')), 'the group header')
      t.api.setGroupBy([])
      openRecord({ api: t.api, rowId: '2' })
      await until(() => document.querySelector('.sv-modal h2')?.textContent?.trim() === 'Cell #2', 'the record title')
      await until(() => [...document.querySelectorAll('.sv-modal .sv-frv-box')].some((b) => b.textContent?.includes('Cell #2')), 'the record field')
      expect(modalText()).not.toContain('#?')
      expect(rows.every((r) => r && typeof r.id === 'string' && r.original && typeof r.original === 'object')).toBe(true)
    } finally {
      closeRecord()
      t.destroy()
    }
  })
})
