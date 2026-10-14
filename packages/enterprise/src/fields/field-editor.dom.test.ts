/**
 * Field editing: value conversion on a type change, the operations behind the
 * field editor and the column menu, and the "+" column on a mounted grid.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableFields, registerLinkedTable } from './index'
import FieldEditor from './FieldEditor.svelte'
import { fillFieldColumn, originalColumn, registerFieldType } from './registry.svelte'
import { convertValue, countCleared, optionsFromValues } from './convert'
import { addField, duplicateField, indexBeside, nameTaken, newRowValues, plainDef, previewChange, recordCopyValues, removeField, uniqueId, updateField } from './field-ops'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

describe('convertValue', () => {
  it('text <-> number keeps what is a number and clears the rest', () => {
    expect(convertValue('$1,200', 'text', 'number')).toBe(1200)
    expect(convertValue('n/a', 'text', 'currency')).toBeNull()
    expect(convertValue(42, 'number', 'text')).toBe('42')
    expect(convertValue(7.6, 'number', 'rating')).toBe(8)
    expect(convertValue(42, 'number', 'rating')).toBe(10)
  })

  it('selects, checkboxes, dates and attachments', () => {
    expect(convertValue('Design, Backend, Design', 'text', 'multiSelect')).toEqual(['Design', 'Backend'])
    expect(convertValue(['Done', 'Late'], 'multiSelect', 'singleSelect')).toBe('Done')
    expect(convertValue('yes', 'text', 'checkbox')).toBe(true)
    expect(convertValue('nope', 'text', 'checkbox')).toBe(false)
    expect(convertValue('2026-10-14T10:00:00Z', 'text', 'date')).toBe('2026-10-14')
    expect(convertValue('see https://x.io/a.pdf', 'text', 'attachment')).toMatchObject([{ name: 'a.pdf' }])
    expect(convertValue(null, 'text', 'multiSelect')).toEqual([])
  })

  it('counts the cells a change would clear', () => {
    expect(countCleared(['12', 'abc', '', null, '3.5'], 'text', 'number')).toBe(1)
    expect(optionsFromValues(['Done', ['Todo', 'Done'], null, ' '])).toEqual([{ value: 'Done' }, { value: 'Todo' }])
  })
})

function fakeCtrl() {
  const events: Array<[string, unknown]> = []
  const ctrl: any = {
    props: {
      onColumnAdd: (e: unknown) => events.push(['add', e]),
      onColumnChange: (e: unknown) => events.push(['change', e]),
      onColumnRemove: (e: unknown) => events.push(['remove', e]),
    },
    internalColumns: [
      { id: 'name', field: 'name', header: 'Name' },
      { id: 'qty', field: 'qty', header: 'Qty', fieldType: 'text' },
    ],
    internalData: [{ name: 'a', qty: '3' }, { name: 'b', qty: 'many' }],
  }
  return { ctrl, events }
}

describe('field operations', () => {
  it('ids are unique and names are checked case-insensitively', () => {
    expect(uniqueId('Due date', ['due_date'])).toBe('due_date_2')
    expect(uniqueId('!!!', [])).toBe('field')
    const { ctrl } = fakeCtrl()
    expect(nameTaken(ctrl, ' qty ')).toBe(true)
    expect(nameTaken(ctrl, 'Qty', 'qty')).toBe(false)
  })

  it('adds a field filled in by its type, at the index asked, and reports the plain column', () => {
    const { ctrl, events } = fakeCtrl()
    const def = addField(ctrl, { name: 'Budget', fieldType: 'currency', fieldProps: { currency: 'EUR' } }, indexBeside(ctrl, 'name', 'right'))
    expect(ctrl.internalColumns.map((c: any) => c.id)).toEqual(['name', 'budget', 'qty'])
    expect(ctrl.internalColumns[1]).toMatchObject({ cellDataType: 'number', editorType: 'fieldNumber' })
    expect(def).toEqual({ id: 'budget', field: 'budget', header: 'Budget', width: 120, fieldType: 'currency', fieldProps: { currency: 'EUR' } })
    expect(events[0]).toEqual(['add', { column: def, columns: [
      { id: 'name', field: 'name', header: 'Name' },
      def,
      { id: 'qty', field: 'qty', header: 'Qty', fieldType: 'text' },
    ] }])
  })

  it('a type change converts the values, refills the column and reports the new data', () => {
    const { ctrl, events } = fakeCtrl()
    const draft = { name: 'Quantity', fieldType: 'number', fieldProps: {} }
    expect(previewChange(ctrl, 'qty', draft)).toBe(1)
    updateField(ctrl, 'qty', draft)
    expect(ctrl.internalData.map((r: any) => r.qty)).toEqual([3, null])
    expect(ctrl.internalColumns[1]).toMatchObject({ header: 'Quantity', fieldType: 'number', cellDataType: 'number', editorType: 'fieldNumber', align: 'right' })
    const [kind, e] = events[0] as [string, any]
    expect(kind).toBe('change')
    expect(e.previous).toMatchObject({ header: 'Qty', fieldType: 'text' })
    expect(e.data).toHaveLength(2)
  })

  it('a change to a select starts its options from the values', () => {
    const { ctrl } = fakeCtrl()
    updateField(ctrl, 'qty', { name: 'Qty', fieldType: 'singleSelect', fieldProps: {} })
    expect(ctrl.internalColumns[1].fieldProps.options).toEqual([{ value: '3' }, { value: 'many' }])
    expect(plainDef(ctrl.internalColumns[1]).editorType).toBeUndefined()
  })

  it('a rename rewrites {Old name} in the other formulas; {field key} needs nothing', () => {
    const { ctrl, events } = fakeCtrl()
    ctrl.internalColumns.push(
      { id: 'cost', field: 'cost', header: 'Unit cost', fieldType: 'number' },
      { id: 'value', field: 'value', header: 'Value', fieldType: 'formula', fieldProps: { formula: '{Qty} * { unit cost } & " {Unit cost}"' } },
      { id: 'byKey', field: 'byKey', header: 'By key', fieldType: 'formula', fieldProps: { formula: '{qty} * {cost}' } },
    )
    ctrl.internalData = [{ name: 'a', qty: 4, cost: 410 }]
    updateField(ctrl, 'cost', { name: 'Cost', fieldType: 'number', fieldProps: {} })
    const byId = (id: string) => ctrl.internalColumns.find((c: any) => c.id === id)
    expect(byId('value').fieldProps.formula).toBe('{Qty} * {Cost} & " {Unit cost}"')
    expect(byId('byKey').fieldProps.formula).toBe('{qty} * {cost}')
    expect(byId('value').fieldFn(ctrl.internalData[0])).toBe('1640 {Unit cost}')
    expect(byId('byKey').fieldFn(ctrl.internalData[0])).toBe(1640)
    // The app gets the rewritten formula with the change.
    const [, e] = events.at(-1) as [string, any]
    expect(e.columns.find((c: any) => c.id === 'value').fieldProps.formula).toBe('{Qty} * {Cost} & " {Unit cost}"')
    // A header that is also the key ("Qty", qty) cannot tell the two apart:
    // both references follow the new name, and both still read the field.
    updateField(ctrl, 'qty', { name: 'Quantity', fieldType: 'text', fieldProps: {} })
    expect(byId('byKey').fieldProps.formula).toBe('{Quantity} * {cost}')
    expect(byId('value').fieldProps.formula).toBe('{Quantity} * {Cost} & " {Unit cost}"')
    expect(byId('byKey').fieldFn(ctrl.internalData[0])).toBe(1640)
  })

  it('a formula, lookup or rollup turned into a stored type keeps what it computed', () => {
    registerLinkedTable({
      id: 'convert-people',
      name: 'People',
      primaryField: 'name',
      rows: [{ id: 'p1', name: 'Ana', hours: 5 }, { id: 'p2', name: 'Ben', hours: 7 }],
      fields: [{ field: 'name', header: 'Name' }, { field: 'hours', header: 'Hours', fieldType: 'number' }],
    })
    const { ctrl, events } = fakeCtrl()
    ctrl.internalColumns.push(
      { id: 'team', field: 'team', header: 'Team', fieldType: 'link', fieldProps: { table: 'convert-people' } },
      { id: 'total', field: 'total', header: 'Total', fieldType: 'formula', fieldProps: { formula: '{Qty} * 2', result: 'number' } },
      { id: 'hours', field: 'hours', header: 'Hours', fieldType: 'rollup', fieldProps: { linkField: 'team', field: 'hours', aggregation: 'SUM' } },
      { id: 'who', field: 'who', header: 'Who', fieldType: 'lookup', fieldProps: { linkField: 'team', field: 'name' } },
      { id: 'next', field: 'next', header: 'Next', fieldType: 'formula', fieldProps: { formula: 'DATEADD("2026-09-05", 1, "days")' } },
    )
    ctrl.internalData = [{ name: 'a', qty: '3', team: ['p1', 'p2'] }, { name: 'b', qty: 'many', team: [] }]
    expect(previewChange(ctrl, 'total', { name: 'Total', fieldType: 'number', fieldProps: {} })).toBe(0)
    updateField(ctrl, 'total', { name: 'Total', fieldType: 'number', fieldProps: {} })
    updateField(ctrl, 'hours', { name: 'Hours', fieldType: 'number', fieldProps: {} })
    updateField(ctrl, 'who', { name: 'Who', fieldType: 'text', fieldProps: {} })
    updateField(ctrl, 'next', { name: 'Next', fieldType: 'date', fieldProps: {} })
    expect(ctrl.internalData.map((r: any) => r.total)).toEqual([6, null])
    expect(ctrl.internalData.map((r: any) => r.hours)).toEqual([12, 0])
    expect(ctrl.internalData.map((r: any) => r.who)).toEqual(['Ana, Ben', null])
    expect(ctrl.internalData.map((r: any) => r.next)).toEqual(['2026-09-06', '2026-09-06'])
    expect((events[0] as [string, any])[1].data.map((r: any) => r.total)).toEqual([6, null])
  })

  it('a link turned into text writes the linked records\' names, not their ids', () => {
    registerLinkedTable({
      id: 'convert-teams',
      name: 'Teams',
      primaryField: 'title',
      rows: [{ id: 'a1', title: 'Design' }, { id: 'a3', title: 'Backend' }],
    })
    const { ctrl } = fakeCtrl()
    ctrl.internalColumns.push({ id: 'teams', field: 'teams', header: 'Teams', fieldType: 'link', fieldProps: { table: 'convert-teams' } })
    ctrl.internalData = [{ name: 'a', teams: ['a1', 'a3'] }, { name: 'b', teams: ['a3', 'gone'] }, { name: 'c', teams: [] }]
    updateField(ctrl, 'teams', { name: 'Teams', fieldType: 'text', fieldProps: {} })
    expect(ctrl.internalData.map((r: any) => r.teams)).toEqual(['Design, Backend', 'Backend', null])
    const again = fakeCtrl().ctrl
    again.internalColumns.push({ id: 'teams', field: 'teams', header: 'Teams', fieldType: 'link', fieldProps: { table: 'convert-teams' } })
    again.internalData = [{ name: 'a', teams: ['a1', 'a3'] }]
    updateField(again, 'teams', { name: 'Teams', fieldType: 'multiSelect', fieldProps: {} })
    expect(again.internalData[0].teams).toEqual(['Design', 'Backend'])
    expect(again.internalColumns.find((c: any) => c.id === 'teams').fieldProps.options).toEqual([{ value: 'Design' }, { value: 'Backend' }])
  })

  it('duplicate copies the values under a new id; remove drops the column only', () => {
    const { ctrl, events } = fakeCtrl()
    const copy = duplicateField(ctrl, 'qty')!
    expect(copy).toMatchObject({ id: 'qty_copy', header: 'Qty copy' })
    expect(ctrl.internalData[0]).toMatchObject({ qty: '3', qty_copy: '3' })
    removeField(ctrl, 'qty')
    expect(ctrl.internalColumns.map((c: any) => c.id)).toEqual(['name', 'qty_copy'])
    expect(ctrl.internalData[0].qty).toBe('3')
    expect(events.map(([k]) => k)).toEqual(['add', 'remove'])
  })
})

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

describe('the field editor and formulas', () => {
  it('will not save a formula that does not compile, and shows why', async () => {
    const { ctrl, events } = fakeCtrl()
    ctrl.internalColumns.push({ id: 'f', field: 'f', header: 'F', fieldType: 'formula', fieldProps: { formula: '{Qty} * 2' } })
    const target = document.createElement('div')
    document.body.appendChild(target)
    let closed = false
    const app = mount(FieldEditor as any, { target, props: { ctrl, mode: 'edit', columnId: 'f', onClose: () => (closed = true) } })
    try {
      await until(() => !!document.querySelector('#sv-fed-formula'), 'the formula box')
      const box = document.querySelector<HTMLTextAreaElement>('#sv-fed-formula')!
      const saveBtn = () => [...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === 'Save')!
      expect(saveBtn().disabled).toBe(false)
      box.value = '{Qty} * {Unit price}'
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await settle()
      expect(document.querySelector('.sv-pi-error')?.textContent).toBe('No field named "Unit price"')
      expect(saveBtn().disabled).toBe(true)
      saveBtn().click()
      document.querySelector<HTMLFormElement>('.sv-fed')!.requestSubmit?.()
      await settle()
      expect(closed).toBe(false)
      expect(events).toHaveLength(0)
      // An empty formula can be saved: its cells stay empty.
      box.value = ''
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await settle()
      expect(saveBtn().disabled).toBe(false)
      saveBtn().click()
      await until(() => closed, 'the editor to close')
      const f = ctrl.internalColumns.find((c: any) => c.id === 'f')
      expect(f.fieldFn({ qty: 3 })).toBeNull()
    } finally {
      unmount(app)
      target.remove()
    }
  })

  it('a formula that names its own field, by key, header or the name being typed, cannot be saved', async () => {
    const { ctrl, events } = fakeCtrl()
    ctrl.internalColumns.push({ id: 'f', field: 'f', header: 'Total', fieldType: 'formula', fieldProps: { formula: '{Qty} * 2' } })
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(FieldEditor as any, { target, props: { ctrl, mode: 'edit', columnId: 'f', onClose: () => {} } })
    try {
      await until(() => !!document.querySelector('#sv-fed-formula'), 'the formula box')
      const box = document.querySelector<HTMLTextAreaElement>('#sv-fed-formula')!
      const saveBtn = () => [...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === 'Save')!
      const type = async (src: string) => {
        box.value = src
        box.dispatchEvent(new Event('input', { bubbles: true }))
        await settle()
      }
      await type('{Total} * 2')
      expect(document.querySelector('.sv-pi-error')?.textContent).toBe('A formula cannot read its own field {Total}')
      expect(saveBtn().disabled).toBe(true)
      await type('{f} + 1')
      expect(document.querySelector('.sv-pi-error')?.textContent).toBe('A formula cannot read its own field {f}')
      expect(saveBtn().disabled).toBe(true)
      // Renamed in the editor: the new name is its own too.
      const name = document.querySelector<HTMLInputElement>('#sv-fed-name')!
      name.value = 'Grand total'
      name.dispatchEvent(new Event('input', { bubbles: true }))
      await type('{Grand total}')
      expect(document.querySelector('.sv-pi-error')?.textContent).toBe('A formula cannot read its own field {Grand total}')
      expect(saveBtn().disabled).toBe(true)
      await type('{Qty} * 2')
      expect(document.querySelector('.sv-pi-error')).toBeNull()
      expect(saveBtn().disabled).toBe(false)
      expect(events).toHaveLength(0)
    } finally {
      unmount(app)
      target.remove()
    }
  })
})

describe('registered types in the field editor and the column pipeline', () => {
  // A score 0..100; text that is no score keeps the old value (here: none).
  const score = (t: unknown) => {
    const n = Number(String(t ?? '').replace(/[%\s]/g, ''))
    return String(t ?? '').trim() && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null
  }
  const seen: Array<Record<string, unknown>> = []
  registerFieldType({
    id: 'testScore',
    label: 'Test score',
    group: 'date',
    defaults: { green: 80, amber: 50, higherIsBetter: true, tags: [] },
    properties: [
      { key: 'higherIsBetter', label: 'Higher is better', kind: 'checkbox', hint: 'Off: lower is better.', alsoSets: (_v, p) => (seen.push({ ...p }), { green: p.amber, amber: p.green }) },
      { key: 'tags', label: 'Tags', kind: 'options', hint: 'Shown on the card.' },
    ],
    fill: (def) => ({ ...def, valueParser: (x: { newValue: unknown; oldValue: unknown; rawInput?: unknown }) => score(x.rawInput ?? x.newValue) ?? x.oldValue }),
  })
  registerFieldType({ id: 'testPerson', label: 'Test person', group: 'people' })

  it('the type picker draws the date and people groups', async () => {
    const { ctrl } = fakeCtrl()
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(FieldEditor as any, { target, props: { ctrl, mode: 'add', onClose: () => {} } })
    try {
      await until(() => !!document.querySelector('.sv-fed-type'), 'the type picker')
      const headings = [...document.querySelectorAll('.sv-fed-type-group')].map((h) => h.textContent?.trim())
      expect(headings).toContain('Dates')
      expect(headings).toContain('People')
      const labels = [...document.querySelectorAll('.sv-fed-type')].map((b) => b.textContent?.trim())
      expect(labels).toContain('Test score')
      expect(labels).toContain('Test person')
    } finally {
      unmount(app)
      target.remove()
    }
  })

  it('hints show under checkbox and options properties; alsoSets sees the defaults', async () => {
    const { ctrl, events } = fakeCtrl()
    ctrl.internalColumns.push({ id: 's', field: 's', header: 'S', fieldType: 'testScore' })
    const target = document.createElement('div')
    document.body.appendChild(target)
    let closed = false
    const app = mount(FieldEditor as any, { target, props: { ctrl, mode: 'edit', columnId: 's', onClose: () => (closed = true) } })
    try {
      await until(() => !!document.querySelector('.sv-pi-check input'), 'the checkbox')
      const hints = [...document.querySelectorAll('.sv-pi-hint')].map((p) => p.textContent?.trim())
      expect(hints).toEqual(['Off: lower is better.', 'Shown on the card.'])
      const box = document.querySelector<HTMLInputElement>('.sv-pi-check input')!
      expect(box.getAttribute('aria-describedby')).toBe('sv-fed-higherIsBetter-hint')
      box.click()
      await settle()
      expect(seen.at(-1)).toMatchObject({ green: 80, amber: 50, higherIsBetter: true })
      ;[...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === 'Save')!.click()
      await until(() => closed, 'the editor to close')
      expect((events.at(-1) as [string, any])[1].column.fieldProps).toMatchObject({ higherIsBetter: false, green: 50, amber: 80 })
    } finally {
      unmount(app)
      target.remove()
    }
  })

  it('a long text\'s rich text hint shows', async () => {
    const { ctrl } = fakeCtrl()
    ctrl.internalColumns.push({ id: 'notes', field: 'notes', header: 'Notes', fieldType: 'longText' })
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(FieldEditor as any, { target, props: { ctrl, mode: 'edit', columnId: 'notes', onClose: () => {} } })
    try {
      await until(() => !!document.querySelector('.sv-pi-check'), 'the checkbox')
      expect(document.querySelector('.sv-pi-hint')?.textContent).toMatch(/\*\*bold\*\*/)
    } finally {
      unmount(app)
      target.remove()
    }
  })

  it('an editAs alias warns from its stored type: the cells the save would clear', async () => {
    registerFieldType({ id: 'testOldScore', label: 'Old score', editAs: { type: 'testScore', props: {} } })
    const { ctrl } = fakeCtrl()
    ctrl.internalColumns.push({ id: 'old', field: 'old', header: 'Old', fieldType: 'testOldScore' })
    ctrl.internalColumns.push({ id: 'cost', field: 'cost', header: 'Cost', fieldType: 'currency' })
    ctrl.internalData = [{ old: '72', cost: 5 }, { old: 'n/a', cost: 7 }]
    const open = async (columnId: string) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(FieldEditor as any, { target, props: { ctrl, mode: 'edit', columnId, onClose: () => {} } })
      await until(() => !!document.querySelector('.sv-fed'), 'the field editor')
      await settle()
      const text = document.querySelector('.sv-fed-warning')?.textContent?.replace(/\s+/g, ' ').trim() ?? null
      unmount(app)
      target.remove()
      return text
    }
    expect(await open('old')).toBe('Old score to Test score converts the values. 1 cell will be cleared or cut short.')
    // Currency opens as Number and every value converts: nothing to say.
    expect(await open('cost')).toBeNull()
    // Saving does what the warning said.
    updateField(ctrl, 'old', { name: 'Old', fieldType: 'testScore', fieldProps: {} })
    expect(ctrl.internalData.map((r: any) => r.old)).toEqual([72, null])
  })

  it('a duplicate gets a copy:false field fresh from newRowValue, else its default; other fields are copied', () => {
    const num = (v: unknown) => Number(/(\d+)$/.exec(String(v ?? ''))?.[1] ?? 0)
    registerFieldType({
      id: 'testTicket',
      label: 'Test ticket',
      copy: false,
      newRowValue: ({ rows, field }) => `T-${rows.reduce((m, r) => Math.max(m, num(r?.[field])), 0) + 1}`,
    })
    registerFieldType({ id: 'testStamp', label: 'Test stamp', copy: false })
    const { ctrl } = fakeCtrl()
    ctrl.internalColumns.push(
      { id: 't', field: 't', header: 'T', fieldType: 'testTicket' },
      { id: 'st', field: 'st', header: 'St', fieldType: 'testStamp', fieldProps: { default: 'new' } },
      { id: 'p', field: 'p', header: 'P', fieldType: 'testPerson' },
      { id: 'n', field: 'n', header: 'N', fieldType: 'autoNumber' },
    )
    ctrl.internalData = [{ name: 'a', qty: '3', t: 'T-1', st: 'old', p: ['Ana'], n: 1 }, { name: 'b', t: 'T-2', n: 2 }]
    const values = recordCopyValues(ctrl, ctrl.internalData[0])
    expect(values).toEqual({ name: 'a', qty: '3', p: ['Ana'] })
    expect(values.p).not.toBe(ctrl.internalData[0].p)
    expect(newRowValues(ctrl, values)).toMatchObject({ name: 'a', qty: '3', p: ['Ana'], t: 'T-3', st: 'new', n: 3 })
  })

  it('values converted into a registered type go through its valueParser, and what it refuses is counted', () => {
    expect(convertValue('72%', 'text', 'testScore')).toBe(72)
    expect(convertValue(['72'], 'multiSelect', 'testScore')).toBe(72)
    expect(convertValue(['Design', 'Backend'], 'multiSelect', 'testScore')).toBeNull()
    expect(countCleared([['Design', 'Backend'], ['40'], 'n/a', null], 'multiSelect', 'testScore')).toBe(2)
    // Without a parser: a list becomes its text, a plain value stays.
    expect(convertValue(['Ana', 'Ben'], 'multiSelect', 'testPerson')).toBe('Ana, Ben')
    expect(convertValue(7, 'number', 'testPerson')).toBe(7)
    const { ctrl } = fakeCtrl()
    expect(previewChange(ctrl, 'qty', { name: 'Qty', fieldType: 'testScore', fieldProps: {} })).toBe(1)
    updateField(ctrl, 'qty', { name: 'Qty', fieldType: 'testScore', fieldProps: {} })
    expect(ctrl.internalData.map((r: any) => r.qty)).toEqual([3, null])
  })

  it('a type without fill still goes through the column pipeline', () => {
    const col = fillFieldColumn({ field: 'p', header: 'P', fieldType: 'testPerson', fieldProps: { summary: 'filled' } })
    expect(typeof col.summary).toBe('function')
    expect((col.summary as (v: number[], rows: unknown[]) => string)([], [{ p: 'a' }, { p: '' }, { p: 'b' }])).toBe('2')
    expect(originalColumn(col)).toEqual({ field: 'p', header: 'P', fieldType: 'testPerson', fieldProps: { summary: 'filled' } })
    expect(plainDef(col)).not.toHaveProperty('summary')
  })
})

