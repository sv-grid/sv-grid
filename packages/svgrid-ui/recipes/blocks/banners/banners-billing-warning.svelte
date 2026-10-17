<script lang="ts" module>
  /**
   * Billing warning banner block - a failed-payment banner at the top of an
   * app: the invoice that bounced, an SvBadge counting the days left before
   * the workspace is suspended, and an Update payment method SvButton. That
   * opens an SvModal with a card form of three SvMaskedInputs (card number
   * with a checksum test, expiry, CVC) and an SvTextInput for the name, each
   * validated on save. A saved card retries the charge and turns the banner
   * into a success state; an SvToaster toast confirms. Pure UI-kit, --sg-* themed.
   *
   * Headless: createBillingWarning() below owns the banner state, the card
   * form's values, its validation (Luhn checksum, expiry, CVC) and the
   * save-and-pay flow with no markup. The component under it is one styled
   * render of that core; import createBillingWarning from this file (or
   * `npx @svgrid/ui add banners-billing-warning --headless` for the core
   * alone) to draw your own.
   */
  export type BillingStatus = 'failed' | 'paid' | 'hidden'
  export type FailedInvoice = {
    number: string; amountCents: number; description: string
    /** The card that was declined, as shown to the user. */
    declinedCard: string
    daysLeft: number; deadline: string
  }
  export type CardValues = { name: string; card: string; expiry: string; cvc: string }
  export type CardErrors = Record<keyof CardValues, string>
  export type BillingWarningOptions = {
    invoice?: FailedInvoice
    status?: BillingStatus
    currency?: string
    locale?: string
    /** Tokenize the card and retry the invoice; throw (or reject) to keep the form open. */
    onSave?: (card: CardValues, invoice: FailedInvoice) => Promise<void> | void
    onPaid?: (last4: string, invoice: FailedInvoice) => void
  }

  const SAMPLE_INVOICE: FailedInvoice = {
    number: 'INV-2041', amountCents: 34800, description: 'Team plan, 6 seats, Oct 2026',
    declinedCard: 'Visa ending 0119', daysLeft: 6, deadline: 'Oct 21',
  }

  const digits = (s: string) => s.replace(/\D/g, '')

  // Luhn checksum: catches most typos in a card number before the processor does.
  function luhn(num: string) {
    let sum = 0
    for (let i = 0; i < num.length; i++) {
      let d = Number(num[num.length - 1 - i])
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
      sum += d
    }
    return sum % 10 === 0
  }

  function expiryError(v: string) {
    const d = digits(v)
    if (d.length < 4) return 'Enter the expiry as MM/YY'
    const month = Number(d.slice(0, 2))
    const year = 2000 + Number(d.slice(2))
    if (month < 1 || month > 12) return 'Month must be 01 to 12'
    const now = new Date()
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'This card has expired'
    return ''
  }

  export function createBillingWarning(opts: BillingWarningOptions = {}) {
    const invoice = opts.invoice ?? SAMPLE_INVOICE
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let status = $state<BillingStatus>(opts.status ?? 'failed')
    let open = $state(false)
    let saving = $state(false)
    let tried = $state(false)
    let name = $state('')
    let card = $state('')
    let expiry = $state('')
    let cvc = $state('')

    const errors = $derived<CardErrors>({
      name: name.trim() ? '' : 'Enter the name on the card',
      card: digits(card).length < 16 ? 'Enter all 16 digits' : luhn(digits(card)) ? '' : 'This card number is not valid',
      expiry: expiryError(expiry),
      cvc: digits(cvc).length < 3 ? 'Enter the 3-digit code' : '',
    })
    const valid = $derived(!errors.name && !errors.card && !errors.expiry && !errors.cvc)
    /** Errors to show: none until the first save attempt. */
    const shownErrors = $derived<Partial<CardErrors>>(tried ? errors : {})

    function openForm() {
      name = ''; card = ''; expiry = ''; cvc = ''; tried = false
      open = true
    }

    async function save(ev?: Event) {
      ev?.preventDefault()
      tried = true
      if (!valid || saving) return
      saving = true
      try {
        await opts.onSave?.({ name: name.trim(), card: digits(card), expiry, cvc }, invoice)
        open = false
        status = 'paid'
        opts.onPaid?.(digits(card).slice(-4), invoice)
      } finally {
        saving = false
      }
    }

    return {
      invoice,
      amount: money.format(invoice.amountCents / 100),
      get status() { return status },
      get open() { return open },
      set open(v: boolean) { open = v },
      get saving() { return saving },
      get name() { return name },
      set name(v: string) { name = v },
      get card() { return card },
      set card(v: string) { card = v },
      get expiry() { return expiry },
      set expiry(v: string) { expiry = v },
      get cvc() { return cvc },
      set cvc(v: string) { cvc = v },
      get errors() { return shownErrors },
      get tried() { return tried },
      get valid() { return valid },
      get last4() { return digits(card).slice(-4) },
      openForm,
      save,
      cancel: () => { open = false },
      dismiss: () => { status = 'hidden' },
      /** Show the failed state again (demo reset, or a new failed charge). */
      showWarning: () => { status = 'failed' },
      /** Spread on the card <form>. */
      formProps: () => ({ novalidate: true, onsubmit: save }),
      /** Spread on the banner's wrapper: an alert while the payment is failed. */
      bannerProps: () => (status === 'failed' ? { role: 'alert' as const } : { role: 'status' as const }),
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvButton, SvMaskedInput, SvModal, SvTextInput, SvToaster, toast } from '@svgrid/grid'

  const billing = createBillingWarning({
    // Replace with your payment provider's tokenize call and an invoice retry.
    onSave: () => new Promise((res) => setTimeout(res, 1200)),
    onPaid: (last4, inv) => toast.success(`Card ending ${last4} saved. ${inv.number} paid.`),
  })
  const inv = billing.invoice
</script>

<div class="sv-bn-billing">
  <div class="sv-bn-billing-app">
    {#if billing.status === 'failed'}
      <section class="sv-bn-billing-banner sv-bn-billing-is-danger" {...billing.bannerProps()} aria-labelledby="sv-bn-billing-title">
        <span class="sv-bn-billing-icon" aria-hidden="true">!</span>
        <div class="sv-bn-billing-text">
          <p class="sv-bn-billing-title" id="sv-bn-billing-title">Payment failed for invoice {inv.number} ({billing.amount}) <SvBadge variant="danger" size="sm">{inv.daysLeft} days left</SvBadge></p>
          <p>Your bank declined the {inv.declinedCard}. Update the card before {inv.deadline} or the workspace becomes read-only.</p>
        </div>
        <div class="sv-bn-billing-actions">
          <SvButton variant="ghost" size="sm" onclick={() => toast(`${inv.number}: ${inv.description}`)}>View invoice</SvButton>
          <SvButton variant="primary" size="sm" onclick={billing.openForm}>Update payment method</SvButton>
        </div>
      </section>
    {:else if billing.status === 'paid'}
      <section class="sv-bn-billing-banner sv-bn-billing-is-success" {...billing.bannerProps()} aria-labelledby="sv-bn-billing-ok">
        <span class="sv-bn-billing-icon" aria-hidden="true">&check;</span>
        <div class="sv-bn-billing-text">
          <p class="sv-bn-billing-title" id="sv-bn-billing-ok">Payment received</p>
          <p>{inv.number} is paid with the card ending {billing.last4}. Nothing else to do.</p>
        </div>
        <button type="button" class="sv-bn-billing-x" aria-label="Dismiss" onclick={billing.dismiss}>&times;</button>
      </section>
    {/if}

    <main class="sv-bn-billing-page">
      <div class="sv-bn-billing-head">
        <h2>Acme Analytics</h2>
        {#if billing.status !== 'failed'}
          <SvButton variant="outline" size="sm" onclick={billing.showWarning}>Show warning again</SvButton>
        {/if}
      </div>
      <div class="sv-bn-billing-grid" aria-hidden="true">
        {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="sv-bn-billing-cell"><i class="sv-bn-billing-a"></i><i class="sv-bn-billing-b"></i></div>{/each}
      </div>
    </main>
  </div>
</div>

<SvModal bind:open={billing.open} title="Update payment method" width={440}>
  <form class="sv-bn-billing-form" {...billing.formProps()}>
    <SvTextInput label="Name on card" bind:value={billing.name} block required autocomplete="cc-name" error={billing.errors.name || undefined} invalid={!!billing.errors.name} />
    <SvMaskedInput label="Card number" mask="#### #### #### ####" placeholder="1234 5678 9012 3456" bind:value={billing.card} block required
      error={billing.errors.card || undefined} invalid={!!billing.errors.card} hint={billing.tried ? undefined : 'Test card: 4242 4242 4242 4242'} />
    <div class="sv-bn-billing-pair">
      <SvMaskedInput label="Expiry" mask="##/##" placeholder="MM/YY" bind:value={billing.expiry} block required error={billing.errors.expiry || undefined} invalid={!!billing.errors.expiry} />
      <SvMaskedInput label="CVC" mask="###" placeholder="123" bind:value={billing.cvc} block required error={billing.errors.cvc || undefined} invalid={!!billing.errors.cvc} />
    </div>
    <p class="sv-bn-billing-note">We retry {inv.number} ({billing.amount}) on this card as soon as you save.</p>
  </form>
  {#snippet footer()}
    <SvButton variant="ghost" onclick={billing.cancel} disabled={billing.saving}>Cancel</SvButton>
    <SvButton variant="primary" loading={billing.saving} onclick={billing.save}>Save and pay {billing.amount}</SvButton>
  {/snippet}
</SvModal>

<SvToaster position="bottom-right" />

<style>
  .sv-bn-billing {
    width: 100%; box-sizing: border-box; padding: 32px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-bn-billing-app {
    max-width: 960px; min-height: 440px; margin: 0 auto; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-bn-billing-banner {
    --_c: var(--sg-danger, #dc2626);
    display: flex; align-items: center; gap: 14px; padding: 14px 16px 14px 18px;
    border-bottom: 1px solid color-mix(in srgb, var(--_c) 35%, var(--sg-border, #e2e8f0));
    background: color-mix(in srgb, var(--_c) 10%, var(--sg-bg, #fff));
  }
  .sv-bn-billing-banner.sv-bn-billing-is-success { --_c: var(--sg-success, #16a34a); }
  .sv-bn-billing-icon {
    flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
    background: var(--_c); color: #fff; font-weight: 800; font-size: 15px;
  }
  .sv-bn-billing-text { flex: 1; min-width: 0; }
  .sv-bn-billing-title { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 3px; font-size: 14px; font-weight: 650; }
  .sv-bn-billing-text p:not(.sv-bn-billing-title) { margin: 0; font-size: 13px; line-height: 1.5; color: color-mix(in srgb, var(--sg-fg, #0f172a) 80%, transparent); }
  .sv-bn-billing-actions { flex: none; display: flex; gap: 8px; }
  .sv-bn-billing-x { flex: none; width: 28px; height: 28px; border: 0; border-radius: 6px; background: none; color: var(--sg-muted, #64748b); font-size: 18px; cursor: pointer; }
  .sv-bn-billing-x:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); color: var(--sg-fg, #0f172a); }

  .sv-bn-billing-page { padding: 24px 20px; }
  .sv-bn-billing-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
  .sv-bn-billing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .sv-bn-billing-cell { display: flex; flex-direction: column; gap: 10px; height: 96px; padding: 14px; box-sizing: border-box; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); }
  .sv-bn-billing-cell i { display: block; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 10%, var(--sg-bg, #fff)); }
  .sv-bn-billing-cell i.sv-bn-billing-a { width: 45%; } .sv-bn-billing-cell i.sv-bn-billing-b { width: 75%; height: 18px; }

  .sv-bn-billing-form { display: flex; flex-direction: column; gap: 14px; }
  .sv-bn-billing-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .sv-bn-billing-note { margin: 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }

  @media (max-width: 720px) {
    .sv-bn-billing { padding: 16px 12px; }
    .sv-bn-billing-banner { flex-wrap: wrap; align-items: flex-start; padding: 14px; }
    .sv-bn-billing-text { flex-basis: calc(100% - 42px); }
    .sv-bn-billing-actions { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
    .sv-bn-billing-page { padding: 18px 14px; }
    .sv-bn-billing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
