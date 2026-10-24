/**
 * Change review types. A proposal is a write nobody typed (an AI result, an
 * agent edit, an import, a sync) held apart from the data until a person
 * accepts it. Pure types, so the clustering and the adapters stay free of
 * Svelte and testable on their own.
 */

/** What produced a proposal. `id` keeps two runs of the same kind apart. */
export type ProposalSource = {
  kind: 'agent' | 'ai' | 'import' | 'bulk' | 'sync' | 'rule'
  id: string
  label: string
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'stale' | 'conflict'

export type Proposal = {
  id: string
  /** Only `update` in this release; inserts and deletes come later. */
  op: 'update'
  /** The grid's row id (its `getRowId`), never a row index. */
  rowId: string
  /** The field on the row object the value is written to. */
  field: string
  /** The value when the proposal was made, which is what staleness compares with. */
  before: unknown
  after: unknown
  source: ProposalSource
  /** Why, in the producer's words (an AI rationale, an import file name). */
  reason?: string
  /** 0..1, when the producer has one. */
  confidence?: number
  createdAt: number
  status: ProposalStatus
  /** Why a proposal is stale, skipped or in conflict, for the panel. */
  note?: string
  decidedBy?: string
  decidedAt?: number
}

/** What a producer hands over: a proposal without the fields the review fills in. */
export type ProposalInput = Omit<Proposal, 'id' | 'op' | 'source' | 'createdAt' | 'status' | 'note' | 'decidedBy' | 'decidedAt'> & {
  id?: string
  confidence?: number
}

/** One batch from one producer. */
export type ChangeSet = {
  id: string
  title: string
  source: ProposalSource
  createdAt: number
  proposals: Proposal[]
}

/**
 * How a group's members relate. The first four are rule groups: every member
 * is proven to follow the rule. The rest are judgment groups, where a person
 * has to look.
 */
export type GroupKind =
  | 'whitespace'
  | 'case'
  | 'format'
  | 'scale'
  | 'same-mapping'
  | 'fill-empty'
  | 'constant-target'
  | 'unpatterned'

export type ProposalGroup = {
  /** Stable while the group's members do not change: source, field, kind and param. */
  key: string
  kind: GroupKind
  /** True for the four rule kinds. */
  rule: boolean
  /** What the members share, in the detector's terms ('upper', '100', a value...). */
  param: string
  label: string
  field: string
  sourceId: string
  ids: string[]
  count: number
  /** Lowest and mean confidence over the members that have one; undefined when none do. */
  minConfidence?: number
  avgConfidence?: number
  /** Up to five ids to look at first: the least confident, then spread across the group. */
  sample: string[]
  /**
   * For `constant-target` and `same-mapping`: the five most common `before`
   * values and how many of each, then one `other` entry for the rest.
   */
  beforeDistribution?: Array<{ value: unknown; count: number; other?: true }>
}
