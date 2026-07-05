# @svgrid/grid changelog

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
