/**
 * grid-announcements - what the grid says to a screen reader, and when.
 *
 * WCAG 4.1.3 covers *status messages*: information the user needs that does not
 * receive focus. That is a narrow set, and getting the boundary right matters
 * more than announcing a lot.
 *
 * Things the grid deliberately does NOT announce here, because the
 * accessibility tree already conveys them when focus lands:
 *
 *   - the value of the cell you moved to      (roving tabindex moves focus)
 *   - the sort state of a header              (`aria-sort` on the columnheader)
 *   - whether the row you are on is selected  (`aria-selected` on the row)
 *
 * Announcing those again would make the grid talk over itself. What is left is
 * genuinely invisible to a screen reader: how many rows survived a filter, and
 * bulk selection changes that move no focus (select-all, clear).
 *
 * These builders are pure so they can be unit-tested without a DOM, and take
 * their strings from `GridMessages` so an announcement is translated like any
 * other label.
 */

/** The subset of `GridMessages` this module reads. */
export type AnnouncementMessages = {
  announceFilterResults: string
  announceNoMatches: string
  announceFiltersCleared: string
  announceRowsSelected: string
  announceSelectionCleared: string
}

/**
 * Interpolate `{name}` placeholders.
 *
 * The rest of `GridMessages` is single words assembled by the caller (`of`,
 * `rowsSuffix`). That works for labels but not for sentences: languages order
 * "12 of 250 match" differently, and a translator handed three separate atoms
 * cannot fix the order. Announcements are whole sentences, so they get whole
 * templates. An unknown placeholder is left alone rather than blanked, so a
 * typo in an override is visible instead of silently eating the number.
 */
export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  )
}

/**
 * What to say after the row set changes, or null to stay quiet.
 *
 * `visible` is the count after filtering but BEFORE pagination - the answer to
 * "how many rows matched", not "how many are on this page".
 */
export function filterAnnouncement(
  visible: number,
  total: number,
  filtersActive: boolean,
  filtersWereActive: boolean,
  messages: AnnouncementMessages,
): string | null {
  if (filtersActive) {
    if (visible === 0) return messages.announceNoMatches
    return formatMessage(messages.announceFilterResults, { visible, total })
  }
  // Clearing a filter is itself a status change worth confirming; without this
  // the user hears nothing back and cannot tell the clear took effect.
  if (filtersWereActive) {
    return formatMessage(messages.announceFiltersCleared, { total })
  }
  return null
}

/**
 * What to say after the selection changes, or null to stay quiet.
 *
 * Only BULK changes are announced. Selecting one row moves focus to it and the
 * screen reader reads it as selected from `aria-selected`; announcing "1 row
 * selected" on top of that is the grid talking over itself. A change of more
 * than one row cannot have come from a single focus move, so it is the
 * select-all / range / clear case that otherwise passes silently.
 */
export function selectionAnnouncement(
  previousCount: number,
  count: number,
  messages: AnnouncementMessages,
): string | null {
  if (Math.abs(count - previousCount) <= 1) return null
  if (count === 0) return messages.announceSelectionCleared
  return formatMessage(messages.announceRowsSelected, { count })
}
