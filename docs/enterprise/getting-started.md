# Enterprise getting started: a complete example

One page, one file, from an empty folder to a working grid with Excel, PDF and
CSV export. Nothing is elided - every command and every line below was run
end to end against the published packages.

If you already have a project, skip to [step 2](#2-install).

## 1. Create a project

```bash
npx sv create svgrid-trial --template minimal --types ts --no-add-ons
cd svgrid-trial
```

Those flags skip every interactive prompt, so the sequence is copy-pasteable.
For a plain Vite app instead, `npm create @svgrid@latest` scaffolds one with
the grid already wired in - the component below drops into either.

## 2. Install

```bash
npm install @svgrid/grid @svgrid/enterprise
npm install jszip pdfmake          # optional peers, for Excel and PDF export
```

`jszip` and `pdfmake` are optional peer dependencies, lazy-loaded the first
time you actually call an export. Skip them if you only need CSV, TSV or HTML;
`exportData` throws a message naming the missing package if you call a format
whose peer is absent.

**No build configuration is required.** If you are on `@svgrid/enterprise`
2.5.x or earlier, see [older versions](#older-versions) below - those releases
shipped TypeScript source and needed two `optimizeDeps` entries in
`vite.config.js`.

## 3. The component

Replace the contents of `src/routes/+page.svelte` (or `src/App.svelte` in a
Vite project) with this. It is self-contained: licence, theme, grid and
exports, with nothing else to wire up.

```svelte
<script>
  import { SvGrid } from '@svgrid/grid'
  import { installEnterprise, setLicenseKey } from '@svgrid/enterprise'
  // One of 20 themes that ship with the package. Swap the id for material,
  // nord, dracula, fluent, carbon, ag-alpine, and so on. Each carries a full
  // light AND dark palette; dark activates on <html data-theme="dark">.
  import '@svgrid/grid/themes/shadcn.css'

  // Once, before any Enterprise feature runs. Use your own key here; see
  // ./evaluation.md for how to get an evaluation key.
  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  let api = $state(null)
  let status = $state('')

  // Capabilities are boolean props - `sortable`, `filterable`, `editable`,
  // `groupable`, `pageable` - and each injects the feature it needs. For finer
  // control, register features explicitly with `tableFeatures({ ... })` and
  // pass them as `features`.

  // Starts 'light' rather than reading the DOM, so this file is safe to render
  // on the server too. The effect below syncs it once we are in the browser.
  let theme = $state('light')

  $effect(() => {
    const saved = localStorage.getItem('theme')
    if (saved) theme = saved
  })

  $effect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch (e) {
      // Private mode / storage disabled. The toggle still works for this tab.
    }
  })

  // Your data. Swap for a fetch() in onMount, a load function, or props.
  let rows = $state([
    { id: 1, name: 'Ada Lovelace', team: 'Engineering', salary: 145000, active: true },
    { id: 2, name: 'Alan Turing', team: 'Research', salary: 160000, active: true },
    { id: 3, name: 'Grace Hopper', team: 'Engineering', salary: 152000, active: false },
    { id: 4, name: 'Katherine Johnson', team: 'Data', salary: 138000, active: true },
    { id: 5, name: 'Edsger Dijkstra', team: 'Research', salary: 149000, active: false },
  ])

  const columns = [
    { field: 'name', header: 'Name', editorType: 'text', width: 200 },
    { field: 'team', header: 'Team', editorType: 'text', width: 150 },
    {
      field: 'salary',
      header: 'Salary',
      width: 130,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'active', header: 'Active', editorType: 'checkbox', width: 90 },
  ]

  // installEnterprise() augments the grid API with the Pro methods:
  // exportData, importData, print, pivot, AI.
  async function run(label, fn) {
    if (!api) return
    try {
      await fn()
      status = `${label} ready`
    } catch (err) {
      status = `${label} failed: ${err instanceof Error ? err.message : String(err)}`
    }
  }
</script>

<main>
  <header>
    <div>
      <h1>SvGrid Enterprise</h1>
      <p>Sort, filter, select, and double-click a cell to edit.</p>
    </div>
    <button
      type="button"
      onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}
      aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} mode"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  </header>

  <div class="grid-shell">
    <SvGrid
      data={rows}
      {columns}
      sortable
      filterable
      editable
      selectionMode="row"
      showRowSelection={true}
      showRowNumbers={true}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = installEnterprise(next))}
    />
  </div>

  <div class="actions">
    <button type="button" onclick={() => run('CSV', () => api.exportData({ format: 'csv', filename: 'team' }))}>
      Export CSV
    </button>
    <button type="button" onclick={() => run('Excel', () => api.exportData({ format: 'xlsx', filename: 'team' }))}>
      Export Excel
    </button>
    <button type="button" onclick={() => run('PDF', () => api.exportData({ format: 'pdf', filename: 'team' }))}>
      Export PDF
    </button>
    <button type="button" onclick={() => run('Print', () => api.print())}>Print</button>
    {#if status}<span class="status">{status}</span>{/if}
  </div>

  <p class="hint">
    Export respects the current sort, filter and grouping. Change the theme
    import at the top of this file to re-skin the grid and this page together.
  </p>
</main>

<style>
  /* Page chrome reads the same --sg-* tokens as the grid, so it re-themes with it. */
  :global(body) {
    margin: 0;
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-family: var(--sg-font, system-ui, sans-serif);
  }

  main { max-width: 760px; margin: 3rem auto; padding: 0 1rem; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  h1 { margin: 0; font-size: 1.4rem; }
  p { color: var(--sg-muted); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 1rem; }

  button {
    flex: none;
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--sg-border);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg-subtle, transparent);
    color: var(--sg-fg);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  button:hover { background: var(--sg-row-hover-bg); }
  button:focus-visible { outline: 2px solid var(--sg-accent); outline-offset: 2px; }

  .status { font-size: 0.82rem; color: var(--sg-muted); }
  .grid-shell { height: 320px; }
  .hint { font-size: 0.85rem; }
</style>
```

## 4. Run it

```bash
npm run dev
```

Open <http://localhost:5173>. You should get a five-row grid: click a header to
sort, use the funnel for Excel-style filtering, double-click a cell to edit,
and the four buttons write real files.

## What the three pieces do

| Line | Why it's there |
| --- | --- |
| `setLicenseKey(...)` | Runs once, before any Enterprise call. Without it the pack still works, but watermarks and nudges the app. See [licensing](./licensing.md). |
| `installEnterprise(next)` | Wraps the `SvGridApi` from `onApiReady` and returns it with `exportData`, `importData`, `print`, pivot and AI attached. The `<SvGrid>` component itself stays Community. |
| `import '@svgrid/grid/themes/shadcn.css'` | Optional. Declares the `--sg-*` tokens for one of 20 presets. Without it the grid still renders, using the built-in fallbacks. |

## Server-side rendering

The component above is SSR-safe as written: `theme` starts at a literal, and
every DOM and `localStorage` access sits inside `$effect`, which only runs in
the browser. No `export const ssr = false` is needed.

If you move DOM access to module scope or into component initialisation, it
will run on the server and throw. Keep it in `$effect` or `onMount`.

## Older versions

`@svgrid/enterprise` 2.5.x and earlier shipped TypeScript source rather than a
built bundle. Vite's dependency pre-bundler cannot parse the `.svelte.ts` rune
modules in it, so those versions need two entries in `vite.config.js`:

```js
optimizeDeps: {
  // Without this the dev server fails to start:
  //   RolldownError ... Unexpected token   (on `import type`)
  exclude: ['@svgrid/grid', '@svgrid/enterprise'],
  // Excluding it also stops ITS imports being pre-bundled, and jszip and
  // pdfmake are CommonJS. Without this, xlsx and pdf export fail with
  // "JSZip is not a constructor" / "pdfMake.createPdf is not a function".
  include: ['jszip', 'pdfmake/build/pdfmake', 'pdfmake/build/vfs_fonts'],
},
```

2.6.0 moved the package to a built `dist`, so neither entry is needed. Upgrading
is the better fix.

## Next

- [Evaluation playbook](./evaluation.md) - what unlicensed looks like, and how
  to get an evaluation key.
- [Licensing](./licensing.md) - key formats, seats, renewals.
- [Data export](../help/export.md) - styles, headers, images, multi-sheet.
- [Data import](../help/import.md) - column mapping and per-row validation.
