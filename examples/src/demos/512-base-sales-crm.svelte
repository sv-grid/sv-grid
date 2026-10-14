<script lang="ts">
  /**
   * 512. SvGrid Base: sales CRM
   * ---------------------------
   * A sales team's CRM as a ready-to-use base with three tables, one tab
   * each. Deals link to an account and a contact; Accounts list their deals
   * and contacts and roll up the pipeline value; Contacts link back to their
   * account and deals. Linking a deal to an account lists it on that
   * account's row, and the other way round.
   *
   * Add a link field ("+" at the end of the header, "Link to records") to
   * relate two tables: the other table gets a field back. Point it at
   * another table, or delete it, and the field back moves or goes with it.
   * The tabs add, rename, duplicate and delete tables.
   */
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STAGES = [
    { value: 'Lead', color: '#94a3b8' },
    { value: 'Qualified', color: '#18bfff' },
    { value: 'Proposal', color: '#2d7ff9' },
    { value: 'Negotiation', color: '#fcb400' },
    { value: 'Won', color: '#20c933' },
    { value: 'Lost', color: '#f82b60' },
  ]
  const ODDS: Record<string, number> = { Lead: 0.1, Qualified: 0.25, Proposal: 0.5, Negotiation: 0.75, Won: 1, Lost: 0 }
  const SOURCES = [
    { value: 'Inbound', color: '#20c933' },
    { value: 'Referral', color: '#8b46ff' },
    { value: 'Outbound', color: '#ff6f2c' },
    { value: 'Event', color: '#18bfff' },
  ]
  const INDUSTRIES = [
    { value: 'Wholesale', color: '#ff6f2c' },
    { value: 'Manufacturing', color: '#2d7ff9' },
    { value: 'Software', color: '#8b46ff' },
    { value: 'Retail', color: '#fcb400' },
    { value: 'Logistics', color: '#18bfff' },
    { value: 'Healthcare', color: '#20c933' },
    { value: 'Education', color: '#f82b60' },
  ]
  const NEXT = ['Send proposal', 'Book a demo', 'Security review', 'Pricing call', 'Legal redlines', 'Kickoff scheduled', 'Follow up next quarter']
  const PRODUCTS = ['Platform license', 'Team plan', 'Renewal', 'Expansion', 'Pilot', 'Enterprise plan']
  const day = (n: number) => new Date(Date.UTC(2026, 9, 6 + n)).toISOString().slice(0, 10)

  // ---- Sample records -------------------------------------------------------

  const ACCOUNTS = [
    ['Northwind Traders', 'Wholesale', 420, 'Seattle'],
    ['Contoso', 'Manufacturing', 2600, 'Chicago'],
    ['Fabrikam', 'Software', 880, 'Austin'],
    ['Adventure Works', 'Retail', 310, 'Denver'],
    ['Tailspin Toys', 'Retail', 140, 'Portland'],
    ['Wide World Importers', 'Logistics', 1200, 'Rotterdam'],
    ['Litware', 'Healthcare', 560, 'Boston'],
    ['Proseware', 'Education', 95, 'Dublin'],
  ] as const
  const PEOPLE = [
    ['Maya Lindqvist', 'Head of Operations'], ['Tom Becker', 'Procurement lead'],
    ['Priya Raman', 'CFO'], ['Luis Ortega', 'IT director'],
    ['Grace Kim', 'VP Engineering'], ['Owen Price', 'Platform lead'],
    ['Sofia Rossi', 'COO'], ['Ken Watanabe', 'Store systems'],
    ['Nora Ali', 'Founder'], ['Jack Moran', 'Head of Product'],
    ['Eva Novak', 'Supply chain director'], ['Ravi Menon', 'Finance manager'],
    ['Hannah Cole', 'CIO'], ['Marco Bianchi', 'Clinical systems'],
    ['Ines Duarte', 'Head of IT'], ['Leo Hart', 'Dean of Operations'],
  ] as const

  const contacts = PEOPLE.map(([name, title], i) => {
    const acct = Math.floor(i / 2)
    return {
      id: `c${i + 1}`,
      name,
      title,
      account: [`a${acct + 1}`],
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${ACCOUNTS[acct]![0].toLowerCase().replace(/[^a-z]+/g, '')}.example.com`,
      phone: `+1 555 01${String(10 + i).padStart(2, '0')}`,
      deals: [] as string[],
    }
  })
  const deals = Array.from({ length: 30 }, (_, i) => {
    const stage = STAGES[[0, 1, 2, 3, 4, 2, 1, 3, 0, 5, 2, 4, 1, 3, 2, 0, 4, 3, 1, 2, 5, 3, 2, 1, 4, 0, 2, 3, 1, 2][i]!]!.value
    const acct = i % ACCOUNTS.length
    return {
      id: `d${i + 1}`,
      // Each account sees each product at most once.
      deal: `${ACCOUNTS[acct]![0]}: ${PRODUCTS[(i - Math.floor(i / ACCOUNTS.length)) % PRODUCTS.length]}`,
      account: [`a${acct + 1}`],
      contact: [`c${acct * 2 + (i % 2) + 1}`],
      stage,
      owner: ['u1', 'u2', 'u4', 'u7'][i % 4]!,
      value: 8000 + ((i * 7919) % 90) * 1500,
      probability: ODDS[stage]!,
      close: day((i * 3) % 50),
      nextStep: stage === 'Won' || stage === 'Lost' ? '' : NEXT[i % NEXT.length]!,
      source: SOURCES[i % SOURCES.length]!.value,
      priority: 1 + ((i * 3) % 5),
    }
  })
  // The fields back list the records that link, as the base keeps them from now on.
  for (const d of deals) contacts.find((c) => c.id === d.contact[0])!.deals.push(d.id)
  const accounts = ACCOUNTS.map(([name, industry, employees, city], i) => ({
    id: `a${i + 1}`,
    name,
    industry,
    employees,
    city,
    deals: deals.filter((d) => d.account[0] === `a${i + 1}`).map((d) => d.id),
    contacts: contacts.filter((c) => c.account[0] === `a${i + 1}`).map((c) => c.id),
  }))

  // ---- The base ---------------------------------------------------------------

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'crm-deals',
      name: 'Deals',
      primaryField: 'deal',
      data: deals,
      columns: [
        { id: 'deal', field: 'deal', header: 'Deal', width: 280, fieldType: 'text' },
        { id: 'account', field: 'account', header: 'Account', width: 180, fieldType: 'link', fieldProps: { table: 'crm-accounts', multiple: false, inverse: 'deals' } },
        { id: 'contact', field: 'contact', header: 'Contact', width: 170, fieldType: 'link', fieldProps: { table: 'crm-contacts', multiple: false, inverse: 'deals' } },
        { id: 'stage', field: 'stage', header: 'Stage', width: 130, fieldType: 'singleSelect', fieldProps: { options: STAGES } },
        { id: 'owner', field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { id: 'value', field: 'value', header: 'Value', width: 130, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } },
        { id: 'probability', field: 'probability', header: 'Probability', width: 150, fieldType: 'number', fieldProps: { format: 'percent', precision: 0, showBar: true, summary: 'avg' } },
        { id: 'close', field: 'close', header: 'Close date', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { id: 'nextStep', field: 'nextStep', header: 'Next step', width: 200, fieldType: 'text' },
        { id: 'source', field: 'source', header: 'Source', width: 120, fieldType: 'singleSelect', fieldProps: { options: SOURCES } },
        { id: 'priority', field: 'priority', header: 'Priority', width: 120, fieldType: 'rating', fieldProps: { max: 5, icon: 'flag', color: '#f82b60' } },
      ],
      views: [
        { id: 'deals', name: 'All deals', type: 'grid', color: { mode: 'field', field: 'stage' }, state: { sorting: [{ id: 'value', desc: true }] } },
        { id: 'pipeline', name: 'Pipeline', type: 'kanban', stackBy: 'stage' },
        { id: 'closing', name: 'Closing calendar', type: 'calendar', dateField: 'close', color: { mode: 'field', field: 'stage' } },
        { id: 'by-stage', name: 'Pipeline value by stage', type: 'chart', chart: { kind: 'bar', x: 'stage', y: 'value' } },
        {
          id: 'open',
          name: 'Open deals by owner',
          type: 'grid',
          state: {
            grouping: ['owner'],
            sorting: [{ id: 'owner', desc: false }, { id: 'close', desc: false }],
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'stage', kind: 'select', op: 'isNoneOf', value: ['Won', 'Lost'] }] },
          },
        },
        { id: 'lead', name: 'New lead', type: 'form', formFields: ['deal', 'account', 'contact', 'owner', 'value', 'source', 'nextStep'], formDescription: 'A lead from a call, an event or a referral. It starts in the Lead stage.' },
      ],
      props: { rowAdder: { label: 'Add deal', defaults: () => ({ deal: '', stage: 'Lead', probability: 0.1 }) } },
    },
    {
      id: 'crm-accounts',
      name: 'Accounts',
      primaryField: 'name',
      data: accounts,
      columns: [
        { id: 'name', field: 'name', header: 'Account', width: 220, fieldType: 'text' },
        { id: 'industry', field: 'industry', header: 'Industry', width: 150, fieldType: 'singleSelect', fieldProps: { options: INDUSTRIES } },
        { id: 'deals', field: 'deals', header: 'Deals', width: 260, fieldType: 'link', fieldProps: { table: 'crm-deals', multiple: true, inverse: 'account' } },
        { id: 'pipeline', field: 'pipeline', header: 'Pipeline value', width: 170, fieldType: 'rollup', fieldProps: { linkField: 'deals', field: 'value', aggregation: 'SUM' } },
        { id: 'dealCount', field: 'dealCount', header: 'Deal count', width: 120, fieldType: 'count', fieldProps: { linkField: 'deals' } },
        { id: 'contacts', field: 'contacts', header: 'Contacts', width: 220, fieldType: 'link', fieldProps: { table: 'crm-contacts', multiple: true, inverse: 'account' } },
        { id: 'employees', field: 'employees', header: 'Employees', width: 120, fieldType: 'number', fieldProps: { format: 'integer' } },
        { id: 'city', field: 'city', header: 'City', width: 130, fieldType: 'text' },
      ],
      views: [
        { id: 'accounts', name: 'All accounts', type: 'grid', state: { sorting: [{ id: 'name', desc: false }] } },
        { id: 'by-industry', name: 'By industry', type: 'kanban', stackBy: 'industry' },
      ],
      props: { rowAdder: { label: 'Add account' } },
    },
    {
      id: 'crm-contacts',
      name: 'Contacts',
      primaryField: 'name',
      data: contacts,
      columns: [
        { id: 'name', field: 'name', header: 'Name', width: 190, fieldType: 'text' },
        { id: 'title', field: 'title', header: 'Title', width: 190, fieldType: 'text' },
        { id: 'account', field: 'account', header: 'Account', width: 180, fieldType: 'link', fieldProps: { table: 'crm-accounts', multiple: false, inverse: 'contacts' } },
        { id: 'deals', field: 'deals', header: 'Deals', width: 260, fieldType: 'link', fieldProps: { table: 'crm-deals', multiple: true, inverse: 'contact' } },
        { id: 'email', field: 'email', header: 'Email', width: 260, fieldType: 'email' },
        { id: 'phone', field: 'phone', header: 'Phone', width: 150, fieldType: 'phone' },
      ],
      views: [
        { id: 'contacts', name: 'All contacts', type: 'grid' },
        { id: 'add', name: 'Add a contact', type: 'form', formFields: ['name', 'title', 'account', 'email', 'phone'] },
      ],
      props: { rowAdder: { label: 'Add contact' } },
    },
  ])
</script>

<section class="base-demo">
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    pinSplitter
    summary
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
