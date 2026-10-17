<script lang="ts" module>
  /**
   * Payment methods block - pick how to pay from four radio cards (Card,
   * Wallet pay, Bank transfer, Invoice); arrow keys move between them. The
   * matching form appears under the choice: SvMaskedInput card fields with an
   * SvCheckBox, an SvPhoneInput for wallet approval, an IBAN SvTextInput with a
   * mod-97 check, or company details with a VAT number and SvCountryInput for
   * invoicing (business accounts only, SvBadge). Continue validates only the
   * chosen method and shows the SvButton loading state. Pure UI-kit, --sg-*
   * themed.
   *
   * Headless: createPaymentMethods() below owns the chosen method, the values,
   * validation and the save flow with no markup, and wraps the kit's
   * createRadioGroup for the radio cards. The component under it is one styled
   * render of that core; import createPaymentMethods from this file (or `npx
   * @svgrid/ui add checkout-payment-methods --headless` for the core alone) to
   * draw your own.
   */
  import { createRadioGroup, type PhoneParts } from '@svgrid/grid'

  const METHOD_IDS = ['card', 'wallet', 'bank', 'invoice'] as const
  export type PaymentMethodId = (typeof METHOD_IDS)[number]
  export type PaymentMethod = { value: PaymentMethodId; label: string; desc: string; business?: boolean }
  export type PaymentValues = {
    card: string; expiry: string; cvc: string; saveCard: boolean; phone: string; phoneParts: PhoneParts | null
    holder: string; iban: string; company: string; vat: string; country: string | null; billingEmail: string; po: string
  }
  export type PaymentOptions = {
    methods?: PaymentMethod[]
    initial?: Partial<PaymentValues> & { method?: PaymentMethodId }
    /** Saves the chosen method; `label` is a one-line summary. Throw to keep the form. */
    onSave?: (method: PaymentMethodId, values: PaymentValues, label: string) => Promise<void> | void
  }

  const SAMPLE_METHODS: PaymentMethod[] = [
    { value: 'card', label: 'Card', desc: 'Credit or debit. Charged today.' },
    { value: 'wallet', label: 'Wallet pay', desc: 'Approve the payment on your phone.' },
    { value: 'bank', label: 'Bank transfer', desc: 'Pay from your account. Clears in 1-2 business days.' },
    { value: 'invoice', label: 'Invoice', desc: 'Net 30 terms. Needs a VAT number.', business: true },
  ]
  const compact = (s: string) => s.replace(/\s/g, '').toUpperCase()

  /** IBAN check digits (ISO 13616 mod-97). */
  export function ibanValid(v: string): boolean {
    // Country code and check digits move to the end, letters become 10-35; valid when the remainder is 1.
    const s = compact(v)
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
    let rem = 0
    for (const ch of s.slice(4) + s.slice(0, 4)) {
      for (const d of /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch) rem = (rem * 10 + Number(d)) % 97
    }
    return rem === 1
  }

  /** Pure validator: checks only the fields of the chosen method. */
  export function validatePayment(method: PaymentMethodId, v: PaymentValues): Record<string, string> {
    // Pure, so the same rules can run again on your server; never trust the browser alone.
    const e: Record<string, string> = {}
    if (method === 'card') {
      if (v.card.replace(/\D/g, '').length < 15) e.card = 'Enter the full card number.'
      if (!/^(0[1-9]|1[0-2])\/\d\d$/.test(v.expiry)) e.expiry = 'Use MM/YY.'
      if (!/^\d{3,4}$/.test(v.cvc)) e.cvc = '3 or 4 digits.'
    } else if (method === 'wallet') {
      if (!v.phoneParts?.national || !v.phoneParts.valid) e.phone = 'Enter the phone number linked to Wallet pay.'
    } else if (method === 'bank') {
      if (!v.holder.trim()) e.holder = 'Enter the account holder.'
      if (!ibanValid(v.iban)) e.iban = 'This IBAN does not check out. Copy it from your bank statement.'
    } else {
      if (!v.company.trim()) e.company = 'Enter the registered company name.'
      if (!/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(compact(v.vat).replace(/[.-]/g, ''))) e.vat = 'Enter a VAT number with its country prefix, like DE123456789.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.billingEmail.trim())) e.billingEmail = 'Enter the address that receives invoices.'
      if (!v.country) e.country = 'Choose a country.'
    }
    return e
  }

  function describe(method: PaymentMethodId, v: PaymentValues): string {
    if (method === 'card') return `Card ending ${v.card.replace(/\D/g, '').slice(-4)}`
    if (method === 'wallet') return `Wallet pay on ${v.phoneParts?.dial} ${v.phoneParts?.national}`
    if (method === 'bank') return `Bank transfer from ${compact(v.iban).slice(0, 4)} ... ${compact(v.iban).slice(-4)}`
    return `Invoice to ${v.company.trim()}, net 30`
  }

  export function createPaymentMethods(opts: PaymentOptions = {}) {
    // Sample methods stand in when the app passes none; switching method clears the errors.
    const methods = opts.methods ?? SAMPLE_METHODS
    const { method: initialMethod, ...initialValues } = opts.initial ?? {}
    let method = $state<PaymentMethodId>(initialMethod ?? methods[0]?.value ?? METHOD_IDS[0])
    const values = $state<PaymentValues>({
      card: '', expiry: '', cvc: '', saveCard: true, phone: '', phoneParts: null, holder: '', iban: '',
      company: '', vat: '', country: 'DE', billingEmail: '', po: '', ...initialValues,
    })
    let attempted = $state(false)
    let busy = $state(false)
    let saved = $state('')

    const errors = $derived(attempted ? validatePayment(method, values) : {})
    const current = $derived(methods.find((m) => m.value === method))

    function choose(v: string | number) {
      const m = methods.find((x) => x.value === v)
      if (!m || m.value === method) return
      method = m.value
      attempted = false
      saved = ''
    }

    const group = createRadioGroup({ options: () => methods, value: () => method, onChange: choose, ariaLabel: () => 'Payment method' })

    async function submit(ev?: Event): Promise<boolean> {
      ev?.preventDefault()
      if (busy) return false
      attempted = true
      if (Object.keys(validatePayment(method, values)).length) return false
      busy = true
      const label = describe(method, values)
      try {
        await opts.onSave?.(method, { ...values }, label)
        saved = label
        return true
      } catch {
        return false
      } finally {
        busy = false
      }
    }

    return {
      methods,
      values,
      get method() { return method },
      set method(v: PaymentMethodId) { choose(v) },
      get current() { return current },
      get errors() { return errors },
      get busy() { return busy },
      /** One-line summary of the last saved method, or ''. */
      get saved() { return saved },
      submit,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on the element around the method cards (role radiogroup + arrow keys). */
      groupProps: () => group.groupProps(),
      /** Spread on each method card (a <button>). */
      optionProps: (m: PaymentMethod) => group.radioProps(m),
    }
  }
