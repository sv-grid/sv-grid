<script lang="ts">
  /**
   * Pricing block - a three-tier plan grid with a monthly/annual SvSegmented
   * toggle, a "most popular" highlighted card, per-plan feature SvList with
   * check marks, and a CTA SvButton on each. Annual applies a discount live.
   * Pure UI-kit composition, --sg-* themed.
   */
  import {
    SvCard, SvSegmented, SvButton, SvBadge, SvList, SvDivider, SvToaster, toast,
  } from '@svgrid/grid'

  let cycle = $state<string | number>('annual')
  const annual = $derived(cycle === 'annual')

  type Plan = {
    id: string; name: string; blurb: string; monthly: number;
    popular?: boolean; features: string[]; cta: string
  }
  const plans: Plan[] = [
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

  function price(p: Plan) {
    if (p.monthly === 0) return '$0'
    const v = annual ? Math.round(p.monthly * 0.8) : p.monthly
    return '$' + v
  }
</script>

<div class="pricing">
  <header class="head">
    <SvBadge variant="accent" pill>Pricing</SvBadge>
    <h1>Plans that scale with you.</h1>
    <p class="muted">Start free, upgrade when you grow. No hidden fees.</p>
    <div class="toggle">
      <SvSegmented
        bind:value={cycle}
        options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'annual', label: 'Annual -20%' },
        ]}
      />
    </div>
  </header>

  <div class="grid">
    {#each plans as p (p.id)}
      <div class="plan" class:popular={p.popular}>
        <SvCard>
          {#if p.popular}<div class="ribbon"><span class="ribbon-pill">Most popular</span></div>{/if}
          <div class="plan-head">
            <h2>{p.name}</h2>
            <p class="muted">{p.blurb}</p>
          </div>
          <div class="amount">
            <span class="num">{price(p)}</span>
            {#if p.monthly > 0}<span class="per">/mo{annual ? ', billed yearly' : ''}</span>{/if}
          </div>
          <SvButton variant={p.popular ? 'primary' : 'outline'} block onclick={() => toast(`${p.cta} - ${p.name}`)}>
            {p.cta}
          </SvButton>
          <SvDivider />
          <SvList type="none" spacing="sm">
            {#each p.features as f (f)}
              <li class="feat"><span class="tick">✓</span>{f}</li>
            {/each}
          </SvList>
        </SvCard>
      </div>
    {/each}
  </div>

  <p class="foot muted">All plans include SSL, 99.9% uptime and unlimited seats on Pro+. Prices in USD.</p>
</div>

<SvToaster position="bottom-right" />

<style>
  .pricing { padding: 28px 20px; display: flex; flex-direction: column; gap: 26px; background: var(--sg-header-bg, #f8fafc); color: var(--sg-fg, #0f172a); }
  .head { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .head h1 { margin: 6px 0 0; font-size: 30px; letter-spacing: -.02em; }
  .muted { color: var(--sg-muted, #64748b); font-size: 14px; margin: 0; }
  .toggle { margin-top: 10px; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 940px; margin: 0 auto; width: 100%; align-items: start; }
  .plan { position: relative; }
  .plan.popular { transform: translateY(-6px); }
  .plan.popular :global(.sv-card),
  .plan.popular :global([class*='card']) { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 10px 30px -12px rgba(79, 70, 229, .35); }
  .ribbon { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); z-index: 1; }
  /* Solid pill so the highlighted card's border line can't strike through the
     text. White-on-accent reads in both light and dark themes. */
  .ribbon-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: var(--sg-accent, #4f46e5); color: #fff; font-size: 11.5px; font-weight: 600; line-height: 1.4; white-space: nowrap; box-shadow: 0 2px 8px -2px rgba(0, 0, 0, .35); }

  .plan-head h2 { margin: 0 0 4px; font-size: 19px; }
  .amount { display: flex; align-items: baseline; gap: 4px; margin: 16px 0; }
  .num { font-size: 38px; font-weight: 700; letter-spacing: -.03em; }
  .per { color: var(--sg-muted, #64748b); font-size: 13px; }

  .feat { display: flex; align-items: center; gap: 9px; font-size: 13.5px; padding: 3px 0; }
  .tick { display: inline-flex; width: 18px; height: 18px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, #22c55e 20%, transparent); color: #22c55e; font-size: 11px; font-weight: 700; }

  .foot { text-align: center; font-size: 12.5px; }

  @media (max-width: 820px) {
    .grid { grid-template-columns: 1fr; max-width: 400px; }
    .plan.popular { transform: none; }
  }
</style>
