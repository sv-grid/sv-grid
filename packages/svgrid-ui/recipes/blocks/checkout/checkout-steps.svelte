<script lang="ts" module>
  /**
   * Stepped checkout block - checkout split into Shipping, Payment and Review
   * behind an SvStepper. Each step validates before Continue moves on:
   * SvTextInput, SvPhoneInput and SvCountryInput for the address, an
   * SvRadioGroup for delivery speed, SvMaskedInput card fields and an
   * SvCheckBox for the billing address. Review lists everything entered with
   * Edit links that jump back to a step and return straight to Review on save.
   * Place order shows the SvButton loading state. Pure UI-kit, --sg-* themed.
   *
   * Headless: createSteppedCheckout() below owns the step, values, per-step
   * validation and the place-order flow with no markup. The component under it
   * is one styled render of that core; import createSteppedCheckout from this
   * file (or `npx @svgrid/ui add checkout-steps --headless` for the core alone)
   * to draw your own.
   */
  import type { StepItem, PhoneParts } from '@svgrid/grid'

  export type SteppedSpeed = { id: string; label: string; cents: number }
  export type SteppedItem = { name: string; cents: number; qty: number }
  export type SteppedValues = {
    name: string; phone: string; phoneParts: PhoneParts | null; address: string; city: string; postal: string
    country: string | null; speed: string; holder: string; card: string; expiry: string; cvc: string
    sameBilling: boolean; billingPostal: string
  }
  export type SteppedOptions = {
    items?: SteppedItem[]
    speeds?: SteppedSpeed[]
    currency?: string
    locale?: string
    initial?: Partial<SteppedValues>
    /** Creates the order; resolve with its number. Throw to stay on Review. */
    onPlace?: (values: SteppedValues, totalCents: number) => Promise<string>
  }

  const SAMPLE_ITEMS: SteppedItem[] = [
    { name: 'Lumen desk lamp, Graphite', cents: 8900, qty: 1 },
    { name: 'Spare LED module', cents: 1450, qty: 2 },
  ]
  const SAMPLE_SPEEDS: SteppedSpeed[] = [
    { id: 'standard', label: 'Standard (4-6 days)', cents: 600 },
    { id: 'express', label: 'Express (1-2 days)', cents: 1800 },
  ]
  const CHECKOUT_STEPS: StepItem[] = [
    { label: 'Shipping', description: 'Address and delivery' },
    { label: 'Payment', description: 'Card details' },
    { label: 'Review', description: 'Check and place' },
  ]

  /** Pure validator for one step (0 shipping, 1 payment; review has no fields). */
  export function validateStep(step: number, v: SteppedValues): Record<string, string> {
    // Pure (no state, no DOM); a form action can reuse the address checks on the server.
    const e: Record<string, string> = {}
    if (step === 0) {
      if (!v.name.trim()) e.name = 'Enter the recipient name.'
      if (!v.phoneParts?.national || !v.phoneParts.valid) e.phone = 'Enter a phone number the courier can call.'
      if (!v.address.trim()) e.address = 'Enter a street address.'
      if (!v.city.trim()) e.city = 'Enter a city.'
      if (v.postal.trim().length < 3) e.postal = 'Enter a postal code.'
      if (!v.country) e.country = 'Choose a country.'
    } else if (step === 1) {
      if (!v.holder.trim()) e.holder = 'Enter the name on the card.'
      if (v.card.replace(/\D/g, '').length < 15) e.card = 'Enter the full card number.'
      if (!/^(0[1-9]|1[0-2])\/\d\d$/.test(v.expiry)) e.expiry = 'Use MM/YY.'
      if (!/^\d{3,4}$/.test(v.cvc)) e.cvc = '3 or 4 digits.'
      if (!v.sameBilling && v.billingPostal.trim().length < 3) e.billingPostal = 'Enter the billing postal code.'
    }
    return e
  }

  export function createSteppedCheckout(opts: SteppedOptions = {}) {
    // Sample data stands in when the app passes none; all amounts are integer cents.
    const items = opts.items ?? SAMPLE_ITEMS
    const speeds = opts.speeds ?? SAMPLE_SPEEDS
    const money = new Intl.NumberFormat(opts.locale ?? 'en-GB', { style: 'currency', currency: opts.currency ?? 'GBP' })
    const values = $state<SteppedValues>({
      name: '', phone: '', phoneParts: null, address: '', city: '', postal: '', country: 'GB', speed: speeds[0]?.id ?? '',
      holder: '', card: '', expiry: '', cvc: '', sameBilling: true, billingPostal: '', ...opts.initial,
    })
    let step = $state(0)
    let attempted = $state([false, false, false])
    let toReview = $state(false)
    let busy = $state(false)
    let orderNo = $state('')

    const errors = $derived(attempted[step] ? validateStep(step, values) : {})
    const subtotal = $derived(items.reduce((s, i) => s + i.cents * i.qty, 0))
    const speed = $derived(speeds.find((s) => s.id === values.speed))
    const total = $derived(subtotal + (speed?.cents ?? 0))

    function goTo(n: number) { step = Math.max(0, Math.min(2, n)) }

    async function next(ev?: Event): Promise<boolean> {
      ev?.preventDefault()
      if (busy) return false
      if (step < 2) {
        attempted[step] = true
        if (Object.keys(validateStep(step, values)).length) return false
        goTo(toReview ? 2 : step + 1)
        if (step === 2) toReview = false
        return true
      }
      busy = true
      try {
        orderNo = (await opts.onPlace?.({ ...values }, total)) ?? 'ORDER'
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
      speeds,
      steps: CHECKOUT_STEPS,
      get step() { return step },
      get errors() { return errors },
      get busy() { return busy },
      get toReview() { return toReview },
      get orderNo() { return orderNo },
      get subtotal() { return subtotal },
      get speed() { return speed },
      get total() { return total },
      get last4() { return values.card.replace(/\D/g, '').slice(-4) },
      format: (cents: number) => money.format(cents / 100),
      next,
      back: () => { toReview = false; goTo(step - 1) },
      /** Jump from Review to a step; its Continue returns straight to Review. */
      edit: (n: number) => { toReview = true; goTo(n) },
      /** Spread on <SvStepper> (or read for your own stepper). Linear: only reached steps. */
      stepperProps: () => ({ steps: CHECKOUT_STEPS, current: step, onChange: (i: number) => { toReview = false; goTo(i) } }),
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: next }),
    }
  }
