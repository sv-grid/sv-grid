/**
 * A base to SQL and back: baseToSql writes the tables, links, records and
 * the svgrid: comments; run on a real Postgres (PGlite), baseFromDatabase
 * reads the same base again: field types and options, the fields with no
 * column, the links (one, many, to itself), views, automations and records.
 */
import { describe, expect, it, vi } from 'vitest'

// Each test boots a Postgres (PGlite): seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 })
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { enableFields } from './index'
import { baseToSql, sqlName } from './base-sql'
import { baseFromDatabase, baseFromSupabase } from './base-connect'
import { createBaseSync } from './base-sync'
import { tableFields } from './automations.svelte'
import { registerFieldType } from './registry.svelte'
import type { BaseTable } from './base-tables'

enableFields()

const TODAY = new Date()
const iso = (offset: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function template(): BaseTable[] {
  return [
    {
      id: 'tpl-bugs',
      name: 'Bugs',
      primaryField: 'bug',
      columns: [
        { field: 'bug', header: 'Bug', width: 260, fieldType: 'text' },
        { field: 'severity', header: 'Severity', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'High', color: '#ff6f2c' }, { value: 'Low', color: '#94a3b8' }] } },
        { field: 'areas', header: 'Areas', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'UI' }, { value: 'API' }] } },
        { field: 'assignee', header: 'Assignee', fieldType: 'user' },
        { field: 'fixedOn', header: 'Fixed on', fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'cost', header: 'Cost', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0 } },
        { field: 'release', header: 'Release', fieldType: 'link', fieldProps: { table: 'tpl-releases', multiple: false, inverse: 'bugs' } },
        { field: 'blockedBy', header: 'Blocked by', fieldType: 'link', fieldProps: { table: 'tpl-bugs', multiple: true } },
        { field: 'label', header: 'Label', fieldType: 'formula', fieldProps: { formula: '{Bug} & " (" & {Severity} & ")"' } },
        { field: 'start', header: 'Start', fieldType: 'button', fieldProps: { label: 'Start' } },
      ],
      data: [
        { id: 'b1', bug: 'Checkout broken', severity: 'High', areas: ['UI', 'API'], assignee: 'u2', fixedOn: iso(-3), cost: 1200, release: ['r1'], blockedBy: [] },
        { id: 'b2', bug: "Typo on 'pricing'", severity: 'Low', areas: [], assignee: '', fixedOn: null, cost: null, release: [], blockedBy: ['b1'] },
      ],
      views: [{ id: 'board', name: 'Board', type: 'kanban', stackBy: 'severity' }],
      automations: [
        { id: 'a', name: 'High bug', enabled: true, trigger: { type: 'recordCreated' }, actions: [{ type: 'createRecord', table: 'tpl-releases', values: { version: 'hotfix' } }] },
      ],
    },
    {
      id: 'tpl-releases',
      name: 'Releases',
      primaryField: 'version',
      columns: [
        { field: 'version', header: 'Version', fieldType: 'text' },
        { field: 'bugs', header: 'Bugs', fieldType: 'link', fieldProps: { table: 'tpl-bugs', multiple: true, inverse: 'release' } },
        { field: 'count', header: 'Bug count', fieldType: 'count', fieldProps: { linkField: 'bugs' } },
      ],
      data: [{ id: 'r1', version: '2.4', bugs: ['b1'] }],
    },
  ]
}

