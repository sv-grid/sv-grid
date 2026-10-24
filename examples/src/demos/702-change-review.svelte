<script lang="ts">
  /**
   * 702. Change review: an agent's edits, accepted by group
   * --------------------------------------------------------
   * A customer table with the dirt a CRM export carries. Run the cleanup
   * agent and its edits arrive as proposals, not writes: each changed cell
   * shows the proposed value with the old one struck through beside it, and
   * the panel groups them by what they do.
   *
   *   Trim spaces, Change to Title Case, Reformat Phone,
   *   Divide Revenue by 100      rule groups: every member follows the rule
   *   Country: 5 values -> ...   a mapping table, one decision
   *   Fill empty Region          split by value; the low-confidence fills
   *                              (two of them wrong) lead the sample
   *
   * Accept a group and one setRows call writes it; Ctrl+Z in the grid puts it
   * back. Edit a cell that has a proposal, then accept: the proposal is
   * marked stale and your value stays. Import the CRM update and one cell gets
   * a second, different proposal: a conflict, decided in the panel.
   *
   * The agent here is a few fixed rules standing in for a model, so the demo
   * runs without a key. With one, reviewSmartFill / reviewClassify feed the
   * same review from the AI helpers.
   */
  import { SvButton, SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import { createReview, fromRows, SvReviewPanel, type ProposalInput } from '@svgrid/enterprise/review'

  type Customer = {
    id: string
    company: string
    contact: string
    phone: string
    country: string
    region: string
    revenue: number
  }

  const COMPANIES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella Labs', 'Hooli', 'Vandelay Imports', 'Stark Industries',
    'Wayne Holdings', 'Tyrell Systems', 'Cyberdyne', 'Aperture Science', 'Soylent Foods', 'Oscorp', 'Wonka Partners',
    'Gringotts', 'Monarch Group', 'Pied Piper', 'Dunder Paper', 'Prestige Worldwide', 'Massive Dynamic']
  const PEOPLE = ['maria silva', 'wei chen', 'aisha khan', 'carlos ruiz', 'emma berg', 'liam novak', 'sofia rossi',
    'noah okafor', 'yuki tanaka', 'omar haddad']
  const COUNTRIES = ['United States', 'usa', 'Germany', 'U.S.', 'Japan', 'US', 'United Kingdom', 'United States of America', 'Brazil', 'U.S.A.']
  const REGION_OF: Record<string, string> = { 'United States': 'AMER', Brazil: 'AMER', Germany: 'EMEA', 'United Kingdom': 'EMEA', Japan: 'APAC' }
  const US = new Set(['usa', 'U.S.', 'US', 'United States of America', 'U.S.A.'])

  const seed = (): Customer[] =>
    COMPANIES.map((name, i) => {
      const country = COUNTRIES[i % COUNTRIES.length]
      const a = 200 + ((i * 37) % 700)
      const b = 100 + ((i * 53) % 800)
      const c = 1000 + ((i * 271) % 9000)
      return {
        id: `c${i + 1}`,
        company: i % 3 === 0 ? `${name}  ` : i % 7 === 1 ? `  ${name}` : name,
        contact: i % 2 === 0 ? PEOPLE[i % PEOPLE.length].toUpperCase() : titleCase(PEOPLE[i % PEOPLE.length]),
        phone: i % 4 === 3 ? `${a}-${b}-${c}` : `(${a}) ${b}-${c}`,
        country,
        region: i % 3 === 1 ? '' : REGION_OF[US.has(country) ? 'United States' : country] ?? '',
        // Six rows came in from the old billing system, in cents.
        revenue: i % 3 === 2 ? (40 + i * 13) * 1000 * 100 : (40 + i * 13) * 1000,
      }
    })

  function titleCase(s: string) {
    return s.replace(/\b\p{Ll}/gu, (ch) => ch.toUpperCase())
  }

  let rows = $state(seed())
  let api = $state<SvGridApi<any, Customer> | null>(null)
  const review = createReview<Customer>({ api: () => api, setRows: (next) => (rows = next) })

  const columns: GridColumns<Customer> = [
    { field: 'company', header: 'Company', width: 190, editable: true },
    { field: 'contact', header: 'Contact', width: 150, editable: true },
    { field: 'phone', header: 'Phone', width: 140, editable: true },
    { field: 'country', header: 'Country', width: 170, editable: true },
    { field: 'region', header: 'Region', width: 100, editable: true },
    { field: 'revenue', header: 'Revenue', width: 130, editable: true, editorType: 'number', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  /** A few fixed rules standing in for a cleanup model. */
  function runAgent() {
    const proposals: ProposalInput[] = []
    for (const r of rows) {
      const add = (field: keyof Customer, after: unknown, extra: Partial<ProposalInput> = {}) => {
        if (r[field] !== after) proposals.push({ rowId: r.id, field, before: r[field], after, ...extra })
      }
      add('company', r.company.trim())
      add('contact', titleCase(r.contact.toLowerCase()))
      const digits = r.phone.replace(/\D/g, '')
      add('phone', `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`)
      const country = US.has(r.country) ? 'United States' : r.country
      add('country', country)
      if (!r.region) {
        // Two guesses are wrong, and the agent says it is unsure of them.
        // c5 is in Japan and c11 in the United States.
        const guess = r.id === 'c5' ? 'EMEA' : r.id === 'c11' ? 'APAC' : null
        const unsure = guess !== null
        add('region', guess ?? REGION_OF[country], {
          confidence: unsure ? 0.42 : 0.93,
          reason: unsure ? 'guessed from the company name' : `from Country (${country})`,
        })
      }
      if (r.revenue >= 1_000_000) add('revenue', r.revenue / 100, { reason: 'billing export was in cents' })
    }
    review.add({ source: { kind: 'agent', id: 'cleanup', label: 'Cleanup agent' }, proposals })
  }

  /** The CRM sends its own region for one customer, different from the agent's. */
  function runImport() {
    if (!api) return
    const set = fromRows<Customer>([{ id: 'c2', region: 'EMEA' }, { id: 'c8', region: 'EMEA' }], {
      api,
      key: 'id',
      source: { kind: 'import', id: 'crm-update.csv', label: 'crm-update.csv' },
    })
    review.add(set)
  }

  function reset() {
    review.clear()
    rows = seed()
  }

  const pending = $derived(review.pending().length)

  // A phone has no room for both side by side, and the demo stage has a fixed
  // height: show one at a time. The grid stays mounted, so its api does too.
  let narrow = $state(false)
  let view = $state<'grid' | 'review'>('grid')
  $effect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => (narrow = mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  })
</script>

<div class="cr-demo">
  <div class="cr-bar">
    <SvButton size="sm" onclick={runAgent}>Run cleanup agent</SvButton>
    <SvButton size="sm" variant="outline" onclick={runImport}>Import crm-update.csv</SvButton>
    <SvButton size="sm" variant="ghost" onclick={reset}>Reset</SvButton>
    <span class="cr-note">{pending ? `${pending} proposed, nothing written yet` : 'The data is as loaded'}</span>
  </div>
  {#if narrow}
    <div class="cr-bar" role="group" aria-label="Show">
      <SvButton size="sm" variant={view === 'grid' ? 'secondary' : 'ghost'} onclick={() => (view = 'grid')}>Grid</SvButton>
      <SvButton size="sm" variant={view === 'review' ? 'secondary' : 'ghost'} onclick={() => (view = 'review')}>Review ({pending})</SvButton>
    </div>
  {/if}
  <div class="cr-split">
    <div class="cr-grid" class:cr-hidden={narrow && view === 'review'}>
      <SvGrid
        data={rows}
        columns={review.columns(columns)}
        getRowId={(r) => r.id}
        conditionalFormats={review.formats}
        editable
        containerHeight={460}
        onApiReady={(a) => (api = a)}
      />
    </div>
    <div class="cr-panel" class:cr-hidden={narrow && view === 'grid'}>
      <SvReviewPanel {review} title="Review the agent's changes" />
    </div>
  </div>
</div>

<style>
  .cr-demo {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-family: var(--sg-font, inherit);
    color: var(--sg-fg);
  }
  .cr-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .cr-note {
    color: var(--sg-muted);
    font-size: 13px;
  }
  .cr-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 12px;
    align-items: start;
  }
  .cr-grid,
  .cr-panel {
    min-width: 0;
  }
  /* The stage has a fixed height: the panel scrolls within the grid's. */
  .cr-panel {
    max-height: 460px;
    overflow: auto;
  }
  .cr-hidden {
    display: none;
  }
  @media (max-width: 860px) {
    .cr-split {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
