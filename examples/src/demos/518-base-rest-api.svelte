<script lang="ts">
  /**
   * 518. Base on your API
   * ---------------------
   * A CRM base over a JSON API, built from the API's own description of its
   * tables. `baseTablesFromSchemas` turns each table's columns into fields: a
   * number column into a number field, an enum into a single select with its
   * values, a foreign key (`company_id`) into a link to Companies, with a
   * field in Companies that links back. Each table is on
   * `createRestDataSource`, which reads `GET /api/deals?offset=0&limit=...`
   * and writes with POST, PATCH and DELETE.
   *
   * The schemas here are written out; `introspectSupabaseTable`,
   * `introspectDatabase` or `introspectOpenApi` read them from a live
   * database or an OpenAPI document. After that, the fields are yours to
   * adjust like any other: Amount shows as currency below.
   *
   * The API checks what it is sent: give a deal a negative amount and it
   * answers 422 with its reason. The base puts the cell back and shows the
   * reason. A new record gets its id from the API (`de1000`); the base keeps
   * the one it gave the row in the page.
   *
   * The API is in the page (`shared/mock-rest.ts`), handed to the source as
   * its `fetch`. With a real one, drop `fetch` and point `url` at it.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseTablesFromSchemas, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { createRestDataSource, type EntitySchema } from '@svgrid/enterprise'
  import { createMockRestApi, type MockApiCall } from '../shared/mock-rest'

  enableBase()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // ---- The API ---------------------------------------------------------------------

  let calls = $state<Array<MockApiCall & { n: number }>>([])
  let n = 0
  const api = createMockRestApi(
    {
      companies: [
        { id: 'c1', name: 'Northwind Traders', industry: 'Retail', website: 'https://northwind.example' },
        { id: 'c2', name: 'Contoso', industry: 'Manufacturing', website: 'https://contoso.example' },
        { id: 'c3', name: 'Fabrikam', industry: 'Software', website: 'https://fabrikam.example' },
      ],
      deals: [
        { id: 'd1', title: 'Annual renewal', stage: 'Won', amount: 48000, close_date: day(-12), company_id: 'c1' },
        { id: 'd2', title: 'Second warehouse', stage: 'Proposal', amount: 125000, close_date: day(18), company_id: 'c1' },
        { id: 'd3', title: 'Pilot for 40 seats', stage: 'Qualified', amount: 22000, close_date: day(30), company_id: 'c2' },
        { id: 'd4', title: 'Platform upgrade', stage: 'Negotiation', amount: 87000, close_date: day(9), company_id: 'c3' },
        { id: 'd5', title: 'Support plan', stage: 'Lost', amount: 9000, close_date: day(-3), company_id: 'c2' },
      ],
      contacts: [
        { id: 'p1', name: 'Maria Anders', email: 'maria@northwind.example', company_id: 'c1' },
        { id: 'p2', name: 'Ken Sato', email: 'ken@contoso.example', company_id: 'c2' },
        { id: 'p3', name: 'Rita Gomez', email: 'rita@fabrikam.example', company_id: 'c3' },
      ],
    },
    {
      latency: 200,
      validate: (table, row) => (table === 'deals' && typeof row.amount === 'number' && row.amount < 0 ? 'Amount must be 0 or more' : null),
      onRequest: (call) => {
        calls = [{ ...call, n: ++n }, ...calls].slice(0, 30)
      },
    },
  )

  // ---- What the API says its tables hold ---------------------------------------------

  const STAGES = [
    { value: 'Qualified', label: 'Qualified', color: '#64748b' },
    { value: 'Proposal', label: 'Proposal', color: '#2563eb' },
    { value: 'Negotiation', label: 'Negotiation', color: '#d97706' },
    { value: 'Won', label: 'Won', color: '#16a34a' },
    { value: 'Lost', label: 'Lost', color: '#dc2626' },
  ]
  const SCHEMAS: EntitySchema[] = [
    {
      name: 'deals',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'title', type: 'text' },
        { field: 'stage', type: 'enum', options: STAGES },
        { field: 'amount', type: 'number' },
        { field: 'close_date', type: 'date', label: 'Close date' },
        { field: 'company_id', type: 'relation', relation: { entity: 'companies', labelField: 'name' } },
      ],
    },
    {
      name: 'companies',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'name', type: 'text' },
        { field: 'industry', type: 'enum', options: ['Retail', 'Manufacturing', 'Software'].map((v) => ({ value: v, label: v })) },
        { field: 'website', type: 'text', format: 'url' },
      ],
    },
    {
      name: 'contacts',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'name', type: 'text' },
        { field: 'email', type: 'text', format: 'email' },
        { field: 'company_id', type: 'relation', relation: { entity: 'companies', labelField: 'name' } },
      ],
    },
  ]

  // ---- The base ------------------------------------------------------------------

  function build(): BaseTable[] {
    const tables = baseTablesFromSchemas(
      SCHEMAS,
      (schema) => createRestDataSource({ url: `/api/${schema.name}`, schema, fetch: api }),
      // The API makes the key of a new record.
      () => ({ serverIds: true }),
    )
    // The fields are ordinary Base fields: adjust them as you would any other.
    return tables.map((t) =>
      t.id !== 'deals'
        ? t
        : {
            ...t,
            columns: t.columns.map((c) => (c.field === 'amount' ? { ...c, fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } } : c)),
            views: [
              { id: 'grid', name: 'All deals', type: 'grid', color: { mode: 'field', field: 'stage' } },
              { id: 'pipeline', name: 'Pipeline', type: 'kanban', stackBy: 'stage' },
            ],
          },
    )
  }
  let tables = $state.raw<BaseTable[]>(build())

  const statusTone = (s: number) => (s >= 400 ? 'is-bad' : s >= 300 ? '' : 'is-ok')
</script>

<section class="rbase">
  <div class="rbase-base">
    <SvBase bind:tables editable sortable showRowNumbers showRowSelection={false} summary rowHeight={34} containerHeight="100%" columnAdder={false} />
  </div>
  <ol class="rbase-log" aria-label="Requests to the API">
    {#each calls as c (c.n)}
      <li>
        <span class="rbase-status {statusTone(c.status)}">{c.status}</span>
        <code>{c.method} {c.path}</code>
        {#if c.body}<code class="rbase-body">{JSON.stringify(c.body)}</code>{/if}
        <span class="rbase-ms">{c.ms} ms</span>
      </li>
    {/each}
  </ol>
  <SvToaster />
</section>

<style>
  .rbase { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 10px; }
  .rbase-base { flex: 1 1 auto; min-height: 380px; display: flex; flex-direction: column; }
  .rbase-log {
    flex: 0 0 auto; list-style: none; margin: 0; padding: 8px 12px; height: 140px; overflow: auto;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .rbase-log li { display: flex; gap: 10px; align-items: baseline; padding: 2px 0; }
  .rbase-status { flex: none; width: 30px; font-weight: 700; color: var(--sg-muted, #64748b); }
  .rbase-status.is-ok { color: var(--sg-success, #16a34a); }
  .rbase-status.is-bad { color: var(--sg-danger, #dc2626); }
  .rbase-body { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sg-muted, #64748b); }
  .rbase-ms { flex: none; margin-left: auto; color: var(--sg-muted, #64748b); }
</style>
