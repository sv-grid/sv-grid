# Agent runtime and collaboration: implementation plan

Two gaps that no shipped grid covers, and that share one missing piece.

1. **Agent runtime.** Every grid on the market, this one included, ships
   *authoring-time* AI: an MCP server and doc files that help a developer
   write grid code. Nothing ships a *runtime* surface an agent can hold:
   an id-addressed tool API, a write path a human approves before it
   lands, per-cell provenance, and an audit trail.
2. **Collaboration.** Sync libraries solve transport and conflict-free
   merge of plain data. None of them solve grid semantics: a remote
   insert under a sorted view, a range fill racing a single-cell edit,
   undo that must not walk back someone else's work, row identity across
   a server-side row model.

Both need the same foundation: a **change intent with an actor on it**,
recorded in one journal that undo, broadcast, approval and provenance all
read. Build that once (Phase 0) and the two tracks stop forking.

Nothing here is implemented yet, except where section 1 says otherwise.
Line numbers refer to commit `17ab051`.

Contents

1. What exists today
2. Phase 0: the intent journal (shared foundation)
3. Track A: agent runtime
4. Track B: collaboration
5. Packaging, licensing and bundle cost
6. Demos, docs and evals
7. PR slicing, order and acceptance criteria
8. Open questions and risks

## 1. What exists today

| Piece | Where | State |
| --- | --- | --- |
| Imperative api (about 120 methods) | `packages/grid/src/svgrid-wrapper.types.ts:145`, built in `build-api.ts` | Ships. Index-addressed, not serializable. |
| `applyTransaction` | `build-api.ts:248` | Ships. Add / update / remove by row id or reference, returns counts. |
| Undo / redo | `history.ts:23` (`HistoryStep`), `:114` (`pushHistory`), `:154` (`runHistoryGroup`) | Ships. One global stack, no actor on a step. |
| Command context | `command-context.ts:21`, write path at `:69` | Ships. Display-indexed, pushes history per write. |
| Collaboration controller | `collaboration.ts:26` (`CollabMessage`), `:32` (transport), `:86` (controller) | Ships. Presence plus single-cell edits, last writer wins, one BroadcastChannel adapter. |
| Sheet delta stream | `packages/enterprise/src/sheet/delta.ts` | Ships. A second, parallel sync path for the sheet shell. |
| AI helpers | `packages/grid/src/ai.ts` | Ship free: filter, smart fill, summarize, classify, anomaly, chart. One provider seam, no tool loop. |
| MCP server | `packages/mcp/src` - `svgrid_search`, `svgrid_get`, `svgrid_check_code`, `svgrid_preview`, `svgrid_scaffold` | Ships. All authoring-time. None of them touch a running grid. |
| Agent patterns | `docs/help/agents.md` | Documented as something the user assembles by hand. No module behind it. |
| Collab guide | `docs/help/collaboration.md` | Says plainly there is no `collab` prop and conflicts are last writer wins. |
| JSON Schemas | `docs/schemas/` | Options, column def, chart spec, export options. Nothing for a tool call. |

Read that table as the honest starting point: the seams exist, the
semantics do not. `docs/help/agents.md` hands the reader a hand-rolled
tool array and a switch statement; `collaboration.ts` broadcasts a cell
edit and hopes the other side wants it.

## 2. Phase 0: the intent journal

New file `packages/grid/src/intent.ts` plus `intent-journal.svelte.ts`.

An intent is one addressed, serializable, reversible change:

```ts
export type GridActor =
  | { kind: 'user'; id: string; name?: string }
  | { kind: 'agent'; id: string; name?: string; model?: string }
  | { kind: 'system'; id: string }   // import, formula recalc, server push

export type GridIntent =
  | { op: 'setCell'; rowId: string; columnId: string; before: unknown; after: unknown }
  | { op: 'setRange'; rect: GridRectById; cells: Array<{ rowId: string; columnId: string; before: unknown; after: unknown }> }
  | { op: 'addRows'; rows: Array<{ rowId: string; row: unknown; at: GridAnchor }> }
  | { op: 'removeRows'; rows: Array<{ rowId: string; row: unknown; at: GridAnchor }> }
  | { op: 'moveRows'; rowIds: string[]; at: GridAnchor }
  | { op: 'view'; patch: Partial<SvGridViewState> }    // sort, filter, group, pinning

export type GridIntentRecord = {
  id: string                 // ulid, sortable by creation
  intent: GridIntent
  actor: GridActor
  at: number                 // wall clock, display only
  clock: number              // per-actor counter, the ordering input
  origin: 'local' | 'remote'
  groupId?: string           // ties a multi-intent action into one undo step
}
```

Rules the rest of the plan depends on:

