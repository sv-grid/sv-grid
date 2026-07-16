<script lang="ts">
  /**
   * Data-app Studio · relations - a foreign-key "lookup" field end to end.
   *
   * Contacts belong to a Company. The contact's `companyId` field is a
   * `relation`, so the edit form renders a SEARCHABLE picker
   * (`SvLookupInput` + `createRelationLookup`) that searches the Companies
   * source and stores the company id - while the grid shows the company NAME.
   *
   * The lookup runs over the same `ServerDataSource` contract as everything
   * else, so the related options could just as well come from Supabase, REST, or
   * SQL. Here both entities are in-memory.
   */
  import { SvGrid, createServerDataSource, type ServerState, type ServerDataSource } from '@svgrid/grid'
  import {
    SvGridEditPanel,
    createInMemoryDataSource,
    createRelationLookup,
    schemaToColumns,
    type EntitySchema,
  } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Company = { id: number; name: string }
  type Contact = { id: number; name: string; email: string; title: string; companyId: number | string; company?: string }

  const companies: Company[] = [
    { id: 1, name: 'Acme Inc' },
    { id: 2, name: 'Globex' },
    { id: 3, name: 'Initech' },
    { id: 4, name: 'Umbrella Corp' },
    { id: 5, name: 'Stark Industries' },
    { id: 6, name: 'Wonka Industries' },
  ]
  const nameById = new Map(companies.map((c) => [String(c.id), c.name]))

  const companySchema: EntitySchema<Company> = {
    name: 'companies',
    label: 'Company',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', required: true },
    ],
  }

  const contactSchema: EntitySchema<Contact> = {
    name: 'contacts',
    label: 'Contact',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true, hidden: { form: true } },
      { field: 'name', type: 'text', required: true, minLength: 2 },
      { field: 'email', type: 'text', label: 'Email', format: 'email' },
      { field: 'title', type: 'text' },
      // The FK: a searchable picker in the form, hidden from the grid.
      { field: 'companyId', type: 'relation', label: 'Company', relation: { entity: 'companies', labelField: 'name' }, hidden: { grid: true } },
      // Display-only: the resolved company name, shown in the grid, not the form.
      { field: 'company', type: 'text', label: 'Company', readonly: true, hidden: { form: true } },
    ],
  }

  const seed: Contact[] = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@acme.io', title: 'CTO', companyId: 1 },
    { id: 2, name: 'Alan Turing', email: 'alan@globex.com', title: 'Engineer', companyId: 2 },
    { id: 3, name: 'Grace Hopper', email: 'grace@initech.com', title: 'Admiral', companyId: 3 },
    { id: 4, name: 'Tony Stark', email: 'tony@stark.com', title: 'CEO', companyId: 5 },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@acme.io', title: 'Principal', companyId: 1 },
    { id: 6, name: 'Willy Wonka', email: 'willy@wonka.com', title: 'Founder', companyId: 6 },
    { id: 7, name: 'Linus Torvalds', email: 'linus@globex.com', title: 'Maintainer', companyId: 2 },
    { id: 8, name: 'Radia Perlman', email: 'radia@umbrella.com', title: 'Architect', companyId: 4 },
  ]

  const companiesSource = createInMemoryDataSource(companies, companySchema)
  const rawContacts = createInMemoryDataSource(seed, contactSchema)

  // Enrich each contact with its company NAME (a join). Nothing is denormalized
  // in storage; the grid just gets a `company` label. IMPORTANT: enrich EVERY
  // method's rows, not just getRows - optimistic create/update reconcile the
  // local row with what create/updateRow return, so they must have the same
  // shape or the display field vanishes after an edit.
  const withCompany = (r: Contact): Contact => ({ ...r, company: nameById.get(String(r.companyId)) ?? '' })
  const contactsSource: ServerDataSource<Contact> = {
    ...rawContacts,
    async getRows(req) {
      const res = await rawContacts.getRows(req)
      return { ...res, rows: res.rows.map(withCompany) }
    },
    async createRow(input) {
      return withCompany(await rawContacts.createRow(input))
    },
    async updateRow(id, patch) {
      return withCompany(await rawContacts.updateRow(id, patch))
    },
  }

  const companyLookup = createRelationLookup<Company>({ source: companiesSource, schema: companySchema, labelField: 'name' })
  const columns = schemaToColumns(contactSchema)

  let view = $state<ServerState<Contact>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 8, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(contactsSource, {
    pageSize: 8, optimistic: true, getRowId: (r) => String(r.id), onChange: (s) => (view = s),
  })
  controller.refresh()

  let editing = $state<Contact | null | undefined>(undefined)
  let selected = $state<Contact[]>([])
  let genId = seed.length + 1

  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Contact> }) {
    if (mode === 'create') {
      await controller.createRow({ id: genId++, ...values })
      controller.setPage(view.pageCount - 1)
    } else if (id) {
      await controller.updateRow(id, values)
    }
    editing = undefined
  }
  async function removeSelected() {
    for (const row of selected) await controller.deleteRow(String(row.id))
    selected = []
  }
</script>

<SvGridStudio
  title="Relations"
  subtitle="Contacts belong to a <strong>Company</strong>. The form's Company field is a searchable <code>relation</code> lookup; the grid shows the resolved name."
>
  {#snippet toolbar()}
    <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New contact</button>
    <button class="st-btn" disabled={selected.length === 0} onclick={removeSelected}>
      Delete{selected.length ? ` (${selected.length})` : ''}
    </button>
    <span class="st-hint">Double-click a row to edit · the Company field searches the Companies source</span>
  {/snippet}

  <SvGrid
    data={view.rows}
    {columns}
    loading={view.loading}
    fitColumns
    enableRowSummaries={false}
    showRowSelection
    sortable
    externalSort
    onSortingChange={(s) => controller.setSort(s)}
    filterable
    filterMode="row"
    showGlobalFilter
    externalFilter
    onFiltersChange={(f) =>
      controller.setFilter({
        global: f.global || undefined,
        columns: Object.fromEntries(
          f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }]),
        ),
      })}
    onRowDoubleClick={(e) => (editing = e.row)}
    onRowSelectionChange={(_sel, rows) => (selected = rows)}
    showPagination
    externalPagination
    rowCount={view.total}
    pageIndex={view.pageIndex}
    pageSize={view.pageSize}
    onPaginationChange={({ pageIndex, pageSize }) => {
      if (pageSize !== view.pageSize) controller.setPageSize(pageSize)
      else controller.setPage(pageIndex)
    }}
    containerHeight={320}
  />

  {#if editing !== undefined}
    <SvGridEditPanel
      schema={contactSchema}
      row={editing}
      presentation="modal" persistKey="studio"
      lookups={{ companyId: companyLookup }}
      onSubmit={save}
      onCancel={() => (editing = undefined)}
    />
  {/if}
</SvGridStudio>
