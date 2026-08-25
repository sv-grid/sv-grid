# @svgrid/grid changelog

Releases above 1.2.3 are generated from the commit subjects in each release tag range
(`node tools/build-changelog.mjs`), so they describe what changed rather than
reading as polished release notes. Entries from 1.2.3 down are hand-written.

## 2.6.5

_2026-08-24_

- Track the enterprise bump in SVGRID_VERSION
- Fix the /filtering entry for raw Node, and guard it
- Advanced filter: toolbar indicator, change notification, docs
- Nested groups in the filter builder
- Accessibility: axe in CI, theme contrast, and two real defects
- Server-side grouping across all three adapters
- Advanced filter: point the expression engine at the grid
- Make the compliance claims true instead of deleting them

## 2.6.2

_2026-08-23_

- Make form controls fill their cell
- Actually apply the size class to an inline form
- Document the round-2 builder
- Model support for the round-2 builder
- Stop capping an inline form at 460px, and let a condition row shrink
- Document the wizard, and why SSR does not step
- Ask one section at a time
- Document folding, and what it is not
- Let a long form fold itself away
- Document where a form comes from
- Make the Form block a real block: one that creates

## 2.5.2

_2026-08-23_

- Update contact email in LICENSE file

## 2.5.1

_2026-08-22_

- Publish @svgrid/enterprise as compiled dist, not raw source
- Verify the generated app actually builds, in CI
- Document the forms work
- Let an agent build the form too
- Generate real SvelteKit by default, and give the form layout a model
- Tell a typo apart from a crash in the Studio CLI
- Show conditional fields working in three sample apps
- Let a form react to its own answers, and stop scolding as you type
- Pin generated apps to the generator's own version, not latest
- Give an expired trial its own message
- Fix accent contrast in the themes that failed it

## 2.2.34

_2026-08-20_

- Update docs-snippets.test.ts
- fixed broken tests, moved AI features to the Grid package from Enterprise
- Correct the published bundle figures to the measured 78.2 KB
- Restore SvGridDropdown's lazy boundary: base 84.1 -> 78.2 KB
- Keep the .mcpb spec-valid; Smithery's bundle publish is broken
- Add an .mcpb bundle build for Smithery and one-click desktop installs
- Fix the last alert: vulnerable adapter in the scaffolded starter
- Release @svgrid/enterprise 2.3.2 so the adapter fix reaches Studio users
- Clear all 37 Dependabot alerts, incl. an adapter shipped to users

## 2.2.33

_2026-08-19_

- Release @svgrid/mcp 2.3.3 to npm and the MCP registry
- updates - studio wizard

## 2.2.32

_2026-08-19_

- Fix demo type errors, including dead bind: directives
- Fix enterprise type errors, incl. a real async-options crash
- Get CI green: 131 type errors to zero, honest coverage gates
- Fix invalid test.yml so CI can run at all
- Fix AI-crawler doc URLs, enrich demo pages, harden the prerenderer

## 2.2.29

_2026-08-17_

- Excel Filtering performance and Listbox extensions

## 2.2.27

_2026-08-17_

- Update data.ts
- website: bump submodule to ae50cbd

## 2.2.19

_2026-08-13_

- Grid: keep the scrollbar custom element out of tree-shaking

## 2.2.17

_2026-08-12_

- i
- u
- themes: add Ember, SvGrid's signature warm-neutral theme
- demo improvements, seo optimization and minor fixes
- Studio: event handlers as code-behind in handlers.ts
- Studio: Properties + Events tabs show the FULL per-component surface
- grid: list controls tolerate primitive/duplicate options (no more each_key_duplicate)
- Studio codegen: type chips/tags fields as string[] in the emitted row type
- Studio fragment mode: emit routes + lib to drop into an existing SvelteKit app (X2)
- Studio form depth: column count, field selection/order, titled sections, dialog chrome
- Studio: import an OpenAPI spec -> entities + REST sources (D4)
- Studio SSR: read-only screens (data-viz / detail / master-detail) render server-side
- `svgrid-studio dev`: the designer edits the RUNNING app (+ SSR bug it caught)
- Studio Copilot ships: `svgrid-studio designer --ai` wires the AI panel to Claude
- Studio toolbox: extractor-driven full prop/event surface for every component
- Studio designer-server: manifest clobber guard on Save-to-folder
- Studio: `svgrid-studio deploy` - build + publish via the provider CLI
- create-studio: default scaffold gets the production kit (parity with the bundle)
- Studio: real-DB last mile - schema.sql/seed.sql, drizzle db:seed, footgun warnings
- SvGrid: initialSorting prop; Studio SSR uses it so the sort indicator matches URL
- Studio SSR: URL-driven filter row (completes sort/filter/paginate over the URL)
- Studio: SPA grid page defaults pageSize when unset (was emitting undefined)
- Studio SSR: SQL relation fields render a <select> too (prefetch via related /api)
- Studio/enterprise: clear the last generated-app svelte-check errors
- Studio: facet filter emits string values (fixes consumer type-check)
- Studio: computed / formula fields are optional in the generated row type
- enterprise: stop optional-peer dynamic imports from breaking consumer type-checks
- Studio SSR slice 2b: relation fields render a native <select> in the SSR form
- Studio SSR slice 2c: RBAC enforced in memory SSR load/actions
- Studio: secure-by-default auth (slice 2d)
- Studio SSR slice 2a: SQL/Drizzle entities can render SSR-native
- Studio: SSR-native output for CRUD screens (slice 1, opt-in)

