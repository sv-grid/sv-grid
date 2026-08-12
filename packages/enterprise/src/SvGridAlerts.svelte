<script lang="ts" generics="TRow extends Record<string, unknown>">
  /**
   * SvGridAlerts - the runtime overlay. It observes the grid's data, runs the
   * alert engine off the render frame (never blocking paint), and:
   *  - raises toasts + records fired events in the shared log (the badge count),
   *  - emits `formats` (bindable) that the consumer spreads into the grid's
   *    `conditionalFormats` so matching rows light up and fired cells flash,
   *  - hosts the alerts badge, the fired-alerts panel, and the rule manager.
   *
   * All evaluation goes through `createAlertObserver`, which defers work to a
   * post-paint frame and coalesces bursts. Two ways to feed it:
   *  - WATCH (default) - the overlay reactively `scan`s `data` on change. Deferred,
   *    and O(changed) via an index-diff (Svelte 5 replaces changed rows immutably).
   *    This covers streaming feeds / a programmatic `data = ...`, which the grid's
   *    `onCellValueChange` (edits only) never signals.
   *  - PUSH (`watch={false}`) - a consumer that already knows what changed drives
   *    `handle.pushChanged(changedRows)` (via `bind:this` or `onReady`), so cost is
   *    O(rows that changed) regardless of dataset size - the path for 100k+ feeds.
   */
  import { onMount, untrack } from 'svelte'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { createAlertEngine } from './alerts/alert-engine'
  import { createAlertObserver } from './alerts/alert-observer'
  import { applyAlertEvents, type FlashTarget } from './alerts/alert-engine-attach'
  import { rulesToConditionalFormats } from './alerts/alert-formats'
  import { alertStore } from './alerts/alert-store.svelte'
  import {
    createAlertRules,
    localStorageAlertRules,
    memoryAlertRules,
    type AlertRulesManager,
  } from './alerts/alert-storage'
  import SvAlertsPanel from './SvAlertsPanel.svelte'
  import SvAlertsManager from './SvAlertsManager.svelte'
  import type { ExprColumn } from './expressions/expression-columns'
  import type { AlertEvent, AlertRule } from './alerts/alert-types'

  /** The imperative handle handed to push-mode consumers. */
  type AlertsHandle<T> = {
    /** Feed only the rows that changed (O(changed) evaluation, deferred). */
    pushChanged: (rows: ReadonlyArray<T>) => void
    /** Silently re-arm edges from the full row set (after a data reset). */
    reseed: (rows: ReadonlyArray<T>) => void
    /** Run any pending evaluation immediately. */
    flush: () => void
  }

  type Props = {
    /** The same rows bound to the grid. In watch mode, observed for changes. */
    data?: ReadonlyArray<TRow>
    /** Columns offered in the rule/expression editors. */
    columns: ReadonlyArray<ExprColumn>
    /** Stable row identity (defaults to `row.id`). */
    getRowId?: (row: TRow) => string
    /** Bindable output: spread into `<SvGrid conditionalFormats={[...]}>`. */
    formats?: ConditionalFormat<TRow>[]
    /** Seed rules when storage is empty. */
    rules?: AlertRule[]
    /** Persist + share rules under this localStorage key (else in-memory). */
    storageKey?: string
    getValue?: (row: TRow, columnId: string) => unknown
    locale?: string | ReadonlyArray<string>
    /**
     * Reactively scan `data` for changes (default). Set `false` when a consumer
     * drives evaluation through `pushChanged` (large / streaming feeds) - the
     * overlay then never reads `data` on the hot path.
     */
    watch?: boolean
    /** Receive the push-mode handle on mount (alternative to `bind:this`). */
    onReady?: (handle: AlertsHandle<TRow>) => void
    /**
     * Rate-limit toasts to at most one per rule per this many ms. Every event is
     * still logged (the badge stays accurate); this only stops a busy live feed
     * from turning into a toast storm. `0` (default) = no throttle.
     */
    toastCooldownMs?: number
    /** Show the built-in badge + manage buttons. */
    controls?: boolean
    panelOpen?: boolean
    managerOpen?: boolean
    /** Called when the user clicks "Go to row" in the panel. */
    onJump?: (event: AlertEvent) => void
  }

  let {
    data = [],
    columns,
    getRowId = (row) => String((row as { id?: unknown }).id ?? ''),
    formats = $bindable<ConditionalFormat<TRow>[]>([]),
    rules: initialRules = [],
    storageKey,
    getValue,
    locale,
    watch = true,
    onReady,
    toastCooldownMs = 0,
    controls = true,
    panelOpen = $bindable(false),
    managerOpen = $bindable(false),
    onJump,
  }: Props = $props()

  const manager: AlertRulesManager = createAlertRules(
    storageKey ? localStorageAlertRules(storageKey) : memoryAlertRules(),
  )
  // Seed once if the store is empty.
  if (initialRules.length && manager.list().length === 0) {
    for (const r of initialRules) manager.save(r)
  }

  let rules = $state<AlertRule[]>(manager.list())
  let rulesVersion = $state(0)
  let flashFormats = $state<ConditionalFormat<TRow>[]>([])

  const engine = createAlertEngine<TRow>({ rules, getRowId, getValue, locale })

  // The observer owns all scheduling + change tracking. It runs evaluation on a
  // post-paint frame (never inside the grid's render flush) and only clones prev
  // snapshots when a rule actually reads prev (`relativeChange`). Fired events
  // come back here as a batch to raise toasts, log, and flash cells.
  // Per-rule toast cooldown: suppress the visible toast (not the log) when a rule
  // fired within `toastCooldownMs`. Keeps a busy feed from storming the screen.
  const lastToastAt = new Map<string, number>()
  function allowToast(e: AlertEvent): boolean {
    if (!toastCooldownMs) return true
    const now = Date.now()
    const last = lastToastAt.get(e.ruleId) ?? -Infinity
    if (now - last < toastCooldownMs) return false
    lastToastAt.set(e.ruleId, now)
    return true
  }

  const observer = createAlertObserver<TRow>({
    engine,
    getRowId,
    schedule: 'raf',
    onEvents: (events) => {
      const { flashes } = applyAlertEvents(events, getRowId, { shouldToast: allowToast })
      for (const f of flashes) addFlash(f)
    },
  })

  let seededVersion = -1

  function addFlash(target: FlashTarget) {
    const fmt: ConditionalFormat<TRow> = {
      type: 'rule',
      ...(target.columnId ? { columns: [target.columnId] } : {}),
      when: ({ row }: { value: unknown; row: TRow }) => getRowId(row) === target.rowId,
      background: 'var(--sg-cell-flash, #fde68a)',
    }
    flashFormats = [...flashFormats, fmt]
    setTimeout(() => {
      flashFormats = flashFormats.filter((f) => f !== fmt)
    }, 900)
  }

  // Seed + rule changes. Depends ONLY on `rulesVersion` so it never re-runs on a
  // data tick; the seed reads `data` untracked. This silently arms edges so
  // pre-existing matches under the (new) rules do not spam toasts.
  $effect(() => {
    const version = rulesVersion
    if (version === seededVersion) return
    observer.setRules(rules)
    observer.seed(untrack(() => data))
    seededVersion = version
  })

  // Watch mode: reactively scan `data` on every change (deferred + O(changed)).
  // When `watch` is false the effect returns before touching `data`, so it takes
  // NO data dependency and never re-runs on a tick - the push-mode hot path.
  $effect(() => {
    if (!watch) return
    const rows = data
    observer.scan(() => rows)
  })

  // Persistent (predicate-driven) styling + transient flashes -> the grid.
  $effect(() => {
    formats = [...rulesToConditionalFormats<TRow>(rules, { getValue, locale }), ...flashFormats]
  })

  // --- Push-mode API (bind:this or onReady) --------------------------------
  export function pushChanged(rows: ReadonlyArray<TRow>) {
    observer.pushChanged(rows)
  }
  export function reseed(rows: ReadonlyArray<TRow>) {
    observer.seed(rows)
  }
  export function flush() {
    observer.flush()
  }

  onMount(() => {
    onReady?.({ pushChanged, reseed, flush })
    return () => observer.detach()
  })

  function onRulesChanged(next: AlertRule[]) {
    rules = next
    rulesVersion += 1
  }
