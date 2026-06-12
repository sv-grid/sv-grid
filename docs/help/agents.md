# Build an AI agent that drives the grid

This is the "AI-native data grid" story end-to-end. Three patterns,
in order of how much agency you hand to the LLM:

1. **Read-only summary agent** - the model describes what's in the
   grid (analyst chat, monthly report drafts)
2. **Stateful UI agent** - the model calls `SvGridApi` methods in
   response to natural language ("group by region, sum revenue")
3. **Autonomous workflow agent** - the model orchestrates multiple
   grids + back-ends (smart import → enrich → export to BI tool)

The grid is designed to support all three. The headless engine + the
imperative `SvGridApi` together form a clean tool surface that any
agent SDK can consume.

> **Looking for the in-grid AI features?** See
> [AI assistant - Pro](./ai.md) for NL filter / smart fill /
> summarise / classify - the agent surface this page describes is
> what you'd build ON TOP of those.

## Pattern 1: Read-only summary agent

```svelte
<script lang="ts">
  import OpenAI from 'openai'
  import { SvGrid, type SvGridApi } from 'sv-grid-community'

  const client = new OpenAI()
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let answer = $state('')

  async function ask(question: string) {
    if (!api) return
    // Grid is the source of truth - only send what the user is
    // looking at right now (filters + sort + grouping respected).
    const rows = api.getDisplayedRows().slice(0, 200)
    const r = await client.chat.completions.create({
      model: 'claude-haiku-4-5',
      messages: [
        { role: 'system', content: 'Answer questions about the table below. Be concise.' },
        { role: 'user',   content: `Question: ${question}\n\nTable (first 200 rows):\n${JSON.stringify(rows)}` },
      ],
    })
    answer = r.choices[0]?.message?.content ?? ''
  }
</script>
```

**Trade-off:** simple to build, no tool calling, but the model only
sees the rows you sent it. Fine for "what's the top performer this
quarter?"; not for "filter to last 30 days" - that needs Pattern 2.

## Pattern 2: Stateful UI agent

The grid's imperative API is a clean tool surface. Each `SvGridApi`
method becomes one function the model can call.

```ts
import OpenAI from 'openai'
import { z } from 'zod'

const tools = [
  {
    type: 'function',
    function: {
      name: 'setFilter',
      description: 'Apply a column filter. Use to narrow the visible rows.',
      parameters: {
        type: 'object', required: ['columnId', 'operator', 'value'],
        properties: {
          columnId: { type: 'string' },
          operator: { type: 'string', enum: ['contains', 'equals', 'startsWith', 'greaterThan', 'lessThan', 'between'] },
          value:    { type: 'string' },
          valueTo:  { type: 'string', description: 'Upper bound for "between" only.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setSort',
      parameters: { type: 'object', required: ['columnId', 'direction'],
        properties: { columnId: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setGroupBy',
      parameters: { type: 'object', required: ['columnIds'],
        properties: { columnIds: { type: 'array', items: { type: 'string' } } } },
    },
  },
  {
    type: 'function',
    function: { name: 'clearAllFilters', parameters: { type: 'object' } },
  },
]
```

Wire the tool calls back to your live `api` reference:

```ts
async function runAgent(prompt: string) {
  let messages = [
    { role: 'system', content: `You drive a data grid. Columns: ${JSON.stringify(api!.getColumns())}.` },
    { role: 'user',   content: prompt },
  ]
  for (let turn = 0; turn < 6; turn += 1) {  // safety bound
    const r = await client.chat.completions.create({
      model: 'claude-sonnet-4-6',
      messages, tools, tool_choice: 'auto',
    })
    const msg = r.choices[0]!.message
    messages.push(msg)
    if (!msg.tool_calls?.length) return msg.content
    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments)
      switch (call.function.name) {
        case 'setFilter':       api!.setFilter(args.columnId, args); break
        case 'setSort':         api!.setSort(args.columnId, args.direction); break
        case 'setGroupBy':      api!.setGroupBy(args.columnIds); break
        case 'clearAllFilters': api!.clearAllFilters(); break
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: 'ok' })
    }
  }
}
```

