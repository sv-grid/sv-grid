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
// A test key in place of the real one (see license-core.test.ts).
vi.mock('./license-hash', async () => {
  const { sha256Hex } = await import('./sha256')
  return { LICENSE_KEY_SHA256: sha256Hex('test-license-key-0000') }
})

// Every customer has the same key and it covers every edition, so the Studio
// data sources (sold as Suite features) stay quiet on it. Edition keys are
// gone: a GRID-format key is just a string that is not the license key, and
// gets the same nudge as no key, never the old "does not cover" notice.
const LICENSE_KEY = 'test-license-key-0000'
const FORGED_GRID_KEY = 'SVENTERPRISE-GRID-ACME-5-209912-9XYZ'

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

describe('the Studio data sources and the one license key', () => {
  beforeEach(() => {
    clearLicenseKey()
    dismissUpgradePrompt()
    vi.mocked(emitUnlicensedNudge).mockClear()
    vi.spyOn(console, 'info').mockImplementation(() => {}).mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {}).mockClear()
    document.body.innerHTML = ''
  })

  for (const [name, open] of studioSurfaces) {
    it(`${name} stays quiet on the license key and nudges a forged Grid key`, () => {
      setLicenseKey(LICENSE_KEY)
      expect(() => open()).not.toThrow()
      expect(watermarkCalls()).toBe(0)

      setLicenseKey(FORGED_GRID_KEY)
      expect(() => open()).not.toThrow()
      expect(watermarkCalls()).toBe(1)
    })
  }

  it('a forged Grid key gets the invalid-key warning, not the edition notice', () => {
    const info = vi.mocked(console.info)
    const warn = vi.mocked(console.warn)
    setLicenseKey(FORGED_GRID_KEY)
    createSupabaseDataSource<Row>({ client: supabaseClient, table: 'rows', schema })
    const edition = info.mock.calls.flat().filter((m) => typeof m === 'string' && m.includes('does not cover'))
    const invalid = warn.mock.calls.flat().filter((m) => typeof m === 'string' && m.includes('is not valid'))
    expect(edition).toHaveLength(0)
    expect(invalid).toHaveLength(1)
  })
})
