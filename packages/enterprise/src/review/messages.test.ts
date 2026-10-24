import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REVIEW_MESSAGES, fill, reviewMessages } from './messages'

describe('review messages', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(fill('{count} of {total}', { count: 2 })).toBe('2 of {total}')
  })

  it('lays overrides over English, ignoring blanks', () => {
    const m = reviewMessages({ acceptAll: 'Alle annehmen', rejectAll: '' }, { reject: 'Ablehnen' })
    expect([m.acceptAll, m.rejectAll, m.reject]).toEqual(['Alle annehmen', 'Reject all', 'Ablehnen'])
  })

  it('every key is used by the review (no dead strings)', () => {
    const files = ['SvReviewPanel.svelte', 'cluster.ts', 'model.svelte.ts', 'ghost.ts', 'RichCellMark.svelte']
    const src = files.map((f) => readFileSync(join(__dirname, f), 'utf8')).join('\n')
    const unused = Object.keys(REVIEW_MESSAGES).filter((k) => !new RegExp(`\\.${k}\\b`).test(src))
    expect(unused).toEqual([])
  })
})
