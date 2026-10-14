<script lang="ts">
  /**
   * The link field's editor (registered as 'fieldLink'): the linked table's
   * rows in a dialog with a search box over the primary field and the
   * table's text fields; tick the ones to link (one when the
   * field allows a single record). Done commits the ids, Cancel leaves the
   * cell as it was. When the table can add records (`create`), a search that
   * names no record offers "+ Create" for it, picked at once.
   */
  import { SvModal } from '@svgrid/grid'
  import { fieldPropsOf } from './registry.svelte'
  import { getLinkedTable, idOf, rowsOf } from './sources.svelte'

  let {
    value,
    columnDef,
    onCommit,
    onCancel,
  }: { value: unknown; columnDef?: Record<string, unknown>; onCommit: (v?: unknown) => void; onCancel: () => void } = $props()

  const props = $derived(fieldPropsOf((columnDef ?? {}) as { fieldType?: unknown; fieldProps?: Record<string, unknown> }) as { table?: string; multiple?: boolean })
  const table = $derived(getLinkedTable(props.table))
  const multiple = $derived(props.multiple !== false)
  // svelte-ignore state_referenced_locally
  let picked = $state<string[]>(Array.isArray(value) ? value.map(String) : value == null || value === '' ? [] : [String(value)])
  let search = $state('')
  let open = $state(true)
  let finished = false

  // The list draws this many rows at most; the footer of the list says how many matched.
  const LIMIT = 200
  const TEXT_TYPES = new Set(['text', 'longText', 'email', 'url', 'phone', 'singleSelect', 'multiSelect'])
  const rows = $derived(table ? rowsOf(table) : [])
  // Besides the primary field, search reads the table's text fields (every
  // text value of the record when the table declares no fields).
  const others = $derived(
    table?.fields?.length
      ? table.fields.filter((f) => f.field !== table.primaryField && (!f.fieldType || TEXT_TYPES.has(f.fieldType))).map((f) => ({ field: f.field, header: f.header }))
      : null,
  )
  const textOf = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(', ') : '')
  /** Where `q` is found in a record other than its primary field, as "Email: maya@...". */
  function hintFor(r: Record<string, unknown>, q: string): string | null {
    const fields = others ?? Object.keys(r).filter((k) => k !== 'id' && k !== table!.primaryField).map((k) => ({ field: k, header: k }))
    for (const f of fields) {
      const text = textOf(r[f.field])
      if (text && text.toLowerCase().includes(q)) return `${f.header}: ${text}`
    }
    return null
  }
  const found = $derived.by(() => {
    const q = search.trim().toLowerCase()
    const out: Array<{ id: string; label: string; hint: string | null }> = []
    let total = 0
    let exact = false
    for (const r of rows) {
      const label = String(r[table!.primaryField] ?? '')
      let hint: string | null = null
      if (q && !label.toLowerCase().includes(q)) {
        hint = hintFor(r, q)
        if (hint == null) continue
      }
      if (q && label.toLowerCase() === q) exact = true
      total += 1
      if (out.length < LIMIT) out.push({ id: idOf(table!, r), label, hint })
    }
    return { rows: out, total, exact }
  })
  const shown = $derived(found.rows)

  const term = $derived(search.trim())
  const canCreate = $derived(!!table?.create && !!term && !found.exact)
  let creating = $state(false)
  async function create() {
    if (!table?.create || creating) return
    creating = true
    try {
      const row = await table.create(term)
      const id = idOf(table, row)
      picked = multiple ? [...picked.filter((x) => x !== id), id] : [id]
      search = ''
    } finally {
      creating = false
    }
  }

  function toggle(id: string) {
    if (!multiple) picked = picked[0] === id ? [] : [id]
    else picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]
  }
  function done() {
    finished = true
    open = false
    onCommit([...picked])
  }
  function cancel() {
    if (finished) return
    finished = true
    open = false
    onCancel()
  }
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value
</script>

<SvModal bind:open title={table ? `Link to ${table.name}` : 'Link to records'} width={460} onClose={cancel}>
  {#if !table}
    <p class="sv-flp-empty">The table this field links to is not available.</p>
  {:else}
    <input class="sv-flp-search" placeholder={`Search ${table.name}`} aria-label={`Search ${table.name}`} value={search} oninput={(e) => (search = inputValue(e))} />
    <ul class="sv-flp-list" role="listbox" aria-multiselectable={multiple}>
      {#each shown as r (r.id)}
        <li>
          <button type="button" class="sv-flp-row" class:is-on={picked.includes(r.id)} role="option" aria-selected={picked.includes(r.id)} onclick={() => toggle(r.id)}>
            <span class="sv-flp-mark" aria-hidden="true">{picked.includes(r.id) ? '✓' : ''}</span>
            <span class="sv-flp-label">{r.label || 'Unnamed'}</span>
            {#if r.hint}<span class="sv-flp-hint">{r.hint}</span>{/if}
          </button>
        </li>
      {:else}
        {#if !canCreate}<li class="sv-flp-empty">No records match.</li>{/if}
      {/each}
      {#if canCreate}
        <li>
          <button type="button" class="sv-flp-row sv-flp-create" disabled={creating} onclick={create}>
            <span class="sv-flp-mark" aria-hidden="true">+</span>
            <span class="sv-flp-label">Create “{term}”</span>
          </button>
        </li>
      {/if}
    </ul>
    {#if found.total > shown.length}
      <p class="sv-flp-more" role="status">Showing {shown.length.toLocaleString()} of {found.total.toLocaleString()}. Type to narrow.</p>
    {/if}
  {/if}
  {#snippet footer()}
    <div class="sv-flp-footer">
      <span class="sv-flp-count">{picked.length} linked</span>
      <button type="button" class="sv-flp-btn" onclick={cancel}>Cancel</button>
      <button type="button" class="sv-flp-btn is-primary" onclick={done}>Done</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .sv-flp-search {
    width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; font: inherit; font-size: 14px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-flp-search:focus { outline: none; border-color: var(--sg-accent, #2563eb); }
  .sv-flp-list { list-style: none; margin: 10px 0 0; padding: 0; max-height: 320px; overflow: auto; }
  .sv-flp-row {
    display: flex; align-items: center; gap: 8px; width: 100%; height: 34px; padding: 0 8px; border: 0;
    border-radius: var(--sg-radius, 6px); background: none; color: var(--sg-fg, #0f172a); font: inherit; font-size: 14px; text-align: start; cursor: pointer;
  }
  .sv-flp-row:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-flp-row.is-on { background: var(--sg-selection-bg, #eef4ff); }
  .sv-flp-create { color: var(--sg-accent, #2563eb); }
  .sv-flp-mark { width: 16px; color: var(--sg-accent, #2563eb); font-weight: 700; }
  .sv-flp-label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-flp-hint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-flp-more { margin: 8px 0 0; padding: 0 8px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-flp-empty { padding: 12px 8px; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-flp-footer { display: flex; align-items: center; gap: 8px; width: 100%; }
  .sv-flp-count { flex: 1; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-flp-btn {
    height: 34px; padding: 0 16px; font: inherit; font-size: 13px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-flp-btn.is-primary { background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); border-color: var(--sg-fg, #0f172a); }
</style>
