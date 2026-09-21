/**
 * Presence: where the other people are.
 *
 * The delta stream carries what everyone TYPES; this carries where everyone
 * IS, which is the other half of two people on one sheet. Seeing a
 * colleague's box move is what stops two people typing into the same cell,
 * and it is what makes a shared sheet feel shared rather than merely
 * synchronised.
 *
 * Presence is not part of the document. It is never saved, never in
 * `getState()` and never in the .xlsx: a cursor belongs to a session, and a
 * file that remembered where someone's cursor was a week ago would be
 * remembering nothing worth keeping. It is passed to the shell as a prop and
 * drawn over the cells.
 */
import type { Rect } from './rects'

export type SheetPresence = {
  /** Whoever this is, stable for as long as they are here. */
  id: string
  /** What to put on the tag. */
  name: string
  /** Their colour, which the box and the tag are drawn in. Left out means
   *  one picked from the id, so a set of peers is never all one colour. */
  colour?: string
  /** The sheet they are looking at. */
  sheet: string
  /** Their selection, `[minRow, minCol, maxRow, maxCol]`. */
  rect: Rect
  /** The cell the cursor is in, which is where the tag goes. Defaults to
   *  the top-left of the selection. */
  active?: { row: number; col: number }
  /** When they were last heard from, in ms. Absent counts as now. */
  at?: number
}

/**
 * Eight colours that read as different people rather than as a heat map,
 * stay legible as a thin box over a white sheet and over a dark one, and
 * each carry a white name at 11px at 4.5:1 or better, so every tag wears
 * the same white ink. The first set had five a shade too light for that.
 */
export const PRESENCE_COLOURS: ReadonlyArray<string> = [
  '#e11d48', '#2563eb', '#15803d', '#7e22ce',
  '#c2410c', '#0e7490', '#a16207', '#db2777',
]

/** A colour for an id: the same person gets the same one every session. */
export function presenceColour(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PRESENCE_COLOURS[hash % PRESENCE_COLOURS.length]!
}

/**
 * The ink for a name tag on a person's colour: black or white, whichever
 * contrasts more. White on every colour was the first version, and white
 * on the first set's green, orange or yellow was a little over 3:1, under
 * the 4.5:1 an 11px name needs. The built-in set is dark enough now, but a
 * collaborator's own colour can be anything, so the tag still asks.
 * A colour that is not a hex triplet gets white, the way it always did.
 */
export function presenceInk(colour: string): '#000' | '#fff' {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim())
  if (!hex) return '#fff'
  const digits = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join('') : hex[1]!
  const channel = (at: number) => {
    const c = parseInt(digits.slice(at, at + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  // Contrast against white is (1.05 / (L + 0.05)); against black, (L + 0.05) / 0.05.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#fff' : '#000'
}

/** Two initials for the tag when the box is too small for a name. */
export function presenceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase()
}

/**
 * The peers still here: the newest entry per person, anyone quiet for
 * longer than `timeoutMs` dropped.
 *
 * A network gives no "goodbye" when a tab is closed, so the only honest
 * answer to "is this person still here" is how long ago they last said
 * anything. Fifteen seconds is the grid's own answer, and this keeps to it.
 */
export function livePresence(
  list: ReadonlyArray<SheetPresence>,
  now = Date.now(),
  timeoutMs = 15_000,
): SheetPresence[] {
  const newest = new Map<string, SheetPresence>()
  for (const person of list) {
    if (now - (person.at ?? now) > timeoutMs) continue
    const had = newest.get(person.id)
    if (!had || (person.at ?? now) >= (had.at ?? now)) newest.set(person.id, person)
  }
  return [...newest.values()]
}

/** The peers on one sheet, in a stable order so the boxes do not swap. */
export function presenceOnSheet(list: ReadonlyArray<SheetPresence>, sheet: string): SheetPresence[] {
  return list
    .filter((person) => person.sheet.toLowerCase() === sheet.toLowerCase())
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** Where the tag goes: the cell named, or the top-left of the selection. */
export function presenceAnchor(person: SheetPresence): { row: number; col: number } {
  if (person.active) return person.active
  const [r1, c1] = person.rect
  return { row: r1, col: c1 }
}
