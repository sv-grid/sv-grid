/**
 * Tools an AI agent can call to work on a grid's data, where every write is a
 * proposal in a change review and a person decides. No tool writes the data.
 *
 * `createGridTools` returns plain tool definitions (name, description, JSON
 * schema, execute) for any tool-use loop: an LLM SDK, an MCP server of your
 * own, or the browser through `registerWebMcpTools`.
 *
 * ```ts
 * const tools = createGridTools({ review, api: () => api, fields: ['region', 'phone'] })
 * registerWebMcpTools(tools)  // experimental: browsers with WebMCP
 * ```
 */
import { isBlank, sameValue } from './equal'
import type { ReviewGridApi } from './model.svelte'
import type { Proposal, ProposalGroup, ProposalInput, ProposalSource } from './types'

export type GridTool = {
  name: string
  description: string
  /** JSON Schema of the input object. */
  inputSchema: Record<string, unknown>
  execute: (input: any) => Promise<unknown>
}

type ToolReview = {
  add(input: { source: ProposalSource; title?: string; proposals: ReadonlyArray<ProposalInput> }): { id: string; proposals: Proposal[] }
  groups(): ProposalGroup[]
  conflicts(): Proposal[]
  proposals(): Proposal[]
}

type ToolApi = Pick<ReviewGridApi, 'getData' | 'getColumns' | 'getOption'>

export type GridToolsOptions = {
  review: ToolReview
  /** The grid api, or a getter for it. */
  api: ToolApi | (() => ToolApi | null | undefined)
  /** Who the proposals are from. Default: an agent named "Agent". */
  source?: ProposalSource
  /** Fields the agent may propose edits to. Default: every column with a field. */
  fields?: ReadonlyArray<string>
  /** Most rows one query returns. Default 200. */
  maxRows?: number
  /** Prefix for tool names. Default 'grid_'. */
  prefix?: string
  /** Most edits one grid_propose_edits call may carry. Default 500. */
  maxEdits?: number
}

type Where = { field: string; op: 'equals' | 'notEquals' | 'contains' | 'blank' | 'notBlank' | 'gt' | 'lt'; value?: unknown }

const OPS: Where['op'][] = ['equals', 'notEquals', 'contains', 'blank', 'notBlank', 'gt', 'lt']

function matches(v: unknown, w: Where): boolean {
  switch (w.op) {
    case 'equals': return sameValue(v, w.value)
    case 'notEquals': return !sameValue(v, w.value)
    case 'contains': return String(v ?? '').toLowerCase().includes(String(w.value ?? '').toLowerCase())
    case 'blank': return isBlank(v)
    case 'notBlank': return !isBlank(v)
    case 'gt': return v != null && (v as number) > (w.value as number)
    case 'lt': return v != null && (v as number) < (w.value as number)
  }
}

/**
 * Why a value does not fit its column, or null. A model can send a string for
 * a number or an object for a text cell; those are skipped, not proposed.
 */
function wrongType(type: string | undefined, current: unknown, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null // clearing a cell
  if (Array.isArray(current)) return Array.isArray(value) ? null : 'expects a list'
  if (typeof value === 'object') return 'expects a single value, not an object or a list'
  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return 'expects a number'
  if (type === 'boolean' && typeof value !== 'boolean') return 'expects true or false'
  if ((type === 'date' || type === 'dateString') && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) return 'expects a date (YYYY-MM-DD)'
  return null
}

