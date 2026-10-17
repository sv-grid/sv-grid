# Pricing blocks

Plan tables for a pricing page or an upgrade screen, built from `SvCard`,
`SvButton`, `SvBadge`, `SvSegmented` and `SvNumberInput`. Prices are plain data:
the `PLANS` array at the top of each file is the default for the core's `plans`
option, so changing a plan is an edit to one array, or pass your own. The newer
blocks keep money in integer cents and format it with `Intl.NumberFormat`
(`currency` and `locale` options, US dollars and `en-US` by default).

## Installation

<div data-docs-add="add blocks/pricing"></div>

See them first with `npx @svgrid/ui try blocks/pricing`.

## Three tiers with a billing toggle

Three plan cards with a monthly / annual `SvSegmented` switch. The annual price
applies the discount as you toggle. The middle plan is highlighted, and each
card lists its features with check marks and ends in a call-to-action button.

<div data-docs-demo="425-block-pricing" data-height="620"></div>

`npx @svgrid/ui add pricing`

The core also takes `annualDiscount` (a fraction, `0.2` by default, which also
sets the "Annual -20%" label), `currency` and `onChoose(plan, cycle)`, which is
where a call-to-action goes to checkout or a sales form.

## Highlighted plan with a seat count

Four per-seat plans with the recommended one outlined and badged. The Seats
`SvNumberInput` reprices every card: from 25 seats each seat is 10% off and
from 100 seats 20% off, with the list price struck through and the monthly
total under it. Starter allows up to 5 seats, so above that its button turns
off. Enterprise has no seat price and shows "Custom" with a sales button.

<div data-docs-demo="634-block-pricing-highlighted" data-height="600"></div>

`npx @svgrid/ui add pricing-highlighted`

`createSeatPricing()` takes `plans` (a plan with `seatCents: null` is
quote-only, `maxSeats` caps a plan), `volume` (bands of `{ from, off }`),
`seats`, `maxSeats` for the field and `onChoose(plan, seats, totalCents)`.
The spin buttons and arrow keys reprice at once; a typed count applies on
Enter or when the field loses focus.

## Comparison table

A feature-by-plan table with grouped sections. Included features get a check
mark, missing ones a dash, and limits show as text. The header row with each
plan's name, price and button is sticky, so it stays in view while you scroll
the features. Below 640 px the table shows one plan column at a time and an
`SvSegmented` above it picks the plan.

<div data-docs-demo="635-block-pricing-comparison" data-height="1000"></div>

`npx @svgrid/ui add pricing-comparison`

`createPlanComparison()` takes `plans` and `sections`. A feature row is
`{ name, values }`, where `values` maps a plan id to `true`, `false` or a
string. The header sticks to the nearest scrolling container at `top: 0`; with
a fixed navbar, set `top` to its height.

## Loading plans from your billing provider

Each core takes its plans as an option, so prices can come from your billing
provider instead of the file. In SvelteKit, read them in `+page.server.ts` and
map them to the block's plan shape. `listPrices` stands for your provider's
client call; keep amounts in the smallest currency unit, which is what most
providers return:

```ts
// src/routes/pricing/+page.server.ts
import { listPrices } from '$lib/server/billing'

export const load = async () => {
  const prices = await listPrices({ active: true })
  return {
    plans: prices.map((p) => ({
      id: p.id,
      name: p.productName,
      blurb: p.description,
      seatCents: p.unitAmount,
      features: p.features,
      cta: `Choose ${p.productName}`,
      recommended: p.metadata.recommended === 'true',
    })),
  }
}
```

Then pass `data.plans` to the core in the block's instance script, and send
the choice to a checkout endpoint of your own:

```svelte
<script lang="ts">
  let { data } = $props()

  const pricing = createSeatPricing({
    plans: data.plans,
    onChoose: (plan, seats) => location.assign(`/checkout?price=${plan.id}&quantity=${seats}`),
  })
</script>
```

## Headless

The block is a styled render of `createPricing()`, the core in its
`<script module>`. To draw your own markup, take the core alone with
`npx @svgrid/ui add pricing --headless` (it writes `pricing.svelte.ts`):

```svelte
<script lang="ts">
  import { createPricing } from './pricing.svelte.js'

  const pricing = createPricing({
    annualDiscount: 0.15,
    onChoose: (plan, cycle) => location.assign(`/checkout?plan=${plan.id}&cycle=${cycle}`),
  })
</script>

<div role="group" aria-label="Billing">
  <button {...pricing.cycleProps('monthly')}>Monthly</button>
  <button {...pricing.cycleProps('annual')}>Annual</button>
</div>
{#each pricing.plans as plan (plan.id)}
  <article>
    <h3>{plan.name}</h3>
    <p>{pricing.price(plan)} / month</p>
    <button onclick={() => pricing.choose(plan)}>{plan.cta}</button>
  </article>
{/each}
```

## See also

- [UI blocks overview](./index.md)
- [SvSegmented](../ui-components/sv-segmented.md)
- [SvCard](../ui-components/sv-card.md)
- [SvNumberInput](../ui-components/sv-number-input.md)
