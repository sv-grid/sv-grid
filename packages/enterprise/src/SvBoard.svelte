<script lang="ts">
  /**
   * SvBoard - a Kanban board over an entity's rows. Columns are the options of an
   * `enum` field (`groupBy`); each row is a card grouped into its column. Drag a
   * card to another column to change its `groupBy` value (fires `onMove`). A real
   * pipeline / task / ticket board, not a report - the signature view that makes a
   * Studio app read like a product.
   *
   * Pure presentation over plain rows + an EntitySchema (same inputs as
   * SvSchemaChart / SvGridEditPanel), so both the generated app and the designer
   * preview render it identically.
   */
  import type { EntitySchema, EntityField } from './schema'

  type Row = Record<string, unknown>

  let {
    schema,
    rows = [],
    groupBy,
    titleField,
    badgeField,
    subtitleField,
    onMove,
    onOpen,
    loading = false,
    height,
  }: {
    // Accept any specialized EntitySchema<T> (the type param is invariant); this is
    // pure presentation over the schema's field metadata + plain record rows.
    schema: EntitySchema<any>
    rows?: ReadonlyArray<Row>
    /** Show shimmer placeholders (first load) instead of columns. */
    loading?: boolean
    /** The enum field whose options become the columns. */
    groupBy: string
    /** Field shown as the card title. */
    titleField: string
    /** Optional numeric/text field shown as a chip on the card. */
    badgeField?: string
    /** Optional secondary line on the card. */
    subtitleField?: string
    /** Called with (rowId, newColumnValue) when a card is dropped in a column. */
    onMove?: (id: string, value: string) => void
    /** Called with the card's row id when it is clicked (drill to a detail page). */
    onOpen?: (id: string) => void
    height?: number
  } = $props()

  const idField = $derived(schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id')
  const fieldOf = (name?: string): EntityField | undefined => (name ? schema.fields.find((f) => f.field === name) : undefined)
  const groupField = $derived(fieldOf(groupBy))
  const badgeIsMoney = $derived(/\$/.test(fieldOf(badgeField)?.label ?? ''))

  /** The columns: the groupBy field's enum options (value + label + color). */
  const columns = $derived(
    (groupField?.options ?? []).map((o) => ({ value: String(o.value), label: o.label ?? String(o.value), color: o.color ?? 'var(--sg-accent, #6366f1)' })),
  )

  const cardsFor = (value: string): Row[] => rows.filter((r) => String(r[groupBy] ?? '') === value)

  function badgeText(r: Row): string {
    if (!badgeField) return ''
    const v = r[badgeField]
    if (v == null || v === '') return ''
    if (typeof v === 'number') return badgeIsMoney ? '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toLocaleString()
    return String(v)
  }

  let dragId = $state<string | null>(null)
  let overCol = $state<string | null>(null)
  function onDragStart(e: DragEvent, id: string) {
    dragId = id
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }
  }
  function onDrop(value: string) {
    if (dragId != null) {
      const from = rows.find((r) => String(r[idField]) === dragId)
      if (from && String(from[groupBy] ?? '') !== value) onMove?.(dragId, value)
    }
    dragId = null
    overCol = null
  }
</script>

