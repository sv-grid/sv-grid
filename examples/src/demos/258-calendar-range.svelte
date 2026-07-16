<script lang="ts">
  /**
   * SvCalendar as a DATE-RANGE picker with a one-click presets rail (Today,
   * Last 7 days, This month, ...) and animated month navigation. The presets
   * rail + range band are all built into SvCalendar - `selectionMode="range"`
   * plus a `presets` array. Every `--sg-*` theme styles it automatically.
   */
  import { SvCalendar } from '@svgrid/grid'
  import type { CalendarPreset, CalendarAnimation } from '@svgrid/grid'

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  // A range value is the FULL inclusive span (so every day in it renders selected).
  const spanDays = (a: Date, b: Date) => {
    const out: Date[] = []
    for (let c = startOfDay(a); c <= b; c = addDays(c, 1)) out.push(c)
    return out
  }

  // Relative presets resolve at click time (Smart-style shortcuts).
  const presets: CalendarPreset[] = [
    { label: 'Today', value: () => { const t = startOfDay(new Date()); return [t, t] } },
    { label: 'Yesterday', value: () => { const y = addDays(startOfDay(new Date()), -1); return [y, y] } },
    { label: 'Last 7 days', value: () => [addDays(startOfDay(new Date()), -6), startOfDay(new Date())] },
    { label: 'Last 30 days', value: () => [addDays(startOfDay(new Date()), -29), startOfDay(new Date())] },
    { label: 'This month', value: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), startOfDay(n)] } },
    { label: 'Last month', value: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)] } },
    { label: 'Year to date', value: () => [new Date(new Date().getFullYear(), 0, 1), startOfDay(new Date())] },
  ]

  let animate = $state<CalendarAnimation>('slide')
  let months = $state(2)
  let value = $state<Date[]>(spanDays(addDays(startOfDay(new Date()), -6), startOfDay(new Date())))

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
  const start = $derived(value[0])
  const end = $derived(value[value.length - 1])
  const nights = $derived(start && end ? Math.round((+end - +start) / 86400000) : 0)
</script>

<div class="wrap">
  <header>
    <h2>Date-range picker</h2>
    <p>
      <code>selectionMode="range"</code> with a <strong>presets rail</strong> and animated navigation.
      Click two days to draw a range, or pick a shortcut. This is the same
      <code>SvCalendar</code> the grid uses - no extra component.
    </p>
  </header>

  <div class="controls">
    <label>Animation
      <select bind:value={animate}>
        <option value="slide">slide</option><option value="fade">fade</option><option value="none">none</option>
      </select>
    </label>
    <label>Panels
      <select bind:value={months}>
        <option value={1}>1</option><option value={2}>2</option>
      </select>
    </label>
  </div>

  <div class="stage">
    <SvCalendar
      value={value}
      selectionMode="range"
      {months}
      {animate}
      {presets}
      wheelNavigation
      firstDayOfWeek={1}
      onChange={(dates) => (value = dates)}
    />

    <aside class="readout">
      <h3>Selected range</h3>
      {#if start && end}
        <p class="big">{fmt.format(start)}</p>
        <p class="arrow">&darr;</p>
        <p class="big">{fmt.format(end)}</p>
        <p class="nights"><strong>{nights}</strong> night{nights === 1 ? '' : 's'} &middot; {nights + 1} days</p>
      {:else}
        <p class="empty">Pick a start and end day</p>
      {/if}
      <p class="hint">Shortcuts on the left resolve relative to today. Scroll the grid to change months.</p>
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 940px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 660px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: end; }
  .controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .controls select { padding: 5px 8px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: inherit; font: inherit; font-size: 13px; }
  .stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .readout { flex: 1; min-width: 200px; }
  .readout h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .readout .big { margin: 0; font-size: 17px; font-weight: 650; }
  .readout .arrow { margin: 2px 0; color: var(--sg-muted, #94a3b8); }
  .readout .nights { margin: 10px 0 0; font-size: 14px; }
  .readout .empty { color: var(--sg-muted, #94a3b8); font-style: italic; }
  .readout .hint { margin-top: 14px; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
</style>
