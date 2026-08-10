<script lang="ts">
  /**
   * SvSegmented - a segmented control: mutually-exclusive options in a shared
   * track. Single-select, keyboard-accessible (arrow keys + Space/Enter), and
   * themed from the --sg-* tokens. The modern alternative to a small radio group.
   */
  import { SvSegmented } from '@svgrid/grid'

  let view = $state('board')
  let range = $state('7d')
  let density = $state('comfortable')
  let align = $state('left')
</script>

<div class="wrap">
  <section>
    <h3>View switcher</h3>
    <SvSegmented
      label="View"
      bind:value={view}
      options={[{ value: 'board', label: 'Board' }, { value: 'table', label: 'Table' }, { value: 'calendar', label: 'Calendar' }]}
    />
    <p class="muted">Selected: <strong>{view}</strong></p>
  </section>

  <section>
    <h3>Sizes</h3>
    <div class="col">
      <SvSegmented size="sm" bind:value={range} options={[{ value: '24h', label: '24h' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }]} />
      <SvSegmented size="md" bind:value={range} options={[{ value: '24h', label: '24h' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }]} />
      <SvSegmented size="lg" bind:value={range} options={[{ value: '24h', label: '24h' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }]} />
    </div>
  </section>

  <section>
    <h3>Full width + icons</h3>
    <SvSegmented block bind:value={align} options={[
      { value: 'left', label: 'Left', icon: iconLeft },
      { value: 'center', label: 'Center', icon: iconCenter },
      { value: 'right', label: 'Right', icon: iconRight },
    ]} />
  </section>

  <section>
    <h3>Disabled</h3>
    <SvSegmented disabled bind:value={density} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
  </section>
</div>

{#snippet iconLeft()}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h13" /></svg>{/snippet}
{#snippet iconCenter()}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M6 18h12" /></svg>{/snippet}
{#snippet iconRight()}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M10 12h10M7 18h13" /></svg>{/snippet}

<style>
  .wrap { padding: 22px; display: flex; flex-direction: column; gap: 24px; max-width: 460px; }
  section h3 { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
  .col { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .muted { margin: 8px 0 0; color: var(--sg-muted, #64748b); font-size: 13px; }
</style>
