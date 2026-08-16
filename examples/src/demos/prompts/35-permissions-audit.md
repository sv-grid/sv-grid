# Prompt: 35-permissions-audit

Source: `examples/src/demos/35-permissions-audit.svelte`
Live:   https://svgrid.com/demos/35-permissions-audit/

## What this demo proves

35. Permissions, audit & history
--------------------------------
A B2B sales pipeline with role-based editing rules, full audit
log, per-cell change history, and one-click revert. The
enterprise-table-vendor-checklist demo.

What it demonstrates that earlier demos didn't:

  1. **Cell-level editable callbacks.** The grid's `editable`
     column-def field accepts `(ctx) => boolean`, so a single
     column can be editable for some rows and locked for others.
     Exercised here for "rep can only edit OWN deals" and
     "manager can only edit deals in OWN region" - both flowing
     from the active user object, no row-by-row prop juggling.

  2. **Column-level role gating.** PII columns (email / phone)
     are entirely locked to admins. The header still renders but
     the cell content is masked, and `editable: false` is wired
     through the same `currentUser`.

  3. **Comprehensive audit log.** Every `onCellValueChange` lands
     in a ring buffer with who / when / what cell / before / after.
     The side panel filters by user, by row, or by column.

  4. **Per-cell history popover.** Click any cell - if it has any
     audit entries we show its full timeline in a floating chip,
     newest first.

  5. **One-click revert.** Each audit entry has an "↶ revert"
     action that restores the cell to its pre-change value. The
     revert ITSELF is audited so you keep a perfect trail.

  6. **Compliance read-only mode.** A toggle freezes the grid for
     everyone but keeps the audit log visible. Used during release
     cuts, after-hours, etc.

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
