<script lang="ts">
  /**
   * 106. Detail row template (expandable row content)
   * -------------------------------------------------
   * Click the chevron on any order to expand a rich detail row beneath
   * it - line items, shipping events, payment timeline, support thread.
   * The Stripe / GitHub PR pattern. Different from master/detail in
   * that the detail content stays in the row stream rather than opening
   * a separate panel.
   *
   * Implemented entirely user-land: we splice "detail" sentinel rows
   * into the data array right after each expanded row, then render a
   * custom column whose `cellRenderer` produces the full-width detail
   * for sentinel rows and the normal content for real rows. We hide
   * other columns on detail rows via `colspan` simulated with CSS.
   *
   * Real grid-engine support (a `detailTemplate` prop with proper
   * full-row td colspan) is a small library change; this user-land
   * pattern is what we ship to consumers in the meantime.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Status = 'pending' | 'paid' | 'fulfilled' | 'returned' | 'refunded'

  type Order = {
    kind: 'order'
    id: string
    customer: string
    email: string
    status: Status
    placedAt: string
    total: number
    items: number
    detail: OrderDetail
  }
  type DetailRow = {
    kind: 'detail'
    id: string
    parentId: string
    detail: OrderDetail
  }
  type AnyRow = Order | DetailRow

  type OrderDetail = {
    lineItems: { sku: string; name: string; qty: number; price: number }[]
    shipping: { label: string; at: string; status: 'done' | 'now' | 'next' }[]
    payments: { event: string; at: string; amount: number }[]
    supportThread: { from: string; at: string; text: string }[]
  }

  const orders: Order[] = [
    {
      kind: 'order', id: 'ORD-23001', customer: 'Ava Thompson', email: 'ava@thompson.co',
      status: 'paid', placedAt: '2026-06-08 09:14', total: 248.94, items: 3,
      detail: {
        lineItems: [
          { sku: 'NB-A5-DEEP', name: 'Hardcover notebook (A5)', qty: 2, price: 18.50 },
          { sku: 'PEN-CHISEL-2PK', name: 'Calligraphy pens (2-pack)', qty: 1, price: 8.99 },
          { sku: 'TOTE-NAVY-L', name: 'Canvas tote (large, navy)', qty: 1, price: 32.00 },
        ],
        shipping: [
          { label: 'Order placed',          at: '06-08 09:14', status: 'done' },
          { label: 'Payment captured',      at: '06-08 09:14', status: 'done' },
          { label: 'Picking',               at: 'pending',     status: 'now'  },
          { label: 'Shipped',               at: 'pending',     status: 'next' },
        ],
        payments: [
          { event: 'Authorized (Visa ****4242)', at: '06-08 09:14', amount: 248.94 },
          { event: 'Captured',                   at: '06-08 09:14', amount: 248.94 },
        ],
        supportThread: [],
      },
    },
    {
      kind: 'order', id: 'ORD-23002', customer: 'Liam Park', email: 'lpark@vertex.io',
      status: 'fulfilled', placedAt: '2026-06-07 17:31', total: 91.50, items: 2,
      detail: {
        lineItems: [
          { sku: 'MUG-LOGO-12OZ', name: 'Logo mug (12 oz)', qty: 4, price: 14.50 },
          { sku: 'STICKER-PACK',  name: 'Sticker pack (10)', qty: 1, price: 5.00 },
        ],
        shipping: [
          { label: 'Order placed',     at: '06-07 17:31', status: 'done' },
          { label: 'Payment captured', at: '06-07 17:31', status: 'done' },
          { label: 'Picking',          at: '06-07 18:02', status: 'done' },
          { label: 'Shipped',          at: '06-08 08:11', status: 'done' },
          { label: 'Delivered',        at: '06-09 14:24', status: 'done' },
        ],
        payments: [
          { event: 'Authorized (Mastercard ****8821)', at: '06-07 17:31', amount: 91.50 },
          { event: 'Captured',                          at: '06-07 17:32', amount: 91.50 },
        ],
        supportThread: [
          { from: 'Customer', at: '06-08 09:02', text: 'Can you change shipping to a PO box?' },
          { from: 'Agent',    at: '06-08 09:15', text: 'Updated! New label sent. Tracking ZX12345.' },
        ],
      },
    },
    {
      kind: 'order', id: 'ORD-23003', customer: 'Noah Singh', email: 'noah@atlas.trade',
      status: 'returned', placedAt: '2026-06-06 14:02', total: 156.00, items: 5,
      detail: {
        lineItems: [
          { sku: 'BOTTLE-INSU-32', name: 'Insulated bottle (32 oz)', qty: 4, price: 34.00 },
          { sku: 'HAT-BB-NAVY',    name: 'Baseball hat (navy)',      qty: 1, price: 24.00 },
        ],
        shipping: [
          { label: 'Order placed',     at: '06-06 14:02', status: 'done' },
          { label: 'Payment captured', at: '06-06 14:02', status: 'done' },
          { label: 'Shipped',          at: '06-06 18:31', status: 'done' },
          { label: 'Delivered',        at: '06-07 10:14', status: 'done' },
          { label: 'Return initiated', at: '06-08 11:22', status: 'done' },
          { label: 'Refund pending',   at: 'pending',     status: 'now'  },
        ],
        payments: [
          { event: 'Captured (Visa ****1144)', at: '06-06 14:02', amount: 156.00 },
        ],
        supportThread: [
          { from: 'Customer', at: '06-08 11:22', text: 'Bottles arrived dented. Returning all 4.' },
          { from: 'Agent',    at: '06-08 11:31', text: 'No questions asked - return label attached, refund on receipt.' },
        ],
      },
    },
    {
      kind: 'order', id: 'ORD-23004', customer: 'Emma Garcia', email: 'eg@quantum.fyi',
      status: 'pending', placedAt: '2026-06-08 14:48', total: 38.50, items: 2,
      detail: {
        lineItems: [
          { sku: 'NB-A5-DEEP', name: 'Hardcover notebook (A5)', qty: 1, price: 18.50 },
          { sku: 'MUG-LOGO-12OZ', name: 'Logo mug (12 oz)', qty: 1, price: 14.50 },
        ],
        shipping: [
          { label: 'Order placed', at: '06-08 14:48', status: 'done' },
          { label: 'Payment pending', at: '...', status: 'now' },
        ],
        payments: [
          { event: 'Authorization attempt (declined - CVV)', at: '06-08 14:48', amount: 0 },
        ],
        supportThread: [],
      },
    },
    {
      kind: 'order', id: 'ORD-23005', customer: 'Olivia Chen', email: 'oc@stellar.energy',
      status: 'fulfilled', placedAt: '2026-06-05 11:18', total: 425.40, items: 8,
      detail: {
        lineItems: [
          { sku: 'TOTE-NAVY-L',     name: 'Canvas tote (large, navy)',  qty: 6, price: 32.00 },
          { sku: 'NB-A5-DEEP',      name: 'Hardcover notebook (A5)',    qty: 2, price: 18.50 },
        ],
        shipping: [
          { label: 'Order placed', at: '06-05 11:18', status: 'done' },
          { label: 'Payment captured', at: '06-05 11:18', status: 'done' },
          { label: 'Shipped',  at: '06-06 09:45', status: 'done' },
          { label: 'Delivered', at: '06-07 16:02', status: 'done' },
        ],
        payments: [
          { event: 'Captured (Amex ****3122)', at: '06-05 11:18', amount: 425.40 },
        ],
        supportThread: [],
      },
    },
  ]

  let expanded = $state<Set<string>>(new Set(['ORD-23002']))
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  function expandAll() { expanded = new Set(orders.map((o) => o.id)) }
  function collapseAll() { expanded = new Set() }

  // The visible rows: insert a detail sentinel after each expanded order.
  const visible = $derived.by<AnyRow[]>(() => {
    const out: AnyRow[] = []
    for (const o of orders) {
      out.push(o)
      if (expanded.has(o.id)) out.push({ kind: 'detail', id: `${o.id}-detail`, parentId: o.id, detail: o.detail })
    }
    return out
  })

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // The first column owns the chevron; detail rows render full-width via the
  // grid's `isDetailRow` / `renderDetailRow` props (a real colspan row).
  const columns: ColumnDef<typeof features, AnyRow>[] = [
    {
      id: 'expand', header: '', width: 36, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(ChevronCell, { id: ctx.row.original.id, isOpen: expanded.has(ctx.row.original.id) })
        : renderSnippet(EmptyCell, {}),
    },
    {
      field: 'id', header: 'Order', width: 130, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(PlainCell, { value: ctx.row.original.id })
        : renderSnippet(EmptyCell, {}),
    },
    { id: 'customer', header: 'Customer',  width: 180, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(PlainCell, { value: ctx.row.original.customer })
        : renderSnippet(EmptyCell, {}) },
    { id: 'email', header: 'Email', width: 200, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(PlainCell, { value: ctx.row.original.email })
        : renderSnippet(EmptyCell, {}) },
    { id: 'status', header: 'Status', width: 110, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(StatusCell, { status: ctx.row.original.status })
        : renderSnippet(EmptyCell, {}) },
    { id: 'placedAt', header: 'Placed',  width: 150, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(PlainCell, { value: ctx.row.original.placedAt })
        : renderSnippet(EmptyCell, {}) },
    { id: 'items',   header: 'Items',   width: 80,  align: 'right', editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(PlainCell, { value: String(ctx.row.original.items) })
        : renderSnippet(EmptyCell, {}) },
    { id: 'total',   header: 'Total',   width: 110, align: 'right', editable: false,
      cell: (ctx) => ctx.row.original.kind === 'order'
        ? renderSnippet(MoneyCell, { value: ctx.row.original.total })
        : renderSnippet(EmptyCell, {}) },
  ]
</script>

{#snippet ChevronCell(props: { id: string; isOpen: boolean })}
  <button class="chev" aria-label={props.isOpen ? 'Collapse row' : 'Expand row'}
    onclick={() => toggle(props.id)}>
    <svg class={props.isOpen ? 'is-open' : ''} viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 4 10 8 6 12"></polyline>
    </svg>
  </button>
{/snippet}

{#snippet EmptyCell()}{/snippet}

{#snippet PlainCell(props: { value: string })}
  <span>{props.value}</span>
{/snippet}

{#snippet MoneyCell(props: { value: number })}
  <span class="money">${props.value.toFixed(2)}</span>
{/snippet}

{#snippet StatusCell(props: { status: Status })}
  <span class={`status status-${props.status}`}>{props.status}</span>
{/snippet}

{#snippet DetailPanel(props: { row: AnyRow; rowIndex: number })}
  {#if props.row.kind === 'detail'}
    {@const detail = props.row.detail}
    {@const parentId = props.row.parentId}
  <div class="detail-host">
    <div class="detail-grid">
      <!-- Line items ----------------------------------------- -->
      <section class="d-card">
        <header>Line items</header>
        <table class="d-table">
          <thead>
            <tr><th>SKU</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            {#each detail.lineItems as item (item.sku)}
              <tr>
                <td class="d-mono">{item.sku}</td>
                <td>{item.name}</td>
                <td class="d-num">{item.qty}</td>
                <td class="d-num">${item.price.toFixed(2)}</td>
                <td class="d-num d-bold">${(item.qty * item.price).toFixed(2)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <!-- Shipping timeline -------------------------------- -->
      <section class="d-card">
        <header>Shipping</header>
        <ul class="timeline">
          {#each detail.shipping as step (step.label)}
            <li class={`step step-${step.status}`}>
              <span class="dot"></span>
              <div>
                <div class="step-label">{step.label}</div>
                <div class="step-at">{step.at}</div>
              </div>
            </li>
          {/each}
        </ul>
      </section>

      <!-- Payment events ---------------------------------- -->
      <section class="d-card">
        <header>Payments</header>
        {#if detail.payments.length === 0}
          <div class="d-empty">No payment events yet.</div>
        {:else}
          <ul class="pay-list">
            {#each detail.payments as p, i (i)}
              <li><span>{p.event}</span><span class="d-num">${p.amount.toFixed(2)}</span><span class="d-at">{p.at}</span></li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Support thread --------------------------------- -->
      <section class="d-card">
        <header>Support thread</header>
        {#if detail.supportThread.length === 0}
          <div class="d-empty">No messages.</div>
        {:else}
          <ul class="thread">
            {#each detail.supportThread as msg, i (i)}
              <li class={`msg msg-${msg.from === 'Customer' ? 'cust' : 'agent'}`}>
                <span class="msg-from">{msg.from}</span>
                <span class="msg-at">{msg.at}</span>
                <p class="msg-text">{msg.text}</p>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
    <div class="detail-bar">
      <span class="detail-ref">Detail for <strong>{parentId}</strong></span>
      <button class="collapse-btn" onclick={() => toggle(parentId)}>Collapse ▲</button>
    </div>
  </div>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="toolbar shrink-0">
    <div class="tb-info">
      Click any <strong>chevron</strong> to expand the detail row. The expanded view stays in the row stream - scroll keeps the order in place.
    </div>
    <div class="tb-actions">
      <button class="tb-btn" onclick={expandAll}>Expand all</button>
      <button class="tb-btn alt" onclick={collapseAll}>Collapse all</button>
      <span class="tb-count">{expanded.size} of {orders.length} expanded</span>
    </div>
  </div>

  <div class="grid-host flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={visible}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="none"
      enableInlineEditing={false}
      enableCellSelection={false}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={true}
      virtualization={false}
      isDetailRow={(row) => row.kind === 'detail'}
      renderDetailRow={DetailPanel}
    />
  </div>
</section>

<style>
  .toolbar {
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 14px;
  }
  .tb-info { flex: 1; min-width: 280px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .tb-info strong { color: var(--sg-accent, #6366f1); }
  .tb-actions { display: flex; align-items: center; gap: 8px; }
  .tb-btn {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border: 0; border-radius: 6px; padding: 5px 12px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .tb-btn.alt { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
                border: 1px solid var(--sg-border, #cbd5e1); }
  .tb-btn:hover { filter: brightness(1.07); }
  .tb-count { font-size: 11px; color: var(--sg-muted, #64748b); }

  /* Chevron --------------------------------------------------- */
  :global(.chev) {
    width: 22px; height: 22px;
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #64748b);
    border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  :global(.chev:hover) {
    background: var(--sg-row-hover-bg, color-mix(in oklab, #6366f1 12%, transparent));
    color: var(--sg-accent, #6366f1);
  }
  :global(.chev svg) { transition: transform 140ms; }
  :global(.chev svg.is-open) { transform: rotate(90deg); }

  /* Status pill ---------------------------------------------- */
  :global(.status) {
    display: inline-block; padding: 1px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  :global(.status-pending)   { background: #fef3c7; color: #92400e; }
  :global(.status-paid)      { background: #dbeafe; color: #1d4ed8; }
  :global(.status-fulfilled) { background: #dcfce7; color: #166534; }
  :global(.status-returned)  { background: #fee2e2; color: #991b1b; }
  :global(.status-refunded)  { background: #e0e7ff; color: #3730a3; }
  :global(.money) { font-variant-numeric: tabular-nums; font-weight: 700; }

  /* Detail row ---------------------------------------------- */
  :global(.detail-host) {
    border-left: 3px solid var(--sg-accent, #6366f1);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-bg, #fff));
    padding: 14px 16px;
    width: 100%;
    box-sizing: border-box;
  }
  :global(.detail-grid) {
    display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 12px;
  }
  :global(.d-card) {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 6px;
    overflow: hidden;
  }
  :global(.d-card header) {
    padding: 6px 10px; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  :global(.d-table) {
    width: 100%; border-collapse: collapse; font-size: 12px;
  }
  :global(.d-table th) {
    text-align: left; padding: 4px 8px;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--sg-muted, #94a3b8); font-weight: 600;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  :global(.d-table td) {
    padding: 4px 8px;
    border-bottom: 1px dashed var(--sg-border, #e2e8f0);
  }
  :global(.d-mono) { font-family: ui-monospace, monospace; font-size: 11px; color: var(--sg-muted, #64748b); }
  :global(.d-num)  { font-variant-numeric: tabular-nums; text-align: right; }
  :global(.d-bold) { font-weight: 700; color: var(--sg-fg, #0f172a); }
  :global(.d-empty){ padding: 12px; font-size: 12px; color: var(--sg-muted, #94a3b8); font-style: italic; }

  :global(.timeline) { list-style: none; margin: 0; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
  :global(.step) { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; }
  :global(.step .dot) {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
    background: var(--sg-muted, #94a3b8);
  }
  :global(.step-done .dot) { background: #10b981; }
  :global(.step-now  .dot) { background: #f59e0b; box-shadow: 0 0 0 3px color-mix(in oklab, #f59e0b 30%, transparent); }
  :global(.step-next .dot) { background: var(--sg-border, #cbd5e1); }
  :global(.step-label) { color: var(--sg-fg, #0f172a); font-weight: 500; }
  :global(.step-at) { color: var(--sg-muted, #94a3b8); font-size: 10px; }

  :global(.pay-list) { list-style: none; margin: 0; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
  :global(.pay-list li) { display: grid; grid-template-columns: 1fr auto; row-gap: 1px; }
  :global(.pay-list .d-at) { grid-column: 1 / -1; font-size: 10px; color: var(--sg-muted, #94a3b8); }

  :global(.thread) { list-style: none; margin: 0; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
  :global(.msg) { padding: 6px 8px; border-radius: 4px; background: var(--sg-bg-subtle, var(--sg-header-bg, #f1f5f9)); }
  :global(.msg-cust) { background: color-mix(in oklab, #f59e0b 8%, transparent); }
  :global(.msg-from) { font-weight: 700; }
  :global(.msg-at) { font-size: 10px; color: var(--sg-muted, #94a3b8); margin-left: 6px; }
  :global(.msg-text) { margin: 2px 0 0; }

  :global(.detail-bar) {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 10px; padding: 6px 4px;
    font-size: 11px; color: var(--sg-muted, #64748b);
  }
  :global(.detail-ref strong) { color: var(--sg-fg, #0f172a); font-family: ui-monospace, monospace; }
  :global(.collapse-btn) {
    background: transparent; border: 0;
    color: var(--sg-accent, #6366f1); font-size: 11px; font-weight: 700; cursor: pointer;
    border-radius: 4px; padding: 2px 8px;
  }
  :global(.collapse-btn:hover) { background: var(--sg-row-hover-bg, color-mix(in oklab, #6366f1 10%, transparent)); }
</style>
