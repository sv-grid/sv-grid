<script lang="ts" module>
  /**
   * Order tracking block - where a shipment is: an order header with an
   * SvBadge, a five-stage delivery stepper (placed, packed, shipped, out for
   * delivery, delivered) with timestamps that runs across on desktop and down
   * on phones, the carrier and tracking number with a copy SvButton, and the
   * carrier's scan events newest first. Refresh fetches the next scan.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createOrderTracking() below owns the stage timestamps, the scan
   * list, the refresh flow and the copy-tracking action with no markup. The
   * component under it is one styled render of that core; import
   * createOrderTracking from this file (or `npx @svgrid/ui add orders-tracking
   * --headless` for the core alone) to draw your own.
   */
  export type TrackingScan = { at: string; title: string; place: string }
  export type StageState = 'done' | 'next' | 'todo'
  export type Shipment = {
    orderNumber: string; summary: string; eta: string
    carrier: string; tracking: string; address: string[]
  }
  /** One carrier update: the new scan, and the stage it reaches (if any). */
  export type TrackingUpdate = { scan: TrackingScan; stage?: number }
  export type OrderTrackingOptions = {
    shipment?: Shipment
    stages?: string[]
    /** Time each stage was reached, ISO; null = not yet. */
    reached?: (string | null)[]
    /** Carrier scans, newest first. */
    scans?: TrackingScan[]
    locale?: string
    /** Ask your tracking endpoint for news; resolve null when nothing changed. */
    fetchUpdate?: () => Promise<TrackingUpdate | null>
    /** Called after an update is applied. */
    onUpdate?: (update: TrackingUpdate, delivered: boolean) => void
    /** Clipboard writer; defaults to navigator.clipboard. */
    copy?: (text: string) => Promise<void>
    onCopied?: (text: string) => void
    onCopyFailed?: () => void
  }

  const SAMPLE_SHIPMENT: Shipment = {
    orderNumber: 'NW-20388', summary: '1 item · Merino beanie', eta: 'Arriving today by 8 pm',
    carrier: 'Cascade Parcel, Ground', tracking: 'CP4471 0928 3316',
    address: ['Ada Lovelace', '18 Harbor St', 'Portland, OR 97209'],
  }
  const SAMPLE_STAGES = ['Order placed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered']
  const SAMPLE_REACHED: (string | null)[] = ['2026-10-08T09:14', '2026-10-08T16:40', '2026-10-09T07:05', '2026-10-15T07:52', null]
  const SAMPLE_SCANS: TrackingScan[] = [
    { at: '2026-10-15T07:52', title: 'Out for delivery', place: 'Portland, OR' },
    { at: '2026-10-15T04:31', title: 'Arrived at delivery station', place: 'Portland, OR' },
    { at: '2026-10-12T22:10', title: 'Departed sort facility', place: 'Sacramento, CA' },
    { at: '2026-10-09T13:48', title: 'Arrived at sort facility', place: 'Sacramento, CA' },
    { at: '2026-10-09T07:05', title: 'Picked up by Cascade Parcel', place: 'Reno, NV' },
    { at: '2026-10-08T16:40', title: 'Packed and labeled', place: 'Northwind warehouse, Reno, NV' },
    { at: '2026-10-08T09:14', title: 'Order placed', place: 'northwind.shop' },
  ]

  export function createOrderTracking(opts: OrderTrackingOptions = {}) {
    const shipment = opts.shipment ?? SAMPLE_SHIPMENT
    const stages = opts.stages ?? SAMPLE_STAGES
    const when = new Intl.DateTimeFormat(opts.locale ?? 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const copy = opts.copy ?? ((t: string) => globalThis.navigator?.clipboard
      ? globalThis.navigator.clipboard.writeText(t)
      : Promise.reject(new Error('no clipboard')))

    let reached = $state<(string | null)[]>([...(opts.reached ?? SAMPLE_REACHED)])
    let scans = $state<TrackingScan[]>([...(opts.scans ?? SAMPLE_SCANS)])
    let busy = $state(false)

    const current = $derived(reached.findIndex((t) => t === null))
    const delivered = $derived(current === -1)
    const latest = $derived(delivered ? stages.length - 1 : current - 1)

    const stageState = (i: number): StageState => (reached[i] ? 'done' : i === current ? 'next' : 'todo')

    async function refresh() {
      if (busy || delivered || !opts.fetchUpdate) return
      busy = true
      try {
        const update = await opts.fetchUpdate()
        if (!update) return
        if (update.stage != null && update.stage < reached.length) reached[update.stage] = update.scan.at
        scans = [update.scan, ...scans]
        opts.onUpdate?.(update, reached.every((t) => t !== null))
      } finally {
        busy = false
      }
    }

    async function copyTracking() {
      const text = shipment.tracking.replace(/\s/g, '')
      try {
        await copy(text)
        opts.onCopied?.(text)
      } catch {
        opts.onCopyFailed?.()
      }
    }

    return {
      shipment,
      stages,
      get reached() { return reached },
      get scans() { return scans },
      get busy() { return busy },
      /** Index of the first stage not reached yet, -1 when delivered. */
      get current() { return current },
      get delivered() { return delivered },
      stageState,
      format: (iso: string) => when.format(new Date(iso)),
      refresh,
      copyTracking,
      /** Spread on a plain <li> per stage. */
      stageProps: (i: number) => ({
        'data-state': stageState(i),
        'aria-current': i === latest ? ('step' as const) : undefined,
      }),
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvButton, SvCard, SvToaster, toast } from '@svgrid/grid'

  const track = createOrderTracking({
    // Replace with a call to your tracking endpoint.
    fetchUpdate: () => new Promise((res) => setTimeout(() => res({
      scan: { at: '2026-10-15T13:26', title: 'Delivered, left at front door', place: 'Portland, OR' }, stage: 4,
    }), 900)),
    onUpdate: (u, delivered) => (delivered ? toast.success('Delivered at ' + track.format(u.scan.at)) : toast(u.scan.title)),
    onCopied: () => toast.success('Tracking number copied'),
    onCopyFailed: () => toast.error('Copy is blocked here. Select the number and copy it by hand.'),
  })
</script>

<main class="sv-ord-track">
  <header class="sv-ord-track-head">
    <div>
      <p class="sv-ord-track-muted">Order {track.shipment.orderNumber} · {track.shipment.summary}</p>
      <h1>{track.delivered ? 'Delivered today' : track.shipment.eta}</h1>
    </div>
    <div class="sv-ord-track-head-actions">
      <SvBadge variant={track.delivered ? 'success' : 'info'} dot>{track.delivered ? 'Delivered' : 'In transit'}</SvBadge>
      <SvButton variant="outline" size="sm" loading={track.busy} disabled={track.delivered} onclick={track.refresh}>Refresh</SvButton>
    </div>
  </header>

  <ol class="sv-ord-track-stages" aria-label="Delivery progress">
    {#each track.stages as label, i (label)}
      {@const st = track.stageState(i)}
      {@const at = track.reached[i]}
      <li class="sv-ord-track-stage sv-ord-track-is-{st}" {...track.stageProps(i)}>
        <span class="sv-ord-track-dot" aria-hidden="true">
          {#if st === 'done'}<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>{/if}
        </span>
        <span class="sv-ord-track-stage-text">
          <strong>{label}</strong>
          <span class="sv-ord-track-muted">{at ? track.format(at) : 'Pending'}</span>
        </span>
      </li>
    {/each}
  </ol>

  <div class="sv-ord-track-cols">
    <section class="sv-ord-track-events" aria-labelledby="sv-ord-track-ev">
      <h2 id="sv-ord-track-ev">Shipment activity</h2>
      <ul>
        {#each track.scans as s (s.at + s.title)}
          <li>
            <time datetime={s.at}>{track.format(s.at)}</time>
            <div><strong>{s.title}</strong><span class="sv-ord-track-muted">{s.place}</span></div>
          </li>
        {/each}
      </ul>
    </section>

    <aside class="sv-ord-track-side">
      <SvCard title="Carrier">
        <p class="sv-ord-track-carrier">{track.shipment.carrier}</p>
        <div class="sv-ord-track-tn">
          <span class="sv-ord-track-muted">Tracking number</span>
          <code>{track.shipment.tracking}</code>
        </div>
        <SvButton variant="outline" size="sm" block onclick={track.copyTracking}>Copy tracking number</SvButton>
      </SvCard>
      <SvCard title="Delivery address">
        <p class="sv-ord-track-addr">
          {#each track.shipment.address as line, i (i)}{#if i}<br />{/if}{line}{/each}
        </p>
      </SvCard>
    </aside>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-ord-track {
    display: flex; flex-direction: column; gap: 24px;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-ord-track-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .sv-ord-track-head-actions { display: flex; align-items: center; gap: 10px; }
  h1 { margin: 2px 0 0; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  h2 { margin: 0 0 12px; font-size: 15px; font-weight: 650; }
  .sv-ord-track-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }

  .sv-ord-track-stages { list-style: none; margin: 0; padding: 18px 20px; display: flex; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); }
  .sv-ord-track-stage { position: relative; flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  /* Connector to the next stage, from this dot's right edge. */
  .sv-ord-track-stage:not(:last-child)::after {
    content: ''; position: absolute; top: 11px; left: 30px; right: 6px; height: 2px;
    background: var(--sg-border, #e2e8f0);
  }
  .sv-ord-track-is-done:not(:last-child)::after { background: var(--sg-accent, #4f46e5); }
  .sv-ord-track-dot {
    display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; box-sizing: border-box;
    border: 2px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff);
  }
  .sv-ord-track-is-done .sv-ord-track-dot { border-color: var(--sg-accent, #4f46e5); background: var(--sg-accent, #4f46e5); }
  .sv-ord-track-is-next .sv-ord-track-dot { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 4px color-mix(in srgb, var(--sg-accent, #4f46e5) 18%, transparent); }
  .sv-ord-track-dot svg { display: block; width: 14px; height: 14px; fill: none; stroke: var(--sg-on-accent, #fff); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-ord-track-stage-text { display: flex; flex-direction: column; gap: 2px; padding-right: 8px; }
  .sv-ord-track-stage-text strong { font-size: 13.5px; font-weight: 600; }
  .sv-ord-track-is-todo strong { color: var(--sg-muted, #64748b); font-weight: 500; }
  .sv-ord-track-stage-text .sv-ord-track-muted { font-size: 12px; font-variant-numeric: tabular-nums; }

  .sv-ord-track-cols { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
  .sv-ord-track-events ul { list-style: none; margin: 0; padding: 0; }
  .sv-ord-track-events li { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 16px; padding: 12px 0; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 14px; }
  .sv-ord-track-events time { color: var(--sg-muted, #64748b); font-size: 13px; font-variant-numeric: tabular-nums; }
  .sv-ord-track-events li div { display: flex; flex-direction: column; gap: 2px; }
  .sv-ord-track-events strong { font-weight: 600; }
  .sv-ord-track-side { display: flex; flex-direction: column; gap: 16px; }
  .sv-ord-track-carrier { margin: 0 0 12px; font-weight: 600; font-size: 14px; }
  .sv-ord-track-tn { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .sv-ord-track-tn code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; letter-spacing: .04em; }
  .sv-ord-track-addr { margin: 0; font-size: 14px; line-height: 1.5; }

  @media (max-width: 760px) {
    .sv-ord-track { padding: 20px 16px; }
    .sv-ord-track-cols { grid-template-columns: 1fr; }
    .sv-ord-track-stages { flex-direction: column; padding: 16px; }
    .sv-ord-track-stage { flex-direction: row; gap: 12px; padding-bottom: 18px; }
    .sv-ord-track-stage:last-child { padding-bottom: 0; }
    .sv-ord-track-stage:not(:last-child)::after { top: 28px; bottom: 4px; left: 11px; right: auto; width: 2px; height: auto; }
    .sv-ord-track-events li { grid-template-columns: 1fr; gap: 2px; }
  }
</style>
