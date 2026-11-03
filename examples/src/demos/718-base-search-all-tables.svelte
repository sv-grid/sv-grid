<script lang="ts">
  /**
   * 718. SvGrid Base: search across tables
   * --------------------------------------
   * The box in the tab bar searches every table of the base, not only the
   * one on screen. It reads each field the way its cell shows it: a deal's
   * stage by its label, an owner by name, a close date as written, a contact's
   * company by the company's name. Results come grouped by table, five per
   * table with a count of the rest, the words marked and the field they
   * matched in. Up and Down pick one, Enter opens it in its own table.
   *
   * Ctrl+K (or "/" outside the grid) puts the cursor in the box.
   *
   * The same search runs without the box: `searchBase(tables, query)`
   * returns the groups, shown here under the base for the query typed in the
   * box beside it.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, searchBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const COMPANIES: Array<[string, string, string]> = [
    ['Northwind Outdoors', 'Retail', 'Denver'],
    ['Fabrikam Retail', 'Retail', 'Chicago'],
    ['Litware Foundation', 'Nonprofit', 'Boston'],
    ['Contoso Pharma', 'Health', 'Basel'],
    ['Adatum Logistics', 'Logistics', 'Rotterdam'],
    ['Tailspin Air', 'Travel', 'Seattle'],
    ['Wingtip Toys', 'Retail', 'Austin'],
    ['Proseware Labs', 'Software', 'Berlin'],
    ['Lucerne Publishing', 'Media', 'Zurich'],
    ['Margie Travel', 'Travel', 'Lisbon'],
    ['Alpine Ski House', 'Hospitality', 'Innsbruck'],
    ['Coho Winery', 'Food', 'Napa'],
  ]
  const FIRST = ['Maya', 'Jonas', 'Priya', 'Lucas', 'Sofía', 'Omar', 'Hannah', 'Kenji', 'Amélie', 'Diego', 'Noor', 'Erik', 'Lena', 'Tomás', 'Yara']
  const LAST = ['Lindqvist', 'Moreau', 'Natarajan', 'Becker', 'Okoye', 'Haddad', 'García', 'Novak', 'Tanaka', 'Brennan']
  const ROLES = ['Buyer', 'CFO', 'Head of Ops', 'IT lead', 'Marketing lead', 'Founder']
  const STAGES = [
    { value: 'lead', label: 'Lead', color: '#94a3b8' },
    { value: 'qualified', label: 'Qualified', color: '#2d7ff9' },
    { value: 'proposal', label: 'Proposal sent', color: '#ff9f0a' },
    { value: 'won', label: 'Closed won', color: '#20c933' },
    { value: 'lost', label: 'Closed lost', color: '#f82b60' },
  ]
  const DEALS = ['Annual renewal', 'Pilot', 'Fleet tracking rollout', 'Data migration', 'Support upgrade', 'New region launch', 'Seasonal campaign', 'Analytics add-on']

  const companies = COMPANIES.map(([name, industry, city], i) => ({ id: `co${i + 1}`, name, industry, city, contacts: [] as string[], deals: [] as string[] }))
  const contacts = Array.from({ length: 30 }, (_, i) => {
    const company = companies[i % companies.length]!
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`
    const c = { id: `ct${i + 1}`, name, role: ROLES[i % ROLES.length], email: `${name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(' ', '.')}@${company.name.split(' ')[0]!.toLowerCase()}.example`, company: [company.id] }
    company.contacts.push(c.id)
    return c
  })
  const deals = Array.from({ length: 24 }, (_, i) => {
    const company = companies[(i * 5) % companies.length]!
    const d = {
      id: `dl${i + 1}`,
      name: `${company.name.split(' ')[0]} ${DEALS[i % DEALS.length]}`,
      company: [company.id],
      stage: STAGES[i % STAGES.length]!.value,
      owner: `u${(i % 6) + 1}`,
      amount: 4000 + ((i * 3779) % 60) * 1000,
      close: `2026-${String(10 + (i % 3)).padStart(2, '0')}-${String(1 + ((i * 11) % 28)).padStart(2, '0')}`,
      notes: i % 4 === 0 ? 'Waiting on procurement to sign the order form.' : i % 4 === 1 ? 'Asked for a security review before the pilot.' : '',
    }
    company.deals.push(d.id)
    return d
  })

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'search-deals',
      name: 'Deals',
      primaryField: 'name',
      data: deals,
      columns: [
        { field: 'name', header: 'Deal', width: 240, fieldType: 'text' },
        { field: 'company', header: 'Company', width: 180, fieldType: 'link', fieldProps: { table: 'search-companies', multiple: false, inverse: 'deals' } },
        { field: 'stage', header: 'Stage', width: 140, fieldType: 'singleSelect', fieldProps: { options: STAGES } },
        { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
        { field: 'amount', header: 'Amount', width: 120, fieldType: 'currency', fieldProps: { precision: 0 } },
        { field: 'close', header: 'Close date', width: 140, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'notes', header: 'Notes', width: 300, fieldType: 'longText' },
      ],
      views: [{ id: 'all', name: 'All deals', type: 'grid', color: { mode: 'field', field: 'stage' } }],
    },
    {
      id: 'search-contacts',
      name: 'Contacts',
      primaryField: 'name',
      data: contacts,
      columns: [
        { field: 'name', header: 'Name', width: 190, fieldType: 'text' },
        { field: 'role', header: 'Role', width: 140, fieldType: 'text' },
        { field: 'email', header: 'Email', width: 260, fieldType: 'email' },
        { field: 'company', header: 'Company', width: 190, fieldType: 'link', fieldProps: { table: 'search-companies', multiple: false, inverse: 'contacts' } },
      ],
      views: [{ id: 'all', name: 'All contacts', type: 'grid' }],
    },
    {
      id: 'search-companies',
      name: 'Companies',
      primaryField: 'name',
      data: companies,
      columns: [
        { field: 'name', header: 'Company', width: 200, fieldType: 'text' },
        { field: 'industry', header: 'Industry', width: 130, fieldType: 'text' },
        { field: 'city', header: 'City', width: 120, fieldType: 'text' },
        { field: 'contacts', header: 'Contacts', width: 260, fieldType: 'link', fieldProps: { table: 'search-contacts', multiple: true, inverse: 'company' } },
        { field: 'deals', header: 'Deals', width: 260, fieldType: 'link', fieldProps: { table: 'search-deals', multiple: true, inverse: 'company' } },
      ],
      views: [{ id: 'all', name: 'All companies', type: 'grid' }],
    },
  ])

  // The headless search, for the line under the base.
  let query = $state('proposal')
  const found = $derived(searchBase(tables, query))
</script>

<section class="search-demo">
  <p class="search-demo-tip">
    Press <kbd>Ctrl</kbd>+<kbd>K</kbd> and try <em>northwind</em>, <em>proposal</em>, <em>ana</em>, <em>security</em> or <em>tomas</em>: a stage, an owner, a note, a contact with an accent. Enter opens the record in its table.
  </p>
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    fieldMenu
  />
  <div class="search-demo-headless">
    <label>
      <code>searchBase(tables, </code><input bind:value={query} aria-label="Query for searchBase" /><code>)</code>
    </label>
    <span>
      {#each found as g, i (g.table)}{i ? ', ' : ''}{g.name}: {g.total}{:else}no records{/each}
    </span>
  </div>
  <SvToaster />
</section>

<style>
  .search-demo { display: flex; flex-direction: column; flex: 1; min-height: 520px; height: 100%; gap: 10px; }
  .search-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .search-demo-tip kbd {
    padding: 1px 5px; font: inherit; font-size: 12px; border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); color: var(--sg-fg, #0f172a);
  }
  .search-demo-headless { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .search-demo-headless label { display: inline-flex; align-items: center; gap: 2px; }
  .search-demo-headless code { font-size: 12px; color: var(--sg-fg, #0f172a); }
  .search-demo-headless input {
    width: 110px; height: 24px; padding: 0 6px; box-sizing: border-box; font: inherit; color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 4px; background: var(--sg-bg, #fff);
  }
</style>
