import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  setAIProvider, getAIProvider, hasAIProvider,
  mockAIProvider,
  aiFilter, aiSmartFill, aiSummarize, aiClassify,
  type AIProvider, type AIRequest,
} from './ai'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Minimal stub of the SvGridApi surface our AI helpers depend on. We don't
 * mock the entire grid - the AI helpers only read `getData()` and (for
 * the `apply` branch of aiFilter) call setFilter/setSort/clearAllFilters/
 * clearSort. Everything else stays a no-op.
 */
function fakeApi<T extends Record<string, unknown>>(data: T[]) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const log = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
  }
  const api = {
    getData: () => data,
    getDisplayedRows: () => data,
    setFilter: log('setFilter'),
    clearAllFilters: log('clearAllFilters'),
    setSort: log('setSort'),
    clearSort: log('clearSort'),
    setColumnVisible: log('setColumnVisible'),
    isColumnVisible: () => true,
    getCellValue: () => undefined,
    setCellValue: log('setCellValue'),
    addRow: log('addRow'),
    addRows: log('addRows'),
    removeRow: log('removeRow'),
    removeRows: log('removeRows'),
    addColumn: log('addColumn'),
    addColumns: log('addColumns'),
    removeColumn: log('removeColumn'),
    setGroupBy: log('setGroupBy'),
    clearFilter: log('clearFilter'),
    getFilters: () => ({}),
    clearRowSelection: log('clearRowSelection'),
  }
  return { api: api as any, calls }
}

/**
 * Build a provider that records every request it sees and replies with a
 * caller-chosen response. Used for the deterministic-shape tests where we
 * need to assert what the helper put into the prompt or what it does with
 * the model's reply.
 */
function recordingProvider(reply: string | ((req: AIRequest) => string)) {
  const seen: AIRequest[] = []
  const fn: AIProvider = async (req) => {
    seen.push(req)
    return typeof reply === 'function' ? reply(req) : reply
  }
  return { provider: fn, seen }
}

// Make sure each test starts from a known state. The provider is a global in the
// AI module, so we reset it around every test.
beforeEach(() => {
  setAIProvider(null)
})
afterEach(() => {
  setAIProvider(null)
})

// ---------------------------------------------------------------------------
// Provider plumbing
// ---------------------------------------------------------------------------

