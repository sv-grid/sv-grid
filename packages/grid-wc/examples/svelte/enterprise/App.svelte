<script lang="ts">
  /**
   * Mirrors examples/react/enterprise/App.tsx.
   *
   * `@svgrid/enterprise/export` is plain JavaScript, so it needs no Svelte in
   * the host's build. React reaches the grid api through the wrapper's ref;
   * here it arrives on the `apiready` event, which is the same handover one
   * step earlier.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { exportGrid } from '@svgrid/enterprise/export'
  import { people, columns } from '../data'

  let api = $state<unknown>(null)
  let busy = $state(false)

  async function exportXlsx() {
    if (!api) return
    busy = true
    try {
      await exportGrid(api as Parameters<typeof exportGrid>[0], {
        format: 'xlsx',
        filename: 'people',
      })
    } finally {
      busy = false
    }
  }
</script>

<div class="mirror">
  <div class="mirror-bar">
    <button type="button" onclick={exportXlsx} disabled={!api || busy}>
      {busy ? 'Building...' : 'Export to Excel'}
    </button>
  </div>
  <div class="mirror-grid">
    <GridBody
      emit={(name: string, detail: unknown) => {
        if (name === 'apiready') api = detail
      }}
      data={people}
      {columns}
      sortable
      filterable
    />
  </div>
</div>

<style>
  .mirror {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    /* min-width, not just min-height: this is a flex item, and a flex item's
       automatic minimum size is its MIN-CONTENT width, which for a grid is the
       sum of its column widths. Without this it can never be laid out narrower
       than its widest possible self. */
    min-width: 0;
  }
  .mirror-bar {
    display: flex;
    gap: 8px;
  }
  button {
    padding: 4px 10px;
    border: 1px solid var(--sg-border);
    border-radius: 6px;
    background: var(--sg-bg);
    color: var(--sg-fg);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--sg-row-hover);
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .mirror-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
