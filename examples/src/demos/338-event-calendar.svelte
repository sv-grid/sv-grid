<script lang="ts">
  /**
   * Event calendar - the extended SvCalendar as a FullCalendar-style scheduler.
   * Two new capabilities do the work:
   *   - the `day` snippet renders rich content (event chips) in each cell, and
   *   - `recurrence` marks repeating days (the standup ring) and drives the
   *     recurring events via `matchesRecurrence`.
   * SvCalendar still owns navigation, keyboard, selection and theming.
   */
  import { SvCalendar, matchesRecurrence, type RecurrenceRule, type CalendarDayState } from '@svgrid/grid'

  type Category = 'meeting' | 'deadline' | 'review' | 'focus' | 'personal'
  type Ev = { title: string; time?: string; category: Category }

  const CATS: Record<Category, { label: string; color: string }> = {
    meeting: { label: 'Meeting', color: '#2563eb' },
    deadline: { label: 'Deadline', color: '#dc2626' },
    review: { label: 'Review', color: '#7c3aed' },
    focus: { label: 'Focus', color: '#0891b2' },
    personal: { label: 'Personal', color: '#16a34a' },
  }

  const now = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const rel = (offset: number) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset); return d }

  // --- Recurring events, expressed as repeat patterns ------------------------
  const recurring: { rule: RecurrenceRule; ev: Ev }[] = [
    { rule: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }, ev: { title: 'Standup', time: '09:15', category: 'meeting' } },
    { rule: { freq: 'weekly', weekdays: [1], interval: 2, from: iso(rel(-(now.getDay() + 6) % 14)) }, ev: { title: 'Sprint planning', time: '10:00', category: 'meeting' } },
    { rule: { freq: 'weekly', weekdays: [5] }, ev: { title: 'Weekly review', time: '16:00', category: 'review' } },
    { rule: { freq: 'monthly', day: 1 }, ev: { title: 'Invoices due', category: 'deadline' } },
  ]
  // The union of recurring rules -> SvCalendar draws the "repeats" ring on these days.
  const recurrenceRules = recurring.map((r) => r.rule)

  // --- One-off events (keyed by ISO date) ------------------------------------
  const oneOff: Record<string, Ev[]> = {
    [iso(rel(0))]: [{ title: '1:1 with Sam', time: '11:00', category: 'meeting' }, { title: 'Focus: API refactor', time: '13:00', category: 'focus' }, { title: 'Ship v1.3', category: 'deadline' }],
    [iso(rel(1))]: [{ title: 'Customer call', time: '15:30', category: 'meeting' }],
    [iso(rel(2))]: [{ title: 'Team lunch', time: '12:00', category: 'personal' }, { title: 'Retro', time: '16:00', category: 'review' }],
    [iso(rel(4))]: [{ title: 'Release freeze', category: 'deadline' }],
    [iso(rel(5))]: [{ title: 'Conference talk', time: '09:00', category: 'personal' }],
    [iso(rel(-2))]: [{ title: 'Design review', time: '14:00', category: 'review' }],
    [iso(rel(9))]: [{ title: 'Security audit', category: 'deadline' }],
  }

  function eventsOn(date: Date): Ev[] {
    const out: Ev[] = []
    for (const { rule, ev } of recurring) if (matchesRecurrence(date, rule)) out.push(ev)
    out.push(...(oneOff[iso(date)] ?? []))
    return out.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }

  let selected = $state<Date | null>(rel(0))
  const selectedEvents = $derived(selected ? eventsOn(selected) : [])
  const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const MAX = 3
</script>

<div class="wrap">
  <header>
    <h2>Event calendar</h2>
    <p>The extended <code>SvCalendar</code>: the <code>day</code> snippet fills each cell with event chips, and <code>recurrence</code> patterns mark repeating days (the ring on weekday standups) and generate their events. Navigation, keyboard and theming are the component's.</p>
  </header>

  <div class="layout">
    <SvCalendar
      value={selected}
      onChange={(d) => (selected = d[0] ?? null)}
      recurrence={recurrenceRules}
      weeks={6}
    >
      {#snippet day(date: Date, _state: CalendarDayState)}
        {@const evs = eventsOn(date)}
        {#each evs.slice(0, MAX) as e, i (i)}
          <span class="ev" style:--c={CATS[e.category].color} title={`${e.time ? e.time + ' ' : ''}${e.title}`}>
            <span class="ev__dot"></span>
            {#if e.time}<span class="ev__time">{e.time}</span>{/if}
            <span class="ev__title">{e.title}</span>
          </span>
        {/each}
        {#if evs.length > MAX}<span class="ev__more">+{evs.length - MAX} more</span>{/if}
      {/snippet}
    </SvCalendar>

    <aside class="detail">
      {#if selected}
        <div class="detail__date">{longDate(selected)}</div>
        {#if selectedEvents.length}
          <ul class="detail__list">
            {#each selectedEvents as e, i (i)}
              <li class="detail__item" style:--c={CATS[e.category].color}>
                <span class="ev__dot"></span>
                <span class="detail__time">{e.time ?? 'All day'}</span>
                <span class="detail__title">{e.title}</span>
                <span class="detail__cat">{CATS[e.category].label}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="detail__empty">No events.</p>
        {/if}
      {:else}
        <p class="detail__empty">Pick a day.</p>
      {/if}

      <div class="legend">
        {#each Object.entries(CATS) as [key, c] (key)}
          <span class="legend__it"><span class="ev__dot" style:--c={c.color}></span>{c.label}</span>
        {/each}
      </div>
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 1040px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0 0 18px; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  header code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; font-size: 12px; }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 18px; align-items: start; }
  @media (max-width: 820px) { .layout { grid-template-columns: 1fr; } }

  /* The calendar fills the left column (rich mode makes cells flex to fit). */
  .layout :global(.sv-cal) { width: 100%; }
  .layout :global(.sv-cal__main) { width: 100%; }

  /* Event chips inside each day cell (rendered by the `day` snippet). */
  .ev {
    display: flex; align-items: center; gap: 5px; min-width: 0;
    padding: 1px 6px; border-radius: 5px; font-size: 11px; line-height: 1.35;
    background: color-mix(in srgb, var(--c) 14%, transparent);
    color: color-mix(in srgb, var(--c) 74%, var(--sg-fg, #0f172a));
  }
  .ev__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--sg-accent, #2563eb)); }
  .ev__time { flex: none; font-weight: 650; font-variant-numeric: tabular-nums; opacity: 0.85; }
  .ev__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ev__more { font-size: 10.5px; font-weight: 600; color: var(--sg-muted, #64748b); padding-inline-start: 2px; }

  .detail {
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; padding: 14px 16px;
    background: var(--sg-bg, #fff); display: flex; flex-direction: column; gap: 10px;
  }
  .detail__date { font-size: 14px; font-weight: 650; }
  .detail__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .detail__item { display: grid; grid-template-columns: 8px 54px 1fr; grid-template-areas: 'dot time title' '. cat cat'; align-items: center; gap: 3px 8px; font-size: 13px; }
  .detail__item .ev__dot { grid-area: dot; }
  .detail__time { grid-area: time; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .detail__title { grid-area: title; font-weight: 550; }
  .detail__cat { grid-area: cat; justify-self: start; font-size: 11px; padding: 1px 8px; border-radius: 999px; color: var(--c); background: color-mix(in srgb, var(--c) 13%, transparent); }
  .detail__empty { color: var(--sg-muted, #94a3b8); font-size: 13px; margin: 4px 0; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px 14px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--sg-border, #eef1f5); }
  .legend__it { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--sg-muted, #64748b); }
</style>