- **Addressing is by id, never by index.** `GridAnchor` is
  `{ before: rowId } | { after: rowId } | { end: true }`, so an insert
  survives a sort or a filter on the receiving side. Index-addressed
  helpers stay where they are for keyboard and pointer code; they
  translate to ids at the journal boundary.
- **Every write goes through the journal.** `writeCellRaw`
  (`SvGrid.controller.svelte.ts:5011`) keeps its job, but the callers
  that push history today push an intent instead, and `pushHistory`
  becomes a consumer of the journal rather than a second record of the
  same fact.
- **Undo is per actor.** The current stack is global, which is correct
  for one user and wrong the moment a peer or an agent writes. Undo
  walks back the latest record whose `actor.id` matches this client and
  which is not already superseded on the cells it touches. When it is
  superseded, undo refuses and returns a reason rather than clobbering.
- **Journal size is bounded.** A ring buffer with a configurable cap
  (default to what undo needs today) plus `onRecord` for anyone who
  wants to persist further. Nothing about a 1M row grid should hold a
  million records in memory.

Perf constraint: this sits in the paste and fill hot path. `setRange`
carries one record for a whole rectangle, not one per cell, and record
construction allocates lazily the way `command-context.ts` already does
with getters. `core.performance.test.ts` gets a paste and fill case with
a budget so a regression fails CI.

API added to the grid api:

```ts
getJournal(options?: { since?: string; limit?: number }): GridIntentRecord[]
onIntent(handler: (record: GridIntentRecord) => void): () => void
applyIntent(record: GridIntentRecord): GridApplyResult   // remote or replayed
setActor(actor: GridActor): void
```

## 3. Track A: agent runtime

New subpath `@svgrid/grid/agent`, source in `packages/grid/src/agent/`.
It registers through the existing feature seam so a grid that never
talks to an agent ships none of it.

### A1. Tool surface generated from the live grid

`gridTools(api, options)` returns JSON Schema tool definitions built
from the grid's own column set and enabled features, so a model cannot
invent a column id or call a tool for a feature that is not loaded.

```ts
const tools = gridTools(api, {
  allow: ['read', 'view', 'write'],      // capability tiers
  columns: { salary: 'read-only' },      // per-column policy
  maxRows: 500,                          // bound on every read
})
```

Tiers: `read` (`describe`, `queryRows`, `aggregate`), `view` (sort,
filter, group, pin, page), `write` (`proposeTransaction`, never a
direct write). Schemas are generated into `docs/schemas/agent-tools.json`
in CI so the static grounding files stay in step.

`runToolCall(api, name, args)` validates arguments against the schema,
executes, and returns a **result envelope** the model can reason about:
`{ ok, rowsVisible, changed, warnings }`. `docs/help/agents.md` lists
"each tool call does not return the new visible row count" as a known
failure mode; the envelope closes it.

### A2. Reads are bounded and id-addressed

`queryRows` takes a filter expression (reuse `GridPredicateExpr` from
the advanced filter, already in the api at `setAdvancedFilter`), a
column projection and a cursor. It returns rows keyed by row id with an
opaque `nextCursor`. No tool ever returns the full data array, and the
token cost of a call is bounded by construction.

### A3. Proposals, not writes

```ts
const proposal = api.proposeTransaction(intents, { actor })
// -> { id, intents, summary: { cellsChanged, rowsAdded, rowsRemoved },
//      conflicts: [...], validation: [...] }
api.acceptProposal(proposal.id)                     // applies as one undo group
api.acceptProposal(proposal.id, { only: [cellKey] }) // partial accept
api.rejectProposal(proposal.id)
```

A proposal is validated before it is shown: every touched cell runs
through `isCellEditableAt` (`SvGrid.controller.svelte.ts:4606`) and the
column validators in `validate.ts`, so an agent cannot reach past the
rules a human editor obeys. Rejected cells come back as structured
reasons the model can read and retry against.

Rendering: `<SvGridProposalBar>` in the free package, a diff overlay
that tints proposed cells, shows before and after in the cell, and gives
accept / accept-selected / reject. It reads only the proposal object, so
a team that wants its own review UI ignores it.

### A4. Provenance per cell

`packages/grid/src/provenance.ts`: a store keyed by `rowId + columnId`
holding `{ actor, recordId, at }` for the last write. Keyed by row id,
not index, so it survives sort and filter, the same way the sheet's
per-cell formats already do. Renders as a corner mark with a tooltip
naming the actor; `provenanceOf(rowId, columnId)` for programmatic
reads, and export carries it as an optional column set.

This is the feature that makes an agent write safe to ship: a reviewer
can see at a glance which cells a human typed and which a model filled.

### A5. Audit trail

The journal is the audit trail. Add `auditSink(record)` so an app can
stream records to its backend, plus a signed-envelope option in
enterprise for teams that need tamper evidence. Compliance export (the
journal as CSV or JSONL with actor, time, before, after) lands in
`@svgrid/enterprise` beside the other export code.