</script>

{#if controls}
  <div class="sg-alerts-controls">
    <button
      type="button"
      class="sg-alerts-bell"
      class:sg-active={alertStore.activeCount > 0}
      onclick={() => (panelOpen = true)}
      aria-label={`Open alerts${alertStore.activeCount ? ` (${alertStore.activeCount} unread)` : ''}`}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {#if alertStore.activeCount > 0}
        <span class="sg-alerts-count">{alertStore.activeCount > 99 ? '99+' : alertStore.activeCount}</span>
      {/if}
    </button>
    <button type="button" class="sg-alerts-manage" onclick={() => (managerOpen = true)}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
      </svg>
      Manage alerts
    </button>
  </div>
{/if}

<SvAlertsPanel bind:open={panelOpen} onJump={(e) => onJump?.(e)} />
<SvAlertsManager bind:open={managerOpen} {manager} {columns} rows={data} onChange={onRulesChanged} />

<style>
  /* Theme-agnostic: these controls render OUTSIDE the grid, where the full
     --sg-* token set may not be in scope. Derive every surface from
     `currentColor` + `inherit` so text is always the page's readable colour. */
  .sg-alerts-controls { display: inline-flex; align-items: center; gap: 8px; font-family: var(--sg-font, inherit); color: inherit; }
  .sg-alerts-bell,
  .sg-alerts-manage {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    height: 34px; border-radius: 9px; color: inherit; cursor: pointer;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 5%, transparent);
    transition: background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease, transform 0.08s ease;
  }
  .sg-alerts-bell:hover,
  .sg-alerts-manage:hover { background: color-mix(in srgb, currentColor 13%, transparent); border-color: color-mix(in srgb, currentColor 36%, transparent); }
  .sg-alerts-bell:active,
  .sg-alerts-manage:active { transform: translateY(0.5px); }
  .sg-alerts-bell:focus-visible,
  .sg-alerts-manage:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #4f46e5) 35%, transparent); }

  .sg-alerts-bell { position: relative; width: 34px; padding: 0; }
  .sg-alerts-bell.sg-active { color: var(--sg-accent, #4f46e5); border-color: color-mix(in srgb, var(--sg-accent, #4f46e5) 50%, transparent); background: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent); }
  .sg-alerts-count {
    position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10.5px; font-weight: 700; line-height: 1; color: #fff;
    background: var(--sg-danger, #dc2626); border-radius: 999px;
    border: 1.5px solid color-mix(in srgb, currentColor 100%, transparent); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .sg-alerts-manage { padding: 0 13px 0 11px; font-size: 13px; font-weight: 500; }
  .sg-alerts-manage svg { opacity: 0.6; }
</style>
