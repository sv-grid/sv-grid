import { afterEach, describe, expect, it } from 'vitest'
import { enableFields } from './index'
import { fillFieldColumn } from './registry.svelte'
import { registerLinkedTable, setFieldUsers } from './sources.svelte'
import { fieldCopyText } from './copy-text'

enableFields()

const accounts = [
  { id: 'a1', name: 'Northwind' },
  { id: 'a2', name: 'Acme' },
]
let forget = () => {}
afterEach(() => forget())

const col = (def: Record<string, unknown>) => ({ columnDef: fillFieldColumn(def) })
const parse = (def: Record<string, unknown>, raw: string, newValue: unknown = raw) =>
  (fillFieldColumn(def).valueParser as (p: unknown) => unknown)({ newValue, oldValue: null, rawInput: raw, data: {}, columnId: String(def.field) })

describe('copy and paste of fields that store ids', () => {
  it('a link copies its names and a pasted name or id becomes the id', () => {
    forget = registerLinkedTable({ id: 'accounts', name: 'Accounts', primaryField: 'name', rows: accounts })
    const link = { field: 'account', fieldType: 'link', fieldProps: { table: 'accounts' } }
    expect(fieldCopyText({ value: ['a1', 'a2'], column: col(link), row: {} })).toBe('Northwind, Acme')
    expect(parse(link, 'Northwind, Acme')).toEqual(['a1', 'a2'])
    expect(parse(link, 'a2, nobody, ACME')).toEqual(['a2'])
    expect(parse({ ...link, fieldProps: { table: 'accounts', multiple: false } }, 'Acme, Northwind')).toEqual(['a2'])
    // The picker commits ids, not text: those pass through.
    expect(parse(link, '', ['a1'])).toEqual([])
    const picked = (fillFieldColumn(link).valueParser as (p: unknown) => unknown)({ newValue: ['a1'], oldValue: null, rawInput: ['a1'], data: {}, columnId: 'account' })
    expect(picked).toEqual(['a1'])
  })

  it('people copy by name, attachments by URL, other values as stored', () => {
    setFieldUsers([{ id: 'u1', name: 'Maya Chen' }])
    expect(fieldCopyText({ value: 'u1', column: col({ field: 'owner', fieldType: 'user' }), row: {} })).toBe('Maya Chen')
    const files = [{ id: 'f1', name: 'brief.pdf', url: 'https://x.test/brief.pdf' }, { id: 'f2', name: 'a.png', url: 'https://x.test/a.png' }]
    expect(fieldCopyText({ value: files, column: col({ field: 'files', fieldType: 'attachment' }), row: {} })).toBe('https://x.test/brief.pdf https://x.test/a.png')
    expect(fieldCopyText({ value: 1250, column: col({ field: 'n', fieldType: 'number', fieldProps: { format: 'currency' } }), row: {} })).toBe(1250)
    expect(fieldCopyText({ value: 'x', column: { columnDef: { field: 'plain' } }, row: {} })).toBe('x')
  })

  it('a name with a comma or a quote is quoted, and pastes back as the same record', () => {
    const rows = [
      { id: 'c1', name: 'Acme, Inc.' },
      { id: 'c2', name: 'The "Big" Shop' },
      { id: 'c3', name: 'Globex' },
    ]
    forget = registerLinkedTable({ id: 'companies', name: 'Companies', primaryField: 'name', rows })
    const link = { field: 'company', fieldType: 'link', fieldProps: { table: 'companies' } }
    const text = fieldCopyText({ value: ['c1', 'c2', 'c3'], column: col(link), row: {} })
    expect(text).toBe('"Acme, Inc.", "The ""Big"" Shop", Globex')
    expect(parse(link, String(text))).toEqual(['c1', 'c2', 'c3'])
  })

  it('several people with a comma in a name round-trip; one person copies as shown', () => {
    setFieldUsers([{ id: 'u1', name: 'Chen, Maya' }, { id: 'u2', name: 'Bo' }])
    const team = { field: 'team', fieldType: 'user', fieldProps: { multiple: true } }
    const text = fieldCopyText({ value: ['u1', 'u2'], column: col(team), row: {} })
    expect(text).toBe('"Chen, Maya", Bo')
    expect(parse(team, String(text))).toEqual(['u1', 'u2'])
    const owner = { field: 'owner', fieldType: 'user' }
    expect(fieldCopyText({ value: 'u1', column: col(owner), row: {} })).toBe('Chen, Maya')
    expect(parse(owner, 'Chen, Maya')).toBe('u1')
  })

  it('an attachment stored with a relative URL copies as an absolute one, so it pastes back', () => {
    const files = [{ id: 'f1', name: 'brief.pdf', url: '/api/files/123' }]
    const text = String(fieldCopyText({ value: files, column: col({ field: 'files', fieldType: 'attachment' }), row: {} }))
    expect(text).toBe(new URL('/api/files/123', location.href).href)
    const pasted = parse({ field: 'files', fieldType: 'attachment' }, text) as Array<{ url: string }>
    expect(pasted.map((a) => a.url)).toEqual([text])
  })
})