export function createGridTools(opts: GridToolsOptions): GridTool[] {
  const prefix = opts.prefix ?? 'grid_'
  const source = opts.source ?? { kind: 'agent', id: 'agent', label: 'Agent' }
  const maxRows = opts.maxRows ?? 200
  const maxEdits = opts.maxEdits ?? 500
  const api = (): ToolApi => {
    const a = typeof opts.api === 'function' ? (opts.api as () => ToolApi | null | undefined)() : opts.api
    if (!a) throw new Error('the grid is not ready yet')
    return a
  }
  const rowIdOf = (a: ToolApi) => {
    const fn = a.getOption('getRowId') as ((row: unknown, i: number) => string) | undefined
    if (!fn) throw new Error('the grid needs a getRowId prop')
    return fn
  }
  const columns = (a: ToolApi) => a.getColumns().filter((c) => c.field)
  const writable = (a: ToolApi) => new Set(opts.fields ?? columns(a).map((c) => c.field!))

  const describe: GridTool = {
    name: `${prefix}describe`,
    description:
      'Describe the table: its columns (field, header, data type), how many rows it has, and which fields you may propose edits to. ' +
      'Edits you propose are not applied: a person reviews them in groups and accepts or rejects them.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute() {
      const a = api()
      const canWrite = writable(a)
      return {
        rowCount: a.getData().length,
        columns: columns(a).map((c) => ({ field: c.field, header: c.header, type: c.cellDataType ?? 'text', writable: canWrite.has(c.field!) })),
      }
    },
  }

  const query: GridTool = {
    name: `${prefix}query_rows`,
    description:
      `Read rows of the table. Filter with "where" (all conditions must hold), pick fields, page with offset/limit (at most ${maxRows}). ` +
      'Every row comes with its rowId, which grid_propose_edits needs.',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'array',
          items: {
            type: 'object',
            properties: { field: { type: 'string' }, op: { type: 'string', enum: OPS }, value: {} },
            required: ['field', 'op'],
          },
        },
        fields: { type: 'array', items: { type: 'string' } },
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: maxRows },
      },
      additionalProperties: false,
    },
    async execute(input: { where?: Where[]; fields?: string[]; offset?: number; limit?: number } = {}) {
      const a = api()
      const id = rowIdOf(a)
      const known = new Set(columns(a).map((c) => c.field!))
      for (const w of input.where ?? []) {
        if (!known.has(w.field)) throw new Error(`unknown field "${w.field}"`)
        if (!OPS.includes(w.op)) throw new Error(`unknown op "${w.op}"`)
      }
      const fields = (input.fields ?? [...known]).filter((f) => known.has(f))
      const hits = a.getData().flatMap((row, i) =>
        (input.where ?? []).every((w) => matches((row as Record<string, unknown>)[w.field], w)) ? [{ row, i }] : [],
      )
      // The schema says integers; a model can still send "10" or -5.
      const offset = Math.max(0, Math.trunc(Number(input.offset) || 0))
      const limit = Math.min(Math.max(1, Math.trunc(Number(input.limit) || maxRows)), maxRows)
      return {
        total: hits.length,
        offset,
        rows: hits.slice(offset, offset + limit).map(({ row, i }) => ({
          rowId: String(id(row, i)),
          ...Object.fromEntries(fields.map((f) => [f, (row as Record<string, unknown>)[f]])),
        })),
      }
    },
  }

  const propose: GridTool = {
    name: `${prefix}propose_edits`,
    description:
      'Propose new values for cells. Nothing is written: each edit becomes a proposal a person reviews. ' +
      'Give a short reason per edit, and a confidence from 0 to 1 when you are unsure. ' +
      'Edits to unknown rows, to fields you may not edit, or that change nothing are skipped and reported.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What this batch does, in a few words.' },
        edits: {
          type: 'array',
          minItems: 1,
          maxItems: maxEdits,
          items: {
            type: 'object',
            properties: {
              rowId: { type: 'string' },
              field: { type: 'string' },
              value: {},
              reason: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['rowId', 'field', 'value'],
          },
        },
      },
      required: ['edits'],
      additionalProperties: false,
    },
    async execute(input: { title?: string; edits: Array<{ rowId: string; field: string; value: unknown; reason?: string; confidence?: number }> }) {
      const a = api()
      const edits = Array.isArray(input?.edits) ? input.edits : []
      if (edits.length > maxEdits) throw new Error(`at most ${maxEdits} edits per call; send the rest in another call`)
      const id = rowIdOf(a)
      const canWrite = writable(a)
      const typeOf = new Map(a.getColumns().filter((c) => c.field).map((c) => [c.field!, c.cellDataType ?? 'text']))
      const rows = new Map(a.getData().map((row, i) => [String(id(row, i)), row as Record<string, unknown>]))
      const skipped: Array<{ index: number; why: string }> = []
      const proposals: ProposalInput[] = []
      edits.forEach((e, index) => {
        const row = rows.get(String(e?.rowId))
        if (!row) return skipped.push({ index, why: `no row with rowId "${e?.rowId}"` })
        if (!canWrite.has(e.field)) return skipped.push({ index, why: `field "${e.field}" is not writable` })
        const why = wrongType(typeOf.get(e.field), row[e.field], e.value)
        if (why) return skipped.push({ index, why: `${e.field} ${why}` })
        if (sameValue(row[e.field], e.value)) return skipped.push({ index, why: 'the cell already holds this value' })
        const confidence = typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : undefined
        proposals.push({ rowId: String(e.rowId), field: e.field, before: row[e.field], after: e.value, reason: e.reason, confidence })
      })
      const set = proposals.length ? opts.review.add({ source, title: input.title, proposals }) : null
      return {
        proposed: set?.proposals.length ?? 0,
        setId: set?.id ?? null,
        skipped,
        note: 'Proposed, not applied. A person will review these; call grid_review_status to see what was decided.',
      }
    },
  }

  const status: GridTool = {
    name: `${prefix}review_status`,
    description:
      'What happened to your proposals: how many are still pending, accepted, rejected, or stale (the cell changed before review), ' +
      'and the pending groups as the reviewer sees them.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute() {
      const mine = opts.review.proposals().filter((p) => p.source.id === source.id)
      const count = (s: Proposal['status']) => mine.filter((p) => p.status === s).length
      return {
        pending: count('pending'),
        accepted: count('accepted'),
        rejected: count('rejected'),
        stale: count('stale'),
        conflicts: count('conflict'),
        groups: opts.review.groups().filter((g) => g.sourceId === source.id).map((g) => ({ label: g.label, kind: g.kind, count: g.count })),
      }
    },
  }

  return [describe, query, propose, status]
}

/**
 * Register tools with the browser's WebMCP API, so an agent driving the page
 * can call them. Experimental: WebMCP is a draft (`document.modelContext`,
 * earlier `navigator.modelContext`), and this does nothing where it is
 * missing. Abort `signal`, or call `unregister`, to remove them.
 */
export function registerWebMcpTools(
  tools: ReadonlyArray<GridTool>,
  opts: { signal?: AbortSignal } = {},
): { supported: boolean; unregister: () => void } {
  const g = globalThis as { document?: { modelContext?: unknown }; navigator?: { modelContext?: unknown } }
  const mc = (g.document?.modelContext ?? g.navigator?.modelContext) as
    | { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown }
    | undefined
  if (typeof mc?.registerTool !== 'function') return { supported: false, unregister() {} }
  const controller = new AbortController()
  opts.signal?.addEventListener('abort', () => controller.abort(), { once: true })
  for (const t of tools) {
    const registered = mc.registerTool(
      {
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        execute: async (input: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(await t.execute(input ?? {})) }] }),
      },
      { signal: controller.signal },
    )
    // A rejected registration (a duplicate name, a permission) must not break the page.
    Promise.resolve(registered).catch(() => {})
  }
  return { supported: true, unregister: () => controller.abort() }
}
