<script lang="ts">
  /**
   * SvDateTimePicker in the shapes you actually ship: a date-only field, a
   * time-only field, a full date+time field, a 12-hour field with spin buttons,
   * and a min/max-constrained field - all in one form. Each is a masked text
   * input (type OR pick) with a portalled dropdown; the calendar animates.
   * The same component the grid mounts to edit a `datetime` cell.
   */
  import { SvDateTimePicker } from '@svgrid/grid'

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in90 = new Date(+todayStart + 90 * 86400000)

  let date = $state<Date | null>(todayStart)
  let time = $state<Date | null>(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30))
  let dateTime = $state<Date | null>(now)
  let meeting = $state<Date | null>(null)
  let booking = $state<Date | null>(null)

  const long = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' })
  const show = (d: Date | null) => (d ? long.format(d) : '-')

  const fields = $derived([
    ['Date only', date],
    ['Time only', time],
    ['Date + time', dateTime],
    ['12-hour + spinners', meeting],
    ['Constrained (next 90 days)', booking],
  ] as const)
</script>

<div class="wrap">
  <header>
    <h2>Date-time picker - form fields</h2>
    <p>
      <code>SvDateTimePicker</code> = a masked input plus a portalled DATE / TIME dropdown.
      Type a value or pick it; bad input reverts. Below: five common configurations. The dropdown
      calendar uses <code>animate</code>, so navigating months slides.
    </p>
  </header>

  <div class="grid">
    <form class="card">
      <label>
        <span>Date only <em>(calendar tab only)</em></span>
        <SvDateTimePicker
          value={date}
          dropDownDisplayMode="calendar"
          formatString="yyyy-MM-dd"
          placeholder="Pick a date"
          animate="slide"
          onChange={(v) => (date = v)}
        />
      </label>

      <label>
        <span>Time only <em>(clock tab only)</em></span>
        <SvDateTimePicker
          value={time}
          dropDownDisplayMode="time"
          formatString="HH:mm"
          placeholder="Pick a time"
          onChange={(v) => (time = v)}
        />
      </label>

      <label>
        <span>Date + time <em>(both tabs)</em></span>
        <SvDateTimePicker
          value={dateTime}
          formatString="yyyy-MM-dd HH:mm"
          placeholder="When?"
          animate="slide"
          weekNumbers
          onChange={(v) => (dateTime = v)}
        />
      </label>

      <label>
        <span>12-hour + spin buttons <em>(arrow-key / button steps)</em></span>
        <SvDateTimePicker
          value={meeting}
          formatString="MM/dd/yyyy hh:mm a"
          hourFormat="12-hour"
          minuteInterval={5}
          spinButtons
          stepMinutes={15}
          placeholder="MM/DD/YYYY hh:mm AM"
          animate="slide"
          onChange={(v) => (meeting = v)}
        />
      </label>

      <label>
        <span>Constrained <em>(today &rarr; +90 days)</em></span>
        <SvDateTimePicker
          value={booking}
          min={todayStart}
          max={in90}
          firstDayOfWeek={1}
          formatString="yyyy-MM-dd HH:mm"
          placeholder="Within 90 days"
          animate="slide"
          onChange={(v) => (booking = v)}
        />
      </label>
    </form>

    <aside class="readout">
      <h3>Values</h3>
      <dl>
        {#each fields as [label, val] (label)}
          <dt>{label}</dt>
          <dd class:empty={!val}>{show(val)}</dd>
        {/each}
      </dl>
      <p class="hint">Constrained field: days outside the window are struck through and the typed value clamps in.</p>
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 940px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .grid { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
  .card { display: flex; flex-direction: column; gap: 16px; min-width: 280px; }
  .card label { display: flex; flex-direction: column; gap: 6px; }
  .card label > span { font-size: 12.5px; font-weight: 650; color: var(--sg-fg, #0f172a); }
  .card label em { font-weight: 400; font-style: normal; color: var(--sg-muted, #94a3b8); }
  .readout { flex: 1; min-width: 240px; }
  .readout h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .readout dl { margin: 0; display: grid; grid-template-columns: 1fr; gap: 10px; }
  .readout dt { font-size: 12px; font-weight: 650; color: var(--sg-muted, #64748b); }
  .readout dd { margin: 2px 0 0; font-size: 14px; }
  .readout dd.empty { color: var(--sg-muted, #94a3b8); font-style: italic; }
  .readout .hint { margin-top: 16px; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
</style>