### A6. Policy

`agentPolicy` is a predicate evaluated per tool call and per cell:

```ts
const policy: AgentPolicy = {
  tools: ({ name }) => name !== 'removeRows',
  cell: ({ rowId, columnId, row }) => columnId !== 'salary' && row.locked !== true,
  budget: { callsPerTurn: 12, cellsPerProposal: 5_000 },
}
```

Denials return a structured refusal, not a thrown error, because a model
that reads "column salary is read-only" recovers and a model that reads
a stack trace does not.

### A7. Streaming and cancelation

`beginAgentBatch()` returns a handle that takes rows as they arrive,
renders them in a pending state, and commits or rolls back as one group.
Cancelation is an `AbortSignal` on the handle, wired to the same path a
rejected proposal takes.

### A8. A server agent is a peer

An agent running on the server joins through the same transport shape
the collaboration controller uses (`collaboration.ts:32`), with
`actor.kind === 'agent'`. That single decision gives the server agent
presence (its cursor shows while it works), the journal (its writes are
attributable), and approval (its proposals queue in the same bar) with
no second mechanism.

### A9. MCP runtime mode

Today the MCP server answers questions about the library. Add a runtime
bridge: the app opts in with `exposeAgentBridge(api, { token })`, the
MCP server connects to that session, and the tools from A1 appear beside
the doc tools. Scope it to localhost and an explicit token; a developer
driving their own running app is the use case, not a production channel.
The MCP package is commercial, so the bridge client in `@svgrid/grid`
stays MIT and the server half ships with the MCP server.

## 4. Track B: collaboration

`@svgrid/grid/collab` supersedes today's `collaboration.ts` (which stays
exported and delegating, so nothing breaks).

### B1. Intents on the wire

`CollabMessage` widens from `hello | presence | edit | bye` to carry a
`GridIntentRecord`. That covers range fills, paste, row add and remove,
row move and view changes, all of which are invisible to the current
protocol.

### B2. Convergence

Per-cell last writer wins with a hybrid clock (`clock`, then `actor.id`
as tie-break) is the default and is *documented as the guarantee*, which
is more than it has today. Structural ops (insert, remove, move) resolve
by anchor id with a deterministic tie-break, and a remove beats a
concurrent edit on the removed row.

Test shape: a property test that runs random interleavings of intents
through two replicas and asserts identical state. That test is the whole
point of the track, so it lands in the first PR of it.

### B3. Cursor and selection stability

The grid's own cursor is index-addressed. When a remote insert lands
above the active cell, the cursor must stay on the same row. Anchor the
active cell and every selection rectangle to row ids while a remote
intent applies, then translate back.

This is the bug that makes naive grid collaboration unusable, and it is
not a sync-library problem, which is exactly why no sync library has
fixed it.

### B4. Offline and local-first

`createOutbox({ storage })` holds unsent local intents in IndexedDB,
marks their cells pending, and replays on reconnect, rebasing against
the remote journal by the B2 rules. `storage` is an interface so a
React Native or Node host can supply its own.

### B5. Presence beyond one cell

Selection rectangles, viewport range, editing state and a follow mode.
`<SvGridPresence>` renders peer cursors, selections and an avatar strip.
Agents appear here too, which is how a user sees what the model is
doing while it does it.

### B6. Comments and threads

Cell comments exist in the sheet (`packages/enterprise/src/sheet/comments.ts`)
and as notes in the grid. Lift threads to the shared journal so a comment
is an intent with an actor, syncs like an edit, and survives a sort.

### B7. A reference relay

`workers/` already hosts two workers. Add a small WebSocket relay so the
demos work across machines, and document self-hosting. It stays a
reference implementation, not a service.

### B8. One sync path, not two

Fold `createDeltaStream` (sheet) onto the journal so the sheet and the
grid share conflict rules, presence and undo semantics. The sheet keeps
its cell-text unit of change as an intent variant.

## 5. Packaging, licensing and bundle cost

MIT, in `@svgrid/grid`:

- the intent journal, provenance store and per-actor undo
- `gridTools`, proposals, policy, the proposal bar and presence components
- the last-writer-wins merge, the outbox interface, the BroadcastChannel transport

Commercial, in `@svgrid/enterprise`:

- the CRDT adapter, the hosted relay adapter and the server row model bridge
- audit persistence, signed envelopes and compliance export
- the policy console and the approval queue across many grids

This matches the line the AI helpers already sit on: the seams and the
client half are free, the infrastructure and the compliance half are
paid. Nothing moves from a commercial package into an MIT one.

Every piece registers through the feature and row-model seams so it
tree-shakes out when unused. Re-measure with `pnpm size` before and
after each PR and record the delta in the PR body; do not type a number
into the docs, the comparison data and `pnpm size:json` own those.

