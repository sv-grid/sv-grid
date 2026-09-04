<script lang="ts">
  /**
   * Data-app Studio · rich form fields - image upload + cascading dropdowns.
   *
   *   Avatar  - an `upload` field renders SvFileInput (preview + file picker).
   *             With no upload handler it stores an inline data URL, so it works
   *             with no backend; pass `uploads` to push to storage instead.
   *   City    - a DEPENDENT dropdown: its options are computed from the chosen
   *             Country (`dependentOptions`), and it clears if the country changes.
   */
  import { SvGrid, createServerDataSource, renderSnippet, type ServerState } from '@svgrid/grid'
  import { SvGridEditPanel, createInMemoryDataSource, schemaToColumns, type EntitySchema } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Member = { id: string; name: string; avatar: string; country: string; city: string }

  const schema: EntitySchema<Member> = {
    name: 'members', label: 'Team member', idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true, hidden: { form: true } },
      { field: 'avatar', type: 'text', label: 'Avatar', upload: { image: true, accept: 'image/*' } },
      { field: 'name', type: 'text', required: true, minLength: 2 },
      { field: 'country', type: 'enum', options: [
        { value: 'US', label: 'United States' }, { value: 'DE', label: 'Germany' }, { value: 'JP', label: 'Japan' },
      ] },
      { field: 'city', type: 'text' }, // form control comes from dependentOptions below
    ],
  }

  const citiesByCountry: Record<string, string[]> = {
    US: ['New York', 'San Francisco', 'Los Angeles'],
    DE: ['Berlin', 'Munich', 'Hamburg'],
    JP: ['Tokyo', 'Osaka', 'Kyoto'],
  }
  const cityOptions = (values: Partial<Member>) =>
    (citiesByCountry[values.country ?? ''] ?? []).map((c) => ({ value: c, label: c }))

  const seed: Member[] = [
    { id: 'm1', name: 'Ada Lovelace', avatar: '', country: 'US', city: 'New York' },
    { id: 'm2', name: 'Alan Turing', avatar: '', country: 'DE', city: 'Berlin' },
    { id: 'm3', name: 'Grace Hopper', avatar: '', country: 'JP', city: 'Tokyo' },
  ]

  const columns = schemaToColumns(schema)
  const source = createInMemoryDataSource(seed, schema)

  let view = $state<ServerState<Member>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(source, {
    pageSize: 10, optimistic: true, getRowId: (r) => r.id, onChange: (s) => (view = s),
  })
  controller.refresh()

  let editing = $state<Member | null | undefined>(undefined)
  let genId = 4
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Member> }) {
    if (mode === 'create') { await controller.createRow({ id: `m${genId++}`, ...values }); controller.setPage(view.pageCount - 1) }
    else if (id) { await controller.updateRow(id, values) }
    editing = undefined
  }
</script>

{#snippet AvatarCell(props: { row: Member })}
  {#if props.row.avatar}
    <img class="ff-avatar" src={props.row.avatar} alt="" />
  {:else}
    <span class="ff-avatar ff-avatar--empty">{props.row.name?.[0] ?? '?'}</span>
  {/if}
{/snippet}

<SvGridStudio
  title="Rich form fields"
  subtitle="Double-click a member: upload an <strong>avatar</strong> (image field) and pick a <strong>City</strong> that cascades from the Country."
>
  {#snippet toolbar()}
    <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New member</button>
  {/snippet}

  <SvGrid responsive={true}
      columnResize
    data={view.rows}
    columns={columns.map((c) => (c.field === 'avatar' ? { ...c, cell: (ctx) => renderSnippet(AvatarCell, { row: ctx.row.original as Member }) } : c))}
    loading={view.loading}
    fitColumns
    onRowDoubleClick={(e) => (editing = e.row)}
    containerHeight={280}
  />

  {#if editing !== undefined}
    <SvGridEditPanel
      {schema}
      row={editing}
      presentation="modal" persistKey="studio"
      dependentOptions={{ city: cityOptions }}
      onSubmit={save}
      onCancel={() => (editing = undefined)}
    />
  {/if}
</SvGridStudio>

<style>
  :global(.ff-avatar) {
    width: 30px; height: 30px; border-radius: 50%; object-fit: cover; display: inline-flex;
    align-items: center; justify-content: center; font-size: 12px; font-weight: 600;
    background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); border: 1px solid var(--sg-border, #ddd);
  }
</style>
