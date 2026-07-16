import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import { scaffold } from './scaffold'
import { summarizeVerify, verifyScaffold } from './verify'

const schema: EntitySchema = {
  name: 'customers',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
  ],
}

describe('verifyScaffold', () => {
  it('reports ok when the scaffolded Svelte page compiles', async () => {
    const { files } = scaffold(schema)
    const res = await verifyScaffold(files)
    expect(res.ok).toBe(true)
    expect(res.checked).toBeGreaterThan(0) // the .svelte page was compiled for real
    expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
  })

  it('flags a malformed Svelte file with an error', async () => {
    const res = await verifyScaffold([
      { path: 'Bad.svelte', description: '', contents: '{#if true}<p>oops' },
    ])
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.severity === 'error')).toBe(true)
  })

  it('skips non-svelte files (they need the project tsc)', async () => {
    const res = await verifyScaffold([{ path: 'x.ts', description: '', contents: 'export const a = 1' }])
    expect(res.skipped).toBe(1)
    expect(res.checked).toBe(0)
  })
})

describe('summarizeVerify', () => {
  it('summarizes ok, failure, and skipped', () => {
    expect(summarizeVerify({ ok: true, issues: [], checked: 2, skipped: 1 })).toMatch(/verified: 2/)
    expect(
      summarizeVerify({ ok: false, checked: 1, skipped: 0, issues: [{ path: 'p.svelte', severity: 'error', message: 'boom' }] }),
    ).toMatch(/VERIFICATION FAILED/)
    expect(summarizeVerify({ ok: true, issues: [], checked: 0, skipped: 2 })).toMatch(/skipped/)
  })
})