User types *"show me last quarter's deals over $50k, grouped by
region"* and the agent calls `setFilter('sellDate', { ... })` +
`setFilter('amount', { operator: 'greaterThan', value: '50000' })` +
`setGroupBy(['region'])` in a single turn.

**The whole `SvGridApi` is on the menu.** Wrap as many or as few
methods as you want; the model only calls what you expose.

## Pattern 3: Autonomous workflow agent

The grid becomes one node in a longer chain. Typical shape:

```ts
const agent = new Agent({
  tools: [
    fetchCsvFromS3,           // pull raw data
    aiSmartPaste,             // parse to typed rows (uses /api/ai endpoint)
    runValidations,           // your domain validations
    pushToGrid,               // api.addRows(...)
    waitForUserApproval,      // pauses for human-in-the-loop
    exportToBigQuery,         // api.exportData({ format: 'csv', ... }) + push
  ],
})
await agent.run('Process today\'s sales batch from s3://acme/sales/2026-06-06.csv')
```

The grid is **the visible state** the human can audit between steps -
which is exactly what makes a workflow agent trustworthy: every
intermediate result lands in a sortable, filterable table the user
can inspect.

## Sandboxing rules

When an LLM is calling grid methods, three boundaries keep things sane:

1. **Whitelist tools at the top level.** Never expose `eval` or
   arbitrary JS. The `SvGridApi` methods above are the only surface
   the model needs.
2. **Validate every tool argument** before invoking. The JSON Schemas
   at [`/schemas/`](./mcp-server.md) cover every input shape; use
   `ajv` or `zod` to check.
3. **Bound the agent loop.** A maximum-turns counter (6 is plenty
   for grid manipulation) prevents runaway calls. Combine with a
   per-turn token budget.

## Common workflows shipped as MCP prompts

The [MCP server](./mcp-server.md) ships three pre-built prompts that
implement the above patterns:

- **`/svgrid:nl-to-grid-state`** - Pattern 2 with the tool set wired up
- **`/svgrid:csv-to-typed-rows`** - Smart-paste an arbitrary CSV into
  a typed row array with confidence per row
- **`/svgrid:summarise-view`** - Pattern 1 grounded in `api.getDisplayedRows()`

## Worked example: NL → Pivot

Live in [demo 75 (AI Smart Paste)](https://svgrid.com/#/demos/75-ai-smart-paste)
and [demo 52 (Pivot designer)](https://svgrid.com/#/demos/52-pivot-table)
- both ship in the gallery.

## Failure modes

| Symptom                                    | Cause                                                       | Fix                                                                       |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Model invents columns that don't exist     | No grounding on the live column set                          | Pass `api.getColumns()` in the system prompt every turn                    |
| Model calls `setFilter('Status', ...)` with the wrong case | Column ids are case-sensitive                | Include the column ids in the system prompt (snake_case vs PascalCase)     |
| Multi-step chain forgets the row count drops | Each tool call doesn't return the new visible row count    | Return `api.getDisplayedRows().length` from each handler                    |
| Agent loops forever                        | No max-turns bound                                          | Always cap the loop (5-10 turns is plenty for grid manipulation)            |

## See also

- [LLM grounding](./llm-grounding.md) - the static doc files agents read
- [MCP server](./mcp-server.md) - turnkey integration for Claude Desktop / Cursor / Zed
- [AI assistant - Pro](./ai.md) - the in-grid NL features (not the agent layer)
- [Architecture](./architecture.md) - what state lives where (agents need to know)

## Frequently asked questions

### Can an AI agent control the SvGrid data grid?

Yes. The imperative `SvGridApi` (filter, sort, select, set values, expand, page)
is exactly the surface an agent drives. This page covers three patterns, from a
read-only summary agent to a full read-write agent that mutates grid state.

### What is the safest way to let an LLM drive the grid?

Start read-only: let the model describe and query the grid before it writes.
When you grant write access, route it through the same `SvGridApi` calls a user
action would trigger, so validation and dirty-tracking still apply.

### Do I need the MCP server to build a grid agent?

No. The MCP server is a turnkey integration for desktop AI clients; for a custom
in-app agent you call `SvGridApi` directly. Both are documented here and in the
MCP server guide.
