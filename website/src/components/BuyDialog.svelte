<script lang="ts">
  /**
   * Themed checkout modal for a sv-grid-pro PayPal subscription.
   *
   * Flow:
   *   1. User clicks "Buy" on a Pro tier in Pricing.svelte
   *   2. Modal opens with planKey + price scoped to that tier
   *   3. User picks a developer count (drives PayPal quantity)
   *   4. User fills in name / email + optional company / VAT
   *   5. Live total updates: pricePerDev × developers / year
   *   6. PayPal subscribe button activates once name + email are valid
   *   7. On approval the modal swaps to a confirmation panel that shows
   *      the subscription ID and a pre-filled mailto: to sales for license
   *      key issuance.
   */
  import { onMount } from 'svelte'
  import PayPalButton from './PayPalButton.svelte'
  import { PAYPAL_PLAN_IDS, type PayPalApproveData } from '../lib/paypal'
  import { funnel } from '../lib/analytics'

  export type SubscriberForm = {
    firstName: string
    lastName: string
    email: string
    company: string
    vat: string
  }
  export type ConfirmedSubscription = { id: string; form: SubscriberForm; quantity: number }

  type Props = {
    open: boolean
    planKey: keyof typeof PAYPAL_PLAN_IDS | null
    /** The plan's per-developer / per-year price in whole USD. */
    pricePerDev: number
    /** Human-readable license name, shown in the modal header + mailto. */
    licenseLabel: string
    /** Bound: per-tier form state owned by the parent so it survives modal close/open. */
    form: SubscriberForm
    /** Bound: per-tier quantity (developers). */
    quantity: number
    /** A prior confirmed subscription for this tier, if any. */
    confirmed?: ConfirmedSubscription
    onClose: () => void
    onSubscribe: (data: PayPalApproveData) => void
  }

  let {
    open,
    planKey,
    pricePerDev,
    licenseLabel,
    form = $bindable(),
    quantity = $bindable(),
    confirmed,
    onClose,
    onSubscribe,
  }: Props = $props()

  // Email gate: presence of "@" + a "." after it. PayPal's checkout
  // re-validates server-side; this just stops obvious junk.
  function isValidEmail(value: string): boolean {
    const v = value.trim()
    const at = v.indexOf('@')
    return at > 0 && v.lastIndexOf('.') > at + 1 && v.length - at > 3
  }
  const ready = $derived(
    form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      isValidEmail(form.email) &&
      quantity >= 1,
  )

  const total = $derived(pricePerDev * Math.max(1, quantity))
  const totalFormatted = $derived(
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(total),
  )

  // Funnel: fire "Checkout Started" once per open, when the buyer reaches a
  // valid form (the pay step). Resets when the dialog closes.
  let checkoutTracked = $state(false)
  $effect(() => {
    if (!open) {
      checkoutTracked = false
      return
    }
    if (ready && planKey && !checkoutTracked) {
      checkoutTracked = true
      funnel.checkoutStarted(planKey)
    }
  })

  function clamp(n: number): number {
    if (!Number.isFinite(n)) return 1
    return Math.max(1, Math.min(9999, Math.floor(n)))
  }
  function step(delta: number) {
    quantity = clamp(quantity + delta)
  }
  function onQuantityInput(e: Event) {
    const raw = Number((e.target as HTMLInputElement).value)
    quantity = clamp(raw)
  }

  // Esc closes the modal. Add at the document level so input focus doesn't
  // steal the key event.
  $effect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    // Prevent the page behind from scrolling while the modal is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  })

  // Focus the first input on open so keyboard users can start typing.
  let firstNameInput: HTMLInputElement | null = $state(null)
  $effect(() => {
    if (open && firstNameInput && !confirmed) {
      // Wait a tick so the modal is in the DOM before focus.
      queueMicrotask(() => firstNameInput?.focus())
    }
  })

  let copied = $state(false)
  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      copied = true
      setTimeout(() => (copied = false), 1800)
    } catch {
      // ignore
    }
  }

  function buildMailto(sub: ConfirmedSubscription): string {
    const lines = [
      `Hello jQWidgets sales,`,
      ``,
      `I just subscribed to sv-grid-pro and would like to receive my license key.`,
      ``,
      `Plan: ${licenseLabel}`,
      `Developers: ${sub.quantity}`,
      `PayPal subscription ID: ${sub.id}`,
      `Name: ${sub.form.firstName} ${sub.form.lastName}`,
      `Email: ${sub.form.email}`,
      ...(sub.form.company.trim() ? [`Company: ${sub.form.company}`] : []),
      ...(sub.form.vat.trim() ? [`VAT: ${sub.form.vat}`] : []),
      ``,
      `Thank you.`,
    ]
    return `mailto:sales@jqwidgets.com?subject=${encodeURIComponent(
      'sv-grid-pro license request',
    )}&body=${encodeURIComponent(lines.join('\n'))}`
  }

  // Click-through on the backdrop only - clicks inside the panel
  // shouldn't dismiss.
  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  onMount(() => {})
