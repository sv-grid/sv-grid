import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LICENSE_KEY_SHA256 } from './license-hash'
import { sha256Hex } from './sha256'

// The master key lives in tools/licenses/master-key.txt, which is gitignored,
// so this check runs on the maintainer's machine and skips in CI. It catches
// a hash edited without the key (or the reverse), which would make every
// issued key show the watermark.
const MASTER = join(__dirname, '..', '..', '..', 'tools', 'licenses', 'master-key.txt')

describe('LICENSE_KEY_SHA256', () => {
  it('is a lowercase SHA-256 hex digest', () => {
    expect(LICENSE_KEY_SHA256).toMatch(/^[0-9a-f]{64}$/)
  })

  it.skipIf(!existsSync(MASTER))('is the hash of the master key in tools/licenses', () => {
    const key = readFileSync(MASTER, 'utf8').trim().toLowerCase()
    expect(sha256Hex(key)).toBe(LICENSE_KEY_SHA256)
  })
})
