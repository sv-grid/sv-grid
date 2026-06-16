<script lang="ts">
  /**
   * 13. Finances - account ledger
   * -----------------------------
   * A chequing/savings ledger with running balance, currency formatting,
   * category chips, and a status column. ~600 transactions across three
   * accounts; pick one with the dropdown to switch the view.
   *
   * Running balance is computed ONCE in chronological order at load time
   * (and re-computed when the account changes) - so it's stable regardless
   * of how the user later sorts or filters the visible rows.
   *
   * Showcases:
   *   - Pagination
   *   - Per-column filtering via the funnel menu
   *   - Currency + date formatters
   *   - Custom cell renderers for category chips and signed amounts
   *   - Row summaries (sum of money-in / money-out) in the footer
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-core'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Status = 'Cleared' | 'Pending' | 'Disputed'
  type Category =
    | 'Salary' | 'Bonus' | 'Refund' | 'Transfer in'
    | 'Rent' | 'Groceries' | 'Utilities' | 'Subscription'
    | 'Dining' | 'Travel' | 'Health' | 'Tax' | 'Misc'

  type Tx = {
    id: string
    date: string         // ISO yyyy-mm-dd
    description: string
    category: Category
    account: string
    amount: number       // positive = credit, negative = debit
    balance: number      // running balance after this tx
    status: Status
    currency: 'USD' | 'EUR' | 'GBP'
  }

  const ACCOUNTS: Array<{ id: string; label: string; opening: number; currency: 'USD' | 'EUR' | 'GBP' }> = [
    { id: 'cheq-1', label: 'Chequing · ••1924',  opening: 12_480.55, currency: 'USD' },
    { id: 'sav-1',  label: 'Savings · ••7741',   opening: 58_320.00, currency: 'USD' },
    { id: 'eur-1',  label: 'EUR business · ••3318', opening: 24_900.00, currency: 'EUR' },
  ]

  // ---------- seeded PRNG so the demo is reproducible across reloads.
  let prngState = 0xA1E2F3B4
  function rand(): number {
    prngState = (prngState * 1664525 + 1013904223) >>> 0
    return prngState / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }
  function range(lo: number, hi: number): number { return lo + Math.floor(rand() * (hi - lo + 1)) }

  // Each category has a typical merchant pool + a sign + a price band. Keeps
  // descriptions varied while staying internally consistent (no $4 of rent,
  // no $4000 coffees).
  type CatProfile = {
    cat: Category
    sign: 1 | -1
    merchants: readonly string[]
    min: number
    max: number
    weight: number
  }
  const CATEGORY_TABLE: CatProfile[] = [
    { cat: 'Salary',       sign:  1, merchants: ['ACME Payroll', 'Globex HR'],                    min: 3_200,  max: 7_400,  weight: 1 },
    { cat: 'Bonus',        sign:  1, merchants: ['ACME Bonus'],                                   min: 400,    max: 3_500,  weight: 1 },
    { cat: 'Refund',       sign:  1, merchants: ['Amazon Refund', 'Apple Refund', 'Lufthansa Refund'], min: 12, max: 380, weight: 2 },
    { cat: 'Transfer in',  sign:  1, merchants: ['Transfer from Savings', 'Wise transfer'],       min: 50,     max: 2_500,  weight: 2 },
    { cat: 'Rent',         sign: -1, merchants: ['Greenhill Apartments'],                          min: 1_800,  max: 2_400,  weight: 1 },
    { cat: 'Groceries',    sign: -1, merchants: ['Whole Foods', 'Trader Joe\'s', 'Aldi', 'Carrefour'], min: 18, max: 220, weight: 8 },
    { cat: 'Utilities',    sign: -1, merchants: ['PG&E', 'Comcast', 'Verizon', 'Town Water'],     min: 24,     max: 240,    weight: 4 },
    { cat: 'Subscription', sign: -1, merchants: ['Netflix', 'Spotify', 'iCloud', 'Adobe', 'NYT'], min: 4,      max: 60,     weight: 6 },
    { cat: 'Dining',       sign: -1, merchants: ['Blue Bottle Coffee', 'Sushi Ran', 'Tartine', 'Chipotle'], min: 6, max: 140, weight: 12 },
    { cat: 'Travel',       sign: -1, merchants: ['Uber', 'Lyft', 'United Airlines', 'Marriott'],  min: 9,      max: 950,    weight: 5 },
    { cat: 'Health',       sign: -1, merchants: ['CVS Pharmacy', 'Walgreens', 'Kaiser'],          min: 14,     max: 320,    weight: 3 },
    { cat: 'Tax',          sign: -1, merchants: ['IRS', 'State Tax Board'],                       min: 200,    max: 2_400,  weight: 1 },
    { cat: 'Misc',         sign: -1, merchants: ['Amazon', 'Etsy', 'Home Depot', 'IKEA'],          min: 6,      max: 480,    weight: 6 },
  ]

  // Pre-build a weighted pool for fast pick().
  const CATEGORY_POOL: CatProfile[] = (() => {
    const out: CatProfile[] = []
    for (const c of CATEGORY_TABLE) for (let i = 0; i < c.weight; i += 1) out.push(c)
    return out
  })()

  function makeLedger(accountId: string): Tx[] {
    const account = ACCOUNTS.find((a) => a.id === accountId)!
    // 600 transactions back from today
    const N = 600
    const start = Date.now() - 365 * 86_400_000
    const span = Date.now() - start

    // Generate in chronological order so the running balance is correct.
    const txs: Tx[] = []
    let balance = account.opening
    for (let i = 0; i < N; i += 1) {
      const profile = pick(CATEGORY_POOL)
      const merchant = pick(profile.merchants)
      const raw = range(profile.min, profile.max) + rand()
      const amount = Math.round(raw * 100) / 100 * profile.sign
      balance = Math.round((balance + amount) * 100) / 100
      const ts = start + (i / N) * span + rand() * (span / N)
      txs.push({
        id: `T-${accountId.toUpperCase()}-${(i + 1).toString().padStart(4, '0')}`,
        date: new Date(ts).toISOString().slice(0, 10),
        description: merchant,
        category: profile.cat,
        account: account.label,
        amount,
        balance,
        // 90% cleared, 8% pending, 2% disputed
        status: rand() < 0.9 ? 'Cleared' : rand() < 0.8 ? 'Pending' : 'Disputed',
        currency: account.currency,
      })
    }
    // Show most-recent first by default.
    return txs.reverse()
  }

  let selectedAccount = $state(ACCOUNTS[0]!.id)
  // svelte-ignore state_referenced_locally
  let rows = $state<Tx[]>(makeLedger(selectedAccount))
  $effect(() => { rows = makeLedger(selectedAccount) })

  const account = $derived(ACCOUNTS.find((a) => a.id === selectedAccount)!)

  // Quick summary for the toolbar - money in vs out over the whole ledger.
  const summary = $derived.by(() => {
    let inflow = 0
    let outflow = 0
    for (const tx of rows) {
      if (tx.amount > 0) inflow += tx.amount
      else outflow += -tx.amount
    }
    return {
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
      latestBalance: rows[0]?.balance ?? account.opening,
    }
  })

  const CATEGORY_TINT: Record<Category, string> = {
    'Salary':       '#16a34a',
    'Bonus':        '#15803d',
    'Refund':       '#0891b2',
    'Transfer in':  '#0d9488',
    'Rent':         '#b45309',
    'Groceries':    '#65a30d',
    'Utilities':    '#0369a1',
    'Subscription': '#7c3aed',
    'Dining':       '#db2777',
    'Travel':       '#2563eb',
    'Health':       '#dc2626',
    'Tax':          '#9f1239',
    'Misc':         '#475569',
  }

  function fmtMoney(value: number, currency: 'USD' | 'EUR' | 'GBP'): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(value)
  }
</script>

{#snippet CategoryChip(props: { value: Category })}
  <span class="ledger-chip" style="background:{CATEGORY_TINT[props.value]}20; color:{CATEGORY_TINT[props.value]}; border:1px solid {CATEGORY_TINT[props.value]}40;">
    {props.value}
  </span>
{/snippet}

{#snippet SignedAmount(props: { row: Tx })}
  <span class={props.row.amount >= 0 ? 'ledger-amount-pos' : 'ledger-amount-neg'}>
    {props.row.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(props.row.amount), props.row.currency)}
  </span>
{/snippet}

{#snippet StatusBadge(props: { value: Status })}
  <span class="ledger-status ledger-status-{props.value.toLowerCase()}">{props.value}</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-end gap-4 text-sm shrink-0">
    <label class="flex flex-col">
      <span class="text-slate-500 dark:text-slate-400">Account</span>
      <select
        bind:value={selectedAccount}
        class="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 min-w-56"
      >
        {#each ACCOUNTS as a (a.id)}
          <option value={a.id}>{a.label} · {a.currency}</option>
        {/each}
      </select>
    </label>
    <div class="ml-auto flex items-end gap-6 text-right">
      <div>
        <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Money in</div>
        <div class="text-base font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {fmtMoney(summary.inflow, account.currency)}
        </div>
      </div>
      <div>
        <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Money out</div>
        <div class="text-base font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
          {fmtMoney(summary.outflow, account.currency)}
        </div>
      </div>
      <div>
        <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Latest balance</div>
        <div class="text-base font-semibold tabular-nums">
          {fmtMoney(summary.latestBalance, account.currency)}
        </div>
      </div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={[
        {
          field: 'date', header: 'Date', editorType: 'date', width: 120,
          format: { type: 'date', pattern: 'y-m-d' },
        },
        { field: 'id',          header: 'Tx',          editorType: 'text', width: 140 },
        { field: 'description', header: 'Description', editorType: 'text', width: 240 },
        {
          field: 'category', header: 'Category', editorType: 'text', width: 140,
          cell: (ctx) => renderSnippet(CategoryChip, { value: ctx.row.original.category }),
        },
        {
          field: 'amount', header: 'Amount', editorType: 'number', width: 150,
          cell: (ctx) => renderSnippet(SignedAmount, { row: ctx.row.original }),
        },
        {
          field: 'balance', header: 'Balance', editorType: 'number', width: 160,
          cell: (ctx) => fmtMoney(ctx.row.original.balance, ctx.row.original.currency),
        },
        {
          field: 'status', header: 'Status', editorType: 'text', width: 110,
          cell: (ctx) => renderSnippet(StatusBadge, { value: ctx.row.original.status }),
        },
      ] satisfies ColumnDef<typeof features, Tx>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={true}
      pageSize={50}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .ledger-chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
  }
  .ledger-amount-pos { color: #16a34a; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ledger-amount-neg { color: #dc2626; font-weight: 600; font-variant-numeric: tabular-nums; }
  :global([data-theme='dark']) .ledger-amount-pos { color: #4ade80; }
  :global([data-theme='dark']) .ledger-amount-neg { color: #f87171; }
  .ledger-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  .ledger-status-cleared  { background: #dcfce7; color: #166534; }
  .ledger-status-pending  { background: #fef3c7; color: #92400e; }
  .ledger-status-disputed { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark']) .ledger-status-cleared  { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
  :global([data-theme='dark']) .ledger-status-pending  { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
  :global([data-theme='dark']) .ledger-status-disputed { background: rgba(239, 68, 68, 0.18); color: #f87171; }
</style>