describe('the "+" column on a mounted grid', () => {
  it('opens the field editor and creates the field', async () => {
    const added: any[] = []
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: [{ id: 1, name: 'a' }],
        columns: [{ field: 'name', header: 'Name' }],
        getRowId: (r: { id: number }) => String(r.id),
        columnAdder: { types: ['text', 'number', 'singleSelect', 'rating'] },
        onColumnAdd: (e: unknown) => added.push(e),
        containerHeight: 200,
        virtualization: false,
        columnVirtualization: false,
        showRowSelection: false,
      },
    })
    try {
      await settle()
      const plus = target.querySelector<HTMLButtonElement>('thead .sv-field-column-adder-button')!
      expect(plus).not.toBeNull()
      plus.click()
      await until(() => !!document.querySelector('.sv-fed'), 'the field editor')
      // Only the types the prop allows, in their picker groups.
      expect([...document.querySelectorAll('.sv-fed-type')].map((b) => b.textContent?.trim())).toEqual(['Single line text', 'Single select', 'Number', 'Rating'])
      const name = document.querySelector<HTMLInputElement>('#sv-fed-name')!
      name.value = 'Score'
      name.dispatchEvent(new Event('input', { bubbles: true }))
      ;[...document.querySelectorAll<HTMLButtonElement>('.sv-fed-type')].find((b) => b.textContent?.includes('Rating'))!.click()
      await settle()
      ;[...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === 'Create field')!.click()
      await until(() => !document.querySelector('.sv-fed'), 'the editor to close')
      expect(added[0].column).toMatchObject({ id: 'score', header: 'Score', fieldType: 'rating' })
      await until(() => [...target.querySelectorAll('thead th')].some((th) => th.textContent?.includes('Score')), 'the new header')

      // Left unnamed, a field is named after its type.
      target.querySelector<HTMLButtonElement>('thead .sv-field-column-adder-button')!.click()
      await until(() => !!document.querySelector('.sv-fed'), 'the field editor again')
      ;[...document.querySelectorAll<HTMLButtonElement>('.sv-fed-type')].find((b) => b.textContent?.includes('Number'))!.click()
      await settle()
      expect(document.querySelector<HTMLInputElement>('#sv-fed-name')!.placeholder).toBe('Number')
      ;[...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === 'Create field')!.click()
      await until(() => !document.querySelector('.sv-fed'), 'the editor to close again')
      expect(added[1].column).toMatchObject({ header: 'Number', fieldType: 'number' })
    } finally {
      unmount(app)
      target.remove()
    }
  })
})
