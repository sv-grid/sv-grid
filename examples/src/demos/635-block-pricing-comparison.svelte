<script lang="ts" module>
  /**
   * Pricing comparison table block - a feature-by-plan table with grouped
   * sections, check marks and limits, and a sticky header row carrying each
   * plan's name, price and SvButton. On a phone the table shows one plan
   * column at a time and an SvSegmented above it picks which; SvBadge marks
   * the most chosen plan. Pure UI-kit, --sg-* themed.
   *
   * Headless: createPlanComparison() below owns the plans, the feature
   * sections, the cell values and the plan shown on small screens with no
   * markup. The component under it is one styled render of that core; import
   * createPlanComparison from this file (or `npx @svgrid/ui add
   * pricing-comparison --headless` for the core alone) to draw your own.
   */
  export type ComparePlan = { id: string; name: string; priceCents: number; cta: string; popular?: boolean }
  /** true = included, false = not included, a string = a limit or a variant. */
  export type CompareValue = boolean | string
  export type CompareFeature = { name: string; values: Record<string, CompareValue> }
  export type CompareSection = { title: string; features: CompareFeature[] }
  export type CompareCell = { kind: 'yes' | 'no' | 'text'; text: string }
  export type PlanComparisonOptions = {
    plans?: ComparePlan[]
    sections?: CompareSection[]
    /** Plan column shown first on small screens. */
    focus?: string
    currency?: string
    locale?: string
    onChoose?: (plan: ComparePlan) => Promise<void> | void
    onError?: (error: unknown, plan: ComparePlan) => void
  }

  const PLANS: ComparePlan[] = [
    { id: 'starter', name: 'Starter', priceCents: 0, cta: 'Start free' },
    { id: 'growth', name: 'Growth', priceCents: 2900, cta: 'Start trial', popular: true },
    { id: 'scale', name: 'Scale', priceCents: 7900, cta: 'Start trial' },
  ]
  const row = (name: string, starter: CompareValue, growth: CompareValue, scale: CompareValue): CompareFeature =>
    ({ name, values: { starter, growth, scale } })
  const SECTIONS: CompareSection[] = [
    { title: 'Inventory', features: [
      row('Stock locations', '1', '5', 'Unlimited'),
      row('SKUs', '1,000', '25,000', 'Unlimited'),
      row('Barcode scanning app', true, true, true),
      row('Purchase orders', false, true, true),
      row('Multi-currency costing', false, false, true),
    ] },
    { title: 'Integrations', features: [
      row('Shop sync (orders and stock)', true, true, true),
      row('Accounting export', false, true, true),
      row('REST API', 'Read only', 'Read and write', 'Read and write'),
      row('Webhooks', false, '10 endpoints', 'Unlimited'),
    ] },
    { title: 'Admin and support', features: [
      row('Users', '2', '10', 'Unlimited'),
      row('Audit log', false, '30 days', '1 year'),
      row('Single sign-on', false, false, true),
      row('Support', 'Email', 'Email and chat', 'Phone, 4 h response'),
    ] },
  ]

  export function createPlanComparison(opts: PlanComparisonOptions = {}) {
    const plans = opts.plans ?? PLANS
    const sections = opts.sections ?? SECTIONS
    const fmt = (digits: number) =>
      new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD', minimumFractionDigits: digits })
    let focus = $state(opts.focus ?? plans.find((p) => p.popular)?.id ?? plans[0]?.id ?? '')
    let pendingId = $state<string | null>(null)

    const money = (cents: number) => fmt(cents % 100 === 0 ? 0 : 2).format(cents / 100)

    function cell(f: CompareFeature, p: ComparePlan): CompareCell {
      const v = f.values[p.id] ?? false
      if (v === true) return { kind: 'yes', text: 'Included' }
      if (v === false) return { kind: 'no', text: 'Not included' }
      return { kind: 'text', text: v }
    }

    async function choose(p: ComparePlan) {
      if (pendingId) return
      pendingId = p.id
      try { await opts.onChoose?.(p) } catch (e) { opts.onError?.(e, p) } finally { pendingId = null }
    }

    return {
      plans, sections, money, cell, choose,
      /** Options for a plan switch on small screens. */
      segments: plans.map((p) => ({ value: p.id, label: p.name })),
      get focus() { return focus },
      /** Accepts any value, so a segmented control can bind to it. */
      set focus(v: string | number | null) { if (plans.some((p) => p.id === v)) focus = String(v) },
      get pendingId() { return pendingId },
      isFocus: (p: ComparePlan) => p.id === focus,
      /** Spread on every <th>/<td> of a plan column; style [data-focus] for phones. */
      columnProps: (p: ComparePlan) => ({ 'data-plan': p.id, 'data-focus': p.id === focus ? '' : undefined }),
      /** Spread on a plain <button> that picks the plan shown on phones. */
      focusProps: (p: ComparePlan) => ({ type: 'button' as const, 'aria-pressed': p.id === focus, onclick: () => (focus = p.id) }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvBadge, SvSegmented, SvToaster, toast } from '@svgrid/grid'

  const compare = createPlanComparison({
    onChoose: (p) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 800)), {
        loading: `Preparing ${p.name}...`,
        success: p.priceCents ? `${p.name} trial started. 14 days, no card needed.` : 'Starter workspace created.',
        error: 'Could not start the plan. Try again.',
      }).then(() => {}),
  })
