import { describe, expect, it } from 'vitest'
import { missingInputs, refusalMessage } from './lib/generator-guard.mjs'

const FULL = { shallow: false, website: true, tags: true }

describe('missingInputs', () => {
  it('a complete checkout blocks nothing', () => {
    expect(missingInputs(FULL, ['website', 'tags', 'fullHistory'])).toEqual([])
  })

  it('reports only what the generator asked for', () => {
    // build-manifests needs the submodule and nothing else, so a shallow clone
    // with the submodule present must not stop it.
    const state = { ...FULL, shallow: true }
    expect(missingInputs(state, ['website'])).toEqual([])
    expect(missingInputs(state, ['fullHistory'])).toHaveLength(1)
  })

  it('names the missing submodule', () => {
    const [problem] = missingInputs({ ...FULL, website: false }, ['website'])
    expect(problem).toMatch(/website\/ submodule is not checked out/)
  })

  it('a shallow clone with tags present still blocks on history', () => {
    // build-changelog asks for both: tags can exist while the commits behind
    // them do not, which is exactly the shallow-clone case.
    const shallow = { ...FULL, shallow: true }
    expect(missingInputs(shallow, ['tags'])).toEqual([])
    expect(missingInputs(shallow, ['fullHistory'])[0]).toMatch(/commit history is truncated/)
  })

  it('reports every reason at once, not just the first', () => {
    const problems = missingInputs({ shallow: true, website: false, tags: false }, [
      'website', 'tags', 'fullHistory',
    ])
    expect(problems).toHaveLength(3)
  })
})

describe('refusalMessage', () => {
  it('leads with the refusal and lists the fixes', () => {
    const text = refusalMessage('build-docs-index', ['no tags'])
    expect(text).toMatch(/^build-docs-index: refusing to write/)
    expect(text).toContain('  - no tags')
    expect(text).toContain('git submodule update --init')
    expect(text).toContain('--force')
  })
})
