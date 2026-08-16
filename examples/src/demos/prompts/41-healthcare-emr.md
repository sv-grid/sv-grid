# Prompt: 41-healthcare-emr

Source: `examples/src/demos/41-healthcare-emr.svelte`
Live:   https://svgrid.com/demos/41-healthcare-emr/

## What this demo proves

41. Healthcare EMR - inpatient board
------------------------------------
An ICU / inpatient list as it would appear to a clinician. Built
to show the procurement team's healthcare buyer two things at
once:

  1. **The grid renders rich clinical cells.** Vitals sparkline,
     color-graded risk score, allergy chip cluster, code-status
     pill, primary-nurse avatar - all in stock SvGrid cell
     snippets, no plugin layer.

  2. **Role-based access actually works.** The role switcher
     drives the cell-level `editable: (ctx) => boolean` predicate
     the grid added in demo 35. Nurses can edit notes; physicians
     can move code status and orders; admins also see discharge
     planning fields. Try Viewer to see everything lock.

No PHI: every name, MRN, allergy, and diagnosis is synthetic
and deterministically seeded. The structure is what counts.

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
