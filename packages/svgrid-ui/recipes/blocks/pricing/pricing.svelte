<script lang="ts" module>
  /**
   * Pricing block - a three-tier plan grid with a monthly/annual SvSegmented
   * toggle, a "most popular" highlighted SvCard, a per-plan feature SvList
   * with check marks, and a CTA SvButton on each. Annual applies a discount
   * live. Pure UI-kit, --sg-* themed.
   *
   * Headless: createPricing() below owns the plans, the billing cycle and the
   * discounted prices with no markup. The component under it is one styled
   * render of that core; import createPricing from this file (or `npx
   * @svgrid/ui add pricing --headless` for the core alone) to draw your own.
   */
  type Cycle = 'monthly' | 'annual'

  export type BillingCycle = Cycle
  export type PricingPlan = {
    id: string; name: string; blurb: string
    /** Price per month on monthly billing; 0 for a free plan. */
    monthly: number
    popular?: boolean; features: string[]; cta: string
  }
  export type PricingOptions = {
    plans?: PricingPlan[]
    /** Billing cycle shown first; annual by default. */
    cycle?: BillingCycle
    /** Annual discount as a fraction: 0.2 is 20% off. */
    annualDiscount?: number
    /** Currency symbol put before each price. */
    currency?: string
    /** A plan's call-to-action was pressed. */
    onChoose?: (plan: PricingPlan, cycle: BillingCycle) => void
    onCycleChange?: (cycle: BillingCycle) => void
  }

  const PLANS: PricingPlan[] = [
    {
      id: 'starter', name: 'Starter', blurb: 'For side projects and evaluation.',
      monthly: 0, cta: 'Start free',
      features: ['1 workspace', 'Up to 3 dashboards', 'Community support', '7-day data history'],
    },
    {
      id: 'pro', name: 'Pro', blurb: 'For growing teams shipping fast.', popular: true,
      monthly: 29, cta: 'Start 14-day trial',
      features: ['Unlimited dashboards', 'Live SQL + REST sources', 'Role-based access', 'Excel / PDF export', 'Priority email support'],
    },
    {
      id: 'enterprise', name: 'Enterprise', blurb: 'For orgs with scale + compliance.',
      monthly: 99, cta: 'Contact sales',
      features: ['Everything in Pro', 'SSO / SAML + audit log', 'Dedicated support & SLA', 'On-prem / VPC deploy', 'Custom contracts'],
    },
  ]

  export function createPricing(opts: PricingOptions = {}) {
    // Plans and discount are fixed for the life of the core; the cycle is state.
    const plans = opts.plans ?? PLANS
    const discount = opts.annualDiscount ?? 0.2
    const currency = opts.currency ?? '$'
    let cycle = $state<BillingCycle>(opts.cycle ?? 'annual')
    const annual = $derived(cycle === 'annual')

    function setCycle(next: BillingCycle) {
      if (next === cycle) return
      cycle = next
      opts.onCycleChange?.(next)
    }

    /** Monthly price for the current cycle, rounded to whole units. */
    const amount = (p: PricingPlan) => (annual ? Math.round(p.monthly * (1 - discount)) : p.monthly)

    return {
      plans,
      /** Options for a monthly / annual switch. */
      cycles: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'annual', label: `Annual -${Math.round(discount * 100)}%` },
      ],
      get cycle() { return cycle },
      /** Accepts any value, so a segmented control can bind to it. */
      set cycle(v: string | number | null) { if (v === 'monthly' || v === 'annual') setCycle(v) },
      get annual() { return annual },
      amount,
      /** The formatted price, like "$23". */
      price: (p: PricingPlan) => currency + amount(p),
      choose: (p: PricingPlan) => opts.onChoose?.(p, cycle),
      /** Spread on a plain <button> for one billing cycle. */
      cycleProps: (value: BillingCycle) => ({
        type: 'button' as const,
        'aria-pressed': cycle === value,
        onclick: () => setCycle(value),
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCard, SvSegmented, SvButton, SvBadge, SvList, SvDivider, SvToaster, toast,
  } from '@svgrid/grid'

  const pricing = createPricing({
    onChoose: (p) => toast(`${p.cta} - ${p.name}`),
  })
</script>

<div class="sv-pricing">
  <header class="sv-pricing-head">
    <SvBadge variant="accent" pill>Pricing</SvBadge>
    <h2>Plans that scale with you.</h2>
    <p class="sv-pricing-muted">Start free, upgrade when you grow. No hidden fees.</p>
    <div class="sv-pricing-toggle">
      <SvSegmented bind:value={pricing.cycle} options={pricing.cycles} />
    </div>
  </header>

  <div class="sv-pricing-grid">
    {#each pricing.plans as p (p.id)}
      <div class="sv-pricing-plan" class:sv-pricing-is-popular={p.popular}>
        <SvCard>
          {#if p.popular}<div class="sv-pricing-ribbon"><span class="sv-pricing-ribbon-pill">Most popular</span></div>{/if}
          <div class="sv-pricing-plan-head">
            <h2>{p.name}</h2>
            <p class="sv-pricing-muted">{p.blurb}</p>
          </div>
          <div class="sv-pricing-amount">
            <span class="sv-pricing-num">{pricing.price(p)}</span>
            {#if p.monthly > 0}<span class="sv-pricing-per">/mo{pricing.annual ? ', billed yearly' : ''}</span>{/if}
          </div>
          <SvButton variant={p.popular ? 'primary' : 'outline'} block onclick={() => pricing.choose(p)}>
            {p.cta}
          </SvButton>
          <SvDivider />
          <SvList type="none" spacing="sm">
            {#each p.features as f (f)}
              <li class="sv-pricing-feat"><span class="sv-pricing-tick">✓</span>{f}</li>
            {/each}
          </SvList>
        </SvCard>
      </div>
    {/each}
  </div>

  <p class="sv-pricing-foot sv-pricing-muted">All plans include SSL, 99.9% uptime and unlimited seats on Pro+. Prices in USD.</p>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-pricing { padding: 28px 20px; display: flex; flex-direction: column; gap: 26px; width: 100%; box-sizing: border-box; background: var(--sg-header-bg, #f8fafc); color: var(--sg-fg, #0f172a); }
  .sv-pricing-head { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .sv-pricing-head h2 { margin: 6px 0 0; font-size: 30px; letter-spacing: -.02em; }
  .sv-pricing-muted { color: var(--sg-muted, #64748b); font-size: 14px; margin: 0; }
  .sv-pricing-toggle { margin-top: 10px; }

  .sv-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 940px; margin: 0 auto; width: 100%; align-items: start; }
  .sv-pricing-plan { position: relative; }
  .sv-pricing-is-popular { transform: translateY(-6px); }
  .sv-pricing-is-popular :global(.sv-card),
  .sv-pricing-is-popular :global([class*='card']) { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 10px 30px -12px rgba(79, 70, 229, .35); }
  .sv-pricing-ribbon { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); z-index: 1; }
  /* Solid pill so the highlighted card's border line can't strike through the
     text. White-on-accent reads in both light and dark themes. */
  .sv-pricing-ribbon-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: var(--sg-accent, #4f46e5); color: #fff; font-size: 11.5px; font-weight: 600; line-height: 1.4; white-space: nowrap; box-shadow: 0 2px 8px -2px rgba(0, 0, 0, .35); }

  .sv-pricing-plan-head h2 { margin: 0 0 4px; font-size: 19px; }
  .sv-pricing-amount { display: flex; align-items: baseline; gap: 4px; margin: 16px 0; }
  .sv-pricing-num { font-size: 38px; font-weight: 700; letter-spacing: -.03em; }
  .sv-pricing-per { color: var(--sg-muted, #64748b); font-size: 13px; }

  .sv-pricing-feat { display: flex; align-items: center; gap: 9px; font-size: 13.5px; padding: 3px 0; }
  .sv-pricing-tick { display: inline-flex; width: 18px; height: 18px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, var(--sg-success, #22c55e) 20%, transparent); color: var(--sg-success, #22c55e); font-size: 11px; font-weight: 700; }

  .sv-pricing-foot { text-align: center; font-size: 12.5px; }

  @media (max-width: 820px) {
    .sv-pricing-grid { grid-template-columns: 1fr; max-width: 400px; }
    .sv-pricing-is-popular { transform: none; }
  }
</style>
