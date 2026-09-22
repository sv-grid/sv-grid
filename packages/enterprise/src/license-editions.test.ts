// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLicenseKey, setLicenseKey } from './license'
import { dismissUpgradePrompt } from './upgrade-prompt'
import { emitUnlicensedNudge } from './watermark'
import { createRestDataSource } from './sources/rest'
import { createSupabaseDataSource } from './sources/supabase'
import { createSupabaseRealtime } from './sources/realtime-supabase'
import { createSupabaseAuth } from './sources/auth-supabase'
import { createSqlDataSource } from './sveltekit/sql-source'
import type { EntitySchema } from './schema'

// Keep everything else in the module real; only the watermark emitter is spied.
vi.mock('./watermark', async (importOriginal) => ({
  ...(await importOriginal()),
  emitUnlicensedNudge: vi.fn(),
}))

// The pricing page sells the SQL, REST and Supabase data sources as Suite
// features, so every one of them has to nudge a Grid key the same way. Before
// this test the two Supabase modules called the edition-blind nudge, so a Grid
// key that opened createRestDataSource got the watermark and one that opened
// createSupabaseDataSource did not.
const GRID_KEY = 'SVENTERPRISE-GRID-ACME-5-209912-9XYZ'
const SUITE_KEY = 'SVENTERPRISE-SUITE-ACME-5-209912-9XYZ'

type Row = { id: number; name: string }
const schema: EntitySchema<Row> = {
  name: 'rows',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'name', type: 'text' },
  ],
}

// The constructors touch nothing until a request comes in, so inert stubs are
// enough to get past the gate at the top of each one.
const restClient = { url: 'https://example.test/rows', schema, fetch: (() => Promise.reject(new Error('unused'))) as unknown as typeof fetch }
const supabaseClient: any = { from: () => ({}) }
const realtimeChannel: any = { on: () => realtimeChannel, subscribe: () => realtimeChannel }
const realtimeClient = { channel: () => realtimeChannel, removeChannel: () => {} }
const authClient: any = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
}

const studioSurfaces: Array<[string, () => unknown]> = [
  ['createRestDataSource', () => createRestDataSource<Row>(restClient)],
  ['createSqlDataSource', () => createSqlDataSource<Row>({ schema, table: 'rows', execute: () => Promise.resolve([]) })],
  ['createSupabaseDataSource', () => createSupabaseDataSource<Row>({ client: supabaseClient, table: 'rows', schema })],
  ['createSupabaseRealtime', () => createSupabaseRealtime<Row>({ client: realtimeClient, table: 'rows', onChange: () => {} })],
  ['createSupabaseAuth', () => createSupabaseAuth({ client: authClient, onChange: () => {} })],
]

const watermarkCalls = () => vi.mocked(emitUnlicensedNudge).mock.calls.length

describe('the Studio data sources on a Grid key', () => {
  beforeEach(() => {
    clearLicenseKey()
    dismissUpgradePrompt()
    vi.mocked(emitUnlicensedNudge).mockClear()
    // Spying on an already-spied method returns the same spy with its calls
    // intact, so clear it here or the notice count reads across tests.
    vi.spyOn(console, 'info').mockImplementation(() => {}).mockClear()
    document.body.innerHTML = ''
  })

  for (const [name, open] of studioSurfaces) {
    it(`${name} nudges a Grid key and stays quiet on a Suite key`, () => {
      setLicenseKey(GRID_KEY)
      expect(() => open()).not.toThrow()
      expect(watermarkCalls()).toBe(1)

      vi.mocked(emitUnlicensedNudge).mockClear()
      setLicenseKey(SUITE_KEY)
      open()
      expect(watermarkCalls()).toBe(0)
    })
  }

  it('the Grid key gets the edition notice, not the unlicensed one', () => {
    const info = vi.mocked(console.info)
    setLicenseKey(GRID_KEY)
    createSupabaseDataSource<Row>({ client: supabaseClient, table: 'rows', schema })
    const notice = info.mock.calls.flat().filter((m) => typeof m === 'string' && m.includes('does not cover'))
    expect(notice).toHaveLength(1)
    expect(notice[0]).toMatch(/Grid license does not cover/)
  })
})