</script>

<section class="sv-pcompare" aria-labelledby="sv-pcompare-title">
  <header class="sv-pcompare-head">
    <h2 id="sv-pcompare-title">Compare Northwind Stock plans</h2>
    <p class="sv-pcompare-muted">Prices per month for the whole workspace. Every plan includes the mobile scanner app.</p>
  </header>

  <div class="sv-pcompare-switch">
    <SvSegmented label="Show plan" options={compare.segments} bind:value={compare.focus} block />
  </div>

  <table class="sv-pcompare-table">
    <caption class="sv-pcompare-sr">Features included in each plan</caption>
    <thead>
      <tr>
        <th scope="col" class="sv-pcompare-corner"><span class="sv-pcompare-sr">Feature</span></th>
        {#each compare.plans as p (p.id)}
          <th scope="col" class="sv-pcompare-plan" class:sv-pcompare-is-focus={compare.isFocus(p)} class:sv-pcompare-is-popular={p.popular} {...compare.columnProps(p)}>
            <span class="sv-pcompare-name">{p.name}{#if p.popular}<SvBadge variant="accent" size="sm">Most chosen</SvBadge>{/if}</span>
            <span class="sv-pcompare-price">{compare.money(p.priceCents)}<small>/mo</small></span>
            <SvButton size="sm" block variant={p.popular ? 'primary' : 'outline'}
              loading={compare.pendingId === p.id} disabled={!!compare.pendingId && compare.pendingId !== p.id}
              onclick={() => compare.choose(p)}>{p.cta}</SvButton>
          </th>
        {/each}
      </tr>
    </thead>
    {#each compare.sections as s (s.title)}
      <tbody>
        <tr class="sv-pcompare-group"><th scope="colgroup" colspan={compare.plans.length + 1}>{s.title}</th></tr>
        {#each s.features as f (f.name)}
          <tr>
            <th scope="row" class="sv-pcompare-feat">{f.name}</th>
            {#each compare.plans as p (p.id)}
              {@const c = compare.cell(f, p)}
              <td class:sv-pcompare-is-focus={compare.isFocus(p)} class:sv-pcompare-is-popular={p.popular} {...compare.columnProps(p)}>
                {#if c.kind === 'text'}{c.text}{:else}
                  <svg class="sv-pcompare-mark sv-pcompare-{c.kind}" viewBox="0 0 16 16" aria-hidden="true">
                    <path d={c.kind === 'yes' ? 'm3.5 8.5 3 3 6-7' : 'M5 8h6'} />
                  </svg><span class="sv-pcompare-sr">{c.text}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-pcompare {
    display: flex; flex-direction: column; gap: 20px;
    width: 100%; padding: 36px 24px 40px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-pcompare-head, .sv-pcompare-table { width: 100%; max-width: 920px; margin: 0 auto; }
  .sv-pcompare-head h2 { margin: 0 0 6px; font-size: 26px; font-weight: 650; letter-spacing: -.02em; }
  .sv-pcompare-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  .sv-pcompare-switch { display: none; }
  .sv-pcompare-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .sv-pcompare-table { border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 13.5px; }
  .sv-pcompare-table th, .sv-pcompare-table td { padding: 11px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); text-align: center; vertical-align: middle; }
  .sv-pcompare-table thead th {
    position: sticky; top: 0; z-index: 1; vertical-align: bottom;
    background: var(--sg-bg, #fff); border-bottom: 2px solid var(--sg-border, #e2e8f0);
  }
  .sv-pcompare-corner { width: 34%; }
  .sv-pcompare-plan { font-weight: 400; }
  .sv-pcompare-plan > span { display: flex; align-items: center; justify-content: center; gap: 6px; }
  .sv-pcompare-name { font-size: 15px; font-weight: 650; flex-wrap: wrap; }
  .sv-pcompare-price { margin: 4px 0 10px; font-size: 24px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .sv-pcompare-price small { font-size: 12px; font-weight: 400; color: var(--sg-muted, #64748b); letter-spacing: 0; }
  .sv-pcompare-is-popular:not(.sv-pcompare-plan) { background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff)); }
  .sv-pcompare-group th {
    padding-top: 22px; text-align: left; font-size: 12px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
  }
  .sv-pcompare-table .sv-pcompare-feat { text-align: left; font-weight: 400; }
  .sv-pcompare-mark { display: inline-block; width: 18px; height: 18px; vertical-align: middle; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-pcompare-yes { stroke: var(--sg-success, #16a34a); }
  .sv-pcompare-no { stroke: var(--sg-muted, #94a3b8); }

  @media (max-width: 640px) {
    .sv-pcompare { padding: 24px 16px 32px; }
    .sv-pcompare-head h2 { font-size: 22px; }
    .sv-pcompare-switch { display: block; }
    .sv-pcompare-table th, .sv-pcompare-table td { padding: 10px 8px; }
    /* Auto layout: the hidden columns collapse instead of keeping their share. */
    .sv-pcompare-table { table-layout: auto; }
    .sv-pcompare-corner { width: 55%; }
    .sv-pcompare-table [data-plan]:not(.sv-pcompare-is-focus) { display: none; }
  }
</style>
