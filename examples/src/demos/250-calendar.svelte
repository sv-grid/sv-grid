<script lang="ts">
  /**
   * SvCalendar - a standalone, themeable calendar that is ALSO the SvGrid date
   * cell editor. Everything here is the same component the grid mounts when you
   * edit a date column; drop it into any app that already uses SvGrid.
   */
  import { SvCalendar } from '@svgrid/grid'
  import type { SelectionMode, CalendarAnimation } from '@svgrid/grid'

  let mode = $state<SelectionMode>('one')
  let weekNumbers = $state(false)
  let footer = $state(true)
  let firstDayOfWeek = $state(0)
  let months = $state(1)
  let noWeekends = $state(false)
  let animate = $state<CalendarAnimation>('slide')
  let wheelNavigation = $state(true)
  let value = $state<Date[]>([new Date()])

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
  const y = new Date().getFullYear()
  const m = new Date().getMonth()
  const importantDates = [new Date(y, m, 14), new Date(y, m, 25)]
  // A tooltip for the important days (Smart-style importantDatesTemplate).
  const labels: Record<number, string> = { 14: 'Team offsite', 25: 'Release day' }
  const dateTooltip = (d: Date) =>
    d.getMonth() === m ? labels[d.getDate()] : undefined
  const restrictWeekends = (d: Date) => noWeekends && (d.getDay() === 0 || d.getDay() === 6)

  const modes: SelectionMode[] = ['one', 'zeroOrOne', 'many', 'range', 'week', 'oneExtended']
  const anims: CalendarAnimation[] = ['slide', 'fade', 'none']
</script>

<div class="wrap">
  <header>
    <h2>SvCalendar</h2>
    <p>
      A framework-free date engine behind a themed Svelte 5 view. It works standalone (below) and is
      the <strong>date cell editor inside SvGrid</strong> - the exact same component. Every
      <code>--sg-*</code> theme applies automatically.
    </p>
  </header>

  <div class="controls">
    <label>Selection
      <select bind:value={mode}>
        {#each modes as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
    <label>First day
      <select bind:value={firstDayOfWeek}>
        <option value={0}>Sunday</option>
        <option value={1}>Monday</option>
      </select>
    </label>
    <label>Panels
      <select bind:value={months}>
        <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
      </select>
    </label>
    <label>Animation
      <select bind:value={animate}>
        {#each anims as a (a)}<option value={a}>{a}</option>{/each}
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={wheelNavigation} /> Mouse-wheel nav</label>
    <label class="chk"><input type="checkbox" bind:checked={weekNumbers} /> Week numbers</label>
    <label class="chk"><input type="checkbox" bind:checked={footer} /> Footer</label>
    <label class="chk"><input type="checkbox" bind:checked={noWeekends} /> Block weekends</label>
  </div>

  <div class="stage">
    <SvCalendar
      value={value}
      selectionMode={mode}
      {weekNumbers}
      {footer}
      {firstDayOfWeek}
      {months}
      {animate}
      {wheelNavigation}
      {dateTooltip}
      importantDates={importantDates}
      restrictedDates={restrictWeekends}
      onChange={(dates) => (value = dates)}
    />

    <aside class="readout">
      <h3>Selected value</h3>
      {#if value.length === 0}
        <p class="empty">Nothing selected</p>
      {:else if value.length <= 3}
        <ul>{#each value as d (d.getTime())}<li>{fmt.format(d)}</li>{/each}</ul>
      {:else}
        <p><strong>{value.length}</strong> days</p>
        <p class="range">{fmt.format(value[0]!)} &ndash; {fmt.format(value[value.length - 1]!)}</p>
      {/if}
      <p class="hint">Dots mark <em>important</em> dates (hover the 14th / 25th for a tooltip). Strikethrough marks restricted days. Scroll over the grid or use the arrows to change months - watch the transition.</p>
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 640px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: end; }
  .controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .controls label.chk { flex-direction: row; align-items: center; gap: 6px; }
  .controls select { padding: 5px 8px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: inherit; font: inherit; font-size: 13px; }
  .stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .readout { flex: 1; min-width: 200px; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .readout ul { margin: 0; padding-left: 18px; }
  .readout li { font-size: 14px; margin-bottom: 2px; }
  .readout .empty { color: var(--sg-muted, #94a3b8); font-style: italic; }
  .readout .range { font-size: 13px; color: var(--sg-muted, #64748b); }
  .readout .hint { margin-top: 14px; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
</style>