describe('AI provider registration', () => {
  it('setAIProvider stores the function and hasAIProvider reflects it', () => {
    expect(hasAIProvider()).toBe(false)
    expect(getAIProvider()).toBeNull()

    const fn: AIProvider = async () => '{}'
    setAIProvider(fn)
    expect(hasAIProvider()).toBe(true)
    expect(getAIProvider()).toBe(fn)
  })

  it('setAIProvider(null) clears the registration', () => {
    setAIProvider(async () => '{}')
    setAIProvider(null)
    expect(hasAIProvider()).toBe(false)
  })

  it('throws a typed NoProviderError when no provider is registered', async () => {
    const { api } = fakeApi([{ id: 1, value: 10 }])
    await expect(aiFilter(api, 'anything')).rejects.toThrow(/no AI provider registered/i)
  })

  it('throws on non-JSON when a json-format helper gets back prose', async () => {
    const { provider } = recordingProvider('this is not JSON at all')
    setAIProvider(provider)
    const { api } = fakeApi([{ id: 1, value: 10 }])
    await expect(aiFilter(api, 'find rows')).rejects.toThrow(/non-JSON/i)
  })

  it('strips a markdown ```json fence before parsing', async () => {
    const { provider } = recordingProvider(
      '```json\n{"filters": [], "sort": [], "rationale": "ok"}\n```',
    )
    setAIProvider(provider)
    const { api } = fakeApi([{ id: 1, value: 10 }])
    const r = await aiFilter(api, 'anything')
    expect(r.rationale).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// aiFilter
// ---------------------------------------------------------------------------

describe('aiFilter', () => {
  it('passes the column schema to the prompt and tags the task', async () => {
    const { provider, seen } = recordingProvider(
      JSON.stringify({ filters: [], sort: [], rationale: 'x' }),
    )
    setAIProvider(provider)
    const { api } = fakeApi([
      { id: 'A1', amount: 100, region: 'EMEA' },
      { id: 'A2', amount: 250, region: 'NA' },
    ])
    await aiFilter(api, 'show big EMEA deals')

    expect(seen).toHaveLength(1)
    const req = seen[0]!
    expect(req.task).toBe('filter')
    expect(req.responseFormat).toBe('json')
    // The schema block must mention every column.
    expect(req.prompt).toMatch(/id \(string\)/)
    expect(req.prompt).toMatch(/amount \(number\)/)
    expect(req.prompt).toMatch(/region \(string\)/)
    // The user's query is forwarded verbatim.
    expect(req.prompt).toMatch(/show big EMEA deals/)
  })

  it('drops filter / sort clauses that reference a column the grid does not have', async () => {
    // The model hallucinates "made_up_field" - the helper must silently drop
    // it rather than pass it through to setFilter, which would otherwise
    // throw.
    const reply = {
      filters: [
        { field: 'amount', operator: 'greaterThan', value: '100' },
        { field: 'made_up_field', operator: 'contains', value: 'foo' },
      ],
      sort: [
        { field: 'amount', desc: true },
        { field: 'imaginary', desc: false },
      ],
      rationale: 'amount > 100',
    }
    setAIProvider(recordingProvider(JSON.stringify(reply)).provider)
    const { api } = fakeApi([{ amount: 100, region: 'NA' }])
    const r = await aiFilter(api, 'anything')

    expect(r.filters).toHaveLength(1)
    expect(r.filters[0]?.field).toBe('amount')
    expect(r.sort).toHaveLength(1)
    expect(r.sort[0]?.field).toBe('amount')
  })

  it('with apply=true applies filters and the last sort clause to the grid', async () => {
    const reply = {
      filters: [{ field: 'amount', operator: 'greaterThan', value: '100' }],
      sort: [
        { field: 'amount', desc: false },  // earlier - should be overridden
        { field: 'amount', desc: true },   // last - this is the one applied
      ],
      rationale: '',
    }
    setAIProvider(recordingProvider(JSON.stringify(reply)).provider)
    const { api, calls } = fakeApi([{ amount: 100, region: 'NA' }])
    await aiFilter(api, 'q', { apply: true })

    const methods = calls.map((c) => c.method)
    expect(methods).toContain('clearAllFilters')
    expect(methods).toContain('clearSort')
    const setFilter = calls.find((c) => c.method === 'setFilter')!
    expect(setFilter.args[0]).toBe('amount')
    expect((setFilter.args[1] as any).operator).toBe('greaterThan')
    const setSort = calls.find((c) => c.method === 'setSort')!
    expect(setSort.args[0]).toBe('amount')
    expect(setSort.args[1]).toBe('desc')
  })

  it('does NOT apply when apply is omitted (preview-only mode)', async () => {
    const reply = {
      filters: [{ field: 'amount', operator: 'greaterThan', value: '100' }],
      sort: [{ field: 'amount', desc: true }],
      rationale: '',
    }
    setAIProvider(recordingProvider(JSON.stringify(reply)).provider)
    const { api, calls } = fakeApi([{ amount: 100, region: 'NA' }])
    const r = await aiFilter(api, 'q')

    expect(calls.find((c) => c.method === 'setFilter')).toBeUndefined()
    expect(calls.find((c) => c.method === 'setSort')).toBeUndefined()
    // But the result still contains the plan so the caller can render a preview.
    expect(r.filters).toHaveLength(1)
    expect(r.sort).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// aiSmartFill
// ---------------------------------------------------------------------------

describe('aiSmartFill', () => {
  it('throws when no examples are provided', async () => {
    setAIProvider(recordingProvider('{}').provider)
    const { api } = fakeApi([{ id: 1, tier: '' }])
    await expect(
      aiSmartFill(api, { field: 'tier', examples: [] }),
    ).rejects.toThrow(/requires at least one example/i)
  })

  it('auto-selects empty rows when targetRowIndices is omitted', async () => {
    const { provider, seen } = recordingProvider(
      JSON.stringify({
        predictions: [{ rowIndex: 1, value: 'auto', confidence: 0.9 }],
        rationale: '',
      }),
    )
    setAIProvider(provider)
    const { api } = fakeApi([
      { id: 1, tier: 'enterprise' },  // already filled
      { id: 2, tier: '' },             // empty -> picked
      { id: 3, tier: null as unknown as string },     // null -> picked
      { id: 4, tier: 'starter' },      // already filled
    ])
    await aiSmartFill(api, {
      field: 'tier',
      examples: [{ input: { id: 999 }, output: 'starter' }],
    })

    const prompt = seen[0]!.prompt
    // Rows 1 and 2 (0-indexed) are the empty ones.
    expect(prompt).toMatch(/Row 1: /)
    expect(prompt).toMatch(/Row 2: /)
    // Rows 0 and 3 are already filled - should NOT appear.
    expect(prompt).not.toMatch(/Row 0: /)
    expect(prompt).not.toMatch(/Row 3: /)
  })

  it('returns an empty prediction list when there are no empty cells', async () => {
    setAIProvider(recordingProvider('{"predictions":[],"rationale":""}').provider)
    const { api } = fakeApi([
      { id: 1, tier: 'enterprise' },
      { id: 2, tier: 'starter' },
    ])
    const r = await aiSmartFill(api, {
      field: 'tier',
      examples: [{ input: { id: 1 }, output: 'enterprise' }],
    })
    expect(r.predictions).toHaveLength(0)
    expect(r.rationale).toMatch(/no empty/i)
  })

  it('respects explicit targetRowIndices', async () => {
    const { provider, seen } = recordingProvider(
      JSON.stringify({
        predictions: [{ rowIndex: 0, value: 'x', confidence: 0.5 }],
        rationale: '',
      }),
    )
    setAIProvider(provider)
    const { api } = fakeApi([
      { id: 1, tier: 'enterprise' },
      { id: 2, tier: 'starter' },
    ])
    await aiSmartFill(api, {
      field: 'tier',
      targetRowIndices: [0],
      examples: [{ input: { id: 1 }, output: 'override' }],
    })
    expect(seen[0]!.prompt).toMatch(/Row 0: /)
    expect(seen[0]!.prompt).not.toMatch(/Row 1: /)
  })
})

// ---------------------------------------------------------------------------
// aiSummarize
// ---------------------------------------------------------------------------

describe('aiSummarize', () => {
  it('returns a safe empty result when the slice is empty', async () => {
    // Use a non-empty dataset but a row target that doesn't exist - the
    // helper must short-circuit BEFORE calling the provider.
    let calls = 0
    setAIProvider(async () => { calls += 1; return '{}' })
    const { api } = fakeApi([{ id: 1 }])
    const r = await aiSummarize(api, { target: { kind: 'row', rowIndex: 99 } })
    expect(r.text).toBe('No rows in scope.')
    expect(r.bullets).toEqual([])
    expect(calls).toBe(0)
  })

  it('groups by field value when target.kind = "group"', async () => {
    const { provider, seen } = recordingProvider(
      JSON.stringify({ text: 'ok', bullets: [], highlightedFields: [] }),
    )
    setAIProvider(provider)
    const { api } = fakeApi([
      { id: 1, region: 'NA' },
      { id: 2, region: 'NA' },
      { id: 3, region: 'EMEA' },
    ])
    const r = await aiSummarize(api, {
      target: { kind: 'group', field: 'region', value: 'NA' },
    })
    expect(r.text).toBe('ok')
    // Only the two NA rows should appear in the prompt.
    const prompt = seen[0]!.prompt
    expect(prompt).toMatch(/"id":1/)
    expect(prompt).toMatch(/"id":2/)
    expect(prompt).not.toMatch(/"id":3/)
  })

  it('samples large slices uniformly so the prompt stays under budget', async () => {
    const { provider, seen } = recordingProvider(
      JSON.stringify({ text: 'ok', bullets: [], highlightedFields: [] }),
    )
    setAIProvider(provider)
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: i }))
    const { api } = fakeApi(rows)
    await aiSummarize(api, { target: { kind: 'all' } })

    // Default sample cap is 25. We can't easily inspect the exact sample
    // count without parsing, but the prompt should advertise the FULL
    // slice size while only sampling a subset (so the rendered JSON line
    // count is ~25 rather than ~200).
    const prompt = seen[0]!.prompt
    expect(prompt).toMatch(/Slice size: 200 row/)
    const jsonLines = (prompt.match(/\{"id":/g) ?? []).length
    expect(jsonLines).toBeLessThanOrEqual(30)
  })

  it('includes the user question in the prompt when provided', async () => {
    const { provider, seen } = recordingProvider(
      JSON.stringify({ text: 'ok', bullets: [], highlightedFields: [] }),
    )
    setAIProvider(provider)
    const { api } = fakeApi([{ id: 1 }])
    await aiSummarize(api, {
      target: { kind: 'all' },
      question: 'Which accounts are at risk?',
    })
    expect(seen[0]!.prompt).toMatch(/Which accounts are at risk\?/)
  })
})

// ---------------------------------------------------------------------------
// aiClassify
// ---------------------------------------------------------------------------

describe('aiClassify', () => {
  it('drops predictions whose value is not in the allowed class set', async () => {
    setAIProvider(
      recordingProvider(JSON.stringify({
        predictions: [
          { rowIndex: 0, value: 'at-risk',   confidence: 0.9 },
          { rowIndex: 1, value: 'expanding', confidence: 0.8 },
          // Hallucinated label - must be dropped.
          { rowIndex: 2, value: 'something-else', confidence: 0.95 },
        ],
      })).provider,
    )
    const { api } = fakeApi([
      { notes: 'losing momentum' },
      { notes: 'expanding fast' },
      { notes: 'unclear' },
    ])
    const r = await aiClassify(api, {
      inputField: 'notes',
      outputField: 'sentiment',
      classes: ['at-risk', 'expanding', 'steady'],
    })
    expect(r.predictions).toHaveLength(2)
    expect(r.predictions.find((p) => p.value === 'something-else')).toBeUndefined()
  })

  it('includes the rubric in the prompt when classDescriptions is provided', async () => {
    const { provider, seen } = recordingProvider('{"predictions":[]}')
    setAIProvider(provider)
    const { api } = fakeApi([{ notes: 'x' }])
    await aiClassify(api, {
      inputField: 'notes',
      outputField: 'sentiment',
      classes: ['at-risk', 'steady'],
      classDescriptions: {
        'at-risk': 'churn signals',
        steady:   'no signals',
      },
    })
    expect(seen[0]!.prompt).toMatch(/- at-risk: churn signals/)
    expect(seen[0]!.prompt).toMatch(/- steady: no signals/)
  })
})

// ---------------------------------------------------------------------------
// mockAIProvider end-to-end
// ---------------------------------------------------------------------------

describe('mockAIProvider', () => {
  it('round-trips through aiFilter with at least one sensible clause', async () => {
    setAIProvider(mockAIProvider)
    const { api } = fakeApi([
      { id: 'A1', arr: 100_000, region: 'EMEA',  owner: 'Sasha' },
      { id: 'A2', arr: 250_000, region: 'NA',    owner: 'Jamie' },
      { id: 'A3', arr:  50_000, region: 'APAC',  owner: 'Casey' },
    ])
    const r = await aiFilter(api, 'show accounts over $80k in EMEA, highest first')
    // Should have inferred something about "over $80k", "EMEA", and a sort.
    const fields = r.filters.map((f) => f.field)
    expect(fields).toContain('arr')
    expect(fields).toContain('region')
    expect(r.sort.length).toBeGreaterThan(0)
    expect(r.rationale).toMatch(/Interpreted/i)
  })

  it('round-trips through aiClassify and returns labels from the allowed set', async () => {
    setAIProvider(mockAIProvider)
    const { api } = fakeApi([
      { id: 1, notes: 'champion left, ARR at risk' },
      { id: 2, notes: 'expanding into two new regions' },
      { id: 3, notes: 'steady usage no surprises' },
    ])
    const r = await aiClassify(api, {
      inputField: 'notes',
      outputField: 'sentiment',
      classes: ['at-risk', 'expanding', 'steady'],
    })
    expect(r.predictions.length).toBeGreaterThan(0)
    for (const p of r.predictions) {
      expect(['at-risk', 'expanding', 'steady']).toContain(p.value)
      expect(p.confidence).toBeGreaterThan(0)
      expect(p.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('summarises the whole view via the mock', async () => {
    setAIProvider(mockAIProvider)
    const { api } = fakeApi(Array.from({ length: 12 }, (_, i) => ({ id: i, value: i * 100 })))
    const r = await aiSummarize(api, { target: { kind: 'all' } })
    expect(r.text).toMatch(/12 rows in scope/i)
    expect(r.bullets.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// No license gating (AI is built-in + free)
// ---------------------------------------------------------------------------

describe('no license gating (AI is built-in + free)', () => {
  it('AI calls succeed with no license key set at all', async () => {
    setAIProvider(mockAIProvider)
    const { api } = fakeApi([{ id: 1 }])
    const r = await aiFilter(api, 'anything')
    expect(r).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Abort + cancellation
// ---------------------------------------------------------------------------

describe('cancellation', () => {
  it('forwards the AbortSignal to the provider for aiFilter', async () => {
    let receivedSignal: AbortSignal | undefined
    const provider: AIProvider = async (req) => {
      receivedSignal = req.signal
      return JSON.stringify({ filters: [], sort: [], rationale: '' })
    }
    setAIProvider(provider)
    const controller = new AbortController()
    const { api } = fakeApi([{ id: 1 }])
    await aiFilter(api, 'q', { signal: controller.signal })
    expect(receivedSignal).toBe(controller.signal)
  })

  it('forwards the AbortSignal for aiSummarize', async () => {
    let receivedSignal: AbortSignal | undefined
    const provider: AIProvider = async (req) => {
      receivedSignal = req.signal
      return JSON.stringify({ text: '', bullets: [], highlightedFields: [] })
    }
    setAIProvider(provider)
    const controller = new AbortController()
    const { api } = fakeApi([{ id: 1 }])
    await aiSummarize(api, { target: { kind: 'all' }, signal: controller.signal })
    expect(receivedSignal).toBe(controller.signal)
  })
})
