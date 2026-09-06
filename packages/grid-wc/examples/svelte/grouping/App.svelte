<script lang="ts">
  /**
   * Mirrors examples/react/grouping/App.tsx.
   *
   * `groupBy` is an array, which is the prop that makes the wrappers worth
   * having: an array cannot cross as an attribute, so a host has to assign the
   * property. Here it is just a prop, which is exactly the point.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns } from '../data'

  const CHOICES: string[][] = [['team'], ['country'], ['team', 'country'], []]

  let groupBy = $state<string[]>(['team'])

  const withTotals = columns.map((c) => (c.id === 'amount' ? { ...c, aggregate: 'sum' } : c))
</script>

<div class="mirror">
  <div class="mirror-bar">
    {#each CHOICES as choice (choice.join('+') || 'none')}
      <button
        type="button"
        class:is-on={groupBy.join() === choice.join()}
        onclick={() => (groupBy = choice)}
      >
        {choice.join(' + ') || 'No grouping'}
      </button>
    {/each}
  </div>
  <div class="mirror-grid">
    <GridBody
      emit={() => {}}
      data={people}
      columns={withTotals}
      sortable
      filterable
      groupable
      {groupBy}
      groupFooters
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
    flex-wrap: wrap;
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
  button:hover {
    background: var(--sg-row-hover);
  }
  button.is-on {
    background: var(--sg-header-bg);
    border-color: var(--sg-accent);
  }
  .mirror-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
