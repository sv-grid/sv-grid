# Prompt: 33-server-infinite

Source: `examples/src/demos/33-server-infinite.svelte`
Live:   https://svgrid.com/demos/33-server-infinite/

## What this demo proves

33. Server-side & infinite scroll - 1M event audit log
------------------------------------------------------
A one-million-row transaction log that lives "behind an API". The
grid mounts with NO data; chunks are pulled in as the user scrolls
past their position. Sort, filter, and search round-trip to the
mock endpoint - so we're never sorting 1M rows in the browser.

Anatomy:

  - `rows` is a sparse, fixed-length array of `Transaction | null`.
    The length equals the server-side match count (1M at rest,
    fewer when a filter narrows the set). Unloaded slots are
    `null`, and the cell snippets render skeleton bars for them.

  - A scroll listener attached to the grid's scroll container
    converts the current `scrollTop` into a chunk range and asks
    the mock API for any chunks that aren't already loaded. Two
    chunks of look-ahead keeps placeholder flashes off-screen at
    reasonable scroll speeds.

  - Sort / filter / search changes wipe the cache (`rows`,
    `loadedChunks`, `pendingChunks`) and re-fetch chunk 0. The
    debounced `mockApi.query()` cancels any in-flight chunk fetch
    so old results can't paint over fresh ones.

  - A floating "Network" panel surfaces the last ten requests
    (chunk index, status, latency) plus aggregate stats from the
    mock API helper.

Replace `mockEndpoint` with `fetch('/api/transactions?...')` and
the rest of the wiring stays exactly the same.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
