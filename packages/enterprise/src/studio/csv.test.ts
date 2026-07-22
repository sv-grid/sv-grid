import { describe, it, expect } from 'vitest'
import { parseCsv, detectDelimiter, csvToEntity } from './csv.js'

describe('parseCsv', () => {
  it('parses a simple grid', () => {
    expect(parseCsv('a,b,c\n1,2,3\n4,5,6')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
  })

  it('handles quoted fields, commas, escaped quotes, and embedded newlines', () => {
    const text = 'name,note\n"Doe, John","said ""hi"""\n"Ada","line1\nline2"'
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Doe, John', 'said "hi"'],
      ['Ada', 'line1\nline2'],
    ])
  })

  it('auto-detects the delimiter (semicolon / tab / pipe), ignoring quoted separators', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(detectDelimiter('a|b|c')).toBe('|')
    expect(detectDelimiter('a,b,c')).toBe(',')
    // A comma inside a quoted header field must not sway a semicolon file.
    expect(detectDelimiter('"a,x";b;c\n1;2;3')).toBe(';')
  })

  it('parses a semicolon-delimited (European/Excel) file', () => {
    expect(parseCsv('name;amount\n"Doe; John";1.200')).toEqual([
      ['name', 'amount'],
      ['Doe; John', '1.200'],
    ])
  })

  it('handles CRLF and a trailing newline, and strips a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('csvToEntity', () => {
  it('infers types per column and coerces values', () => {
    const csv = 'id,name,mrr,active,joined\n1,Ada,1200,true,2024-01-02\n2,Alan,240.5,no,2024-03-04'
    const { schema, rows } = csvToEntity('customers', csv)
    const t = Object.fromEntries(schema.fields.map((f) => [f.field, f.type]))
    expect(t).toEqual({ id: 'number', name: 'text', mrr: 'number', active: 'boolean', joined: 'dateString' })
    expect(rows[0]).toEqual({ id: 1, name: 'Ada', mrr: 1200, active: true, joined: '2024-01-02' })
    expect(rows[1]!.mrr).toBe(240.5)
    expect(rows[1]!.active).toBe(false)
  })

  it('marks an existing id column as the primary key', () => {
    const { schema } = csvToEntity('t', 'id,name\n1,a')
    const id = schema.fields.find((f) => f.field === 'id')!
    expect(id.primaryKey).toBe(true)
    expect(id.readonly).toBe(true)
  })

  it('synthesizes a string id when none is present', () => {
    const { schema, rows } = csvToEntity('t', 'name,city\nAda,London\nAlan,Leeds')
    const id = schema.fields.find((f) => f.field === 'id')!
    expect(id.primaryKey).toBe(true)
    expect(rows.map((r) => r.id)).toEqual(['1', '2'])
    expect(rows[0]).toMatchObject({ id: '1', name: 'Ada', city: 'London' })
  })

  it('renames unsafe headers to safe keys and reports them', () => {
    const { schema, renamed, rows } = csvToEntity('t', 'First Name,E-mail Address\nAda,ada@x.io')
    const keys = schema.fields.map((f) => f.field)
    expect(keys).toContain('first_name')
    expect(keys).toContain('e_mail_address')
    expect(renamed.map((r) => r.field)).toEqual(expect.arrayContaining(['first_name', 'e_mail_address']))
    expect(rows[0]).toMatchObject({ first_name: 'Ada', e_mail_address: 'ada@x.io' })
  })

  it('treats empty cells as null and parses thousands separators', () => {
    const { rows } = csvToEntity('t', 'id,amount\n1,"1,200"\n2,')
    expect(rows[0]!.amount).toBe(1200)
    expect(rows[1]!.amount).toBeNull()
  })

  it('returns an empty entity for empty input', () => {
    expect(csvToEntity('t', '').rows).toEqual([])
  })
})
