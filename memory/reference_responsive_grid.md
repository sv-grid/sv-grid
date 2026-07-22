---
name: reference_responsive_grid
description: opt-in grid `responsive` prop + per-column `hideBelow` for mobile-usable tables; where the wiring lives
metadata:
  type: reference
---

Mobile usability work (2026-07). Two layers, opt-in:

- **Gallery shell** (`examples/src/App.svelte`): sidebar collapses to a slide-over drawer below 768px (hamburger + backdrop + auto-close on demo select via `$effect` on `current.id`). Mirror this into the private website submodule's viewer separately.
- **Grid `responsive` prop** (`packages/grid`): `responsive?: boolean | { breakpoint?: number }` (default 640px). When container `viewportWidth` < breakpoint: un-pins columns (via `effectivePinning` derived that routes reads through an EMPTY set while narrow, leaving stored `columnPinning` intact), suspends `fitColumns`, adds `.sv-grid-narrow` class + momentum touch scroll.
- **Per-column `hideBelow?: number`** (px) on `ColumnDef` (`core.ts`): drops that column when container is narrower; inert unless grid has `responsive`. Filtered in the controller's `allColumns` via `isHiddenByResponsive`.

Wiring: deriveds in `SvGrid.controller.svelte.ts` after `viewportHeight` (`responsiveBreakpoint`, `isNarrowResponsive`, `effectivePinning`, `isHiddenByResponsive`) + getters; `columns.ts` `isColumnPinned` reads `ctx.effectivePinning ?? ctx.columnPinning`. Tests: `svgrid.responsive.test.ts` (uses `withWidth()` clientWidth mock). Enabled in hero demos 00 (hideBelow:700 on secondary cols) + 01 (hideBelow:640). Docs: `docs/help/mobile-card-view.md` "The quick win" section. See [[project_kanban_board]] for the sibling board-mode work.