## 6. Demos, docs and evals

Demos (each one is two edits: the `.svelte` file in `examples/src/demos/`
and its registration in `website/src/lib/demos.ts`, which is a private
submodule; `pnpm demos:count` fails if they disagree). Take the next
free block, confirmed by `pnpm demos:count`:

1. Agent drives the grid, tool calls visible in a side panel.
2. Proposal review: a model fills 200 cells, the user accepts a subset.
3. Provenance: a grid where human and agent cells are marked, filterable
   by actor.
4. Two-machine collaboration against the reference relay.
5. Offline edit, reconnect, converge, with the outbox visible.
6. Agent plus human on one grid at the same time.

Docs: rewrite `docs/help/agents.md` from "here is a pattern you build"
to "here is the module", keep the hand-rolled version as an appendix for
teams that want their own loop. Rewrite `docs/help/collaboration.md`
around the journal and state the convergence guarantee. New page on
provenance and audit.

Evals: `tools/mcp-eval/` already runs the MCP server against fixtures.
Add an agent-tool eval that scores a model driving a fixture grid
through a scripted set of tasks (filter to a subset, fix the malformed
rows, group and summarize) and asserts the end state. That number is the
honest measure of whether the tool surface works, and it belongs in CI.

## 7. PR slicing, order and acceptance criteria

| PR | Content | Accepted when |
| --- | --- | --- |
| 1 | `intent.ts`, journal, actors, id addressing, `getJournal` / `onIntent` / `applyIntent` | Unit tests cover every op; paste and fill perf budgets hold in `core.performance.test.ts` |
| 2 | History rebuilt on the journal, per-actor undo, supersede refusal | Existing undo tests pass unchanged; new tests cover two actors |
| 3 | Provenance store plus cell mark | Survives sort, filter, group and paging; export carries it |
| 4 | `gridTools`, `runToolCall`, bounded `queryRows`, generated schema in CI | Schema file regenerates clean; invalid args rejected with a readable reason |
| 5 | Proposals, validation, partial accept, `<SvGridProposalBar>` | An agent cannot write past `isCellEditableAt` or a validator; accept is one undo group |
| 6 | Policy and budgets, structured refusals | Denials are data, not throws; budget exhaustion is reported to the caller |
| 7 | Collab intents on the wire, convergence rules, property test | Two replicas converge over random interleavings, 10k generated cases |
| 8 | Cursor and selection anchoring under remote intents | Remote insert above the cursor leaves the active row unchanged |
| 9 | Outbox, offline replay, pending cell state | Kill the socket mid-edit, reconnect, converge |
| 10 | Presence upgrade plus `<SvGridPresence>` | Two Playwright contexts see each other's selections |
| 11 | Reference relay in `workers/`, cross-machine demo | Demo works from two machines with documented setup |
| 12 | Sheet delta folded onto the journal | Sheet collaboration tests pass on the shared path |
| 13 | Enterprise: CRDT adapter, audit persistence, compliance export | Adapter passes the same convergence property test |
| 14 | MCP runtime bridge | Token-scoped, localhost-only by default, eval suite green |

Tracks A and B can run in parallel from PR 4 and PR 7 respectively, but
PRs 1 to 3 gate both. Run the full test suite, not a subset, on each.

## 8. Open questions and risks

1. **Undo across actors.** Per-actor undo is the right default, but a
   spreadsheet user expects Ctrl+Z to undo *the document*. Decide
   whether a `undoScope: 'actor' | 'document'` prop is worth it or
   whether the actor rule is simply documented.
2. **Rows that are not resident.** With the server-side row model the
   client does not hold the row a remote intent names. The journal
   applies to a cache it may not have; either the intent is deferred
   until the block loads, or the server is the merge point and the
   client only renders. Probably the latter, which makes the server row
   model an enterprise prerequisite for collaborative server data.
3. **No `getRowId`.** Everything here needs stable ids. Decide between
   refusing to enable the features without `getRowId` (clear, strict)
   and synthesizing an id (works, but breaks the moment data reloads).
   Prefer the refusal with a readable error.
4. **Journal cost at 1M rows.** A full-column fill is one `setRange`
   record with a million cell entries. Cap it: past a threshold, store
   the rectangle and the value rather than per-cell before and after,
   and accept that undo of such an op restores from a snapshot instead.
5. **Trust boundary for the MCP bridge.** An open local socket that can
   drive a running app is a real risk. Token plus localhost plus an
   explicit opt-in call, and the token never lands in the docs as a
   copy-paste constant.
6. **Where the approval UI belongs.** The bar is free so the pattern
   spreads; if the queue across grids proves to be the thing teams pay
   for, it stays enterprise. Revisit after the first paying evaluation.
