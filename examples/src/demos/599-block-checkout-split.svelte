<script lang="ts" module>
  /**
   * Split checkout block - a one-page checkout: contact email, shipping
   * address (SvTextInput, SvCountryInput), a delivery SvRadioGroup and card
   * fields (SvMaskedInput) on the left, a sticky order summary on the right.
   * Pay validates every field (Luhn check on the card, expiry not in the past)
   * and shows the SvButton loading state. On phones the summary moves above the
   * form behind a show/hide toggle. Money is integer cents. Pure UI-kit,
   * --sg-* themed.
   *
   * Headless: createSplitCheckout() below owns the values, totals, validation
   * and pay flow with no markup. The component under it is one styled render of
   * that core; import createSplitCheckout from this file (or `npx @svgrid/ui add
   * checkout-split --headless` for the core alone) to draw your own.
   */
  export type CheckoutItem = { id: string; name: string; variant: string; cents: number; qty: number; thumb?: string }
  export type DeliveryRate = { id: string; label: string; cents: number }
  export type SplitCheckoutValues = {
    email: string; updates: boolean; name: string; address: string; city: string; postal: string
    country: string | null; delivery: string; card: string; expiry: string; cvc: string
  }
  type SplitCheckoutField = Exclude<keyof SplitCheckoutValues, 'updates' | 'delivery'>
  export type SplitCheckoutErrors = Partial<Record<SplitCheckoutField, string>>
  export type SplitCheckoutTotals = { subtotal: number; shipping: number; tax: number; total: number }
  export type SplitCheckoutOptions = {
    items?: CheckoutItem[]
    rates?: DeliveryRate[]
    taxRate?: number
    currency?: string
    initial?: Partial<SplitCheckoutValues>
    /** Called with valid values; throw (or reject) to keep the form as it is. */
    onPay?: (values: SplitCheckoutValues, totals: SplitCheckoutTotals) => Promise<void> | void
    onInvalid?: (errors: SplitCheckoutErrors) => void
  }

  const SAMPLE_ITEMS: CheckoutItem[] = [
    { id: 'k1', name: 'Gooseneck kettle', variant: '1 L, Matte black', cents: 6400, qty: 1, thumb: 'kettle' },
    { id: 'd2', name: 'Ceramic dripper', variant: 'Size 02, Sand', cents: 2800, qty: 1, thumb: 'dripper' },
    { id: 'b1', name: 'House blend', variant: '1 kg, whole bean', cents: 2200, qty: 2, thumb: 'bag' },
  ]
  const SAMPLE_RATES: DeliveryRate[] = [
    { id: 'standard', label: 'Standard, 5-7 business days', cents: 595 },
    { id: 'express', label: 'Express, 2 business days', cents: 1400 },
    { id: 'pickup', label: 'Pick up at the Fieldline roastery', cents: 0 },
  ]
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const digits = (s: string) => s.replace(/\D/g, '')

  function luhn(num: string): boolean {
    let sum = 0
    for (let i = 0; i < num.length; i++) {
      let d = Number(num[num.length - 1 - i])
      if (i % 2) { d *= 2; if (d > 9) d -= 9 }
      sum += d
    }
    return num.length >= 13 && sum % 10 === 0
  }

  function expiryError(v: string, now = new Date()): string | undefined {
    const m = /^(\d\d)\/(\d\d)$/.exec(v)
    if (!m) return 'Enter the expiry as MM/YY.'
    const month = Number(m[1])
    if (month < 1 || month > 12) return 'Month must be 01 to 12.'
    return (2000 + Number(m[2])) * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1 ? 'This card has expired.' : undefined
  }

  /** Pure validator: one message per invalid field. */
  export function validateSplitCheckout(v: SplitCheckoutValues): SplitCheckoutErrors {
    // Pure (no state, no DOM); a form action can reuse the address checks on the server.
    const e: SplitCheckoutErrors = {}
    if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email, like name@company.com.'
    if (!v.name.trim()) e.name = 'Enter the recipient name.'
    if (!v.address.trim()) e.address = 'Enter a street address.'
    if (!v.city.trim()) e.city = 'Enter a city.'
    if (v.postal.trim().length < 3) e.postal = 'Enter a postal code.'
    if (!v.country) e.country = 'Choose a country.'
    if (!luhn(digits(v.card))) e.card = 'Check the card number.'
    const exp = expiryError(v.expiry)
    if (exp) e.expiry = exp
    if (!/^\d{3,4}$/.test(digits(v.cvc))) e.cvc = '3 or 4 digits.'
    return e
  }

  export function createSplitCheckout(opts: SplitCheckoutOptions = {}) {
    // Sample data stands in when the app passes none; all amounts are integer cents.
    const items = opts.items ?? SAMPLE_ITEMS
    const rates = opts.rates ?? SAMPLE_RATES
    const taxRate = opts.taxRate ?? 0.08
    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: opts.currency ?? 'USD' })
    const values = $state<SplitCheckoutValues>({
      email: '', updates: true, name: '', address: '', city: '', postal: '', country: 'US',
      delivery: rates[0]?.id ?? '', card: '', expiry: '', cvc: '', ...opts.initial,
    })
    // Errors appear after the first Pay and then follow the values as they change.
    let attempted = $state(false)
    let busy = $state(false)
    let summaryOpen = $state(false)

    const errors = $derived(attempted ? validateSplitCheckout(values) : {})
    const subtotal = $derived(items.reduce((s, i) => s + i.cents * i.qty, 0))
    const shipping = $derived(rates.find((r) => r.id === values.delivery)?.cents ?? 0)
    const tax = $derived(Math.round(subtotal * taxRate))
    const totals = $derived<SplitCheckoutTotals>({ subtotal, shipping, tax, total: subtotal + shipping + tax })

    async function pay(ev?: Event): Promise<boolean> {
      ev?.preventDefault()
      if (busy) return false
      attempted = true
      const e = validateSplitCheckout(values)
      if (Object.keys(e).length) { opts.onInvalid?.(e); return false }
      busy = true
      try {
        await opts.onPay?.({ ...values }, totals)
        return true
      } catch {
        return false
      } finally {
        busy = false
      }
    }

    return {
      values,
      items,
      rates,
      get errors(): SplitCheckoutErrors { return errors },
      get busy() { return busy },
      get totals() { return totals },
      get summaryOpen() { return summaryOpen },
      set summaryOpen(v: boolean) { summaryOpen = v },
      format: (cents: number) => money.format(cents / 100),
      pay,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: pay }),
      /** Spread on the phone-only button that shows and hides the summary. */
      summaryToggleProps: (controls: string) => ({
        type: 'button' as const, 'aria-expanded': summaryOpen, 'aria-controls': controls,
        onclick: () => { summaryOpen = !summaryOpen },
      }),
      /** Spread on a plain <input> when you render your own fields. */
      fieldProps: (name: Exclude<SplitCheckoutField, 'country'>) => ({
        name,
        value: values[name],
        oninput: (e: Event) => { values[name] = (e.currentTarget as HTMLInputElement).value },
        'aria-invalid': errors[name] ? ('true' as const) : undefined,
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvTextInput, SvCountryInput, SvRadioGroup, SvMaskedInput, SvCheckBox, SvButton, SvToaster, toast,
  } from '@svgrid/grid'

  const co = createSplitCheckout({
    initial: { email: 'ada@northwind.io', name: 'Ada Lovelace' },
    onInvalid: () => toast.error('Check the highlighted fields.'),
    // Replace with your payment provider; a thrown error leaves the form as it was.
    onPay: (v, t) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1400)), {
        loading: `Charging ${co.format(t.total)}...`,
        success: `Paid ${co.format(t.total)}. Receipt sent to ${v.email.trim()}.`,
        error: 'The card was declined. Nothing was charged.',
      }),
  })
  const deliveryOptions = co.rates.map((r) => ({ value: r.id, label: `${r.label} - ${r.cents ? co.format(r.cents) : 'Free'}` }))
  const e = $derived(co.errors)
