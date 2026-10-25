# `@svgrid/enterprise` · `review/agent.ts`

Auto-generated. Source: `packages\enterprise\src\review\agent.ts`.

### `type GridTool`

One agent tool in the shape tool-use loops take: a name, a description, a
JSON Schema for its input, and `execute`.

```ts
export type GridTool = {
  name: string
  description: string
  /** JSON Schema of the input object. */
  inputSchema: Record<string, unknown>
  execute: (input: any) => Promise<unknown>
}
```

### `type GridToolsOptions`

Options for `createGridTools`: the review edits are proposed into, the grid
api, and the fields the agent may edit.

```ts
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
```

### `function createGridTools`

The tools an agent edits a grid through: `grid_describe`, `grid_query_rows`,
`grid_propose_edits` and `grid_review_status`. None of them writes the data:
edits arrive in the review as proposals for a person to accept.

```ts
export function createGridTools(opts: GridToolsOptions): GridTool[]
```

### `function registerWebMcpTools`

Register tools with the browser's WebMCP API, so an agent driving the page
can call them. Experimental: WebMCP is a draft (`document.modelContext`,
earlier `navigator.modelContext`), and this does nothing where it is
missing. Abort `signal`, or call `unregister`, to remove them.

```ts
export function registerWebMcpTools(
  tools: ReadonlyArray<GridTool>,
  opts: { signal?: AbortSignal } = {},
): { supported: boolean; unregister: () => void }
```
