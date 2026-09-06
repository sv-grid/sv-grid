<script lang="ts">
  /**
   * Mirrors examples/react/theming/App.tsx.
   *
   * The `--sg-*` properties are ordinary CSS custom properties, so setting them
   * on an ancestor is enough - which is also why they reach inside
   * `<sv-grid-shadow>`: inheritance crosses a shadow boundary.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns } from '../data'

  const THEMES: Record<string, Record<string, string>> = {
    Light: {},
    Dark: {
      '--sg-bg': '#0b1220',
      '--sg-fg': '#e2e8f0',
      '--sg-border': '#1e293b',
      '--sg-header-bg': '#111a2e',
      '--sg-row-hover': '#111a2e',
    },
    Warm: {
      '--sg-bg': '#fffaf5',
      '--sg-fg': '#42302a',
      '--sg-border': '#f0dcc9',
      '--sg-header-bg': '#fdf1e4',
      '--sg-accent': '#c2410c',
    },
  }

  let theme = $state('Light')

  const style = $derived(
    Object.entries(THEMES[theme] ?? {})
      .map(([k, v]) => `${k}:${v}`)
      .join(';'),
  )
</script>

<div class="mirror" {style}>
  <div class="mirror-bar">
    {#each Object.keys(THEMES) as name (name)}
      <button type="button" class:is-on={theme === name} onclick={() => (theme = name)}>
        {name}
      </button>
    {/each}
  </div>
  <div class="mirror-grid">
    <GridBody emit={() => {}} data={people} {columns} sortable filterable zebraRows />
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
    /* The theme vars land on this element, so the swatch of colour behind the
       grid changes with the picker rather than staying the page's. */
    background: var(--sg-bg);
    color: var(--sg-fg);
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