<div class="sv-board" style:height={height != null ? `${height}px` : undefined}>
  {#if loading}
    {#each [0, 1, 2] as c (c)}
      <section class="sv-board__col sv-board__col--skeleton">
        <header class="sv-board__colhead"><span class="sv-board__sk sv-board__sk--head"></span></header>
        <div class="sv-board__cards">
          {#each [0, 1] as k (k)}<div class="sv-board__card sv-board__sk sv-board__sk--card"></div>{/each}
        </div>
      </section>
    {/each}
  {:else if columns.length > 0 && rows.length === 0}
    <div class="sv-board__blank">
      <div class="sv-board__blank-mark" aria-hidden="true"></div>
      <p>No records yet. New items will appear as cards here.</p>
    </div>
  {:else}
  {#each columns as col (col.value)}
    {@const cards = cardsFor(col.value)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <section
      class="sv-board__col"
      class:is-over={overCol === col.value}
      ondragover={(e) => { e.preventDefault(); overCol = col.value }}
      ondragleave={() => { if (overCol === col.value) overCol = null }}
      ondrop={(e) => { e.preventDefault(); onDrop(col.value) }}
    >
      <header class="sv-board__colhead" style:--col={col.color}>
        <span class="sv-board__dot"></span>
        <span class="sv-board__coltitle">{col.label}</span>
        <span class="sv-board__count">{cards.length}</span>
      </header>
      <div class="sv-board__cards">
        {#each cards as r (String(r[idField]))}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_tabindex -->
          <article
            class="sv-board__card"
            class:is-dragging={dragId === String(r[idField])}
            class:is-clickable={!!onOpen}
            style:--col={col.color}
            draggable="true"
            ondragstart={(e) => onDragStart(e, String(r[idField]))}
            ondragend={() => { dragId = null; overCol = null }}
            role={onOpen ? 'button' : undefined}
            tabindex={onOpen ? 0 : undefined}
            onclick={onOpen ? () => onOpen(String(r[idField])) : undefined}
            onkeydown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(String(r[idField])) } } : undefined}
          >
            <div class="sv-board__card-title">{String(r[titleField] ?? '(untitled)')}</div>
            {#if subtitleField && r[subtitleField] != null && r[subtitleField] !== ''}
              <div class="sv-board__card-sub">{String(r[subtitleField])}</div>
            {/if}
            {#if badgeText(r)}<span class="sv-board__badge">{badgeText(r)}</span>{/if}
          </article>
        {/each}
        {#if cards.length === 0}<div class="sv-board__empty">Drop here</div>{/if}
      </div>
    </section>
  {/each}
  {#if columns.length === 0}
    <p class="sv-board__hint">Set <code>groupBy</code> to an enum field to build the board columns.</p>
  {/if}
  {/if}
</div>

<style>
  .sv-board {
    display: flex; gap: 14px; align-items: flex-start; overflow-x: auto; padding: 4px;
    min-height: 260px; box-sizing: border-box;
  }
  .sv-board__col {
    flex: 0 0 clamp(240px, 22vw, 300px); display: flex; flex-direction: column; gap: 10px; min-height: 120px;
    background: var(--sg-header-bg, #f6f7f9); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px;
    padding: 12px; transition: background 0.12s, box-shadow 0.12s;
  }
  .sv-board__col.is-over { background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, var(--sg-header-bg, #f6f7f9)); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sg-accent, #6366f1) 40%, transparent); }
  .sv-board__colhead { display: flex; align-items: center; gap: 8px; padding: 0 2px 2px; }
  .sv-board__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--col, var(--sg-accent, #6366f1)); flex: none; }
  .sv-board__coltitle { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-fg, #0f172a); }
  .sv-board__count { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--sg-muted, #64748b); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 999px; }
  .sv-board__cards { display: flex; flex-direction: column; gap: 8px; min-height: 40px; }
  .sv-board__card {
    position: relative; background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-left: 3px solid var(--col, var(--sg-accent, #6366f1));
    border-radius: 9px; padding: 10px 12px; cursor: grab; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); user-select: none;
    transition: box-shadow 0.12s, transform 0.06s;
  }
  .sv-board__card:hover { box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.18); }
  .sv-board__card.is-clickable:hover { border-color: color-mix(in srgb, var(--col, #6366f1) 45%, var(--sg-border, #e6e8ec)); }
  .sv-board__card.is-clickable:focus-visible { outline: 2px solid var(--col, #6366f1); outline-offset: 2px; }
  .sv-board__card:active { cursor: grabbing; }
  .sv-board__card.is-dragging { opacity: 0.5; }
  .sv-board__card-title { font-size: 13.5px; font-weight: 600; color: var(--sg-fg, #0f172a); line-height: 1.35; }
  .sv-board__card-sub { margin-top: 3px; font-size: 12px; color: var(--sg-muted, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-board__badge {
    display: inline-flex; margin-top: 8px; padding: 2px 8px; font-size: 11.5px; font-weight: 700; border-radius: 999px;
    color: var(--col, var(--sg-accent, #6366f1)); background: color-mix(in srgb, var(--col, #6366f1) 14%, transparent);
  }
  .sv-board__empty { padding: 14px; text-align: center; font-size: 12px; color: var(--sg-muted, #94a3b8); border: 1px dashed var(--sg-border, #e6e8ec); border-radius: 8px; }
  .sv-board__hint { color: var(--sg-muted, #64748b); font-size: 13px; padding: 20px; }
  .sv-board__hint code { background: var(--sg-header-bg, #f1f5f9); padding: 1px 5px; border-radius: 5px; }
  /* First-load skeleton + empty state. */
  .sv-board__col--skeleton { pointer-events: none; }
  .sv-board__sk { position: relative; overflow: hidden; background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); border: none; }
  .sv-board__sk::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sg-bg, #fff) 55%, transparent), transparent); animation: sv-board-sheen 1.2s ease-in-out infinite; }
  .sv-board__sk--head { display: block; width: 55%; height: 12px; border-radius: 5px; }
  .sv-board__sk--card { height: 52px; box-shadow: none; }
  @keyframes sv-board-sheen { 100% { transform: translateX(100%); } }
  .sv-board__blank { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 200px; color: var(--sg-muted, #94a3b8); font-size: 13.5px; text-align: center; }
  .sv-board__blank-mark { width: 42px; height: 42px; border-radius: 11px; border: 2px dashed var(--sg-border, #cbd5e1); }
</style>
