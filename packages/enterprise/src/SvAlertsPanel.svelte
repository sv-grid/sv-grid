<script lang="ts">
  /**
   * SvAlertsPanel - a drawer listing fired alerts (newest first) from the shared
   * alertStore. Filter by severity, acknowledge, clear, and jump to the row that
   * fired. This is the audit trail of what the rules have caught.
   */
  import { SvDrawer } from '@svgrid/grid'
  import { alertStore } from './alerts/alert-store.svelte'
  import type { AlertEvent, AlertSeverity } from './alerts/alert-types'

  type Props = {
    open?: boolean
    onJump?: (event: AlertEvent) => void
    onClose?: () => void
  }

  let { open = $bindable(false), onJump, onClose }: Props = $props()

  let filter = $state<AlertSeverity | 'all'>('all')

  const SEV_COLOR: Record<AlertSeverity, string> = {
    info: '#3b82f6', success: '#16a34a', warning: '#d97706', error: '#dc2626',
  }

  const shown = $derived(
    filter === 'all' ? alertStore.events : alertStore.events.filter((e) => e.severity === filter),
  )

  function timeLabel(ms: number): string {
    try {
      return new Date(ms).toLocaleTimeString()
    } catch {
      return ''
    }
  }
</script>

<SvDrawer bind:open side="right" size="380px" title="Alerts" onClose={() => onClose?.()}>
  <div class="ap-toolbar">
    <div class="ap-filters" role="group" aria-label="Filter by severity">
      {#each ['all', 'error', 'warning', 'info', 'success'] as sev (sev)}
        <button type="button" class:ap-on={filter === sev} onclick={() => (filter = sev as AlertSeverity | 'all')}>{sev}</button>
      {/each}
    </div>
    <button type="button" class="ap-clear" onclick={() => alertStore.clear()} disabled={alertStore.events.length === 0}>Clear</button>
  </div>

  {#if shown.length === 0}
    <div class="ap-empty">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <p>No alerts{filter === 'all' ? ' yet' : ` at ${filter}`}.</p>
      <span>Rules fire here as your data changes.</span>
    </div>
  {:else}
    <ul class="ap-list">
      {#each shown as event, i (event.firedAt + '-' + i)}
        <li class="ap-item" class:ap-ack={event.acknowledged} style={`--sev: ${SEV_COLOR[event.severity]}`}>
          <span class="ap-dot" aria-hidden="true"></span>
          <div class="ap-content">
            <p class="ap-msg">{event.message}</p>
            <div class="ap-meta">
              <span class="ap-rule">{event.ruleName}</span>
              <span class="ap-dotsep" aria-hidden="true"></span>
              <span>{timeLabel(event.firedAt)}</span>
            </div>
            <div class="ap-row-actions">
              {#if event.rowId != null && onJump}
                <button type="button" onclick={() => onJump?.(event)}>Go to row</button>
              {/if}
              {#if !event.acknowledged}
                <button type="button" onclick={() => alertStore.acknowledge(alertStore.events.indexOf(event))}>Acknowledge</button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#snippet footer()}
    <button type="button" class="ap-ack-all" onclick={() => alertStore.acknowledgeAll()} disabled={alertStore.activeCount === 0}>
      Acknowledge all ({alertStore.activeCount})
    </button>
  {/snippet}
</SvDrawer>

<style>
  /* Theme-agnostic surfaces: currentColor + inherit (readable in any theme). */
  .ap-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; font-family: var(--sg-font, inherit); color: inherit; }
  .ap-filters { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .ap-filters button, .ap-clear {
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent); background: transparent; border-radius: 999px;
    padding: 3px 11px; font-size: 11px; font-weight: 500; cursor: pointer; color: inherit; opacity: 0.7;
    text-transform: capitalize; transition: background 0.13s ease, opacity 0.13s ease, border-color 0.13s ease;
  }
  .ap-filters button:hover, .ap-clear:hover { background: color-mix(in srgb, currentColor 10%, transparent); opacity: 1; }
  .ap-filters button.ap-on { background: var(--sg-accent, #4f46e5); color: #fff; border-color: transparent; opacity: 1; }
  .ap-clear:disabled { opacity: 0.4; cursor: default; }

  .ap-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; padding: 40px 12px; text-align: center; }
  .ap-empty svg { color: var(--sg-accent, #4f46e5); opacity: 0.7; margin-bottom: 6px; }
  .ap-empty p { margin: 0; font-weight: 600; }
  .ap-empty span { font-size: 12px; opacity: 0.65; }

  .ap-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; font-family: var(--sg-font, inherit); color: inherit; }
  .ap-item {
    display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start;
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-left: 3px solid var(--sev);
    border-radius: 10px; padding: 10px 12px; background: color-mix(in srgb, currentColor 3%, transparent);
    transition: box-shadow 0.14s ease;
  }
  .ap-item:hover { box-shadow: 0 4px 14px -8px color-mix(in srgb, var(--sev) 55%, transparent); }
  .ap-item.ap-ack { opacity: 0.5; }
  .ap-dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 999px; background: var(--sev); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sev) 20%, transparent); }
  .ap-content { min-width: 0; }
  .ap-msg { margin: 0; font-size: 13px; line-height: 1.4; }
  .ap-meta { display: flex; align-items: center; gap: 7px; font-size: 11px; opacity: 0.55; margin-top: 5px; }
  .ap-rule { font-weight: 600; }
  .ap-dotsep { width: 3px; height: 3px; border-radius: 999px; background: currentColor; opacity: 0.6; }
  .ap-row-actions { display: flex; gap: 12px; margin-top: 8px; }
  .ap-row-actions button { border: 0; background: transparent; color: var(--sg-accent, #4f46e5); font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; }
  .ap-row-actions button:hover { text-decoration: underline; }

  .ap-ack-all { width: 100%; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); background: color-mix(in srgb, currentColor 4%, transparent); border-radius: 8px; padding: 8px; font-size: 13px; font-weight: 500; cursor: pointer; color: inherit; transition: background 0.13s ease; }
  .ap-ack-all:hover:not(:disabled) { background: color-mix(in srgb, currentColor 11%, transparent); }
  .ap-ack-all:disabled { opacity: 0.5; cursor: default; }
</style>