describe('a base to SQL and back', () => {
  it('names tables and columns the SQL way', () => {
    expect(sqlName('Key results')).toBe('key_results')
    expect(sqlName('fixedOn')).toBe('fixed_on')
    expect(sqlName('2024 plan')).toBe('t_2024_plan')
  })

  it('writes tables, a foreign key, a junction, comments and records', () => {
    const sql = baseToSql(template(), { today: TODAY })
    expect(sql).toContain('create table "bugs"')
    expect(sql).toContain('"release_id" text')
    expect(sql).toContain('create table "bugs_blocked_by"')
    expect(sql).toContain('"areas" text[]')
    expect(sql).toContain('current_date - 3')
    // The quote in the record survives.
    expect(sql).toContain("'Typo on ''pricing'''")
    expect(sql).toMatch(/comment on table "bugs" is 'svgrid:/)
    expect(sql).toContain('alter table "bugs" add foreign key ("release_id") references "releases"("id")')
  })

  it('opens again as the same base, on a real Postgres', async () => {
    const db = new PGlite()
    await db.exec(baseToSql(template(), { today: TODAY }))
    const execute = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows as Record<string, unknown>[]
    let tables = await baseFromDatabase({ execute })
    expect(tables.map((t) => [t.id, t.name])).toEqual([['bugs', 'Bugs'], ['releases', 'Releases']])
    const bugs = tables[0]!
    expect(bugs.primaryField).toBe('bug')
    expect(bugs.columns.map((d) => [d.field, d.fieldType])).toEqual([
      ['bug', 'text'],
      ['severity', 'singleSelect'],
      ['areas', 'multiSelect'],
      ['assignee', 'user'],
      ['fixedOn', 'date'],
      ['cost', 'number'],
      ['release', 'link'],
      ['blockedBy', 'link'],
      ['label', 'formula'],
      ['start', 'button'],
    ])
    expect(bugs.columns[1]!.fieldProps.options[0]).toEqual({ value: 'High', color: '#ff6f2c' })
    expect(bugs.columns[5]!.fieldProps.format).toBe('currency')
    expect(bugs.columns[6]!.fieldProps).toMatchObject({ table: 'releases', inverse: 'bugs' })
    expect(bugs.views).toEqual([{ id: 'board', name: 'Board', type: 'kanban', stackBy: 'severity' }])
    expect(bugs.automations![0]!.actions[0]).toMatchObject({ type: 'createRecord', table: 'releases' })
    expect(tables[1]!.columns.map((d) => d.field)).toEqual(['version', 'bugs', 'count'])

    // The records, through the sources.
    const sync = createBaseSync({ getTables: () => tables, apply: (n) => (tables = n) })
    await sync.load()
    const b1 = tables[0]!.data.find((r) => r.id === 'b1')!
    expect(b1).toMatchObject({ bug: 'Checkout broken', severity: 'High', areas: ['UI', 'API'], assignee: 'u2', fixedOn: iso(-3), cost: 1200, release: ['r1'] })
    expect(tables[0]!.data.find((r) => r.id === 'b2')!.blockedBy).toEqual(['b1'])
    expect(tables[1]!.data[0]!.bugs).toEqual(['b1'])
    const label = tableFields(tables[0]!).get('label')!
    expect((label.def.fieldFn as (r: unknown) => unknown)(b1)).toBe('Checkout broken (High)')

    // An edit to a renamed column goes to its column.
    tables = tables.map((t, i) => (i === 0 ? { ...t, data: t.data.map((r) => (r === tables[0]!.data.find((x) => x.id === 'b2') ? { ...r, fixedOn: iso(0) } : r)) } : t))
    sync.push(tables)
    await sync.settled()
    const { rows } = await db.query<{ fixed_on: Date }>(`select fixed_on from bugs where id = 'b2'`)
    expect(rows[0]!.fixed_on).toBeTruthy()

    // A record added later gets its key from the database (a Supabase insert has none).
    const made = await db.query<{ id: string }>(`insert into bugs (bug) values ('New') returning id`)
    expect(made.rows[0]!.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('a registered type gets the SQL type its cellDataType says, on a real Postgres', async () => {
    registerFieldType({ id: 'sqlScore', label: 'Score', fill: (d) => ({ ...d, cellDataType: 'number' }) })
    registerFieldType({ id: 'sqlFlag', label: 'Flag', fill: (d) => ({ ...d, cellDataType: 'boolean' }) })
    registerFieldType({ id: 'sqlDay', label: 'Day', fill: (d) => ({ ...d, cellDataType: 'dateString' }) })
    registerFieldType({ id: 'sqlWhen', label: 'When', fill: (d) => ({ ...d, cellDataType: 'date' }) })
    registerFieldType({ id: 'sqlPhone', label: 'Phone' })
    const table: BaseTable = {
      id: 'items',
      name: 'Items',
      primaryField: 'phone',
      columns: [
        { field: 'phone', header: 'Phone', fieldType: 'sqlPhone' },
        { field: 'score', header: 'Score', fieldType: 'sqlScore' },
        { field: 'flag', header: 'Flag', fieldType: 'sqlFlag' },
        { field: 'day', header: 'Day', fieldType: 'sqlDay' },
        { field: 'when', header: 'When', fieldType: 'sqlWhen' },
      ],
      data: [{ id: 'i1', phone: '+14155550123', score: 72, flag: true, day: '2026-03-02', when: '2026-03-02T10:30:00Z' }],
    }
    const sql = baseToSql([table], { relativeDays: 0 })
    expect(sql).toContain('"phone" text')
    expect(sql).toContain('"score" double precision')
    expect(sql).toContain('"flag" boolean')
    expect(sql).toContain('"day" date')
    expect(sql).toContain('"when" timestamptz')
    const db = new PGlite()
    await db.exec(sql)
    const { rows } = await db.query<Record<string, unknown>>(`select phone, score, flag, day, "when" from items`)
    expect(rows[0]).toMatchObject({ phone: '+14155550123', score: 72, flag: true })
    expect(rows[0]!.day).toBeInstanceOf(Date)
    expect((rows[0]!.when as Date).toISOString()).toBe('2026-03-02T10:30:00.000Z')
  })

  it('opens again as the same base on Supabase, from the API description', async () => {
    const db = new PGlite()
    await db.exec(baseToSql(template(), { today: TODAY }))
    const openApi = await postgrestDescription(db)
    const fetchFn = (async () => new Response(JSON.stringify(openApi), { status: 200 })) as unknown as typeof fetch
    const tables = await baseFromSupabase({ client: {} as never, url: 'https://x.supabase.co', key: 'anon', fetch: fetchFn, choices: false, realtime: false })
    expect(tables.map((t) => [t.id, t.name])).toEqual([['bugs', 'Bugs'], ['releases', 'Releases']])
    const bugs = tables[0]!
    expect(bugs.columns.map((d) => d.field)).toEqual(['bug', 'severity', 'areas', 'assignee', 'fixedOn', 'cost', 'release', 'blockedBy', 'label', 'start'])
    expect(bugs.columns[1]!.fieldProps.options[0]).toEqual({ value: 'High', color: '#ff6f2c' })
    expect(bugs.columns[6]!.fieldProps).toMatchObject({ table: 'releases', inverse: 'bugs' })
    expect(bugs.views).toEqual([{ id: 'board', name: 'Board', type: 'kanban', stackBy: 'severity' }])
    expect(tables[1]!.columns.map((d) => d.field)).toEqual(['version', 'bugs', 'count'])
  })
})

/** What PostgREST serves at /rest/v1/: a table's comment as its description, a column's with notes after it. */
async function postgrestDescription(db: PGlite) {
  const q = async <T,>(sql: string) => (await db.query<T>(sql)).rows
  const cols = await q<{ t: string; c: string; type: string }>(`select table_name as t, column_name as c, data_type as type from information_schema.columns where table_schema = 'public' order by ordinal_position`)
  const keys = await q<{ t: string; c: string; kind: string; ft: string | null; fc: string | null }>(
    `select k.table_name as t, k.column_name as c, tc.constraint_type as kind, u.table_name as ft, u.column_name as fc
     from information_schema.table_constraints tc
     join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name
     left join information_schema.constraint_column_usage u on u.constraint_name = tc.constraint_name and tc.constraint_type = 'FOREIGN KEY'
     where tc.table_schema = 'public' and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY')`,
  )
  const notes = await q<{ t: string; c: string | null; text: string }>(
    `select c.relname as t, a.attname as c, d.description as text from pg_description d
     join pg_class c on c.oid = d.objoid join pg_namespace n on n.oid = c.relnamespace
     left join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid and d.objsubid > 0
     where n.nspname = 'public'`,
  )
  const definitions: Record<string, { description?: string; properties: Record<string, Record<string, unknown>> }> = {}
  for (const { t, c, type } of cols) {
    const def = (definitions[t] ??= { properties: {} })
    const tableNote = notes.find((n) => n.t === t && n.c == null)
    if (tableNote) def.description = tableNote.text
    const extra = keys
      .filter((k) => k.t === t && k.c === c)
      .map((k) => (k.kind === 'PRIMARY KEY' ? 'This is a Primary Key.<pk/>' : `This is a Foreign Key to \`${k.ft}.${k.fc}\`.<fk table='${k.ft}' column='${k.fc}'/>`))
    const comment = notes.find((n) => n.t === t && n.c === c)?.text
    const description = [comment, extra.length ? `Note:\n${extra.join('\n')}` : undefined].filter(Boolean).join('\n\n')
    def.properties[c] = {
      type: type === 'double precision' || type === 'integer' ? 'number' : type === 'boolean' ? 'boolean' : type === 'ARRAY' ? 'array' : 'string',
      ...(description ? { description } : {}),
    }
  }
  return { definitions }
}

describe('the template SQL npm create ships', () => {
  // Tests run from packages/enterprise.
  const dir = join(process.cwd(), '..', 'create-sv-grid', 'templates', 'base', 'db', 'templates')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'))

  it('has a file per template', () => {
    expect(files.length).toBeGreaterThanOrEqual(11)
  })

  it.each(files)('%s runs on Postgres and opens as its base', async (file) => {
    const db = new PGlite()
    await db.exec(readFileSync(join(dir, file), 'utf8'))
    const execute = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows as Record<string, unknown>[]
    let tables = await baseFromDatabase({ execute })
    expect(tables.length).toBeGreaterThan(1)
    for (const t of tables) {
      expect(t.views?.length, `${t.name} views`).toBeGreaterThan(0)
      expect(t.columns.some((d) => d.fieldType === 'link'), `${t.name} links`).toBe(true)
    }
    const sync = createBaseSync({ getTables: () => tables, apply: (n) => (tables = n) })
    await sync.load()
    expect(tables[0]!.data.length).toBeGreaterThan(2)
  })
})
