import { describe, expect, it } from 'vitest'
import {
  livePresence, presenceOnSheet, presenceColour, presenceInitials, presenceAnchor, presenceInk,
  PRESENCE_COLOURS, type SheetPresence,
} from './presence'

const person = (over: Partial<SheetPresence> = {}): SheetPresence => ({
  id: 'ada', name: 'Ada Lovelace', sheet: 'S', rect: [1, 1, 3, 2], ...over,
})

describe('presence', () => {
  it('gives the same person the same colour, from the set', () => {
    expect(presenceColour('ada')).toBe(presenceColour('ada'))
    expect(PRESENCE_COLOURS).toContain(presenceColour('ada'))
    expect(PRESENCE_COLOURS).toContain(presenceColour(''))
    // Different people usually differ; these two do.
    expect(presenceColour('ada')).not.toBe(presenceColour('brin'))
  })

  it('inks a tag black or white, whichever the colour contrasts more with', () => {
    expect(presenceInk('#2563eb')).toBe('#fff')
    // Green, orange and yellow are too light for white at 11px.
    expect(presenceInk('#16a34a')).toBe('#000')
    expect(presenceInk('#ea580c')).toBe('#000')
    expect(presenceInk('#ca8a04')).toBe('#000')
    expect(presenceInk('#fff')).toBe('#000')
    expect(presenceInk('rebeccapurple')).toBe('#fff')
    // The built-in set is dark enough that every tag reads white on colour.
    for (const colour of PRESENCE_COLOURS) expect(presenceInk(colour), colour).toBe('#fff')
  })

  it('shortens a name to initials for a small box', () => {
    expect(presenceInitials('Ada Lovelace')).toBe('AL')
    expect(presenceInitials('Ada')).toBe('AD')
    expect(presenceInitials('  ')).toBe('?')
    expect(presenceInitials('Jean Baptiste Joseph Fourier')).toBe('JF')
  })

  it('keeps the newest entry per person and drops the quiet ones', () => {
    const now = 1_000_000
    const list = [
      person({ id: 'ada', at: now - 1_000, rect: [0, 0, 0, 0] }),
      person({ id: 'ada', at: now - 100, rect: [5, 5, 5, 5] }),
      person({ id: 'brin', at: now - 20_000 }),
      person({ id: 'cyd', at: now - 14_000 }),
    ]
    const live = livePresence(list, now)
    expect(live.map((p) => p.id).sort()).toEqual(['ada', 'cyd'])
    expect(live.find((p) => p.id === 'ada')!.rect).toEqual([5, 5, 5, 5])
  })

  it('treats a missing time as now', () => {
    expect(livePresence([person()], 1_000_000)).toHaveLength(1)
  })

  it('filters to one sheet, case for case, in a stable order', () => {
    const list = [person({ id: 'zed', sheet: 'Sales' }), person({ id: 'ada', sheet: 'sales' }), person({ id: 'brin', sheet: 'Costs' })]
    expect(presenceOnSheet(list, 'Sales').map((p) => p.id)).toEqual(['ada', 'zed'])
  })

  it('anchors the tag on the active cell, or the top left', () => {
    expect(presenceAnchor(person())).toEqual({ row: 1, col: 1 })
    expect(presenceAnchor(person({ active: { row: 3, col: 2 } }))).toEqual({ row: 3, col: 2 })
  })
})
