/**
 * Bulk edit - the selection bar's built-in `editFields` button, and the engine
 * behind it: set one or more fields across one or more selected rows, in a
 * single undo run.
 *
 * Split deliberately:
 *
 *   - The DRAWER is checked for what this component owns - that it opens, that
 *     it offers exactly the editable columns, and that submitting closes it.
 *   - The ENGINE (`applyBulkEdit`, `bulkEditInitialValues`) is checked
 *     directly, because that is where every rule lives.
 *
 * What is NOT done here is typing into the form and asserting rows changed.
 * SvForm renders most controls as its own components (a number is
 * SvNumberInput, a select is SvDropDownList), so a synthetic `input` event on
 * the inner element does not reach the form's state - a test written that way
 * passes or fails on SvForm's internals rather than on this feature. SvForm has
 * its own suite in the grid package; the end-to-end path is covered by
 * `tests/e2e/selection-bar.spec.ts` in a real browser.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableSelectionBar } from './selection-bar'
import {
  applyBulkEdit,
  bulkEditInitialValues,
  bulkEditableFields,
  coerceBulkValue,
} from './bulk-edit'

enableSelectionBar()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

type Row = { id: number; title: string; status: string; points: number; done: boolean }
const seed = (): Row[] => [
  { id: 1, title: 'One', status: 'Open', points: 1, done: false },
  { id: 2, title: 'Two', status: 'Open', points: 2, done: false },
  { id: 3, title: 'Three', status: 'Done', points: 3, done: true },
]
const cols = [
  { field: 'title', header: 'Title', width: 160 },
  { field: 'status', header: 'Status', width: 120, editorType: 'list', editorOptions: ['Open', 'Done'] },
  { field: 'points', header: 'Points', width: 100, editorType: 'number' },
  { field: 'done', header: 'Done', width: 90, editorType: 'checkbox' },
  // Read-only, so it must never appear in the field list.
  { field: 'id', header: 'Key', width: 90, editable: false },
]

const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(extra: Record<string, unknown> = {}) {
  return new Promise<{
    api: any
    target: HTMLElement
    changes: Array<{ columnId: string; newValue: unknown }>
    destroy: () => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const changes: Array<{ columnId: string; newValue: unknown }> = []
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: seed(),
        columns: cols,
        getRowId: (r: Row) => String(r.id),
        containerHeight: 240,
        virtualization: false,
        editable: true,
        showRowSelection: true,
        selectionBar: { actions: ['selectAll', 'editFields'] },
        onCellValueChange: (e: { columnId: string; newValue: unknown }) => changes.push(e),
        onApiReady(api: any) {
          res({ api, target, changes, destroy: () => { unmount(app); target.remove() } })
        },
        ...extra,
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

async function openBar(target: HTMLElement, api: any, ids: string[]) {
  api.selectRows(ids)
  await vi.waitFor(() => expect(target.querySelector('.sv-selbar')).not.toBeNull())
  return target.querySelector('.sv-selbar') as HTMLElement
}

const byLabel = (bar: HTMLElement, text: string) =>
  [...bar.querySelectorAll<HTMLButtonElement>('.sv-selbar-btn')].find((b) =>
    (b.textContent ?? '').includes(text),
  )!

/** Open the drawer and wait for the form. */
async function openDrawer(bar: HTMLElement) {
  byLabel(bar, 'Edit fields').click()
  await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull())
  return document.querySelector('form') as HTMLFormElement
}

/**
 * Press the form's own submit button and wait for the drawer to go.
 *
 * SvForm's submit is async (it awaits validation before calling `onSubmit`),
 * so dispatching a submit event and waiting a fixed couple of ticks races it -
 * the assertions then read the rows before anything was written.
 */
async function apply(form: HTMLFormElement) {
  const button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
  if (!button) throw new Error('no submit button in the bulk-edit form')
  button.click()
  await vi.waitFor(() => expect(document.querySelector('form')).toBeNull())
}

describe('built-in bar actions', () => {
  it('renders selectAll and editFields from their string keys', async () => {
    const { api, target, destroy } = await mountGrid()
    await tick()
    const bar = await openBar(target, api, ['1'])
    const text = [...bar.querySelectorAll('.sv-selbar-btn')].map((b) => (b.textContent ?? '').trim())
    expect(text).toContain('Select all')
    expect(text).toContain('Edit fields')
    destroy()
  })

  it('Select all picks every row, then goes disabled', async () => {
    const { api, target, destroy } = await mountGrid()
    await tick()
    const bar = await openBar(target, api, ['1'])

    byLabel(bar, 'Select all').click()
    await vi.waitFor(() => expect(api.getSelectedRowIds()).toEqual(['1', '2', '3']))
    await vi.waitFor(() => expect(byLabel(bar, 'Select all').disabled).toBe(true))
    destroy()
  })

  it('draws a separator from the "separator" key without it counting as a button', async () => {
    const { api, target, destroy } = await mountGrid({
      selectionBar: { actions: ['selectAll', 'separator', 'editFields'] },
    })
    await tick()
    const bar = await openBar(target, api, ['1'])
    // One before the actions + one from the key + one before Clear.
    expect(bar.querySelectorAll('.sv-selbar-sep').length).toBe(3)
    expect(bar.querySelectorAll('.sv-selbar-btn').length).toBe(2)
    destroy()
  })
})