</script>

{#if open && planKey}
  <div
    class="modal-backdrop"
    onclick={onBackdropClick}
    role="presentation"
  >
    <div
      class="modal-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-dialog-title"
    >
      <header class="modal-header">
        <div>
          <p class="modal-eyebrow">sv-grid-pro</p>
          <h2 id="buy-dialog-title" class="modal-title">{licenseLabel}</h2>
        </div>
        <button
          type="button"
          class="modal-close"
          onclick={onClose}
          aria-label="Close checkout"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="modal-body">
        {#if confirmed}
          <!-- Post-purchase confirmation -->
          <div class="confirm-banner">
            <div class="confirm-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <p class="confirm-title">License confirmed</p>
              <p class="confirm-sub">PayPal sent us your billing info. Forward the details below
                to sales for license-key issuance - we reply within one business day. Your license
                is perpetual; the yearly renewal keeps updates and support active and you can cancel
                any time.</p>
            </div>
          </div>

          <dl class="confirm-grid">
            <dt>Plan</dt><dd>{licenseLabel}</dd>
            <dt>Developers</dt><dd>{confirmed.quantity}</dd>
            <dt>Name</dt><dd>{confirmed.form.firstName} {confirmed.form.lastName}</dd>
            <dt>Email</dt><dd>{confirmed.form.email}</dd>
            {#if confirmed.form.company.trim()}
              <dt>Company</dt><dd>{confirmed.form.company}</dd>
            {/if}
            {#if confirmed.form.vat.trim()}
              <dt>VAT</dt><dd>{confirmed.form.vat}</dd>
            {/if}
          </dl>

          <label class="block">
            <span class="modal-label">PayPal subscription ID</span>
            <div class="modal-id-row">
              <code class="modal-id" title={confirmed.id}>{confirmed.id}</code>
              <button
                type="button"
                onclick={() => copy(confirmed.id)}
                class="modal-copy"
              >
                {#if copied}Copied{:else}Copy{/if}
              </button>
            </div>
          </label>

          <a
            href={buildMailto(confirmed)}
            class="modal-btn modal-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Email sales for license key →
          </a>
        {:else}
          <!-- Quantity stepper -->
          <div class="modal-row">
            <div>
              <p class="modal-label">Developers</p>
              <p class="modal-help">One seat per engineer that imports sv-grid-pro.</p>
            </div>
            <div class="qty-stepper">
              <button
                type="button"
                class="qty-btn"
                onclick={() => step(-1)}
                disabled={quantity <= 1}
                aria-label="Decrease developer count"
              >−</button>
              <input
                type="number"
                class="qty-input"
                min="1"
                max="9999"
                step="1"
                value={quantity}
                oninput={onQuantityInput}
                aria-label="Developer count"
              />
              <button
                type="button"
                class="qty-btn"
                onclick={() => step(1)}
                aria-label="Increase developer count"
              >+</button>
            </div>
          </div>

          <!-- Subscriber form -->
          <div class="modal-grid">
            <label class="block">
              <span class="modal-label">
                First name <span class="modal-required" aria-hidden="true">*</span>
              </span>
              <input
                type="text"
                class="modal-input"
                placeholder="Ada"
                autocomplete="given-name"
                bind:value={form.firstName}
                bind:this={firstNameInput}
              />
            </label>
            <label class="block">
              <span class="modal-label">
                Last name <span class="modal-required" aria-hidden="true">*</span>
              </span>
              <input
                type="text"
                class="modal-input"
                placeholder="Lovelace"
                autocomplete="family-name"
                bind:value={form.lastName}
              />
            </label>
            <label class="block modal-col-span-2">
              <span class="modal-label">
                Work email <span class="modal-required" aria-hidden="true">*</span>
              </span>
              <input
                type="email"
                class="modal-input"
                placeholder="ada@example.com"
                autocomplete="email"
                bind:value={form.email}
              />
            </label>
            <label class="block">
              <span class="modal-label">
                Company <span class="modal-optional">(optional)</span>
              </span>
              <input
                type="text"
                class="modal-input"
                placeholder="Acme Inc."
                autocomplete="organization"
                bind:value={form.company}
              />
            </label>
            <label class="block">
              <span class="modal-label">
                VAT / Tax ID <span class="modal-optional">(optional)</span>
              </span>
              <input
                type="text"
                class="modal-input"
                placeholder="EU123456789"
                bind:value={form.vat}
              />
            </label>
          </div>

          <!-- Total -->
          <div class="modal-total">
            <div>
              <p class="modal-total-line">
                {quantity} × ${pricePerDev} / dev / year
              </p>
              <p class="modal-total-help">
                Perpetual license + 1 year of updates &amp; support. Renews annually via PayPal;
                cancel any time and keep your paid-term versions.
              </p>
            </div>
            <div class="modal-total-amount">
              <span class="modal-total-big">{totalFormatted}</span>
              <span class="modal-total-cadence">/ year</span>
            </div>
          </div>

          <!-- PayPal checkout panel. PayPal Buttons render with their own
               light iframe chrome - putting that directly on the dark modal
               looks like a mismatched paste. Wrapping it in an intentional
               light card with a "Pay securely" header turns the colour
               shift into a designed surface, the same pattern Stripe /
               Paddle / Lemon Squeezy use. -->
          <div class="checkout-card" class:checkout-gated={!ready}>
            <div class="checkout-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Pay securely</span>
              <span class="checkout-head-spacer"></span>
              <span class="checkout-amount">{totalFormatted}/yr</span>
            </div>

            <div class="checkout-body" aria-disabled={!ready}>
              <PayPalButton
                planId={PAYPAL_PLAN_IDS[planKey]}
                planLabel={licenseLabel}
                fallbackHref="mailto:sales@jqwidgets.com"
                {quantity}
                subscriberDetails={{
                  firstName: form.firstName,
                  lastName: form.lastName,
                  email: form.email,
                  company: form.company,
                  vat: form.vat,
                }}
                onSubscribe={onSubscribe}
              />
            </div>

            <p class="checkout-foot">
              Perpetual license · secure annual billing by PayPal · cancel any time
            </p>
          </div>
          {#if !ready}
            <p class="modal-gate-hint">
              Fill in first name, last name, and a valid email to unlock checkout.
            </p>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ---------- Backdrop + panel ------------------------------------------- */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(8, 12, 24, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 5vh 1rem 1rem;
    overflow-y: auto;
    animation: modal-fade-in 160ms ease-out;
  }
  @keyframes modal-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .modal-panel {
    width: 100%;
    max-width: 520px;
    background: var(--sg-header-bg, #1e2433);
    color: var(--sg-fg, #e8ecf6);
    border: 1px solid var(--sg-border, #25324f);
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: modal-slide-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes modal-slide-in {
    from { transform: translateY(10px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.25rem 0.75rem;
    border-bottom: 1px solid var(--sg-border, #25324f);
  }
  .modal-eyebrow {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--site-accent-2, #22d3ee);
  }
  .modal-title {
    margin-top: 0.15rem;
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--sg-fg, #e8ecf6);
  }
  .modal-close {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--sg-border, #25324f);
    background: var(--sg-bg, #181d27);
    color: var(--site-muted, #9aa6c2);
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease;
    flex-shrink: 0;
  }
  .modal-close:hover {
    color: var(--sg-fg, #e8ecf6);
    border-color: var(--site-accent, #3b82f6);
  }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  /* ---------- Quantity stepper ------------------------------------------- */
  .modal-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .qty-stepper {
    display: inline-flex;
    align-items: stretch;
    background: var(--sg-input-bg, #1a2130);
    border: 1px solid var(--sg-input-border, #2c3548);
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .qty-btn {
    width: 36px;
    height: 38px;
    background: transparent;
    border: 0;
    color: var(--sg-fg, #e8ecf6);
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 100ms ease;
  }
  .qty-btn:hover:not(:disabled) {
    background: var(--sg-row-hover-bg, #232b3c);
  }
  .qty-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .qty-input {
    width: 56px;
    height: 38px;
    text-align: center;
    background: transparent;
    border: 0;
    border-left: 1px solid var(--sg-input-border, #2c3548);
    border-right: 1px solid var(--sg-input-border, #2c3548);
    color: var(--sg-fg, #e8ecf6);
    font-size: 0.95rem;
    font-weight: 600;
    font-family: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .qty-input::-webkit-outer-spin-button,
  .qty-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .qty-input:focus {
    outline: none;
  }

  /* ---------- Form ------------------------------------------------------- */
  .modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }
  .modal-col-span-2 {
    grid-column: span 2;
  }
  .modal-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--site-muted, #9aa6c2);
    margin-bottom: 0.25rem;
  }
  .modal-optional {
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.7;
    margin-left: 0.25rem;
  }
  .modal-required {
    color: #f87171;
    margin-left: 0.15rem;
  }
  .modal-input {
    width: 100%;
    height: 38px;
    padding: 0 0.75rem;
    border-radius: 8px;
    background: var(--sg-input-bg, #1a2130);
    color: var(--sg-fg, #e8ecf6);
    border: 1px solid var(--sg-input-border, #2c3548);
    font-size: 0.875rem;
    font-family: inherit;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  .modal-input:focus {
    outline: none;
    border-color: var(--site-accent, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--site-accent, #3b82f6) 28%, transparent);
  }
  .modal-input::placeholder {
    color: var(--site-muted, #9aa6c2);
    opacity: 0.65;
  }
  .modal-help {
    font-size: 0.72rem;
    color: var(--site-muted, #9aa6c2);
    margin-top: 0.1rem;
  }

  /* ---------- Total ------------------------------------------------------ */
  .modal-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    border: 1px solid var(--sg-border, #25324f);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--site-accent, #3b82f6) 8%, transparent),
      color-mix(in srgb, var(--site-accent-2, #22d3ee) 4%, transparent)
    );
  }
  .modal-total-line {
    font-size: 0.78rem;
    color: var(--site-muted, #9aa6c2);
    font-weight: 600;
  }
  .modal-total-help {
    font-size: 0.7rem;
    color: var(--site-muted, #9aa6c2);
    margin-top: 0.1rem;
    line-height: 1.4;
  }
  .modal-total-amount {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .modal-total-big {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--sg-fg, #e8ecf6);
  }
  .modal-total-cadence {
    font-size: 0.75rem;
    color: var(--site-muted, #9aa6c2);
  }

  /* ---------- Checkout (PayPal) card ------------------------------------ */
  .checkout-card {
    /* Slate-50 surface - designed light card on the dark modal. The
     * PayPal Buttons iframe blends into this surface instead of looking
     * like an accidental white block. */
    background: #f8fafc;
    color: #0f172a;
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    padding: 0.85rem 0.95rem 0.75rem;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.03) inset,
      0 6px 16px rgba(0, 0, 0, 0.25);
    transition: opacity 160ms ease, filter 160ms ease;
  }
  .checkout-gated {
    opacity: 0.55;
    filter: grayscale(0.25);
  }
  .checkout-gated .checkout-body {
    pointer-events: none;
  }
  .checkout-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
    padding: 0 0.1rem 0.6rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .checkout-head-spacer {
    flex: 1;
  }
  .checkout-amount {
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
    text-transform: none;
    font-size: 0.78rem;
  }
  .checkout-body {
    padding: 0.7rem 0 0.15rem;
    /* Reserve enough vertical space for PayPal's vertical layout so the
     * card doesn't reflow as the iframe loads. */
    min-height: 110px;
  }
  .checkout-foot {
    font-size: 0.65rem;
    color: #64748b;
    text-align: center;
    margin-top: 0.4rem;
    letter-spacing: 0.01em;
  }
  .modal-gate-hint {
    font-size: 0.72rem;
    color: var(--site-muted, #9aa6c2);
    text-align: center;
    margin-top: -0.25rem;
  }

  /* ---------- Confirmation panel ----------------------------------------- */
  .confirm-banner {
    display: flex;
    gap: 0.7rem;
    padding: 0.85rem;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, #4ade80 55%, var(--sg-border));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #4ade80 12%, transparent),
      color-mix(in srgb, #22d3ee 6%, transparent)
    );
  }
  .confirm-icon {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: color-mix(in srgb, #4ade80 25%, transparent);
    color: #4ade80;
    flex-shrink: 0;
  }
  .confirm-title {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--sg-fg, #e8ecf6);
  }
  .confirm-sub {
    font-size: 0.75rem;
    color: var(--site-muted, #9aa6c2);
    margin-top: 0.2rem;
    line-height: 1.45;
  }
  .confirm-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3rem 1rem;
    font-size: 0.82rem;
  }
  .confirm-grid dt {
    color: var(--site-muted, #9aa6c2);
    font-weight: 500;
  }
  .confirm-grid dd {
    color: var(--sg-fg, #e8ecf6);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .modal-id-row {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
  }
  .modal-id {
    flex: 1;
    padding: 0.5rem 0.7rem;
    border-radius: 8px;
    background: var(--sg-input-bg, #1a2130);
    border: 1px solid var(--sg-input-border, #2c3548);
    color: var(--sg-fg, #e8ecf6);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .modal-copy {
    padding: 0 0.85rem;
    border-radius: 8px;
    background: linear-gradient(
      135deg,
      var(--site-accent, #3b82f6),
      color-mix(in srgb, var(--site-accent-2, #22d3ee) 65%, var(--site-accent, #3b82f6))
    );
    color: #fff;
    border: 1px solid color-mix(in srgb, var(--site-accent, #3b82f6) 60%, transparent);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: filter 120ms ease, transform 80ms ease;
  }
  .modal-copy:hover {
    filter: brightness(1.08);
  }
  .modal-copy:active {
    transform: translateY(1px);
  }

  /* ---------- Buttons ---------------------------------------------------- */
  .modal-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 44px;
    padding: 0 1.25rem;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      filter 120ms ease,
      transform 80ms ease;
  }
  .modal-btn-primary {
    background: linear-gradient(
      135deg,
      var(--site-accent, #3b82f6),
      color-mix(in srgb, var(--site-accent-2, #22d3ee) 60%, var(--site-accent, #3b82f6))
    );
    color: #fff;
  }
  .modal-btn-primary:hover {
    filter: brightness(1.08);
  }
  .modal-btn-primary:active {
    transform: translateY(1px);
  }
</style>