## 2.2.1

_2026-08-04_

- Stop tracking internal marketing/GTM docs; gitignore marketing/
- ui 0.3.4: full component catalogue + suite image in the README
- docs: document `try` with multiple components / a family at once
- ui 0.3.3: theme picker + light/dark toggle in the try sandbox
- docs: add "see it with try" line to the 9 UI component family pages
- ui 0.3.2: add is project-aware - guide to try/create when there's no project
- docs: add "see it with try" line to all 72 UI component pages
- docs: changelog entries for ui try/preview + enterprise/mcp/create-studio fixes
- ui 0.3.1: point users to the "see it" step after add + refresh docs
- Fixes from package smoke-tests + @svgrid/ui preview UX

## 2.1.23

_2026-08-03_

- updates
- installation updates of the editors
- Update SvDockLayout.svelte
- Update dock-context.ts
- added more filter options and browser bounds detection to the grid editors
- Studio: wire code-behind into entity screens + expose ctx.grid everywhere
- Studio: expose the Grid as its real SvGridApi (ctx.grid), strongly typed
- Studio: components become named imperative handles (btn.setLabel, btn.onclick)
- Studio code model: always-present onLoad(ctx) + Svelte refs (not getElementById)
- Studio codegen: structured onLoad slot + page-element id manifest
- Studio codegen: user-owned handler companions (design + your own code)

## 2.1.7

_2026-07-26_

- feat(charting): integrated chart panel + enterprise pivot/AI charting

## 2.1.5

_2026-07-25_

- Update daily-tweet.yml

## 2.1.1

_2026-07-23_

- fix: SvelteKit vite plugin import broke every scaffolded/generated app
- Fixed Theming and CLI options to choose a default theme

## 2.0.1

_2026-07-22_

- 2.0.0
- chore: bump website submodule pointer (custom CSS)
- Studio: custom CSS - brand the generated app beyond the theme presets
- chore: bump website submodule pointer (data model view)
- chore: bump website submodule pointer (copy/paste + screen mgmt + shortcuts)
- Studio: insertBlock / duplicateScreen / reorderScreen ops (paste + screen mgmt)
- chore: bump website submodule pointer (inline validation)
- Studio: attribute validation issues to blocks + more per-block checks
- chore: bump website submodule pointer (designer autosave/restore)
- chore: bump website submodule pointer (record panel presentation)
- Studio: record panel can open as a modal or sidebar drawer (not just inline)
- examples(334-checkout-form): keep all fields inside the card
- chore: bump website submodule pointer (SvGrid UI icons + Recipes)
- examples: real-world SvGrid UI recipes (checkout, booking, product filter)
- chore: bump website submodule pointer (SvGrid UI rename)
- test: expand SvGridEditPanel DOM coverage (editorType routing + submit round-trip)
- chore: bump website submodule pointer (record Save updates preview grid)
- chore: bump website submodule pointer (record panel preview fix)
- chore: bump website submodule pointer (designer number options + chips fix)
- Studio fixes: PGlite migration, i18n block labels, CSV delimiter, number options, DOM tests
- chore: point website submodule at the Studio designer commit
- Studio: rich editors in forms, Gauge/Tree/Tabs blocks, onboarding + provisioning

## 1.2.24

_2026-07-17_

- headless editors
- Delete __headless_demo_check.svelte.ts
- Create __headless_demo_check.svelte.ts
- more editor fixes
- Update SvTree.svelte
- Create createDateTimePicker.svelte.ts
- headless editors updates
- updates for headless editors and website
- Convert website to a private git submodule
- ci: restore private Studio designer during website build

## 1.2.23

_2026-07-16_

- Grid Editors

## 1.2.8

_2026-07-09_

- Update publish-npm.yml

## 1.2.4

_2026-07-07_

- Fixed home page responsiveness on phone and pinned columns bug fix
- Fixes and Examples switcher in the Playground
- Bug fixes

