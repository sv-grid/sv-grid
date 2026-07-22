<script lang="ts">
  /**
   * SvRecordDetail - a full record "detail page" over an entity's rows: a header
   * (title + subtitle + colored status pill + a few metric tiles + a record
   * switcher), then tabbed sections - an Overview of grouped label/value pairs plus
   * one tab per related child collection (Activity / Related), each a timeline of
   * the child rows that point back at this record. The universal signature view for
   * relation-heavy entities (a customer / deal / patient / trip page), where a board
   * or calendar does not fit.
   *
   * Pure presentation over plain rows + an EntitySchema (same inputs as SvBoard /
   * SvSchemaChart), so the generated app and the designer preview render it
   * identically. When `row` is omitted it self-drives off `rows` (defaults to the
   * first, switchable via the header dropdown).
   */
  import type { EntitySchema, EntityField } from './schema'

  type Row = Record<string, unknown>
  type Section = { label: string; fields: string[] }
  type Related = {
    label: string
    schema: EntitySchema
    rows?: ReadonlyArray<Row>
    /** The child field pointing back at this record. */
    foreignKey: string
    /** The parent field the child's `foreignKey` matches (default: the id) - lets a
     *  denormalized view relate by name / company when it has no FK ids. */
    parentField?: string
    titleField: string
    subtitleField?: string
    dateField?: string
    statusField?: string
  }

  let {
    schema,
    rows = [],
    row,
    titleField,
    subtitleField,
    statusField,
    metricFields = [],
    sections = [],
    related = [],
    selectedId,
    loading = false,
    height,
  }: {
    schema: EntitySchema
    rows?: ReadonlyArray<Row>
    /** The specific record to show. Omit to self-drive off `rows`. */
    row?: Row
    /** Initial record to open, by id (e.g. from a URL `?id=` param). Switchable. */
    selectedId?: string
    /** Show a skeleton during first load. */
    loading?: boolean
    titleField: string
    subtitleField?: string
    /** Enum field rendered as a colored status pill in the header. */
    statusField?: string
    /** A few (numeric) fields shown as header stat tiles. */
    metricFields?: string[]
    /** Overview field groups. Empty -> one auto "Details" group. */
    sections?: Section[]
    /** Related child collections, one tab each. */
    related?: Related[]
    height?: number
  } = $props()

  const idField = $derived(schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id')
  const fieldOf = (name?: string): EntityField | undefined => (name ? schema.fields.find((f) => f.field === name) : undefined)
  const titleCase = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).replace(/\bId\b/, '').trim()
  const labelOf = (name: string) => fieldOf(name)?.label ?? titleCase(name)
  const isMoneyName = (s: string) => /\$|price|amount|total|cost|value|revenue|fee|salary|balance|subtotal|budget/i.test(s)

  /** Format a value against its field: enum -> option label, money numbers -> $,
   *  else localized. Works for any schema so parent + child rows format alike. */
  function fmtField(f: EntityField | undefined, v: unknown): string {
    if (v == null || v === '') return '-'
    if (f?.options?.length) { const o = f.options.find((x) => String(x.value) === String(v)); if (o) return o.label ?? String(v) }
    if (typeof v === 'number') return isMoneyName(f?.label ?? f?.field ?? '') ? '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toLocaleString()
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (Array.isArray(v)) return v.join(', ')
    return String(v)
  }

  let picked = $state<string | null>(null)
  // A URL-driven `selectedId` seeds the selection (and follows navigation to a new
  // id); a manual switch via the header dropdown then overrides it.
  $effect(() => { picked = selectedId ?? null })
  const current = $derived.by<Row | undefined>(() => {
    if (row) return row
    if (picked != null) { const r = rows.find((x) => String(x[idField]) === picked); if (r) return r }
    return rows[0]
  })
  const currentId = $derived(current ? String(current[idField]) : '')

  const fmt = (name: string, r: Row | undefined): string => fmtField(fieldOf(name), r?.[name])
  const childField = (rel: Related, name?: string): EntityField | undefined => (name ? rel.schema.fields.find((f) => f.field === name) : undefined)
  const fmtChild = (rel: Related, name: string, r: Row): string => fmtField(childField(rel, name), r[name])

  function optOf(field: string | undefined, r: Row | undefined): { label: string; color: string } | undefined {
    if (!field || !r) return undefined
    const v = String(r[field] ?? '')
    if (!v) return undefined
    const o = fieldOf(field)?.options?.find((x) => String(x.value) === v)
    return { label: o?.label ?? v, color: o?.color ?? 'var(--sg-muted, #64748b)' }
  }
  const status = $derived(optOf(statusField, current))

  // Overview groups: explicit sections, else one auto "Details" of the remaining
  // non-key fields (skipping ones already surfaced in the header).
  const shown = $derived(new Set([titleField, subtitleField, statusField, ...metricFields].filter(Boolean) as string[]))
  const groups = $derived.by<Section[]>(() => {
    if (sections.length) return sections
    const pk = idField
    const fields = schema.fields.filter((f) => f.field !== pk && !shown.has(f.field) && !(typeof f.hidden === 'object' && f.hidden.form) && f.hidden !== true).map((f) => f.field)
    return fields.length ? [{ label: 'Details', fields }] : []
  })

  const tabs = $derived(['Overview', ...related.map((r) => r.label)])
  let tab = $state(0)
  $effect(() => { if (tab >= tabs.length) tab = 0 })

  function childRows(rel: Related): Row[] {
    const key = String(current?.[rel.parentField ?? idField] ?? '')
    const list = (rel.rows ?? []).filter((c) => String(c[rel.foreignKey] ?? '') === key)
    if (rel.dateField) list.sort((a, b) => String(b[rel.dateField!] ?? '').localeCompare(String(a[rel.dateField!] ?? '')))
    return list
  }
  function childOpt(rel: Related, r: Row): { label: string; color: string } | undefined {
    if (!rel.statusField) return undefined
    const v = String(r[rel.statusField] ?? '')
    const o = rel.schema.fields.find((f) => f.field === rel.statusField)?.options?.find((x) => String(x.value) === v)
    return v ? { label: o?.label ?? v, color: o?.color ?? 'var(--sg-accent, #6366f1)' } : undefined
  }
  function fmtDate(v: unknown): string {
    if (v == null || v === '') return ''
    const s = String(v)
    const d = new Date(s)
    return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
</script>

<div class="sv-detail" style:height={height != null ? `${height}px` : undefined}>
  {#if loading && !current}
    <div class="sv-detail__sk sv-detail__sk--title"></div>
    <div class="sv-detail__sk sv-detail__sk--sub"></div>
    <div class="sv-detail__metrics">
      {#each [0, 1, 2] as m (m)}<div class="sv-detail__metric sv-detail__sk sv-detail__sk--metric"></div>{/each}
    </div>
    <div class="sv-detail__sk sv-detail__sk--row"></div>
    <div class="sv-detail__sk sv-detail__sk--row"></div>
  {:else if !current}
    <p class="sv-detail__hint">No record to show.</p>
  {:else}
    <header class="sv-detail__head" style:--accent={status?.color ?? 'var(--sg-accent, #6366f1)'}>
      <div class="sv-detail__head-main">
        <div class="sv-detail__titlerow">
          <h2 class="sv-detail__title">{fmt(titleField, current)}</h2>
          {#if status}<span class="sv-detail__status" style:--pill={status.color}>{status.label}</span>{/if}
        </div>
        {#if subtitleField}<div class="sv-detail__subtitle">{fmt(subtitleField, current)}</div>{/if}
      </div>
      {#if !row && rows.length > 1}
        <label class="sv-detail__switch">
          <span>Record</span>
          <select value={currentId} onchange={(e) => (picked = (e.currentTarget as HTMLSelectElement).value)}>
            {#each rows as r (String(r[idField]))}
              <option value={String(r[idField])}>{fmt(titleField, r)}</option>
            {/each}
          </select>
        </label>
      {/if}
    </header>

    {#if metricFields.length}
      <div class="sv-detail__metrics">
        {#each metricFields as m (m)}
          <div class="sv-detail__metric">
            <span class="sv-detail__metric-label">{labelOf(m)}</span>
            <span class="sv-detail__metric-value">{fmt(m, current)}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if tabs.length > 1}
      <div class="sv-detail__tabs" role="tablist">
        {#each tabs as t, i (t)}
          <button class="sv-detail__tab" class:is-active={tab === i} role="tab" aria-selected={tab === i} onclick={() => (tab = i)}>{t}</button>
        {/each}
      </div>
    {/if}

    <div class="sv-detail__body">
      {#if tab === 0}
        {#each groups as g (g.label)}
          <section class="sv-detail__section">
            {#if groups.length > 1 || g.label !== 'Details'}<h3 class="sv-detail__section-head">{g.label}</h3>{/if}
            <dl class="sv-detail__fields">
              {#each g.fields as f (f)}
                <div class="sv-detail__field">
                  <dt>{labelOf(f)}</dt>
                  <dd>{fmt(f, current)}</dd>
                </div>
              {/each}
            </dl>
          </section>
        {/each}
        {#if groups.length === 0}<p class="sv-detail__hint">No fields to show.</p>{/if}
      {:else}
        {@const rel = related[tab - 1]}
        {@const list = childRows(rel)}
        {#if list.length === 0}
          <p class="sv-detail__hint">No {rel.label.toLowerCase()} yet.</p>
        {:else}
          <ul class="sv-detail__timeline">
            {#each list as c (String(c[rel.schema.idField ?? 'id']))}
              {@const co = childOpt(rel, c)}
              <li class="sv-detail__event" style:--dot={co?.color ?? 'var(--sg-accent, #6366f1)'}>
                <span class="sv-detail__event-dot"></span>
                <div class="sv-detail__event-main">
                  <div class="sv-detail__event-title">{fmtChild(rel, rel.titleField, c) || '(untitled)'}</div>
                  {#if rel.subtitleField && c[rel.subtitleField] != null && c[rel.subtitleField] !== ''}
                    <div class="sv-detail__event-sub">{fmtChild(rel, rel.subtitleField, c)}</div>
                  {/if}
                </div>
                {#if co}<span class="sv-detail__event-status" style:--pill={co.color}>{co.label}</span>{/if}
                {#if rel.dateField}<time class="sv-detail__event-date">{fmtDate(c[rel.dateField])}</time>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .sv-detail {
    display: flex; flex-direction: column; gap: 14px; box-sizing: border-box;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px;
    padding: 18px 20px; overflow: auto; min-height: 220px;
  }
  .sv-detail__head { display: flex; align-items: flex-start; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--sg-border, #e6e8ec); position: relative; }
  .sv-detail__head::before { content: ''; position: absolute; left: -20px; top: -18px; bottom: 0; width: 4px; background: var(--accent, var(--sg-accent, #6366f1)); border-radius: 0 3px 3px 0; }
  .sv-detail__head-main { flex: 1; min-width: 0; }
  .sv-detail__titlerow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .sv-detail__title { margin: 0; font-size: 20px; font-weight: 700; color: var(--sg-fg, #0f172a); line-height: 1.2; }
  .sv-detail__subtitle { margin-top: 4px; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-detail__status { padding: 3px 11px; font-size: 12px; font-weight: 700; border-radius: 999px; color: var(--pill, #64748b); background: color-mix(in srgb, var(--pill, #64748b) 14%, transparent); white-space: nowrap; }
  .sv-detail__switch { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #94a3b8); }
  .sv-detail__switch select { font: inherit; font-size: 13px; text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 8px; padding: 6px 10px; max-width: 220px; }
  .sv-detail__metrics { display: flex; flex-wrap: wrap; gap: 10px; }
  .sv-detail__metric { flex: 1 1 120px; min-width: 110px; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: var(--sg-header-bg, #f6f7f9); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 10px; }
  .sv-detail__metric-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #94a3b8); }
  .sv-detail__metric-value { font-size: 19px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .sv-detail__tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--sg-border, #e6e8ec); }
  .sv-detail__tab { appearance: none; border: none; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .sv-detail__tab:hover { color: var(--sg-fg, #0f172a); }
  .sv-detail__tab.is-active { color: var(--sg-accent, #6366f1); border-bottom-color: var(--sg-accent, #6366f1); }
  .sv-detail__body { min-height: 60px; }
  .sv-detail__section + .sv-detail__section { margin-top: 18px; }
  .sv-detail__section-head { margin: 0 0 10px; font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .sv-detail__fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px 20px; margin: 0; }
  .sv-detail__field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .sv-detail__field dt { font-size: 11.5px; font-weight: 600; color: var(--sg-muted, #94a3b8); }
  .sv-detail__field dd { margin: 0; font-size: 14px; color: var(--sg-fg, #0f172a); overflow: hidden; text-overflow: ellipsis; }
  .sv-detail__timeline { list-style: none; margin: 0; padding: 4px 0 0; display: flex; flex-direction: column; }
  .sv-detail__event { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--sg-border, #eef0f3); position: relative; }
  .sv-detail__event:last-child { border-bottom: none; }
  .sv-detail__event-dot { flex: none; width: 9px; height: 9px; margin-top: 5px; border-radius: 50%; background: var(--dot, var(--sg-accent, #6366f1)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot, #6366f1) 18%, transparent); }
  .sv-detail__event-main { flex: 1; min-width: 0; }
  .sv-detail__event-title { font-size: 13.5px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .sv-detail__event-sub { margin-top: 2px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-detail__event-status { flex: none; padding: 2px 8px; font-size: 11px; font-weight: 700; border-radius: 999px; color: var(--pill, #64748b); background: color-mix(in srgb, var(--pill, #64748b) 14%, transparent); }
  .sv-detail__event-date { flex: none; font-size: 12px; color: var(--sg-muted, #94a3b8); white-space: nowrap; }
  .sv-detail__hint { color: var(--sg-muted, #64748b); font-size: 13px; padding: 18px 4px; }
  /* First-load skeleton. */
  .sv-detail__sk { position: relative; overflow: hidden; border-radius: 8px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); }
  .sv-detail__sk::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sg-bg, #fff) 55%, transparent), transparent); animation: sv-detail-sheen 1.2s ease-in-out infinite; }
  .sv-detail__sk--title { width: 240px; max-width: 60%; height: 22px; }
  .sv-detail__sk--sub { width: 160px; max-width: 40%; height: 13px; margin-top: 2px; }
  .sv-detail__sk--metric { height: 58px; }
  .sv-detail__sk--row { height: 46px; margin-top: 4px; }
  @keyframes sv-detail-sheen { 100% { transform: translateX(100%); } }
</style>
