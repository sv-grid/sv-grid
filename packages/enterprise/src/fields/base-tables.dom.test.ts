import { describe, expect, it, vi } from 'vitest'
import {
  addInverse,
  blankTable,
  checkLinks,
  copyTable,
  dropInverse,
  fieldChanged,
  linkReaders,
  removeLinkField,
  removeTable,
  syncAllInverses,
  syncInverse,
  type BaseTable,
} from './base-tables'
import { getLinkedTable, registerLinkedTable, unregisterLinkedTable, type LinkedTable } from './sources.svelte'

const deals = (): BaseTable => ({
  id: 'deals',
  name: 'Deals',
  primaryField: 'deal',
  columns: [
    { id: 'deal', field: 'deal', header: 'Deal', fieldType: 'text' },
    { id: 'account', field: 'account', header: 'Account', fieldType: 'link', fieldProps: { table: 'accounts', multiple: false } },
  ],
  data: [
    { id: 'd1', deal: 'Renewal', account: ['a1'] },
    { id: 'd2', deal: 'Pilot', account: ['a2'] },
    { id: 'd3', deal: 'Expansion', account: ['a1'] },
  ],
})
const accounts = (): BaseTable => ({
  id: 'accounts',
  name: 'Accounts',
  primaryField: 'name',
  columns: [
    { id: 'name', field: 'name', header: 'Name', fieldType: 'text' },
    { id: 'deals', field: 'deals', header: 'Deals', fieldType: 'text' },
  ],
  data: [
    { id: 'a1', name: 'Contoso' },
    { id: 'a2', name: 'Fabrikam' },
    { id: 'a3', name: 'Litware' },
  ],
})
const table = (list: BaseTable[], id: string) => list.find((t) => t.id === id)!
const col = (t: BaseTable, id: string) => t.columns.find((d) => (d.id ?? d.field) === id)

