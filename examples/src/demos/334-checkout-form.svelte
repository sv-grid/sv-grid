<script lang="ts">
  /**
   * Checkout form - a real payment form built entirely from the SvGrid UI kit
   * (the same components SvGrid uses to edit cells, composed into a page):
   * SvMaskedInput, SvCountryInput, SvNumberInput, SvSwitchButton, SvButton.
   * Copy this file into your app and wire `pay()` to your payment provider.
   */
  import { SvMaskedInput, SvCountryInput, SvNumberInput, SvSwitchButton, SvButton } from '@svgrid/grid'

  let name = $state('')
  let cardRaw = $state('')
  let expiry = $state('')
  let cvc = $state('')
  let country = $state<string | null>('US')
  let saveCard = $state(true)
  let paid = $state(false)

  const amount = 149

  // Card brand from the leading digits (Visa 4, Mastercard 5, Amex 34/37).
  const brand = $derived(
    /^4/.test(cardRaw) ? 'Visa' : /^5[1-5]/.test(cardRaw) ? 'Mastercard' : /^3[47]/.test(cardRaw) ? 'Amex' : '',
  )
  const cardOk = $derived(cardRaw.length >= 15)
  const expiryOk = $derived(/^\d\d\/\d\d$/.test(expiry))
  const cvcOk = $derived(cvc.length >= 3)
  const canPay = $derived(name.trim().length > 1 && cardOk && expiryOk && cvcOk && !!country)

  function pay() {
    if (!canPay) return
    paid = true
    setTimeout(() => (paid = false), 2200)
  }
</script>

<div class="co">
  <header>
    <h2>Checkout</h2>
    <p>A production-shaped payment form, built only from <code>@svgrid/grid</code> UI components.</p>
  </header>

  <form class="card" onsubmit={(e) => { e.preventDefault(); pay() }}>
    <label class="field">
      <span>Cardholder name</span>
      <input class="txt" bind:value={name} placeholder="Ada Lovelace" autocomplete="cc-name" />
    </label>

    <label class="field">
      <span>Card number {#if brand}<em class="brand">{brand}</em>{/if}</span>
      <SvMaskedInput mask="#### #### #### ####" placeholder="1234 5678 9012 3456" onChange={(_m, raw) => (cardRaw = raw)} />
    </label>

    <div class="row">
      <label class="field">
        <span>Expiry</span>
        <SvMaskedInput mask="##/##" placeholder="MM/YY" onChange={(m) => (expiry = m)} />
      </label>
      <label class="field">
        <span>CVC</span>
        <SvMaskedInput mask="####" placeholder="123" onChange={(_m, raw) => (cvc = raw)} />
      </label>
    </div>

    <label class="field">
      <span>Billing country</span>
      <SvCountryInput value={country} onChange={(c) => (country = c)} />
    </label>

    <label class="switchrow">
      <SvSwitchButton checked={saveCard} onChange={(v) => (saveCard = v)} ariaLabel="Save card for next time" />
      <span>Save this card for next time</span>
    </label>

    <div class="total">
      <span>Total due</span>
      <strong><SvNumberInput value={amount} readonly prefix="$" precision={2} grouping /></strong>
    </div>

    <SvButton variant="primary" size="lg" disabled={!canPay} onclick={pay}>
      {paid ? 'Payment approved ✓' : `Pay $${amount}.00`}
    </SvButton>
    {#if !canPay}<p class="hint">Fill in the card details to enable payment.</p>{/if}
  </form>
</div>

<style>
  .co { padding: 22px; max-width: 460px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .card { display: flex; flex-direction: column; gap: 14px; padding: 20px; min-width: 0; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 14px; background: var(--sg-bg, #fff); box-shadow: 0 1px 2px rgba(15,23,42,0.05); }
  .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .field > span { font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  /* The SvGrid editors wrap in an inline-flex SvField; make them fill the field. */
  .field :global(.sv-field) { display: flex; width: 100%; }
  .brand { font-style: normal; font-size: 11px; font-weight: 700; color: var(--sg-accent, #6366f1); background: color-mix(in srgb, var(--sg-accent, #6366f1) 12%, transparent); padding: 1px 6px; border-radius: 999px; }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .txt { width: 100%; box-sizing: border-box; padding: 8px 11px; font: inherit; font-size: 14px; border: 1px solid var(--sg-input-border, var(--sg-border, #e6e8ec)); border-radius: 9px; background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, inherit); }
  .txt:focus { outline: none; border-color: var(--sg-accent, #6366f1); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #6366f1) 22%, transparent); }
  .switchrow { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .total { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px dashed var(--sg-border, #e6e8ec); font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .total strong { display: inline-flex; width: 140px; flex: none; }
  .total strong :global(.sv-field) { display: flex; width: 100%; }
  .hint { margin: 0; font-size: 12px; color: var(--sg-muted, #94a3b8); }
</style>