describe('bulkEditableFields', () => {
  it('offers editable field-backed columns and nothing else', async () => {
    const { api, target, destroy } = await mountGrid()
    await tick()
    const bar = await openBar(target, api, ['1'])
    const form = await openDrawer(bar)

    const labels = [...form.querySelectorAll('.sv-form__label')].map((l) =>
      (l.textContent ?? '').trim().replace(/\s*\*$/, ''),
    )
    // A checkbox renders its label inline rather than in .sv-form__label, so
    // the wrapper count is the honest check for "one control per column".
    expect(labels).toEqual(expect.arrayContaining(['Title', 'Status', 'Points']))
    expect(form.querySelectorAll('.sv-form__field').length).toBe(4)
    // `id` is editable:false - writing it in bulk would be a footgun.
    expect(labels).not.toContain('Key')
    destroy()
  })

  it('labels by header, falling back to the column id', () => {
    const fields = bulkEditableFields({
      allColumns: [
        { id: 'a', columnDef: { field: 'a', header: 'Alpha' } },
        { id: 'b', columnDef: { field: 'b' } },
      ],
      isCellEditable: () => true,
    })
    expect(fields.map((f) => f.label)).toEqual(['Alpha', 'b'])
  })
})

describe('coerceBulkValue', () => {
  it('turns the checkbox input into a boolean', () => {
    expect(coerceBulkValue('checkbox', true)).toBe(true)
    expect(coerceBulkValue('checkbox', '')).toBe(false)
  })

  it('turns numeric text into a number, and junk into null', () => {
    expect(coerceBulkValue('number', '12.5')).toBe(12.5)
    expect(coerceBulkValue('number', '')).toBeNull()
    expect(coerceBulkValue('number', 'abc')).toBeNull()
  })

  it('leaves text alone', () => {
    expect(coerceBulkValue('text', 'hello')).toBe('hello')
  })
})

describe('what the drawer opens showing', () => {
  const ctxFor = (rows: Array<Record<string, unknown>>, ids: string[]) => ({
    allRows: rows.map((r, i) => ({ id: String(i + 1), original: r })),
    selectionBarTarget: { ids, rows: [] },
    readCellRaw: (rowIndex: number, columnId: string) => rows[rowIndex]?.[columnId],
  })

  const fields = [
    { id: 'status', label: 'Status', editorType: 'text' },
    { id: 'points', label: 'Points', editorType: 'number' },
  ]

  it('shows a value the whole selection already agrees on', () => {
    const ctx = ctxFor(
      [{ status: 'Open', points: 5 }, { status: 'Open', points: 9 }],
      ['1', '2'],
    )
    const { values, mixed } = bulkEditInitialValues(ctx, fields as any)
    expect(values.status).toBe('Open')
    expect(mixed.has('status')).toBe(false)
  })

  it('blanks a field the selection disagrees on and flags it mixed', () => {
    // This is what makes multi-field bulk edit safe: the user can see which
    // fields differ, and leaving one alone keeps every row's own value.
    const ctx = ctxFor(
      [{ status: 'Open', points: 5 }, { status: 'Done', points: 9 }],
      ['1', '2'],
    )
    const { values, mixed } = bulkEditInitialValues(ctx, fields as any)
    expect(mixed.has('status')).toBe(true)
    expect(values.status).toBe('')
    expect(mixed.has('points')).toBe(true)
  })
})

describe('the drawer itself', () => {
  it('closes when the form is submitted', async () => {
    const { api, target, destroy } = await mountGrid()
    await tick()
    const bar = await openBar(target, api, ['1'])
    const form = await openDrawer(bar)
    await apply(form)
    expect(document.querySelector('form')).toBeNull()
    destroy()
  })

  it('offers a submit and a cancel, labelled with the selection size', async () => {
    const { api, target, destroy } = await mountGrid()
    await tick()
    const bar = await openBar(target, api, ['1', '2'])
    const form = await openDrawer(bar)

    const submit = form.querySelector('button[type="submit"]')!
    expect(submit.textContent).toContain('2')
    expect([...form.querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('Cancel'))).toBe(true)
    destroy()
  })

  it('reopens with a fresh baseline rather than the last edit', async () => {
    // A drawer that reopens holding the previous values invites applying them
    // to a different selection by accident.
    const { api, target, destroy } = await mountGrid()
    await tick()
    const bar = await openBar(target, api, ['1'])
    const first = await openDrawer(bar)
    await apply(first)

    api.selectRows(['3'])
    await vi.waitFor(() => expect(target.querySelector('.sv-selbar')).not.toBeNull())
    const second = await openDrawer(target.querySelector('.sv-selbar') as HTMLElement)
    // Row 3's own title, not row 1's.
    const titleInput = [...second.querySelectorAll('.sv-form__field')]
      .find((f) => (f.querySelector('.sv-form__label')?.textContent ?? '').startsWith('Title'))
      ?.querySelector('input') as HTMLInputElement
    expect(titleInput.value).toBe('Three')
    destroy()
  })
})