</script>

<main class="sv-checkout-split">
  <aside class="sv-checkout-split-summary" aria-labelledby="sv-checkout-split-summary-title">
    <button class="sv-checkout-split-toggle" {...co.summaryToggleProps('sv-checkout-split-summary-body')}>
      <span>{co.summaryOpen ? 'Hide' : 'Show'} order summary</span>
      <strong>{co.format(co.totals.total)}</strong>
    </button>
    <div id="sv-checkout-split-summary-body" class="sv-checkout-split-summary-body" class:sv-checkout-split-collapsed={!co.summaryOpen}>
      <h2 id="sv-checkout-split-summary-title">Order summary</h2>
      <ul class="sv-checkout-split-items">
        {#each co.items as item (item.id)}
          <li>
            <span class="sv-checkout-split-thumb">{@render art(item.thumb)}<span class="sv-checkout-split-qty">{item.qty}</span></span>
            <span class="sv-checkout-split-info"><strong>{item.name}</strong><span>{item.variant}</span></span>
            <span class="sv-checkout-split-num">{co.format(item.cents * item.qty)}</span>
          </li>
        {/each}
      </ul>
      <dl class="sv-checkout-split-totals">
        <div><dt>Subtotal</dt><dd>{co.format(co.totals.subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>{co.totals.shipping ? co.format(co.totals.shipping) : 'Free'}</dd></div>
        <div><dt>Tax (8%)</dt><dd>{co.format(co.totals.tax)}</dd></div>
        <div class="sv-checkout-split-grand"><dt>Total</dt><dd>{co.format(co.totals.total)}</dd></div>
      </dl>
    </div>
  </aside>

  <form class="sv-checkout-split-form" {...co.formProps()}>
    <h1>Checkout</h1>

    <section class="sv-checkout-split-section" aria-labelledby="sv-checkout-split-contact">
      <h2 id="sv-checkout-split-contact">Contact</h2>
      <SvTextInput label="Email" type="email" name="email" autocomplete="email" bind:value={co.values.email} block required error={e.email} invalid={!!e.email} />
      <SvCheckBox checked={co.values.updates} onChange={(v) => (co.values.updates = v)}>Email me shipping updates for this order</SvCheckBox>
    </section>

    <section class="sv-checkout-split-section" aria-labelledby="sv-checkout-split-ship">
      <h2 id="sv-checkout-split-ship">Shipping address</h2>
      <SvTextInput label="Full name" name="name" autocomplete="name" bind:value={co.values.name} block required error={e.name} invalid={!!e.name} />
      <SvTextInput label="Address" name="address" autocomplete="street-address" placeholder="Street and number, apartment"
        bind:value={co.values.address} block required error={e.address} invalid={!!e.address} />
      <div class="sv-checkout-split-row">
        <SvTextInput label="City" name="city" autocomplete="address-level2" bind:value={co.values.city} block required error={e.city} invalid={!!e.city} />
        <SvTextInput label="Postal code" name="postal" autocomplete="postal-code" bind:value={co.values.postal} block required error={e.postal} invalid={!!e.postal} />
      </div>
      <SvCountryInput label="Country" name="country" value={co.values.country} block required error={e.country} invalid={!!e.country}
        onChange={(c) => (co.values.country = c)} />
    </section>

    <section class="sv-checkout-split-section" aria-labelledby="sv-checkout-split-delivery">
      <h2 id="sv-checkout-split-delivery">Delivery</h2>
      <SvRadioGroup ariaLabel="Delivery method" name="delivery" options={deliveryOptions} value={co.values.delivery} onChange={(v) => (co.values.delivery = String(v))} />
    </section>

    <section class="sv-checkout-split-section" aria-labelledby="sv-checkout-split-pay">
      <h2 id="sv-checkout-split-pay">Payment</h2>
      <SvMaskedInput label="Card number" mask="#### #### #### ####" placeholder="1234 1234 1234 1234" bind:value={co.values.card} block required error={e.card} invalid={!!e.card} />
      <div class="sv-checkout-split-row">
        <SvMaskedInput label="Expiry" mask="##/##" placeholder="MM/YY" bind:value={co.values.expiry} block required error={e.expiry} invalid={!!e.expiry} />
        <SvMaskedInput label="CVC" mask="####" placeholder="123" bind:value={co.values.cvc} block required error={e.cvc} invalid={!!e.cvc} />
      </div>
    </section>

    <SvButton type="submit" variant="primary" size="lg" block loading={co.busy}>Pay {co.format(co.totals.total)}</SvButton>
    <p class="sv-checkout-split-note">Test card: 4242 4242 4242 4242, any future date, any CVC.</p>
  </form>
</main>

{#snippet art(kind: string | undefined)}
  <svg viewBox="0 0 48 48" aria-hidden="true">
    {#if kind === 'kettle'}
      <path d="M12 38h22l-2-18H14z" /><path d="M14 20c0-5 4-8 9-8s9 3 9 8" /><path d="M34 26c4-1 6-4 8-8" /><path d="M21 12v-3h4v3" />
    {:else if kind === 'dripper'}
      <path d="M10 14h28l-8 16H18z" /><path d="M14 34h20" /><path d="M38 18h3a3 3 0 0 1 0 6h-5" />
    {:else if kind === 'bag'}
      <path d="M15 10h18l3 6v24a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V16z" /><path d="M12 16h24" /><circle cx="24" cy="28" r="5" />
    {:else}
      <rect x="10" y="14" width="28" height="24" rx="3" /><path d="M10 22h28" />
    {/if}
  </svg>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-checkout-split {
    display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; align-items: start;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 32px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-checkout-split-form { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: 22px; max-width: 560px; min-width: 0; }
  .sv-checkout-split h1 { margin: 0; font-size: 24px; font-weight: 650; letter-spacing: -.01em; }
  .sv-checkout-split h2 { margin: 0; font-size: 15px; font-weight: 650; }
  .sv-checkout-split-section { display: flex; flex-direction: column; gap: 12px; padding-top: 20px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-checkout-split-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .sv-checkout-split-note { margin: -10px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); text-align: center; }

  .sv-checkout-split-summary {
    grid-column: 2; grid-row: 1; position: sticky; top: 24px; padding: 22px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-checkout-split-summary-body { display: flex; flex-direction: column; gap: 16px; }
  .sv-checkout-split-toggle { display: none; }
  .sv-checkout-split-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .sv-checkout-split-items li { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
  .sv-checkout-split-thumb {
    position: relative; display: grid; place-items: center; width: 52px; height: 52px; border-radius: var(--sg-radius, 8px);
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b);
  }
  .sv-checkout-split-thumb svg { display: block; width: 30px; height: 30px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .sv-checkout-split-qty {
    position: absolute; top: -7px; right: -7px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box;
    border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 650;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff);
  }
  .sv-checkout-split-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13.5px; }
  .sv-checkout-split-info strong { font-weight: 600; }
  .sv-checkout-split-info span { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .sv-checkout-split-num { font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .sv-checkout-split-totals { display: flex; flex-direction: column; gap: 8px; margin: 0; padding-top: 14px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 13.5px; }
  .sv-checkout-split-totals div { display: flex; justify-content: space-between; gap: 12px; }
  .sv-checkout-split-totals dt { color: var(--sg-muted, #64748b); }
  .sv-checkout-split-totals dd { margin: 0; font-variant-numeric: tabular-nums; }
  .sv-checkout-split-grand { padding-top: 10px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 16px; font-weight: 650; }
  .sv-checkout-split-grand dt { color: var(--sg-fg, #0f172a); }

  @media (max-width: 820px) {
    .sv-checkout-split { grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 16px; }
    .sv-checkout-split-summary { grid-column: 1; position: static; padding: 0; }
    .sv-checkout-split-form { grid-column: 1; grid-row: 2; max-width: none; }
    .sv-checkout-split-toggle {
      display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 12px;
      padding: 14px 16px; background: none; border: 0; font: inherit; font-size: 14px; cursor: pointer;
      color: var(--sg-fg, #0f172a);
    }
    .sv-checkout-split-toggle span { color: var(--sg-accent, #4f46e5); }
    .sv-checkout-split-toggle:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: -2px; border-radius: var(--sg-radius-lg, 10px); }
    .sv-checkout-split-summary-body { padding: 0 16px 16px; }
    .sv-checkout-split-collapsed { display: none; }
    .sv-checkout-split-summary h2 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  }
</style>
