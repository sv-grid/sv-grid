<script lang="ts" module>
  /**
   * Order confirmation block - the thank-you page after payment: an inline-SVG
   * check mark, the order number with a copy button, a delivery estimate
   * counted in business days from today, the shipping address, a "what happens
   * next" list and the order summary with totals in integer cents. SvButton
   * actions for Track order and Continue shopping, an SvBadge for the order
   * state, toasts for copy and receipt resend. Pure UI-kit, --sg-* themed.
   *
   * Headless: createOrderConfirmation() below owns the order data, totals,
   * delivery window, copy state and receipt resend with no markup. The
   * component under it is one styled render of that core; import
   * createOrderConfirmation from this file (or `npx @svgrid/ui add
   * checkout-confirmation --headless` for the core alone) to draw your own.
   */
  export type ConfirmedLine = { name: string; qty: number; cents: number }
  export type ConfirmedOrder = {
    number: string; firstName: string; email: string; shipTo: string; method: string; cardLast4: string
    items: ConfirmedLine[]; shippingCents: number; taxRate: number
    /** Business days from today until the earliest and latest delivery. */
    deliveryDays: [number, number]
  }
  export type OrderConfirmationOptions = {
    order?: ConfirmedOrder
    currency?: string
    /** Put text on the clipboard (navigator.clipboard.writeText in a browser). */
    writeText?: (text: string) => Promise<void>
    /** Re-send the receipt email; throw to report a failure. */
    onResend?: (order: ConfirmedOrder) => Promise<void> | void
    now?: () => Date
  }

  const SAMPLE_ORDER: ConfirmedOrder = {
    number: 'NW-58210', firstName: 'Ada', email: 'ada@northwind.io',
    shipTo: 'Ada Lovelace, 12 Harbor Lane, Portland, OR 97209', method: 'Standard shipping', cardLast4: '4242',
    items: [
      { name: 'Canvas tote, Olive', qty: 1, cents: 4200 },
      { name: 'Field notebook, 3-pack', qty: 2, cents: 1800 },
      { name: 'Brass pen', qty: 1, cents: 3600 },
    ],
    shippingCents: 595, taxRate: 0.0725, deliveryDays: [3, 5],
  }

  /** `from` plus `n` business days. */
  export function addBusinessDays(from: Date, n: number): Date {
    // Saturday and Sunday are skipped; public holidays are not.
    const d = new Date(from)
    while (n > 0) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) n--
    }
    return d
  }

  export function createOrderConfirmation(opts: OrderConfirmationOptions = {}) {
    // The order is final here; totals and the delivery window are computed once.
    const order = opts.order ?? SAMPLE_ORDER
    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: opts.currency ?? 'USD' })
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const today = (opts.now ?? (() => new Date()))()

    const subtotal = order.items.reduce((s, i) => s + i.cents * i.qty, 0)
    const tax = Math.round(subtotal * order.taxRate)
    const totals = { subtotal, shipping: order.shippingCents, tax, total: subtotal + order.shippingCents + tax }
    const eta = `${day.format(addBusinessDays(today, order.deliveryDays[0]))} - ${day.format(addBusinessDays(today, order.deliveryDays[1]))}`
    const nextSteps = [
      { title: 'Order confirmed', body: `Receipt sent to ${order.email}.`, done: true },
      { title: 'Packed and shipped', body: 'Usually within one business day. You get a tracking link by email.', done: false },
      { title: 'Delivered', body: `Expected ${eta}. No signature needed.`, done: false },
    ]

    let copied = $state(false)
    let resending = $state(false)
    let timer: ReturnType<typeof setTimeout> | undefined

    /** Copies the order number; resolves false when the clipboard refuses. */
    async function copy(): Promise<boolean> {
      try {
        if (!opts.writeText) throw new Error('No clipboard writer')
        await opts.writeText(order.number)
        copied = true
        clearTimeout(timer)
        timer = setTimeout(() => (copied = false), 2000)
        return true
      } catch {
        return false
      }
    }

    async function resend(): Promise<boolean> {
      if (resending) return false
      resending = true
      try {
        await opts.onResend?.(order)
        return true
      } catch {
        return false
      } finally {
        resending = false
      }
    }

    return {
      order,
      totals,
      eta,
      nextSteps,
      get copied() { return copied },
      get resending() { return resending },
      format: (cents: number) => money.format(cents / 100),
      copy,
      resend,
      /** Spread on the copy <button>. */
      copyProps: () => ({ type: 'button' as const, 'aria-label': `Copy order number ${order.number}`, onclick: copy }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const done = createOrderConfirmation({
    writeText: (t) => navigator.clipboard.writeText(t),
    // Replace with your receipt endpoint.
    onResend: (o) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1000)), {
        loading: 'Sending receipt...', success: `Receipt sent to ${o.email}`, error: 'Could not send the receipt',
      }),
  })
  const o = done.order

  async function copyNumber() {
    if (await done.copy()) toast.success(`Copied ${o.number}`)
    else toast.error('Copy failed. Select the number and copy it by hand.')
  }
