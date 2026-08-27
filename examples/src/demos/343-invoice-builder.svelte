<script lang="ts">
  /**
   * Invoice builder - an adornment-heavy money form composed from the UI kit.
   * Foregrounds frame input adornments (currency prefix, % suffix, masked tax id),
   * SvPopconfirm on line-item delete, live SvStat totals, SvHoverCard on the tax
   * hint, and a promise toast when the invoice is sent.
   */
  import {
    SvTextInput, SvNumberInput, SvMaskedInput, SvButton, SvCard, SvStat, SvBadge,
    SvHoverCard, SvPopconfirm, SvSwitchButton, SvDivider, SvToaster, toast,
  } from '@svgrid/grid'

  let client = $state('Globex Corporation')
  let taxId = $state('12-3456789')
  let taxRate = $state(8.5)
  let discount = $state(0)
  let sendCopy = $state(true)

  type Line = { id: number; desc: string; qty: number; price: number }
  let lines = $state<Line[]>([
    { id: 1, desc: 'Design retainer', qty: 1, price: 4800 },
    { id: 2, desc: 'Engineering (hours)', qty: 40, price: 145 },
    { id: 3, desc: 'Cloud hosting', qty: 3, price: 220 },
  ])
  let seq = 3

  const lineTotal = (l: Line) => l.qty * l.price
  const subtotal = $derived(lines.reduce((s, l) => s + lineTotal(l), 0))
  const discounted = $derived(subtotal * (1 - (discount || 0) / 100))
  const tax = $derived(discounted * (taxRate || 0) / 100)
  const total = $derived(discounted + tax)
  const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  function addLine() { lines = [...lines, { id: ++seq, desc: 'New item', qty: 1, price: 0 }] }
  function removeLine(l: Line) {
    lines = lines.filter((x) => x.id !== l.id)
    toast('Removed line', { action: { label: 'Undo', onClick: () => { lines = [...lines, l].sort((a, b) => a.id - b.id) } } })
  }
  function send() {
    toast.promise(
      new Promise((res) => setTimeout(res, 1000)),
      { loading: `Sending invoice to ${client}...`, success: `Invoice sent (${money(total)})`, error: 'Send failed' },
    )
  }
</script>

<div class="wrap">
  <header class="head">
    <div>
      <h2>New invoice <SvBadge variant="warning">Draft</SvBadge></h2>
      <p class="muted">Invoice #INV-2043 - due in 30 days</p>
    </div>
    <div class="head-actions">
      <SvButton variant="ghost">Preview</SvButton>
      <SvButton variant="primary" onclick={send}>Send invoice</SvButton>
    </div>
  </header>

  <div class="cols">
    <div class="main">
      <SvCard title="Bill to">
        <div class="grid2">
          <SvTextInput label="Client" bind:value={client} block>
            {#snippet leading()}<span class="ic">🏢</span>{/snippet}
          </SvTextInput>
          <SvMaskedInput label="Tax ID" bind:value={taxId} mask="##-#######" block>
            {#snippet leading()}<span class="ic">#</span>{/snippet}
          </SvMaskedInput>
        </div>
      </SvCard>

      <SvCard title="Line items">
        <div class="lines">
          <div class="lrow lhead">
            <span>Description</span><span class="num">Qty</span><span class="num">Unit price</span><span class="num">Amount</span><span></span>
          </div>
          {#each lines as l (l.id)}
            <div class="lrow">
              <SvTextInput bind:value={l.desc} block />
              <SvNumberInput bind:value={l.qty} min={0} width={78} />
              <SvNumberInput bind:value={l.price} min={0} prefix="$" grouping width={120} />
              <span class="amount">{money(lineTotal(l))}</span>
              <SvPopconfirm title="Delete line?" confirmLabel="Delete" confirmVariant="danger" onConfirm={() => removeLine(l)}>
                {#snippet anchor()}<SvButton size="sm" variant="ghost" ariaLabel="Delete line">✕</SvButton>{/snippet}
              </SvPopconfirm>
            </div>
          {/each}
        </div>
        <SvButton size="sm" variant="outline" onclick={addLine}>+ Add line</SvButton>
      </SvCard>
    </div>

    <aside class="side">
      <SvCard title="Summary">
        <div class="adjust">
          <SvNumberInput label="Discount" bind:value={discount} min={0} max={100} suffix="%" width={110} />
          <span class="tax-lab">
            Tax rate
            <SvHoverCard placement="top">
              {#snippet anchor()}<button class="info">?</button>{/snippet}
              <div class="muted" style="max-width:200px">Sales tax applied after any discount. Set 0% for tax-exempt clients.</div>
            </SvHoverCard>
          </span>
          <SvNumberInput bind:value={taxRate} min={0} max={30} step={0.5} precision={1} suffix="%" width={110} />
        </div>
        <SvDivider />
        <dl class="totals">
          <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          {#if discount > 0}<div><dt>Discount</dt><dd>-{money(subtotal - discounted)}</dd></div>{/if}
          <div><dt>Tax ({taxRate}%)</dt><dd>{money(tax)}</dd></div>
        </dl>
        <SvDivider />
        <SvStat label="Total due" value={money(total)} hint={`${lines.length} items`} />
        <div class="copy">
          <span>Email me a copy</span><SvSwitchButton checked={sendCopy} onChange={(v) => (sendCopy = v)} />
        </div>
      </SvCard>
    </aside>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 16px; max-width: 900px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .head h2 { margin: 0; font-size: 19px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; }
  .head-actions { display: flex; gap: 8px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13px; margin: 3px 0 0; }
  .cols { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
  .main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .lines { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .lrow { display: grid; grid-template-columns: 1fr 78px 120px 90px 32px; gap: 10px; align-items: center; }
  .lhead { font-size: 11.5px; font-weight: 600; color: var(--sg-muted, #64748b); text-transform: uppercase; letter-spacing: 0.03em; }
  .lrow .num { text-align: end; }
  .amount { text-align: end; font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13px; }
  .side { position: sticky; top: 12px; }
  .adjust { display: flex; flex-direction: column; gap: 10px; }
  .tax-lab { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .info { width: 17px; height: 17px; border-radius: 50%; border: 0; background: var(--sg-row-hover-bg, #eef2f7); color: var(--sg-muted, #64748b); font-size: 11px; cursor: pointer; }
  .totals { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .totals div { display: flex; justify-content: space-between; font-size: 13px; }
  .totals dt { color: var(--sg-muted, #64748b); margin: 0; }
  .totals dd { margin: 0; font-variant-numeric: tabular-nums; }
  .copy { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 13px; }

  /* Mobile: the line row's fixed tracks (78 + 120 + 90 + 32) plus four 10px
     gaps need 360px, which is more than the ~304px a phone gives the card - so
     the description column collapsed to nothing and the row-action button hung
     off the edge. Tighten the tracks and the gap to fit, keeping all five
     columns so the row still reads as an invoice line. */
  @media (max-width: 767px) {
    .lrow {
      grid-template-columns: minmax(0, 1fr) 44px 64px 56px 32px;
      gap: 6px;
    }
  }
</style>
