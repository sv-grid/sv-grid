---
name: reference_colormix_pinned_gotcha
description: color-mix percentages must sum to 100% or the result goes semi-transparent (bit us on pinned columns)
metadata:
  type: reference
---

CSS `color-mix(in oklab, A p1%, B p2%)` scales the RESULT's alpha by `(p1+p2)/100` when the two percentages sum to **less than 100%**. So `color-mix(in oklab, var(--sg-bg) 55%, var(--sg-accent) 18%)` (sum 73%) renders at **alpha 0.73 = semi-transparent**, not opaque.

This caused the "pinned columns background is semi-transparent" bug (2026-07): [25-column-pinning.svelte](examples/src/demos/25-column-pinning.svelte) overrode `--sg-pinned-bg` / `--sg-pinned-header-bg` with pairs summing to 73-86%, so the scrolling middle columns bled through the frozen strip. The grid's DEFAULT tokens in [SvGrid.css](packages/grid/src/SvGrid.css) are correct (`92% + 8%`, `86% + 14%` = 100%).

Rule: always pair color-mix percentages as `N%` / `(100 - N)%`. Fixed demo 25 (kept accent %, set base = 100 - accent), plus [column-pinning.md](docs/help/columns/column-pinning.md) token table (was documenting wrong 70%/8% defaults) and its "very obvious" example, then re-ran `tools/build-docs-index.mjs` + `packages/mcp/scripts/build-manifests.mjs` (data.ts is generated). See [[reference_responsive_grid]].