</script>

<script lang="ts">
  import {
    SvMaskedInput, SvCheckBox, SvPhoneInput, SvTextInput, SvCountryInput, SvBadge,
    SvButton, SvToaster, toast,
  } from '@svgrid/grid'

  const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
  const pm = createPaymentMethods({
    // Replace with your request; a thrown error leaves the form as it was.
    onSave: (_m, _v, label) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
        loading: 'Checking payment details...',
        success: `${label} saved. Next: review your order.`,
        error: 'We could not verify these details.',
      }),
  })
  const v = pm.values
  const e = $derived(pm.errors)
</script>

<main class="sv-checkout-methods">
  <form class="sv-checkout-methods-panel" {...pm.formProps()}>
    <header>
      <h1>Payment method</h1>
      <p>Acme Analytics Team plan, 12 seats, billed yearly: <strong>{money.format(2388)}</strong></p>
    </header>

    <div class="sv-checkout-methods-options" {...pm.groupProps()}>
      {#each pm.methods as m (m.value)}
        <button class="sv-checkout-methods-option" {...pm.optionProps(m)}>
          <span class="sv-checkout-methods-icon">{@render icon(m.value)}</span>
          <span class="sv-checkout-methods-text">
            <strong>{m.label} {#if m.business}<SvBadge size="sm" variant="neutral">Business</SvBadge>{/if}</strong>
            <span>{m.desc}</span>
          </span>
          <span class="sv-checkout-methods-dot" aria-hidden="true"></span>
        </button>
      {/each}
    </div>

    <section class="sv-checkout-methods-form" aria-label={`${pm.current?.label} details`}>
      {#if pm.method === 'card'}
        <SvMaskedInput label="Card number" mask="#### #### #### ####" placeholder="1234 1234 1234 1234" bind:value={v.card} block required error={e.card} invalid={!!e.card} />
        <div class="sv-checkout-methods-row">
          <SvMaskedInput label="Expiry" mask="##/##" placeholder="MM/YY" bind:value={v.expiry} block required error={e.expiry} invalid={!!e.expiry} />
          <SvMaskedInput label="CVC" mask="####" placeholder="123" bind:value={v.cvc} block required error={e.cvc} invalid={!!e.cvc} />
        </div>
        <SvCheckBox checked={v.saveCard} onChange={(c) => (v.saveCard = c)}>Use this card for renewals</SvCheckBox>
      {:else if pm.method === 'wallet'}
        <SvPhoneInput label="Phone linked to Wallet pay" country="DE" bind:value={v.phone} block required
          hint="We send an approval request to this phone. It expires in 10 minutes."
          error={e.phone} invalid={!!e.phone} onChange={(_val, parts) => (v.phoneParts = parts)} />
      {:else if pm.method === 'bank'}
        <SvTextInput label="Account holder" autocomplete="name" bind:value={v.holder} block required error={e.holder} invalid={!!e.holder} />
        <SvTextInput label="IBAN" placeholder="DE89 3704 0044 0532 0130 00" bind:value={v.iban} block required
          hint="We debit the amount once and keep no mandate." error={e.iban} invalid={!!e.iban} />
      {:else}
        <SvTextInput label="Company name" autocomplete="organization" bind:value={v.company} block required error={e.company} invalid={!!e.company} />
        <div class="sv-checkout-methods-row">
          <SvTextInput label="VAT number" placeholder="DE123456789" bind:value={v.vat} block required error={e.vat} invalid={!!e.vat} />
          <SvCountryInput label="Country" value={v.country} block required error={e.country} invalid={!!e.country} onChange={(c) => (v.country = c)} />
        </div>
        <SvTextInput label="Invoice email" type="email" placeholder="ap@company.com" bind:value={v.billingEmail} block required error={e.billingEmail} invalid={!!e.billingEmail} />
        <SvTextInput label="PO number (optional)" bind:value={v.po} block />
      {/if}
    </section>

    <div class="sv-checkout-methods-foot">
      <p role="status">{pm.saved ? `Saved: ${pm.saved}` : ''}</p>
      <SvButton type="submit" variant="primary" loading={pm.busy}>Continue</SvButton>
    </div>
  </form>
</main>

{#snippet icon(kind: PaymentMethodId)}
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {#if kind === 'card'}
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" />
    {:else if kind === 'wallet'}
      <rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /><path d="m9.5 10.5 2 2 3-3.5" />
    {:else if kind === 'bank'}
      <path d="M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" />
    {:else}
      <path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h6" />
    {/if}
  </svg>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-checkout-methods {
    display: flex; justify-content: center; width: 100%; box-sizing: border-box; min-height: 560px; padding: 32px 24px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-checkout-methods-panel {
    display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 600px; align-self: flex-start; box-sizing: border-box;
    padding: 28px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); background: var(--sg-bg, #fff);
  }
  .sv-checkout-methods h1 { margin: 0 0 4px; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  .sv-checkout-methods header p { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-checkout-methods header strong { color: var(--sg-fg, #0f172a); font-variant-numeric: tabular-nums; }
  .sv-checkout-methods-options { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .sv-checkout-methods-option {
    display: grid; grid-template-columns: 36px minmax(0, 1fr) 18px; gap: 12px; align-items: start; padding: 14px;
    text-align: start; font: inherit; color: inherit; cursor: pointer; background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
  }
  .sv-checkout-methods-option:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-checkout-methods-option[aria-checked='true'] {
    border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 1px var(--sg-accent, #4f46e5);
    background: color-mix(in srgb, var(--sg-accent, #4f46e5) 6%, var(--sg-bg, #fff));
  }
  .sv-checkout-methods-option:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .sv-checkout-methods-icon {
    display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-checkout-methods-icon svg { display: block; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .sv-checkout-methods-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .sv-checkout-methods-text strong { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
  .sv-checkout-methods-text > span { font-size: 12.5px; line-height: 1.4; color: var(--sg-muted, #64748b); }
  .sv-checkout-methods-dot {
    width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; margin-top: 2px;
    border: 1.5px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff);
  }
  .sv-checkout-methods-option[aria-checked='true'] .sv-checkout-methods-dot { border: 5px solid var(--sg-accent, #4f46e5); }
  .sv-checkout-methods-form { display: flex; flex-direction: column; gap: 14px; padding-top: 18px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-checkout-methods-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .sv-checkout-methods-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sv-checkout-methods-foot p { margin: 0; font-size: 13px; color: var(--sg-success, #16a34a); min-width: 0; }

  @media (max-width: 600px) {
    .sv-checkout-methods { padding: 16px; }
    .sv-checkout-methods-panel { padding: 20px 16px; }
    .sv-checkout-methods-options, .sv-checkout-methods-row { grid-template-columns: minmax(0, 1fr); }
    .sv-checkout-methods-foot { flex-direction: column-reverse; align-items: stretch; }
  }
</style>
