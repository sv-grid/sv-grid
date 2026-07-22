<script lang="ts">
  /**
   * SvGridSelect - a "grid in a dropdown" single-select: the panel shows options
   * as a compact multi-column table with a header row and search, so you pick by
   * more than a label. Built on its own panel (no embedded SvGrid); standalone
   * or as a grid cell editor.
   */
  import { SvGridSelect, type GridSelectColumn } from '@svgrid/grid'

  const columns: GridSelectColumn[] = [
    { field: 'name', header: 'Name', width: '1.4fr' },
    { field: 'email', header: 'Email', width: '1.6fr' },
    { field: 'team', header: 'Team', width: '1fr' },
  ]

  const people = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@analytical.io', team: 'Research' },
    { id: 2, name: 'Alan Turing', email: 'alan@bletchley.io', team: 'Crypto' },
    { id: 3, name: 'Grace Hopper', email: 'grace@navy.mil', team: 'Compilers' },
    { id: 4, name: 'Katherine Johnson', email: 'kj@nasa.gov', team: 'Orbits' },
    { id: 5, name: 'Edsger Dijkstra', email: 'ew@shortest.path', team: 'Algorithms' },
    { id: 6, name: 'Barbara Liskov', email: 'liskov@subst.io', team: 'Types' },
  ]

  let assignee = $state<string | number | null>(3)
  const chosen = $derived(people.find((p) => p.id === assignee) ?? null)
</script>

<div class="wrap">
  <header>
    <h2>Grid select</h2>
    <p>Pick from a multi-column list - name, email and team are all visible and searchable. The panel portals to <code>&lt;body&gt;</code>; arrows navigate, Enter selects.</p>
  </header>

  <div class="row">
    <SvGridSelect
      label="Assignee"
      {columns}
      options={people}
      value={assignee}
      labelField="name"
      onChange={(id) => (assignee = id)}
    />
  </div>

  {#if chosen}
    <p class="muted">Assigned to <strong>{chosen.name}</strong> ({chosen.email}) on team {chosen.team}.</p>
  {:else}
    <p class="muted">No one assigned yet.</p>
  {/if}
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  header code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .row { display: flex; gap: 20px; align-items: center; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13px; }
</style>