</script>

<script lang="ts">
  import {
    SvStepper, SvTextInput, SvPhoneInput, SvCountryInput, SvRadioGroup, SvMaskedInput, SvCheckBox,
    SvButton, SvToaster, toast,
  } from '@svgrid/grid'

  const TITLES = ['Where should we ship it?', 'How would you like to pay?', 'Review your order']
  const regions = new Intl.DisplayNames(['en'], { type: 'region' })

  const co = createSteppedCheckout({
    initial: { name: 'Ada Lovelace', holder: 'Ada Lovelace' },
    // Replace with your order endpoint; a thrown error keeps the shopper on Review.
    onPlace: () =>
      toast.promise(new Promise<string>((res) => setTimeout(() => res('LU-30417'), 1300)), {
        loading: 'Placing your order...',
        success: (no) => `Order ${no} placed.`,
        error: 'Payment failed. Nothing was charged.',
      }),
  })
  const speedOptions = co.speeds.map((s) => ({ value: s.id, label: `${s.label}, ${co.format(s.cents)}` }))
  const v = co.values
  const e = $derived(co.errors)

  let heading = $state<HTMLElement>()
  // Move focus to the new step's heading so screen readers hear the step change.
  let lastStep = co.step
  $effect(() => {
    if (co.step !== lastStep) { lastStep = co.step; heading?.focus() }
  })
