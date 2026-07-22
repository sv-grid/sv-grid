<script lang="ts">
  /**
   * Data-app Studio · auth - a secured screen. `SvAuthGate` requires a signed-in
   * user before it shows the app; sign out returns to the login form.
   *
   * This demo uses a *mock* auth client (any email + password signs you in) so it
   * runs with no backend. In a real app you pass your `supabase-js` client -
   * `createClient(url, anonKey)` - and Row-Level Security scopes each user to
   * their own rows. Auth establishes WHO; RLS enforces WHAT they can see.
   */
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import {
    SvAuthGate,
    SvGridEditPanel,
    createInMemoryDataSource,
    schemaToColumns,
    type EntitySchema,
    type SupabaseAuthClientLike,
  } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Customer = { id: string; name: string; email: string; tier: string; mrr: number; active: boolean }

  const schema: EntitySchema<Customer> = {
    name: 'customers', label: 'Customer', idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true, hidden: { form: true } },
      { field: 'name', type: 'text', required: true, minLength: 2 },
      { field: 'email', type: 'text', label: 'Email', required: true, format: 'email' },
      { field: 'tier', type: 'enum', options: [
        { value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' },
      ] },
      { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },
      { field: 'active', type: 'boolean' },
    ],
  }

  // A mock supabase-js-shaped auth client: any credentials sign in. Swap for
  // `createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)` in a real app.
  function mockAuthClient(): SupabaseAuthClientLike {
    let cb: ((event: string, session: { user: { id: string; email?: string } } | null) => void) | undefined
    let session: { user: { id: string; email?: string } } | null = null
    const emit = () => cb?.('x', session)
    const signIn = async ({ email }: { email: string }) => {
      session = { user: { id: 'demo-user', email } }
      emit()
      return { error: null }
    }
    return {
      auth: {
        getSession: async () => ({ data: { session } }),
        onAuthStateChange: (fn) => { cb = fn; return { data: { subscription: { unsubscribe() {} } } } },
        signInWithPassword: signIn,
        signUp: signIn,
        signOut: async () => { session = null; emit(); return { error: null } },
      },
    }
  }
  const client = mockAuthClient()

  const seed: Customer[] = [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', tier: 'enterprise', mrr: 1200, active: true },
    { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', tier: 'pro', mrr: 240, active: true },
    { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', tier: 'enterprise', mrr: 980, active: true },
    { id: 'c4', name: 'Linus Torvalds', email: 'linus@kernel.org', tier: 'pro', mrr: 360, active: true },
  ]
  const columns = schemaToColumns(schema)
  const source = createInMemoryDataSource(seed, schema)

  let view = $state<ServerState<Customer>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(source, {
    pageSize: 10, optimistic: true, getRowId: (r) => r.id, onChange: (s) => (view = s),
  })
  controller.refresh()

  let editing = $state<Customer | null | undefined>(undefined)
  let genId = 5

  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Customer> }) {
    if (mode === 'create') { await controller.createRow({ id: `c${genId++}`, ...values }); controller.setPage(view.pageCount - 1) }
    else if (id) { await controller.updateRow(id, values) }
    editing = undefined
  }
</script>

<SvGridStudio
  title="Secured"
  subtitle="The grid is behind <code>SvAuthGate</code>. Sign in with <em>any</em> email + password (mock auth), then Sign out."
>
  <SvAuthGate {client} title="Sign in to Studio">
    <div class="st__toolbar">
      <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New customer</button>
      <span class="st-hint">You are signed in - in a real app, RLS would scope these rows to you.</span>
    </div>

    <SvGrid responsive={true}
      data={view.rows}
      {columns}
      loading={view.loading}
      fitColumns
      enableRowSummaries={false}
      sortable
      externalSort
      onSortingChange={(s) => controller.setSort(s)}
      filterable
      filterMode="row"
      externalFilter
      onFiltersChange={(f) =>
        controller.setFilter({
          global: f.global || undefined,
          columns: Object.fromEntries(f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }])),
        })}
      onRowDoubleClick={(e) => (editing = e.row)}
      showPagination
      externalPagination
      rowCount={view.total}
      pageIndex={view.pageIndex}
      pageSize={view.pageSize}
      onPaginationChange={({ pageIndex, pageSize }) => (pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex))}
      containerHeight={300}
    />

    {#if editing !== undefined}
      <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey="studio" onSubmit={save} onCancel={() => (editing = undefined)} />
    {/if}
  </SvAuthGate>
</SvGridStudio>
