<script lang="ts" module>
  /**
   * Empty widget card block - a dashboard row of three SvCard widgets: one
   * with data (SvStat + SvSparkline), one waiting for its first event and one
   * with no source connected. The compact SvEmptyState fits inside a card;
   * "Connect help desk" runs a toast.promise and the card fills with data.
   * SvButton, SvToaster. Wraps to one column on phones.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createWidgetRow() below owns the series, the connect flow and
   * copying the tracking snippet with no markup. The component under it is
   * one styled render of that core; import createWidgetRow from this file (or
   * `npx @svgrid/ui add empty-states-card --headless` for the core alone) to
   * draw your own.
   */
  export type WidgetRowOptions = {
    /** Weekly series for the sparklines; sample numbers by default. */
    revenue?: number[]
    tickets?: number[]
    /** Link the help desk; reject to leave the card empty. */
    connect?: () => Promise<void>
    /** The tracking tag users paste into their site. */
    snippet?: string
    /** Clipboard write; defaults to navigator.clipboard.writeText. */
    writeClipboard?: (text: string) => Promise<void>
    onCopy?: (ok: boolean) => void
  }

  export function createWidgetRow(opts: WidgetRowOptions = {}) {
    // The closing tag is split; a literal one would end this script block early.
    const snippet = opts.snippet ?? '<script src="/lumen-track.js" data-site="acme"></' + 'script>'
    let connected = $state(false)
    let connecting = $state(false)

    async function connect() {
      if (connecting) return
      connecting = true
      try {
        await opts.connect?.()
        connected = true
      } catch {
        // The caller reports the failure (the demo's toast.promise does).
      } finally {
        connecting = false
      }
    }

    async function copySnippet() {
      try {
        await (opts.writeClipboard ?? ((t: string) => navigator.clipboard.writeText(t)))(snippet)
        opts.onCopy?.(true)
      } catch {
        opts.onCopy?.(false)
      }
    }

    return {
      revenue: opts.revenue ?? [31, 34, 33, 38, 36, 41, 40, 44, 43, 48],
      tickets: opts.tickets ?? [52, 49, 50, 46, 44, 45, 41, 39, 38, 37],
      snippet,
      get connected() { return connected },
      get connecting() { return connecting },
      connect,
      copySnippet,
    }
  }
</script>

<script lang="ts">
  import { SvCard, SvStat, SvSparkline, SvEmptyState, SvButton, SvToaster, toast } from '@svgrid/grid'

  const widgets = createWidgetRow({
    // Replace the timer with your OAuth or API-key flow.
    connect: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
        loading: 'Connecting help desk...',
        success: 'Help desk connected - 30 days synced',
        error: 'Could not reach the help desk',
      }),
    onCopy: (ok) => (ok ? toast.success('Tracking snippet copied') : toast.error('Clipboard is blocked in this browser')),
  })
</script>

<section class="sv-widgets" aria-labelledby="sv-widgets-title">
  <header>
    <h2 id="sv-widgets-title">Overview</h2>
    <p class="sv-widgets-muted">Acme Analytics - last 30 days</p>
  </header>

  <div class="sv-widgets-row">
    <SvCard title="Revenue" subtitle="Paid invoices">
      <SvStat label="Monthly recurring" value="$48.2k" delta={12.4} hint="vs last month" />
      <div class="sv-widgets-chart">
        <SvSparkline data={widgets.revenue} type="area" color="var(--sg-info, #0891b2)" width={320} height={56} lastPoint={false} ariaLabel="Revenue, last 10 weeks" />
      </div>
    </SvCard>

    <SvCard title="Signups" subtitle="New accounts">
      <SvEmptyState compact title="No data yet" description="Signups show up here after the tracking snippet sees its first visitor.">
        {#snippet icon()}
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19V5M4 19h16M8 15l3-3 3 2 5-6" stroke-dasharray="2.5 2.5" />
          </svg>
        {/snippet}
        <SvButton variant="secondary" size="sm" onclick={widgets.copySnippet}>Copy snippet</SvButton>
      </SvEmptyState>
    </SvCard>

    <SvCard title="Support tickets" subtitle="Open requests">
      {#if widgets.connected}
        <SvStat label="Open tickets" value={37} delta={-8} invert hint="vs last month" />
        <div class="sv-widgets-chart">
          <SvSparkline data={widgets.tickets} type="area" color="var(--sg-info, #0891b2)" width={320} height={56} lastPoint={false} ariaLabel="Open tickets, last 10 weeks" />
        </div>
      {:else}
        <SvEmptyState compact title="Connect a source" description="Link your help desk to track open tickets and response time.">
          {#snippet icon()}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" />
            </svg>
          {/snippet}
          <SvButton size="sm" loading={widgets.connecting} onclick={widgets.connect}>Connect help desk</SvButton>
        </SvEmptyState>
      {/if}
    </SvCard>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-widgets {
    padding: 28px; box-sizing: border-box; min-height: 360px;
    display: flex; flex-direction: column; gap: 16px;
    background: var(--sg-bg-subtle, #f8fafc); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-widgets-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-widgets-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
  /* SvStat draws its own tile; inside a card it only needs the numbers. */
  .sv-widgets-row :global(.sv-stat) { border: 0; padding: 0; background: transparent; }
  .sv-widgets-row :global(.sv-card__body) { display: flex; flex-direction: column; justify-content: center; min-height: 170px; }
  .sv-widgets-chart { margin-top: 14px; }
  .sv-widgets-chart :global(.sv-spark) { display: block; width: 100%; height: 56px; }

  @media (max-width: 760px) {
    .sv-widgets { padding: 18px 16px; }
    .sv-widgets-row { grid-template-columns: 1fr; }
  }
</style>
