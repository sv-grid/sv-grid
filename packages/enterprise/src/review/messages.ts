/**
 * Every string change review shows: the panel, the group labels, the card and
 * cell marks. English defaults; pass any subset as `createReview({ messages })`
 * (and `<SvReviewPanel messages>` for one panel), unset keys stay English. The
 * idiom of the grid's own `localization.text`: a flat map, `{name}`
 * placeholders. Kept free of imports: the clustering uses it in plain Node.
 */
export const REVIEW_MESSAGES = {
  // Panel header
  title: 'Review changes',
  decided: '{decided} of {total} decided',
  pendingInGroups: '{count} pending in {groups} groups',
  pendingInOneGroup: '{count} pending in 1 group',
  nothingPending: 'Nothing pending',
  inConflict: ', {count} in conflict',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  acceptRuleGroups: 'Accept rule groups ({count})',
  resolveFirst: 'Resolve the conflicts before accepting everything.',
  onlyRowsWithChanges: 'Only rows with changes',
  // Confirm
  confirmAcceptGroup: 'Accept {count} changes: {label}?',
  confirmRejectGroup: 'Reject {count} changes: {label}?',
  confirmAcceptAll: 'Accept all {count} changes?',
  confirmRejectAll: 'Reject all {count} changes?',
  confirmAcceptRules: 'Accept {groups} rule groups ({count} changes)?',
  confirmYes: 'Yes, {count}',
  cancel: 'Cancel',
  // Conflicts
  conflictsTitle: 'Two sources disagree',
  conflictCell: '{row}, {field}: now {value}',
  keep: 'Keep {value}',
  // Groups
  badgeRule: 'Rule',
  hintRule: 'Every change in this group follows the rule.',
  hintMapping: 'Check the mapping before accepting.',
  hintFill: 'Check the sample: the least sure ones come first.',
  hintConstant: 'Many different values set to one: check what they were.',
  hintEach: 'No shared pattern: look at each change.',
  oneChange: '{count} change',
  changes: '{count} changes',
  sure: '{pct} sure',
  sureRange: '{min} to {avg} sure',
  accept: 'Accept',
  reject: 'Reject',
  acceptGroupLabel: 'Accept {count}: {label}',
  rejectGroupLabel: 'Reject {count}: {label}',
  from: 'From',
  otherValues: 'other values',
  sampleOf: 'Sample of {count}',
  everyChange: 'Every change',
  firstN: 'First {count}',
  showRow: 'Show {row} in the grid',
  rowId: 'Row {row}',
  acceptOne: 'Accept this change',
  rejectOne: 'Reject this change',
  showAll: 'Show all {count}',
  keysHint: 'J / K move between groups, Enter opens one, A accepts it, R rejects it.',
  showInGrid: 'Show in grid',
  nextInGrid: 'Next in grid',
  hiddenRows: '{count} hidden by filters or grouping',
  // Empty and done
  allReviewed: 'All {count} reviewed',
  reviewedSummary: '{accepted} accepted, {rejected} rejected',
  reviewedStale: ', {count} not written because the cell changed',
  noProposals: 'No proposals yet',
  noProposalsHint: 'Edits an agent, an import or an AI helper proposes show up here, grouped by what they change.',
  notWritten: '{count} not written',
  rowField: '{row}, {field}',
  decidedLabel: 'Decided',
  // Why a proposal was not written or is waiting (shown in the panel)
  noteCellChanged: 'the cell changed after this was proposed',
  noteRowGone: 'the row no longer exists',
  noteRowEditing: 'the row is being edited',
  noteGridNotReady: 'the grid is not ready',
  noteSavedStale: 'saved, but the cell changed before it was written here',
  noteConflict: 'another source proposed a different value',
  undoHint: 'Ctrl+Z in the grid undoes the last decision.',
  // Announced after a decision
  announceAccepted: '{count} accepted',
  announceRejected: '{count} rejected',
  announceStale: '{count} not written: the cell changed',
  announceSkipped: '{count} left pending',
  announceCommittedStale: '{count} saved but not shown: the cell changed while saving',
  announceNotSaved: 'not saved: {error}',
  announceNothing: 'Nothing to decide',
  undoFailed: 'Undo not saved: {error}',
  redoFailed: 'Redo not saved: {error}',
  // Marks
  cardProposed: '{count} proposed',
  proposes: '{source} proposes {value}',
  nowValue: 'Now: {value}',
  empty: '(empty)',
  // Group labels ({field} is the column header)
  labelWhitespace: 'Trim spaces in {field}',
  labelCase: 'Change {field} to {case}',
  caseUpper: 'UPPER CASE',
  caseLower: 'lower case',
  caseTitle: 'Title Case',
  caseMixed: 'a different case',
  labelToNumber: 'Convert {field} text to numbers',
  labelDates: 'Reformat {field} dates as {shape}',
  datesAsDates: 'dates',
  labelShape: 'Reformat {field} as {shape}',
  labelPunct: '{change} in {field}',
  punctRemove: 'remove {chars}',
  punctAdd: 'add {chars}',
  punctSpaces: 'spaces',
  labelDivide: 'Divide {field} by {n}',
  labelMultiply: 'Multiply {field} by {n}',
  labelMapping: '{field}: {from} → {to}',
  mappingValues: '{count} values',
  labelFill: 'Fill empty {field} with {value}',
  labelFillVarious: 'Fill empty {field} (different values)',
  labelConstant: 'Set {field} to {value}',
  labelUnpatterned: '{field}: no shared pattern',
}

/**
 * Every string the review shows, with the keys of `REVIEW_MESSAGES`.
 */
export type ReviewMessages = typeof REVIEW_MESSAGES

/**
 * English, with `overrides` laid over it (blank values ignored).
 * @internal
 */
export function reviewMessages(...overrides: Array<Partial<ReviewMessages> | null | undefined>): ReviewMessages {
  const out = { ...REVIEW_MESSAGES }
  for (const o of overrides) {
    if (!o) continue
    for (const k in o) {
      const v = o[k as keyof ReviewMessages]
      if (v != null && v !== '') out[k as keyof ReviewMessages] = v
    }
  }
  return out
}

/**
 * A template with its `{name}` placeholders filled.
 * @internal
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole))
}
