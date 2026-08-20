<script>
  import { SvGrid } from '@svgrid/grid'

  // Capabilities are boolean props - `sortable`, `filterable`, `editable`,
  // `groupable`, `pageable` - and each injects the feature it needs. For finer
  // control you can register features explicitly with `tableFeatures({ ... })`
  // and pass them as `features`; see docs/getting-started/4-features.md.

  // Light/dark. The preset imported in src/app.css declares both palettes, so
  // writing `data-theme` on <html> is all it takes to swap them. index.html has
  // already restored the saved choice by the time this runs.
  let theme = $state(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

  $effect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch (e) {
      // Private mode / storage disabled. The toggle still works for this tab.
    }
  })

  // Your data. Swap for a fetch() in onMount, a store, or props.
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
</script>

<main>
  <header>
    <div>
      <h1>SvGrid</h1>
      <p>
        Sort, filter, select, and double-click a cell to edit. Edit
        <code>src/App.svelte</code> to make it yours.
      </p>
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
    />
  </div>

  <p class="hint">
    Theme: <code>src/app.css</code> imports one of 20 presets. Swap the id for
    <code>material</code>, <code>nord</code>, <code>dracula</code>, and so on.
  </p>
</main>

<style>
  /* Chrome reads the same --sg-* tokens as the grid, so it re-themes with it. */
  main {
    max-width: 720px;
    margin: 3rem auto;
    padding: 0 1rem;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.4rem;
  }

  p {
    color: var(--sg-muted);
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }

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

  button:hover {
    background: var(--sg-row-hover-bg);
  }

  button:focus-visible {
    outline: 2px solid var(--sg-accent);
    outline-offset: 2px;
  }

  .grid-shell {
    height: 320px;
  }

  .hint {
    font-size: 0.85rem;
  }
</style>