describe('base tables: links between tables', () => {
  it('a link field gets a field back in the other table, named after its table, with the records that link', () => {
    const next = addInverse([deals(), accounts()], 'deals', 'account')
    const acc = table(next, 'accounts')
    // "Deals" is taken by a text field, so the field back is "Deals 2".
    const back = acc.columns.at(-1)!
    expect(back).toMatchObject({ header: 'Deals 2', fieldType: 'link', fieldProps: { table: 'deals', multiple: true, inverse: 'account' } })
    expect(col(table(next, 'deals'), 'account')!.fieldProps.inverse).toBe(back.id)
    // A record nothing links to is left as it was.
    expect(acc.data.map((r) => r[back.field])).toEqual([['d1', 'd3'], ['d2'], undefined])
  })

  it('an edit on either side shows on the other, keeping the order already there', () => {
    let next = addInverse([deals(), accounts()], 'deals', 'account')
    const backField = String(table(next, 'accounts').columns.at(-1)!.field)
    // d2 moves from Fabrikam to Contoso.
    next = next.map((t) => (t.id === 'deals' ? { ...t, data: t.data.map((r) => (r.id === 'd2' ? { ...r, account: ['a1'] } : r)) } : t))
    next = syncInverse(next, 'deals', 'account')
    expect(table(next, 'accounts').data.map((r) => r[backField])).toEqual([['d1', 'd3', 'd2'], [], undefined])
    // And from the accounts side: Litware takes d1.
    next = next.map((t) => (t.id === 'accounts' ? { ...t, data: t.data.map((r) => (r.id === 'a3' ? { ...r, [backField]: ['d1'] } : r.id === 'a1' ? { ...r, [backField]: ['d3', 'd2'] } : r)) } : t))
    next = syncInverse(next, 'accounts', backField)
    expect(table(next, 'deals').data.map((r) => r.account)).toEqual([['a3'], ['a1'], ['a1']])
  })

  it('deleted records leave the other side', () => {
    let next = addInverse([deals(), accounts()], 'deals', 'account')
    const backField = String(table(next, 'accounts').columns.at(-1)!.field)
    next = next.map((t) => (t.id === 'deals' ? { ...t, data: t.data.filter((r) => r.id !== 'd1') } : t))
    next = syncAllInverses(next, 'deals')
    expect(table(next, 'accounts').data.map((r) => r[backField])).toEqual([['d3'], ['d2'], undefined])
  })

  it('pointing a link at another table moves the field back and clears the old ids', () => {
    const people: BaseTable = { id: 'people', name: 'People', columns: [{ id: 'name', field: 'name', header: 'Name', fieldType: 'text' }], data: [{ id: 'p1', name: 'Ana' }] }
    let next = addInverse([deals(), accounts(), people], 'deals', 'account')
    const prev = { ...col(table(next, 'deals'), 'account')! }
    next = next.map((t) => (t.id === 'deals' ? { ...t, columns: t.columns.map((d) => (d.id === 'account' ? { ...d, fieldProps: { ...d.fieldProps, table: 'people' } } : d)) } : t))
    next = fieldChanged(next, 'deals', prev, 'account')
    expect(table(next, 'accounts').columns.some((d) => d.fieldProps?.table === 'deals')).toBe(false)
    expect(table(next, 'people').columns.at(-1)).toMatchObject({ header: 'Deals', fieldProps: { table: 'deals', inverse: 'account' } })
    expect(table(next, 'deals').data.map((r) => r.account)).toEqual([[], [], []])
  })

  it('a link turned into text, or deleted, takes its field back with it', () => {
    const next = addInverse([deals(), accounts()], 'deals', 'account')
    const prev = { ...col(table(next, 'deals'), 'account')! }
    const turned = next.map((t) => (t.id === 'deals' ? { ...t, columns: t.columns.map((d) => (d.id === 'account' ? { ...d, fieldType: 'text' } : d)) } : t))
    const after = fieldChanged(turned, 'deals', prev, 'account')
    expect(table(after, 'accounts').columns.map((d) => d.header)).toEqual(['Name', 'Deals'])
    expect(col(table(after, 'deals'), 'account')!.fieldProps.inverse).toBeUndefined()
    const dropped = dropInverse(next, prev)
    expect(table(dropped, 'accounts').columns.map((d) => d.header)).toEqual(['Name', 'Deals'])
    expect(Object.keys(table(dropped, 'accounts').data[0]!)).toEqual(['id', 'name'])
  })

  it('a duplicated link field gets its own field back', () => {
    let next = addInverse([deals(), accounts()], 'deals', 'account')
    const copy = { ...col(table(next, 'deals'), 'account')!, id: 'account_copy', field: 'account_copy', header: 'Account copy' }
    next = next.map((t) => (t.id === 'deals' ? { ...t, columns: [...t.columns, copy], data: t.data.map((r) => ({ ...r, account_copy: r.account })) } : t))
    next = addInverse(next, 'deals', 'account_copy')
    const backs = table(next, 'accounts').columns.filter((d) => d.fieldProps?.table === 'deals')
    expect(backs.map((d) => d.fieldProps.inverse)).toEqual(['account', 'account_copy'])
  })

  it('deleting a table deletes the link fields that point at it, and their values', () => {
    const next = removeTable(addInverse([deals(), accounts()], 'deals', 'account'), 'accounts')
    expect(next.map((t) => t.id)).toEqual(['deals'])
    expect(next[0]!.columns.map((d) => d.id)).toEqual(['deal'])
    expect(next[0]!.data[0]).toEqual({ id: 'd1', deal: 'Renewal' })
  })

  it('a single field back keeps the record that linked last, and the one before lets go', () => {
    // Accounts.deals links many, Deals.account one.
    let next = addInverse([deals(), accounts()], 'deals', 'account')
    const backField = String(table(next, 'accounts').columns.at(-1)!.field)
    // Litware takes d1 while Contoso still lists it.
    next = next.map((t) => (t.id === 'accounts' ? { ...t, data: t.data.map((r) => (r.id === 'a3' ? { ...r, [backField]: ['d1'] } : r)) } : t))
    next = syncInverse(next, 'accounts', backField)
    expect(table(next, 'deals').data.map((r) => r.account)).toEqual([['a3'], ['a2'], ['a1']])
    expect(table(next, 'accounts').data.map((r) => r[backField])).toEqual([['d3'], ['d2'], ['d1']])
    // Nothing left to move: a second sync changes nothing.
    expect(syncInverse(next, 'accounts', backField)).toBe(next)
    expect(syncInverse(next, 'deals', 'account')).toBe(next)
  })

  it('a link made single keeps the first id of each record, and the field back follows', () => {
    const many = deals()
    many.columns[1] = { ...many.columns[1]!, fieldProps: { table: 'accounts', multiple: true } }
    many.data[0] = { ...many.data[0]!, account: ['a1', 'a2'] }
    let next = addInverse([many, accounts()], 'deals', 'account')
    const backField = String(table(next, 'accounts').columns.at(-1)!.field)
    expect(table(next, 'accounts').data.map((r) => r[backField])).toEqual([['d1', 'd3'], ['d1', 'd2'], undefined])
    const prev = { ...col(table(next, 'deals'), 'account')! }
    next = next.map((t) => (t.id === 'deals' ? { ...t, columns: t.columns.map((d) => (d.id === 'account' ? { ...d, fieldProps: { ...d.fieldProps, multiple: false } } : d)) } : t))
    next = fieldChanged(next, 'deals', prev, 'account')
    expect(table(next, 'deals').data.map((r) => r.account)).toEqual([['a1'], ['a2'], ['a1']])
    expect(table(next, 'accounts').data.map((r) => r[backField])).toEqual([['d1', 'd3'], ['d2'], undefined])
  })

  it('warns once about an inverse that names no field, and about loaded sides that disagree', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const broken = deals()
      broken.columns[1] = { ...broken.columns[1]!, fieldProps: { table: 'accounts', multiple: false, inverse: 'nope' } }
      const list = [broken, accounts()]
      expect(syncInverse(list, 'deals', 'account')).toBe(list)
      syncInverse(list, 'deals', 'account')
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toContain('"nope"')

      const linked = addInverse([deals(), accounts()], 'deals', 'account')
      const seen: string[] = []
      expect(checkLinks(linked, (m) => seen.push(m))).toEqual([])
      // a2 drops d2 by hand: the two sides disagree, said once for the pair.
      const backField = String(table(linked, 'accounts').columns.at(-1)!.field)
      const off = linked.map((t) => (t.id === 'accounts' ? { ...t, data: t.data.map((r) => (r.id === 'a2' ? { ...r, [backField]: [] } : r)) } : t))
      const problems = checkLinks(off, (m) => seen.push(m))
      expect(problems).toHaveLength(1)
      expect(problems[0]).toContain('disagree')
      // Reporting writes nothing.
      expect(table(off, 'accounts').data[1]![backField]).toEqual([])
    } finally {
      warn.mockRestore()
    }
  })

  it('deleting a link field deletes the lookups, rollups and counts on both sides that read it', () => {
    let next = addInverse([deals(), accounts()], 'deals', 'account')
    const back = table(next, 'accounts').columns.at(-1)!
    next = next.map((t) =>
      t.id === 'deals'
        ? { ...t, columns: [...t.columns, { id: 'industry', field: 'industry', header: 'Industry', fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'name' } }] }
        : {
            ...t,
            columns: [
              ...t.columns,
              { id: 'count', field: 'count', header: 'Deal count', fieldType: 'count', fieldProps: { linkField: back.id } },
              { id: 'other', field: 'other', header: 'Other', fieldType: 'text', fieldProps: { linkField: back.id } },
            ],
          },
    )
    expect(linkReaders(table(next, 'accounts'), back).map((d) => d.id)).toEqual(['count'])
    const removed = col(table(next, 'deals'), 'account')!
    next = next.map((t) => (t.id === 'deals' ? { ...t, columns: t.columns.filter((d) => d !== removed) } : t))
    next = removeLinkField(next, 'deals', removed)
    expect(table(next, 'deals').columns.map((d) => d.id)).toEqual(['deal'])
    // A text field that happens to carry a linkField prop is not a reader.
    expect(table(next, 'accounts').columns.map((d) => d.header)).toEqual(['Name', 'Deals', 'Other'])
  })

  it('deleting a table deletes the lookups that read the links to it', () => {
    let next = addInverse([deals(), accounts()], 'deals', 'account')
    next = next.map((t) => (t.id === 'deals' ? { ...t, columns: [...t.columns, { id: 'acc', field: 'acc', header: 'Account name', fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'name' } }] } : t))
    expect(removeTable(next, 'accounts')[0]!.columns.map((d) => d.id)).toEqual(['deal'])
  })

  it('a new table and a copy get names and ids not taken, and records with ids', () => {
    const list = [deals(), accounts()]
    const t = blankTable(list)
    expect(t).toMatchObject({ id: 'table', name: 'Table', primaryField: 'name' })
    expect(t.data).toHaveLength(3)
    expect(new Set(t.data.map((r) => r.id)).size).toBe(3)
    const copy = copyTable(list, list[0]!)
    expect(copy).toMatchObject({ id: 'deals_copy', name: 'Deals copy' })
    expect(copy.data.map((r) => r.deal)).toEqual(['Renewal', 'Pilot', 'Expansion'])
    expect(copy.data.every((r, i) => r.id !== list[0]!.data[i]!.id)).toBe(true)
  })
})

describe('linked table registry', () => {
  const t = (name: string): LinkedTable => ({ id: 'reg-test', name, primaryField: 'name', rows: [] })

  it('a registration is forgotten only by its owner, and the one before shows again', () => {
    const a = {}
    const b = {}
    registerLinkedTable(t('App'))
    const offA = registerLinkedTable(t('Base A'), a)
    registerLinkedTable(t('Base B'), b)
    expect(getLinkedTable('reg-test')?.name).toBe('Base B')
    // Registering again under the same owner replaces that registration.
    registerLinkedTable(t('Base B renamed'), b)
    expect(getLinkedTable('reg-test')?.name).toBe('Base B renamed')
    offA()
    offA()
    expect(getLinkedTable('reg-test')?.name).toBe('Base B renamed')
    unregisterLinkedTable('reg-test', b)
    expect(getLinkedTable('reg-test')?.name).toBe('App')
    // Without an owner it is the app's own registration that goes.
    unregisterLinkedTable('reg-test')
    expect(getLinkedTable('reg-test')).toBeUndefined()
  })
})
