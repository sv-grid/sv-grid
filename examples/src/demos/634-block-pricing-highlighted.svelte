<script lang="ts" module>
  /**
   * Pricing with highlighted plan block - four per-seat plans in SvCards with
   * the recommended one raised and badged (SvBadge). A seat count
   * SvNumberInput reprices every card live: volume discounts kick in at 25
   * and 100 seats, totals update, and a plan whose seat cap is exceeded turns
   * its SvButton off. Pure UI-kit, --sg-* themed.
   *
   * Headless: createSeatPricing() below owns the plans, the seat count, the
   * volume discount and the per-plan totals with no markup. The component
   * under it is one styled render of that core; import createSeatPricing from
   * this file (or `npx @svgrid/ui add pricing-highlighted --headless` for the
   * core alone) to draw your own.
   */
  export type SeatPlan = {
    id: string; name: string; blurb: string
    /** Price per seat per month in integer cents; null for "talk to sales". */
    seatCents: number | null
    /** Largest team the plan allows. */
    maxSeats?: number
    recommended?: boolean
    /** Line under a quote-only plan's price. */
    quoteNote?: string
    features: string[]; cta: string
  }
  /** From `from` seats on, every seat costs `off` (a fraction) less. */
  export type VolumeBand = { from: number; off: number }
  export type SeatPricingOptions = {
    plans?: SeatPlan[]
    volume?: VolumeBand[]
    seats?: number
    /** Upper bound for the seat field. */
    maxSeats?: number
    currency?: string
    locale?: string
    onChoose?: (plan: SeatPlan, seats: number, totalCents: number | null) => void
  }

  const PLANS: SeatPlan[] = [
    { id: 'starter', name: 'Starter', blurb: 'Shared dashboards for a small team.', seatCents: 800, maxSeats: 5, cta: 'Start Starter',
      features: ['10 dashboards', 'CSV and Sheets sources', 'Daily refresh'] },
    { id: 'team', name: 'Team', blurb: 'Live data and alerts for a whole department.', seatCents: 1400, recommended: true, cta: 'Start 14-day trial',
      features: ['Unlimited dashboards', 'Postgres, BigQuery, REST', 'Hourly refresh', 'Slack alerts'] },
    { id: 'business', name: 'Business', blurb: 'Access control and audit for regulated teams.', seatCents: 2400, cta: 'Start Business',
      features: ['Everything in Team', 'SSO and SCIM', 'Row-level permissions', 'Audit log export'] },
    { id: 'enterprise', name: 'Enterprise', blurb: 'Private deployment and a support contract.', seatCents: null, quoteNote: 'Annual contract, 50+ seats', cta: 'Talk to sales',
      features: ['Everything in Business', 'VPC or on-prem', '99.95% uptime SLA', 'Named support engineer'] },
  ]
  const VOLUME: VolumeBand[] = [{ from: 25, off: 0.1 }, { from: 100, off: 0.2 }]

  export function createSeatPricing(opts: SeatPricingOptions = {}) {
    const plans = opts.plans ?? PLANS
    const bands = [...(opts.volume ?? VOLUME)].sort((a, b) => a.from - b.from)
    const cap = opts.maxSeats ?? 1000
    const fmt = (digits: number) =>
      new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD', minimumFractionDigits: digits })
    let seats = $state(Math.max(1, opts.seats ?? 10))

    const discount = $derived(bands.reduce((off, b) => (seats >= b.from ? b.off : off), 0))
    const nextBand = $derived(bands.find((b) => seats < b.from) ?? null)

    const clampSeats = (n: number) => Math.min(cap, Math.max(1, Math.round(n)))
    /** Per-seat cents after the volume discount, or null for a quote-only plan. */
    const seatPrice = (p: SeatPlan) => (p.seatCents == null ? null : Math.round(p.seatCents * (1 - discount)))
    const total = (p: SeatPlan) => { const s = seatPrice(p); return s == null ? null : s * seats }
    const fits = (p: SeatPlan) => p.maxSeats == null || seats <= p.maxSeats
    /** "$14" for whole amounts, "$12.60" otherwise. */
    const money = (cents: number) => fmt(cents % 100 === 0 ? 0 : 2).format(cents / 100)

    return {
      plans,
      maxSeats: cap,
      get seats() { return seats },
      /** Accepts null (a cleared field) and keeps the last valid count. */
      set seats(v: number | null) { if (v != null && Number.isFinite(v)) seats = clampSeats(v) },
      get discount() { return discount },
      get nextBand() { return nextBand },
      seatPrice, total, fits, money,
      choose: (p: SeatPlan) => { if (fits(p)) opts.onChoose?.(p, seats, total(p)) },
      /** Spread on a plain <input type="number"> for the seat count. */
      seatsProps: () => ({
        type: 'number' as const, min: 1, max: cap, step: 1, value: seats,
        oninput: (e: Event) => {
          const n = (e.currentTarget as HTMLInputElement).valueAsNumber
          if (Number.isFinite(n)) seats = clampSeats(n)
        },
      }),
      /** Spread on a plan's <article>: marks the recommended one. */
      planProps: (p: SeatPlan) => ({
        'data-recommended': p.recommended ? '' : undefined,
        'aria-label': p.recommended ? `${p.name}, recommended` : p.name,
      }),
    }
  }
</script>

