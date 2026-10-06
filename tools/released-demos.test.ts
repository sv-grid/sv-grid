/**
 * examples/src/shared/released-demos.json decides which demos the gallery
 * marks "new": every registered demo NOT on it. These keep the file honest:
 * it is what its release actually shipped, and a demo held back by a release
 * date is never on it, so it is new on the day it goes live.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain .mjs helpers without types
import { RELEASED_DEMOS_FILE, snapshotCurrent, snapshotFromTag } from './lib/released-demos.mjs'
import { pendingDemoIds } from './lib/releases.mjs'

const root = join(__dirname, '..')
const file = JSON.parse(readFileSync(join(root, RELEASED_DEMOS_FILE), 'utf-8')) as {
  release: string
  date: string
  ids: string[]
}

const hasTag = (tag: string) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('released-demos.json', () => {
  it('names a grid release and lists sorted, unique demo ids', () => {
    expect(file.release).toMatch(/^grid-v\d+\.\d+\.\d+$/)
    expect(file.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(file.ids.length).toBeGreaterThan(100)
    expect(new Set(file.ids).size).toBe(file.ids.length)
    expect([...file.ids].sort()).toEqual(file.ids)
  })

  it.skipIf(!hasTag(file.release))('is exactly what its release tag registered', () => {
    expect(snapshotFromTag(root, file.release)).toEqual(file)
  })

  it('never lists a demo still held back by a release date', () => {
    const pending: Set<string> = pendingDemoIds(file.date)
    for (const id of file.ids) expect(pending.has(id), id).toBe(false)
  })

  it('is a subset of what a release cut today would list', () => {
    // Demos are added, not taken away, between releases; anything released
    // and since removed would show here, and should be dropped by hand.
    const now = new Set(snapshotCurrent(root, 'now').ids)
    const gone = file.ids.filter((id) => !now.has(id))
    expect(gone).toEqual([])
  })
})