</script>

<main class="sv-checkout-steps">
  <div class="sv-checkout-steps-panel">
    <h1>Checkout</h1>
    <SvStepper {...co.stepperProps()} />

    {#if co.orderNo}
      <div class="sv-checkout-steps-done" role="status">
        <h2>Order {co.orderNo} is placed</h2>
        <p>We emailed the receipt. {co.format(co.total)} was charged to the card ending {co.last4}; it ships to {v.city} by {co.speed?.label}.</p>
      </div>
    {:else}
      <form class="sv-checkout-steps-form" {...co.formProps()}>
        <h2 bind:this={heading} tabindex="-1">{TITLES[co.step]}</h2>

        {#if co.step === 0}
          <SvTextInput label="Full name" autocomplete="name" bind:value={v.name} block required error={e.name} invalid={!!e.name} />
          <SvPhoneInput label="Phone" country="GB" bind:value={v.phone} block required error={e.phone} invalid={!!e.phone}
            onChange={(_val, parts) => (v.phoneParts = parts)} />
          <SvTextInput label="Address" autocomplete="street-address" bind:value={v.address} block required error={e.address} invalid={!!e.address} />
          <div class="sv-checkout-steps-row">
            <SvTextInput label="City" autocomplete="address-level2" bind:value={v.city} block required error={e.city} invalid={!!e.city} />
            <SvTextInput label="Postal code" autocomplete="postal-code" bind:value={v.postal} block required error={e.postal} invalid={!!e.postal} />
          </div>
          <SvCountryInput label="Country" value={v.country} block required error={e.country} invalid={!!e.country} onChange={(c) => (v.country = c)} />
          <SvRadioGroup label="Delivery" orientation="horizontal" value={v.speed} options={speedOptions} onChange={(s) => (v.speed = String(s))} />
        {:else if co.step === 1}
          <SvTextInput label="Name on card" autocomplete="cc-name" bind:value={v.holder} block required error={e.holder} invalid={!!e.holder} />
          <SvMaskedInput label="Card number" mask="#### #### #### ####" placeholder="1234 1234 1234 1234" bind:value={v.card} block required error={e.card} invalid={!!e.card} />
          <div class="sv-checkout-steps-row">
            <SvMaskedInput label="Expiry" mask="##/##" placeholder="MM/YY" bind:value={v.expiry} block required error={e.expiry} invalid={!!e.expiry} />
            <SvMaskedInput label="CVC" mask="####" placeholder="123" bind:value={v.cvc} block required error={e.cvc} invalid={!!e.cvc} />
          </div>
          <SvCheckBox checked={v.sameBilling} onChange={(c) => (v.sameBilling = c)}>Billing address is the same as shipping</SvCheckBox>
          {#if !v.sameBilling}
            <SvTextInput label="Billing postal code" bind:value={v.billingPostal} block required error={e.billingPostal} invalid={!!e.billingPostal} />
          {/if}
        {:else}
          <section class="sv-checkout-steps-review" aria-label="Shipping details">
            <div class="sv-checkout-steps-review-head"><h3>Shipping</h3><button type="button" class="sv-checkout-steps-edit" onclick={() => co.edit(0)}>Edit<span class="sv-checkout-steps-sr"> shipping</span></button></div>
            <p>{v.name}<br />{v.address}<br />{v.city} {v.postal}, {v.country ? regions.of(v.country) : ''}<br />{v.phoneParts?.dial} {v.phoneParts?.national}</p>
            <p class="sv-checkout-steps-muted">{co.speed?.label}</p>
          </section>
          <section class="sv-checkout-steps-review" aria-label="Payment details">
            <div class="sv-checkout-steps-review-head"><h3>Payment</h3><button type="button" class="sv-checkout-steps-edit" onclick={() => co.edit(1)}>Edit<span class="sv-checkout-steps-sr"> payment</span></button></div>
            <p>Card ending {co.last4}, expires {v.expiry}<br />{v.holder}</p>
            <p class="sv-checkout-steps-muted">{v.sameBilling ? 'Billing address same as shipping' : `Billing postal code ${v.billingPostal}`}</p>
          </section>
          <dl class="sv-checkout-steps-totals">
            {#each co.items as item (item.name)}<div><dt>{item.name} x {item.qty}</dt><dd>{co.format(item.cents * item.qty)}</dd></div>{/each}
            <div><dt>Shipping</dt><dd>{co.format(co.speed?.cents ?? 0)}</dd></div>
            <div class="sv-checkout-steps-grand"><dt>Total (VAT included)</dt><dd>{co.format(co.total)}</dd></div>
          </dl>
        {/if}

        <div class="sv-checkout-steps-nav">
          {#if co.step > 0}<SvButton variant="ghost" onclick={co.back}>Back</SvButton>{/if}
          <SvButton type="submit" variant="primary" loading={co.busy}>
            {co.step === 2 ? `Place order, ${co.format(co.total)}` : co.toReview ? 'Save and review' : co.step === 0 ? 'Continue to payment' : 'Continue to review'}
          </SvButton>
        </div>
      </form>
    {/if}
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-checkout-steps {
    display: flex; justify-content: center; width: 100%; box-sizing: border-box; min-height: 600px; padding: 32px 24px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-checkout-steps-panel {
    display: flex; flex-direction: column; gap: 22px; width: 100%; max-width: 620px; align-self: flex-start; box-sizing: border-box;
    padding: 28px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); background: var(--sg-bg, #fff);
  }
  .sv-checkout-steps h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  .sv-checkout-steps h2 { margin: 0; font-size: 16px; font-weight: 650; outline: none; }
  .sv-checkout-steps h3 { margin: 0; font-size: 14px; font-weight: 650; }
  .sv-checkout-steps-form { display: flex; flex-direction: column; gap: 14px; }
  .sv-checkout-steps-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .sv-checkout-steps-review { padding: 14px 16px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); }
  .sv-checkout-steps-review-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; }
  .sv-checkout-steps-review p { margin: 0; font-size: 13.5px; line-height: 1.55; }
  .sv-checkout-steps-review p + p { margin-top: 4px; }
  .sv-checkout-steps-muted { color: var(--sg-muted, #64748b); }
  .sv-checkout-steps-edit {
    background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--sg-accent, #4f46e5);
  }
  .sv-checkout-steps-edit:hover { text-decoration: underline; }
  .sv-checkout-steps-edit:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; border-radius: 3px; }
  .sv-checkout-steps-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .sv-checkout-steps-totals { display: flex; flex-direction: column; gap: 8px; margin: 0; font-size: 13.5px; }
  .sv-checkout-steps-totals div { display: flex; justify-content: space-between; gap: 12px; }
  .sv-checkout-steps-totals dt { color: var(--sg-muted, #64748b); }
  .sv-checkout-steps-totals dd { margin: 0; font-variant-numeric: tabular-nums; }
  .sv-checkout-steps-grand { padding-top: 10px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 15px; font-weight: 650; }
  .sv-checkout-steps-grand dt { color: var(--sg-fg, #0f172a); }
  .sv-checkout-steps-nav { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-checkout-steps-done { padding: 18px; border-radius: var(--sg-radius, 8px); background: color-mix(in srgb, var(--sg-success, #16a34a) 12%, transparent); }
  .sv-checkout-steps-done p { margin: 6px 0 0; font-size: 13.5px; line-height: 1.5; }

  @media (max-width: 560px) {
    .sv-checkout-steps { padding: 16px; }
    .sv-checkout-steps-panel { padding: 18px 16px; }
    .sv-checkout-steps :global(.sv-step__desc) { display: none; }
    .sv-checkout-steps :global(.sv-step__line) { margin: 0 4px; }
    .sv-checkout-steps-nav > :global(*) { flex: 1; }
  }
</style>
