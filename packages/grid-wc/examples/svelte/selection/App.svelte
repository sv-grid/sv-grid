<script lang="ts">
  /**
   * Mirrors examples/react/selection/App.tsx.
   *
   * `rowselectionchange` is the one event that carries two values, so its
   * detail is an object keyed by the callback's parameter names - `selection`
   * and `rows` - rather than a bare argument.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns, type Person } from '../data'

  let selected = $state<Person[]>([])

  const total = $derived(selected.reduce((sum, r) => sum + r.amount, 0))
  const money = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
</script>

<div class="mirror">
  <p class="mirror-note">
    {selected.length === 0
      ? 'Tick some rows to total them'
      : `${selected.length} selected · ${money(total)}`}
  </p>
  <div class="mirror-grid">
    <GridBody
      emit={(name: string, detail: unknown) => {
        if (name === 'rowselectionchange') selected = (detail as { rows: Person[] }).rows
      }}
      data={people}
      {columns}
      sortable
      filterable
      showRowSelection
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
