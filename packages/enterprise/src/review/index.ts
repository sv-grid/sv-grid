/**
 * @svgrid/enterprise/review - change review. Writes nobody typed (AI helper
 * results, agent edits, imports, syncs) arrive as proposals held apart from
 * the data, grouped by the transformation they apply, and are accepted or
 * rejected a group at a time. Accepted values are written to the app's data,
 * a cell that changed since the proposal was made is never overwritten, and
 * every decision is one Ctrl+Z.
 *
 * ```svelte
 * <script lang="ts">
 *   import { SvGrid } from '@svgrid/grid'
 *   import { createReview, reviewSmartFill, SvReviewPanel } from '@svgrid/enterprise/review'
 *
 *   let rows = $state(initialRows)
 *   let api = $state()
 *   const review = createReview({ api: () => api, setRows: (next) => (rows = next) })
 * </script>
 *
 * <SvGrid data={rows} columns={review.columns(columns)} getRowId={(r) => r.id}
 *   conditionalFormats={review.formats} onApiReady={(a) => (api = a)} />
 * <SvReviewPanel {review} />
 * ```
 *
 * Adds nothing to `@svgrid/grid`: the tint is `conditionalFormats`, the
 * proposed value is a wrapped `cell`, the undo step is the public command
 * context.
 */
export { createReview } from './model.svelte'
export type { Review, ReviewOptions, ReviewOutcome, ReviewGridApi, ReviewJSON, ReviewDecision, AddInput } from './model.svelte'
export { createGridTools, registerWebMcpTools } from './agent'
export type { GridTool, GridToolsOptions } from './agent'
export { clusterProposals, showValue } from './cluster'
export type { ClusterOptions } from './cluster'
export { sameValue, isBlank } from './equal'
export { REVIEW_MESSAGES } from './messages'
export type { ReviewMessages } from './messages'
export { pendingFormats, PENDING_BG, PENDING_ICON } from './formats'
export { canGhost } from './ghost'
export { fromSmartFill, fromClassify, fromRows, fromStaged, reviewSmartFill, reviewClassify, blankTargets } from './adapters'
export type { AdapterResult } from './adapters'
export type { Proposal, ProposalInput, ProposalSource, ProposalStatus, ChangeSet, GroupKind, ProposalGroup } from './types'
export { default as SvReviewPanel } from './SvReviewPanel.svelte'