<script lang="ts">
  import { SvCard, SvButton, SvBadge, SvNumberInput, SvToaster, toast } from '@svgrid/grid'

  const pricing = createSeatPricing({
    onChoose: (p, seats, total) =>
      toast(total == null ? `Opening a sales call request for ${seats} seats` : `${p.name} for ${seats} seats: ${pricing.money(total)} a month`),
  })
  const hint = $derived(
    pricing.nextBand
      ? `${Math.round(pricing.nextBand.off * 100)}% off every seat from ${pricing.nextBand.from} seats.`
      : `${Math.round(pricing.discount * 100)}% volume discount applied.`,
  )
</script>

<section class="sv-pseats" aria-labelledby="sv-pseats-title">
  <header class="sv-pseats-head">
    <div>
      <h2 id="sv-pseats-title">Acme Analytics pricing</h2>
      <p class="sv-pseats-muted">Billed monthly per seat. Viewers who only read dashboards are free.</p>
    </div>
    <div class="sv-pseats-count">
      <SvNumberInput label="Seats" bind:value={pricing.seats} min={1} max={pricing.maxSeats} {hint} width={160} />
    </div>
  </header>

  <div class="sv-pseats-grid">
    {#each pricing.plans as p (p.id)}
      {@const seat = pricing.seatPrice(p)}
      {@const total = pricing.total(p)}
      <article class="sv-pseats-plan" class:sv-pseats-is-rec={p.recommended} {...pricing.planProps(p)}>
        <SvCard>
          <div class="sv-pseats-body">
            <div class="sv-pseats-name">
              <h3>{p.name}</h3>
              {#if p.recommended}<SvBadge variant="accent">Recommended</SvBadge>{/if}
            </div>
            <p class="sv-pseats-muted sv-pseats-blurb">{p.blurb}</p>
            {#if seat == null}
              <p class="sv-pseats-price"><span class="sv-pseats-num">Custom</span></p>
              <p class="sv-pseats-muted">{p.quoteNote ?? 'Priced per contract'}</p>
              <p class="sv-pseats-total">Volume pricing on request</p>
            {:else}
              <p class="sv-pseats-price">
                <span class="sv-pseats-num">{pricing.money(seat)}</span>
                {#if pricing.discount && p.seatCents}<s><span class="sv-pseats-sr">was </span>{pricing.money(p.seatCents)}</s>{/if}
              </p>
              <p class="sv-pseats-muted">per seat / month</p>
              <p class="sv-pseats-total" class:sv-pseats-is-capped={!pricing.fits(p)}>
                {pricing.fits(p) ? `${pricing.money(total ?? 0)} a month for ${pricing.seats} seats` : `Only for teams up to ${p.maxSeats} seats`}
              </p>
            {/if}
            <SvButton variant={p.recommended ? 'primary' : 'outline'} block disabled={!pricing.fits(p)} onclick={() => pricing.choose(p)}>
              {p.cta}
            </SvButton>
            <ul class="sv-pseats-feats">
              {#each p.features as f (f)}
                <li><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>{f}</li>
              {/each}
            </ul>
          </div>
        </SvCard>
      </article>
    {/each}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-pseats {
    display: flex; flex-direction: column; gap: 24px;
    width: 100%; padding: 36px 24px 40px; box-sizing: border-box;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-pseats-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; max-width: 1080px; width: 100%; margin: 0 auto; }
  .sv-pseats-head h2 { margin: 0 0 6px; font-size: 26px; font-weight: 650; letter-spacing: -.02em; }
  .sv-pseats-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  .sv-pseats-count { flex: none; }
  .sv-pseats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; max-width: 1080px; width: 100%; margin: 0 auto; align-items: stretch; }
  .sv-pseats-plan { display: flex; flex-direction: column; min-width: 0; }
  .sv-pseats-plan > :global(.sv-card) { flex: 1; }
  .sv-pseats-is-rec > :global(.sv-card) {
    border-color: var(--sg-accent, #4f46e5);
    box-shadow: 0 0 0 1px var(--sg-accent, #4f46e5), 0 12px 32px -16px color-mix(in srgb, var(--sg-accent, #4f46e5) 60%, transparent);
  }
  .sv-pseats-body { display: flex; flex-direction: column; gap: 8px; }
  .sv-pseats-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
  .sv-pseats-name h3 { margin: 0; font-size: 16px; font-weight: 650; }
  .sv-pseats-price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; min-height: 36px; margin: 8px 0 0; }
  .sv-pseats-num { font-size: 30px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .sv-pseats-price s { color: var(--sg-muted, #64748b); font-size: 15px; }
  .sv-pseats-blurb { min-height: 2.9em; line-height: 1.45; }
  /* Two lines reserved so the buttons line up whatever the total says. */
  .sv-pseats-total { margin: 4px 0 8px; min-height: 2.9em; line-height: 1.45; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .sv-pseats-is-capped { font-weight: 400; color: var(--sg-muted, #64748b); }
  .sv-pseats-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .sv-pseats-feats { list-style: none; margin: 8px 0 0; padding: 12px 0 0; border-top: 1px solid var(--sg-border, #e2e8f0); display: flex; flex-direction: column; gap: 7px; }
  .sv-pseats-feats li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
  .sv-pseats-feats svg {
    display: block; flex: none; width: 15px; height: 15px; margin-top: 2px;
    fill: none; stroke: var(--sg-success, #16a34a); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  }

  @media (max-width: 980px) {
    .sv-pseats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 600px) {
    .sv-pseats { padding: 24px 16px 32px; }
    .sv-pseats-head { flex-direction: column; align-items: stretch; }
    .sv-pseats-head h2 { font-size: 22px; }
    .sv-pseats-grid { grid-template-columns: minmax(0, 1fr); }
    .sv-pseats-blurb, .sv-pseats-total { min-height: 0; }
  }
</style>
