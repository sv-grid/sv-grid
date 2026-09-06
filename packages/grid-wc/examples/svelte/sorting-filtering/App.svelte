<script lang="ts">
  /**
   * Mirrors examples/react/sorting-filtering/App.tsx.
   *
   * `emit` is where a wrapper's event listeners land: React's
   * `onSortingChange` is `addEventListener('sortingchange', ...)` on the
   * element, and this is the same callback one step earlier.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns } from '../data'

  let sorting = $state<Array<{ id: string; desc: boolean }>>([])

  const summary = $derived(
    sorting.length === 0
      ? 'nothing yet - click a header, then shift-click a second one'
      : sorting.map((s) => `${s.id} ${s.desc ? 'desc' : 'asc'}`).join(', '),
  )
</script>

<div class="mirror">
  <p class="mirror-note">Sorted by: {summary}</p>
  <div class="mirror-grid">
    <GridBody
      emit={(name: string, detail: unknown) => {
        if (name === 'sortingchange') sorting = detail as typeof sorting
      }}
      data={people}
      {columns}
      sortable
      filterable
      showFilterRow
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
  .mirror-note {
    margin: 0;
    font-size: 13px;
    color: var(--sg-muted);
  }
  .mirror-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
