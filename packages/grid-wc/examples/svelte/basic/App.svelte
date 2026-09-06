<script lang="ts">
  /**
   * Mirrors examples/react/basic/App.tsx (and its Vue and Angular twins).
   *
   * `GridBody` is the component `<sv-grid>` renders, so what you see here is
   * what the wrapper produces - not a Svelte approximation of it.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns } from '../data'
</script>

<div class="mirror">
  <div class="mirror-grid">
    <GridBody emit={() => {}} data={people} {columns} sortable filterable />
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
  .mirror-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
