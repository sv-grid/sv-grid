<script lang="ts">
  /**
   * A bar chart over whatever slice the dashboard is currently showing.
   *
   * Inline SVG on purpose: a starter should not pull a charting library in for
   * one chart, and this way the bars are plain DOM you can style with the same
   * `--sg-*` tokens as the grid.
   */
  type Props = {
    /** Bars to draw, already aggregated. */
    series: { label: string; value: number }[]
    /** Formats the value in the tooltip and the axis. */
    format: (value: number) => string
    /** Highlighted bar, e.g. the one being drilled. */
    active?: string | null
    onSelect?: (label: string) => void
  }

  let { series, format, active = null, onSelect }: Props = $props()

  const max = $derived(Math.max(1, ...series.map((s) => s.value)))
</script>

{#if series.length === 0}
  <p class="empty">No data in this slice.</p>
{:else}
  <ul class="bars">
    {#each series as bar (bar.label)}
      <li class="row" class:is-active={active === bar.label}>
        <button
          type="button"
          onclick={() => onSelect?.(bar.label)}
          title="{bar.label}: {format(bar.value)}"
        >
          <span class="label">{bar.label}</span>
          <span class="track">
            <!-- Width is the only inline style here: it is data, not design. -->
            <span class="fill" style="width: {(bar.value / max) * 100}%"></span>
          </span>
          <span class="value">{format(bar.value)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  button {
    display: grid; grid-template-columns: 8rem 1fr 6rem; align-items: center; gap: 0.75rem;
    width: 100%; padding: 0.3rem 0.4rem; font: inherit; text-align: left;
    background: none; border: 0; border-radius: var(--sg-radius, 8px); cursor: pointer;
    color: var(--sg-fg, #0f172a);
  }
  button:hover { background: var(--sg-row-hover-bg, rgba(0, 0, 0, 0.04)); }
  .row.is-active button { background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent); }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; }
  .track { background: var(--sg-border, #e2e8f0); border-radius: 999px; height: 0.7rem; overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--sg-accent, #2563eb); border-radius: 999px; }
  .value { font-variant-numeric: tabular-nums; font-size: 0.8125rem; text-align: right; color: var(--sg-muted, #64748b); }
  .empty { color: var(--sg-muted, #64748b); font-size: 0.875rem; margin: 0; }
</style>
