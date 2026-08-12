<script lang="ts">
  /**
   * SvSchedule - a month event-calendar over an entity's rows. Each row with a
   * `dateField` value is placed as an event chip on its day; `titleField` is the
   * chip label and an optional enum `colorField` tints it. A real scheduling view
   * (appointments / events / bookings / shifts) - the signature calendar that makes
   * a Studio app read like a product, not a report.
   *
   * Pure presentation over plain rows + an EntitySchema (same inputs as SvBoard /
   * SvSchemaChart), so the generated app and the designer preview match.
   */
  import type { EntitySchema } from './schema'

  type Row = Record<string, unknown>

  let {
    schema,
    rows = [],
    dateField,
    titleField,
    colorField,
    onSelect,
    loading = false,
    height,
  }: {
    // Accept any specialized EntitySchema<T> (the type param is invariant); this is
    // pure presentation over the schema's field metadata + plain record rows.
    schema: EntitySchema<any>
    rows?: ReadonlyArray<Row>
    /** The date / datetime field that places a row on the calendar. */
    dateField: string
    /** Field shown as the event chip label. */
    titleField: string
    /** Optional enum field whose option color tints the chip. */
    colorField?: string
    onSelect?: (id: string) => void
    /** Dim the grid + show a loading note during first load. */
    loading?: boolean
    height?: number
  } = $props()

  const idField = $derived(schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id')
  const colorMap = $derived.by(() => {
    const m = new Map<string, string>()
    schema.fields.find((f) => f.field === colorField)?.options?.forEach((o) => { if (o.color) m.set(String(o.value), o.color) })
    return m
  })

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  function parse(v: unknown): Date | null {
    if (v == null || v === '') return null
    const d = new Date(String(v))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const events = $derived(rows.map((r) => ({ r, d: parse(r[dateField]) })).filter((e): e is { r: Row; d: Date } => e.d != null))
  // Anchor the view to the BUSIEST month (most events) so the calendar always opens
  // on data, not an empty month; ties break to the earliest. Falls back to today.
  const anchor = $derived.by(() => {
    if (events.length === 0) return startOfMonth(new Date())
    const buckets = new Map<string, { start: Date; n: number }>()
    for (const e of events) {
      const key = `${e.d.getFullYear()}-${e.d.getMonth()}`
      const cur = buckets.get(key)
      if (cur) cur.n += 1
      else buckets.set(key, { start: startOfMonth(e.d), n: 1 })
    }
    return [...buckets.values()].sort((a, b) => b.n - a.n || a.start.getTime() - b.start.getTime())[0]!.start
  })
  let offset = $state(0)
  const viewMonth = $derived(addMonths(anchor, offset))
  const monthLabel = $derived(viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' }))

  const days = $derived.by(() => {
    const first = viewMonth
    const start = new Date(first)
    start.setDate(1 - first.getDay()) // back to the Sunday on/before the 1st
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  })
  const eventsOn = (d: Date) => events.filter((e) => sameDay(e.d, d))
  const today = new Date()
</script>

<div class="sv-sched" style:height={height != null ? `${height}px` : undefined}>
  <header class="sv-sched__bar">
    <strong class="sv-sched__month">{monthLabel}</strong>
    <div class="sv-sched__nav">
      <button type="button" class="sv-sched__btn" aria-label="Previous month" onclick={() => (offset -= 1)}>&lsaquo;</button>
      <button type="button" class="sv-sched__btn sv-sched__today" onclick={() => (offset = 0)}>Today</button>
      <button type="button" class="sv-sched__btn" aria-label="Next month" onclick={() => (offset += 1)}>&rsaquo;</button>
    </div>
  </header>
  <div class="sv-sched__weekdays">
    {#each WEEKDAYS as w (w)}<span class="sv-sched__wd">{w}</span>{/each}
  </div>
  <div class="sv-sched__grid">
    {#each days as d (d.getTime())}
      {@const evs = eventsOn(d)}
      {@const outside = d.getMonth() !== viewMonth.getMonth()}
      <div class="sv-sched__cell" class:is-outside={outside} class:is-today={sameDay(d, today)}>
        <span class="sv-sched__daynum">{d.getDate()}</span>
        <div class="sv-sched__evs">
          {#each evs.slice(0, 3) as e (String(e.r[idField]))}
            {@const c = colorMap.get(String(e.r[colorField ?? ''])) ?? 'var(--sg-accent, #6366f1)'}
            {#if onSelect}
              <button type="button" class="sv-sched__ev sv-sched__ev--btn" style:--c={c} title={String(e.r[titleField] ?? '')} onclick={() => onSelect(String(e.r[idField]))}>
                <span class="sv-sched__ev-dot"></span>{String(e.r[titleField] ?? '(untitled)')}
              </button>
            {:else}
              <span class="sv-sched__ev" style:--c={c} title={String(e.r[titleField] ?? '')}>
                <span class="sv-sched__ev-dot"></span>{String(e.r[titleField] ?? '(untitled)')}
              </span>
            {/if}
          {/each}
          {#if evs.length > 3}<span class="sv-sched__more">+{evs.length - 3} more</span>{/if}
        </div>
      </div>
    {/each}
  </div>
  {#if loading}
    <div class="sv-sched__overlay"><span class="sv-sched__spinner" aria-hidden="true"></span>Loading…</div>
  {:else if rows.length === 0}
    <div class="sv-sched__overlay">No events scheduled yet.</div>
  {/if}
</div>

<style>
  .sv-sched {
    position: relative;
    display: flex; flex-direction: column; min-height: 420px; box-sizing: border-box;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; overflow: hidden;
  }
  .sv-sched__overlay { position: absolute; inset: 46px 0 0; display: flex; align-items: center; justify-content: center; gap: 10px; background: color-mix(in srgb, var(--sg-bg, #fff) 72%, transparent); backdrop-filter: blur(1px); color: var(--sg-muted, #64748b); font-size: 13.5px; }
  .sv-sched__spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--sg-border, #e6e8ec); border-top-color: var(--sg-accent, #6366f1); animation: sv-sched-spin 0.7s linear infinite; }
  @keyframes sv-sched-spin { to { transform: rotate(360deg); } }
  .sv-sched__ev--btn { appearance: none; width: 100%; text-align: left; border: none; font: inherit; }
  .sv-sched__bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--sg-border, #e6e8ec); }
  .sv-sched__month { font-size: 15px; font-weight: 750; color: var(--sg-fg, #0f172a); }
  .sv-sched__nav { display: flex; gap: 4px; }
  .sv-sched__btn { min-width: 30px; height: 30px; padding: 0 10px; display: inline-flex; align-items: center; justify-content: center; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); background: var(--sg-header-bg, #f6f7f9); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 8px; cursor: pointer; }
  .sv-sched__btn:hover { background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, var(--sg-header-bg, #f6f7f9)); }
  .sv-sched__weekdays { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--sg-border, #e6e8ec); }
  .sv-sched__wd { padding: 7px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8); text-align: right; }
  .sv-sched__grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 1fr; min-height: 0; }
  .sv-sched__cell { border-right: 1px solid var(--sg-border, #eef0f3); border-bottom: 1px solid var(--sg-border, #eef0f3); padding: 4px 5px; min-height: 62px; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
  .sv-sched__cell:nth-child(7n) { border-right: 0; }
  .sv-sched__cell.is-outside { background: color-mix(in srgb, var(--sg-header-bg, #f6f7f9) 55%, transparent); }
  .sv-sched__daynum { align-self: flex-end; font-size: 11.5px; font-weight: 600; color: var(--sg-muted, #64748b); padding: 1px 3px; }
  .sv-sched__cell.is-outside .sv-sched__daynum { color: var(--sg-muted, #b6bdc7); }
  .sv-sched__cell.is-today .sv-sched__daynum { background: var(--sg-accent, #6366f1); color: #fff; border-radius: 999px; min-width: 18px; text-align: center; }
  .sv-sched__evs { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sv-sched__ev { display: flex; align-items: center; gap: 5px; padding: 2px 6px; font-size: 11px; font-weight: 600; border-radius: 5px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c, var(--sg-accent, #6366f1)); background: color-mix(in srgb, var(--c, #6366f1) 13%, transparent); }
  .sv-sched__ev-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--sg-accent, #6366f1)); flex: none; }
  .sv-sched__more { font-size: 10.5px; font-weight: 600; color: var(--sg-muted, #94a3b8); padding: 0 4px; }
</style>