</script>

<main class="sv-checkout-done">
  <header class="sv-checkout-done-head">
    <svg class="sv-checkout-done-mark" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="26" /><path d="m17 29 7 7 15-16" />
    </svg>
    <h1>Thanks, {o.firstName}. Your order is confirmed.</h1>
    <p>We sent the receipt to {o.email}.
      <button type="button" class="sv-checkout-done-link" disabled={done.resending} onclick={done.resend}>Resend receipt</button></p>
    <div class="sv-checkout-done-number">
      <span>Order <strong>{o.number}</strong></span>
      <button class="sv-checkout-done-copy" {...done.copyProps()} onclick={copyNumber}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {#if done.copied}<path d="m5 12 5 5 9-10" />{:else}<rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />{/if}
        </svg>
        {done.copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  </header>

  <div class="sv-checkout-done-cols">
    <section class="sv-checkout-done-box" aria-labelledby="sv-checkout-done-delivery">
      <div class="sv-checkout-done-row">
        <h2 id="sv-checkout-done-delivery">Delivery</h2>
        <SvBadge variant="success" size="sm" dot>Confirmed</SvBadge>
      </div>
      <p class="sv-checkout-done-eta">{done.eta}</p>
      <p class="sv-checkout-done-muted">{o.method} to {o.shipTo}</p>
      <h3>What happens next</h3>
      <ol class="sv-checkout-done-next">
        {#each done.nextSteps as s, i (s.title)}
          <li class:sv-checkout-done-past={s.done}>
            <span class="sv-checkout-done-step" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
            <span><strong>{s.title}</strong><span>{s.body}</span></span>
          </li>
        {/each}
      </ol>
    </section>

    <section class="sv-checkout-done-box" aria-labelledby="sv-checkout-done-summary">
      <h2 id="sv-checkout-done-summary">Order summary</h2>
      <dl class="sv-checkout-done-totals">
        {#each o.items as item (item.name)}
          <div><dt>{item.name}{item.qty > 1 ? ` x ${item.qty}` : ''}</dt><dd>{done.format(item.cents * item.qty)}</dd></div>
        {/each}
        <div class="sv-checkout-done-sep"><dt>Subtotal</dt><dd>{done.format(done.totals.subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>{done.format(done.totals.shipping)}</dd></div>
        <div><dt>Tax</dt><dd>{done.format(done.totals.tax)}</dd></div>
        <div class="sv-checkout-done-grand"><dt>Paid</dt><dd>{done.format(done.totals.total)}</dd></div>
      </dl>
      <p class="sv-checkout-done-muted">Charged to the card ending {o.cardLast4}</p>
    </section>
  </div>

  <div class="sv-checkout-done-actions">
    <SvButton variant="primary" onclick={() => toast.info('Tracking goes live when the parcel ships. The link comes by email.')}>Track order</SvButton>
    <SvButton variant="outline" onclick={() => toast('Back to the Northwind shop')}>Continue shopping</SvButton>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-checkout-done {
    display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: 820px; margin: 0 auto; box-sizing: border-box;
    min-height: 560px; padding: 40px 24px; color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-checkout-done-head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
  .sv-checkout-done-mark { display: block; width: 56px; height: 56px; margin-bottom: 6px; }
  .sv-checkout-done-mark circle { fill: color-mix(in srgb, var(--sg-success, #16a34a) 14%, transparent); stroke: var(--sg-success, #16a34a); stroke-width: 2; }
  .sv-checkout-done-mark path {
    fill: none; stroke: var(--sg-success, #16a34a); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 36; stroke-dashoffset: 36; animation: sv-checkout-done-draw .5s .15s ease-out forwards;
  }
  @keyframes sv-checkout-done-draw { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { .sv-checkout-done-mark path { animation: none; stroke-dashoffset: 0; } }
  .sv-checkout-done h1 { margin: 0; font-size: 24px; font-weight: 650; letter-spacing: -.01em; }
  .sv-checkout-done h2 { margin: 0; font-size: 15px; font-weight: 650; }
  .sv-checkout-done h3 { margin: 6px 0 0; font-size: 13px; font-weight: 650; }
  .sv-checkout-done-head p { margin: 0; font-size: 14px; color: var(--sg-muted, #64748b); }
  .sv-checkout-done-link { background: none; border: 0; padding: 0; font: inherit; cursor: pointer; color: var(--sg-accent, #4f46e5); }
  .sv-checkout-done-link:hover { text-decoration: underline; }
  .sv-checkout-done-link:disabled { opacity: .6; cursor: default; }
  .sv-checkout-done-number {
    display: inline-flex; align-items: center; gap: 12px; margin-top: 6px; padding: 6px 6px 6px 14px; font-size: 14px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 999px;
  }
  .sv-checkout-done-number strong { font-family: ui-monospace, monospace; letter-spacing: .02em; }
  .sv-checkout-done-copy {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font: inherit; font-size: 12.5px; cursor: pointer;
    color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff));
    border: 0; border-radius: 999px;
  }
  .sv-checkout-done-copy svg { display: block; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-checkout-done-link:focus-visible, .sv-checkout-done-copy:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .sv-checkout-done-cols { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  .sv-checkout-done-box {
    display: flex; flex-direction: column; gap: 10px; padding: 20px; min-width: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); background: var(--sg-bg, #fff);
  }
  .sv-checkout-done-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .sv-checkout-done-eta { margin: 0; font-size: 20px; font-weight: 650; }
  .sv-checkout-done-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); line-height: 1.5; }
  .sv-checkout-done-next { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .sv-checkout-done-next li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; font-size: 13px; }
  .sv-checkout-done-next li > span:last-child { display: flex; flex-direction: column; gap: 2px; }
  .sv-checkout-done-next li > span:last-child > span { color: var(--sg-muted, #64748b); line-height: 1.45; }
  .sv-checkout-done-step {
    display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 650;
    color: var(--sg-muted, #64748b); border: 1.5px solid var(--sg-border, #e2e8f0); box-sizing: border-box;
  }
  .sv-checkout-done-past .sv-checkout-done-step { color: var(--sg-success, #16a34a); border-color: var(--sg-success, #16a34a); }
  .sv-checkout-done-totals { display: flex; flex-direction: column; gap: 8px; margin: 0; font-size: 13.5px; }
  .sv-checkout-done-totals div { display: flex; justify-content: space-between; gap: 12px; }
  .sv-checkout-done-totals dt { color: var(--sg-muted, #64748b); min-width: 0; }
  .sv-checkout-done-totals dd { margin: 0; font-variant-numeric: tabular-nums; }
  .sv-checkout-done-sep { padding-top: 10px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-checkout-done-grand { padding-top: 10px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 16px; font-weight: 650; }
  .sv-checkout-done-grand dt { color: var(--sg-fg, #0f172a); }
  .sv-checkout-done-actions { display: flex; justify-content: center; gap: 10px; }

  @media (max-width: 680px) {
    .sv-checkout-done { padding: 28px 16px; }
    .sv-checkout-done h1 { font-size: 21px; }
    .sv-checkout-done-cols { grid-template-columns: minmax(0, 1fr); }
    .sv-checkout-done-actions { flex-direction: column; }
  }
</style>