describe('applyBulkEdit directly', () => {
  it('reports what it changed, skipped and how many fields it touched', async () => {
    const { api, target, destroy } = await mountGrid()
    await tick()
    await openBar(target, api, ['1', '2'])
    const ctrl = (target.querySelector('.sv-grid-root') as any) ?? null
    void ctrl
    // Reached through the same handle the drawer uses.
    const result = applyBulkEdit(
      {
        allColumns: [{ id: 'points', columnDef: { field: 'points' } }],
        allRows: [{ id: '1' }, { id: '2' }],
        selectionBarTarget: { ids: ['1', '2'] },
        isCellEditableAt: () => true,
        readCellRaw: () => 0,
        writeCellRaw: () => {},
        history: [],
        historyPtr: -1,
        historyVersion: 0,
        UNDO_LIMIT: 200,
      },
      { points: 7 },
    )
    expect(result).toEqual({ changed: 2, skipped: 0, fields: 1 })
    destroy()
  })

  /** A stand-in grid whose writes are recorded rather than applied. */
  function fakeCtx(rows: Array<Record<string, unknown>>, ids: string[]) {
    const writes: Array<[number, string, unknown]> = []
    return {
      writes,
      ctx: {
        allColumns: [
          { id: 'status', columnDef: { field: 'status' } },
          { id: 'points', columnDef: { field: 'points' } },
        ],
        allRows: rows.map((_, i) => ({ id: String(i + 1) })),
        selectionBarTarget: { ids },
        isCellEditableAt: () => true,
        readCellRaw: (rowIndex: number, columnId: string) => rows[rowIndex]?.[columnId],
        writeCellRaw: (rowIndex: number, columnId: string, value: unknown) => {
          writes.push([rowIndex, columnId, value])
          rows[rowIndex]![columnId] = value
        },
        history: [] as unknown[],
        historyPtr: -1,
        historyVersion: 0,
        UNDO_LIMIT: 200,
      } as any,
    }
  }

  it('writes SEVERAL fields across SEVERAL rows - the point of the drawer', () => {
    const { ctx, writes } = fakeCtx(
      [
        { status: 'Open', points: 1 },
        { status: 'Open', points: 2 },
      ],
      ['1', '2'],
    )
    const result = applyBulkEdit(ctx, { status: 'Done', points: 8 })
    expect(result).toEqual({ changed: 4, skipped: 0, fields: 2 })
    expect(writes).toHaveLength(4)
  })

  it('skips cells already holding the value, so they are not empty undo steps', () => {
    const { ctx, writes } = fakeCtx(
      [
        { status: 'Open', points: 1 },
        { status: 'Done', points: 2 },
      ],
      ['1', '2'],
    )
    const result = applyBulkEdit(ctx, { status: 'Done' })
    // Row 2 was already Done.
    expect(result.changed).toBe(1)
    expect(writes).toEqual([[0, 'status', 'Done']])
    expect(ctx.history).toHaveLength(1)
  })

  it('appends the whole run as ONE block of undo steps', () => {
    const { ctx } = fakeCtx(
      [
        { status: 'Open', points: 1 },
        { status: 'Open', points: 2 },
      ],
      ['1', '2'],
    )
    ctx.history = [{ rowId: 'x', columnId: 'a', field: 'a', before: 0, after: 1 }]
    ctx.historyPtr = 0
    applyBulkEdit(ctx, { status: 'Done', points: 9 })
    // The pre-existing step is kept, four new ones appended after it.
    expect(ctx.history).toHaveLength(5)
    expect(ctx.historyPtr).toBe(4)
  })

  it('ignores a field the grid has no column for', () => {
    const { ctx, writes } = fakeCtx([{ status: 'Open', points: 1 }], ['1'])
    const result = applyBulkEdit(ctx, { nonexistent: 'x' })
    expect(result).toEqual({ changed: 0, skipped: 0, fields: 0 })
    expect(writes).toHaveLength(0)
  })

  it('counts rows the grid refuses as skipped rather than writing them', () => {
    const result = applyBulkEdit(
      {
        allColumns: [{ id: 'points', columnDef: { field: 'points' } }],
        allRows: [{ id: '1' }, { id: '2' }],
        selectionBarTarget: { ids: ['1', '2'] },
        isCellEditableAt: (rowIndex: number) => rowIndex === 0,
        readCellRaw: () => 0,
        writeCellRaw: () => {},
        history: [],
        historyPtr: -1,
        historyVersion: 0,
        UNDO_LIMIT: 200,
      },
      { points: 7 },
    )
    expect(result).toEqual({ changed: 1, skipped: 1, fields: 1 })
  })
})