<!-- build-changelog: hand-written entries below this line -->

## 1.2.3

### Fixed

- **Pinned columns no longer disappear when column virtualization is on.** A
  pinned column is `position: sticky`, so it only stays pinned while its cell is
  in the DOM - but column virtualization dropped it once it scrolled out of the
  window, so scrolling far enough sideways made the frozen column vanish (the
  workaround was `columnVirtualization={false}`). The rendered column window now
  stays contiguous through the pinned-left prefix and pinned-right suffix, so
  pinned cells are always rendered and pinning + column virtualization work
  together. No API change.
- **No more "ResizeObserver loop completed with undelivered notifications"
  console noise.** The grid's internal `ResizeObserver`s (header height, root
  size, viewport size, and the custom scrollbar) mutated layout state
  synchronously inside the observe callback, which the browser reports with that
  benign-but-noisy warning - most visibly when a whole grid is swapped at once
  (e.g. switching demos in the playground). The callbacks now coalesce onto the
  next animation frame, so each delivery cycle finishes cleanly and the warning
  is gone. Behaviour is unchanged; the remeasure just happens one frame later.

## 1.2.2

### Fixed

- **The grid now themes itself out of the box.** Styling that previously lived
  only in the examples' host stylesheet is now shipped in the grid's own CSS, so
  a bare `@svgrid/grid` install (or the single-file / CDN builds) renders a
  complete grid with no extra stylesheet:
  - **Cell grid lines** (per-cell right + bottom borders, clean outer edge),
  - **Row hover** tint,
  - **Pagination footer** (layout, page-size select, prev/next buttons, labels)
    - `GridFooter.svelte` shipped with no styles at all before,
  - **Filter inputs** - the header filter row, per-column filter, global search
    box, and menu search/condition inputs now get a tokenized background +
    border out of the box (previously only the inline cell editor + menu inputs
    were styled), with a calm box-shadow focus instead of a hard outline.
  - **Column menu + filter chrome** - the filter-operator `<select>`, the
    "search values" magnifier, the facet checklist's native checkboxes
    (accent-colored), the submenu chevron, the filter/choose-columns popover
    widths, the filter-menu spacing, and the active-filter funnel tint are now
    themed by the grid (were host-only, so bare consumers saw unstyled menus).
  - **Selection checkbox** fills with the accent (was the lighter selection
    tint); **column resize handle** shows an accent center pill on hover/drag;
    scrollbar-corner divider, group-row label, and a few operator/button states
    now use tokens instead of hardcoded values.

  All driven by the existing `--sg-*` tokens with sensible fallbacks; consumer
  overrides still win, so the examples/site look unchanged. Every redundant
  `.sv-grid-*` override was removed from the examples' + website's host
  stylesheets - they now carry only demo helpers, no grid chrome.

- **Pinned columns were semi-transparent.** The default pinned-cell tint used
  `color-mix(... 70%, ... 8%)` whose percentages sum to 78%, which per spec
  yields a 78%-opaque colour - so scrolling rows bled through the frozen column.
  The mixes now sum to 100% (`92%/8%`, `86%/14%`) and are fully opaque.
- **Right-aligned values hid under the vertical scrollbar.** The custom
  scrollbar overlays the right 16px of the viewport, and the scrollbar-width
  reservation only ran in `fitColumns` mode. The last column's right-aligned
  content now gets 16px of extra right padding whenever the vertical scrollbar
  is visible, so numbers stay clear of it.

## 1.2.0

### Added

- **CDN bundles.** Pre-compiled ESM bundles under `dist/cdn/` (CSS inlined):
  - `svgrid.js` - Svelte runtime bundled in; a self-contained drop-in exposed
    via the `unpkg` / `jsdelivr` fields and the `./cdn` export.
  - `svgrid.svelte-external.js` - Svelte kept external (`./cdn/svelte-external`
    export), so a page that compiles its own component can share ONE Svelte
    runtime with the grid. Powers the website's "copy runnable Svelte HTML"
    single-file export.

  The main `exports` still ship the Svelte-source library, so npm + Vite /
  SvelteKit consumers keep tree-shaking and normal compilation - nothing
  changes for them.

### Fixed

- **Smaller install.** Test artifacts (`*.test.*`, `*.spec.*`, `test-setup.*`,
  `test-fixtures/`) are stripped from the published `dist/` (~130 files that
  were previously shipped to every installer).
- **Valid HTML / accessibility.** The multi-select dropdown no longer nests a
  `<button>` (the chip "remove" control) inside the trigger `<button>` - the
  remove control is now a `role="button"` span with identical behaviour. The
  Excel fill handle carries an explicit `tabindex`, and a stray tabindex lint on
  the free-form chips editor was resolved.
