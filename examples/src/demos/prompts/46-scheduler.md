# Prompt: 46-scheduler

Source: `examples/src/demos/46-scheduler.svelte`
Live:   https://svgrid.com/demos/46-scheduler/

## What this demo proves

46. Clinic day scheduler (Enterprise Scheduler view)
---------------------------------------------------
The same <SvGrid>, rendered as a real calendar by setting one `scheduler`
prop: providers become resource columns, appointment rows become events laid
out on the hour axis. Drag to reschedule, drag an edge to resize, drag across
providers to reassign, click to edit in the built-in drawer; a live now-line
ticks. The calendar renderer ships in @svgrid/enterprise.

(Previously a hand-rolled timeline; now it uses the first-class Scheduler.)

## Imports

```ts
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
