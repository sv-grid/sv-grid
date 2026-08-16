# Prompt: 55-state-maintenance

Source: `examples/src/demos/55-state-maintenance.svelte`
Live:   https://svgrid.com/demos/55-state-maintenance/

## What this demo proves

55. State maintenance
----------------------
Capture every dimension the user can change about the grid - sort,
filters, group-by, column visibility + widths, page, expansion,
selection, active cell - into a JSON-serialisable bag, then
restore the grid to that exact state on demand.

Five surfaces sit on top of the snapshot util:

  1. **History (undo / redo).** Every meaningful change pushes a
     snapshot onto a bounded ring; the two arrows step through it.

  2. **Auto-save.** Toggle on/off. When on, the latest state
     writes to localStorage debounced at 250 ms - reload the page
     and the grid comes back as you left it.

  3. **Named bookmarks.** Capture-with-a-label saves the snapshot
     into a side list so a user can build "Weekly forecast view",
     "Churn risk view", etc.

  4. **JSON export / import.** Copy the current state as JSON,
     paste a JSON state to restore. Round-trips cleanly through
     Slack / a ticket / version control.

  5. **Forget everything.** Wipes the auto-save key + the history.

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

## SvGridApi methods called

- `api.setSort(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
