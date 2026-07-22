<script lang="ts">
  /**
   * Appointment booking - a scheduling form composed from the SvGrid UI kit:
   * SvComboBox (service), SvCalendar (date), SvTimePicker (slot), SvButtonGroup
   * (duration) and SvNumberInput (guests), with a live summary. The same
   * components SvGrid mounts to edit cells, arranged into a real page.
   */
  import { SvComboBox, SvCalendar, SvTimePicker, SvButtonGroup, SvNumberInput, SvButton } from '@svgrid/grid'
  import type { ButtonGroupItem } from '@svgrid/grid'

  const services = [
    { value: 'consult', label: 'Design consultation' },
    { value: 'review', label: 'Code review' },
    { value: 'demo', label: 'Product demo' },
    { value: 'onboard', label: 'Onboarding session' },
  ]
  const durations: ButtonGroupItem[] = [
    { value: '30', label: '30 min' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '90 min' },
  ]

  let service = $state<string | null>('consult')
  let date = $state<Date | null>(null)
  let time = $state<Date | null>(null)
  let duration = $state('60')
  let guests = $state<number | null>(1)
  let booked = $state(false)

  const serviceLabel = $derived(services.find((s) => s.value === service)?.label ?? '-')
  const dateStr = $derived(date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '-')
  const timeStr = $derived(time ? time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '-')
  const canBook = $derived(!!service && !!date && !!time)

  function book() {
    if (!canBook) return
    booked = true
    setTimeout(() => (booked = false), 2400)
  }
</script>

<div class="bk">
  <header>
    <h2>Book an appointment</h2>
    <p>A scheduling flow built only from <code>@svgrid/grid</code> UI components.</p>
  </header>

  <div class="cols">
    <div class="pane">
      <label class="field">
        <span>Service</span>
        <SvComboBox options={services} value={service} onChange={(v) => (service = v as string)} placeholder="Choose a service…" />
      </label>

      <div class="field">
        <span>Date</span>
        <SvCalendar value={date} selectionMode="one" onChange={(d) => (date = d[0] ?? null)} />
      </div>
    </div>

    <div class="pane">
      <div class="field">
        <span>Time</span>
        <SvTimePicker value={time} minuteInterval={15} onChange={(d) => (time = d)} />
      </div>

      <div class="field">
        <span>Duration</span>
        <SvButtonGroup items={durations} value={duration} mode="single" onChange={(v) => (duration = v as string)} />
      </div>

      <label class="field">
        <span>Guests</span>
        <SvNumberInput value={guests} min={1} max={12} step={1} onChange={(v) => (guests = v)} />
      </label>
    </div>
  </div>

  <div class="summary">
    <div class="lines">
      <div><dt>Service</dt><dd>{serviceLabel}</dd></div>
      <div><dt>When</dt><dd>{dateStr} · {timeStr}</dd></div>
      <div><dt>Length</dt><dd>{durations.find((d) => d.value === duration)?.label} · {guests} guest{guests === 1 ? '' : 's'}</dd></div>
    </div>
    <SvButton variant="primary" size="lg" disabled={!canBook} onclick={book}>
      {booked ? 'Booked ✓' : 'Confirm booking'}
    </SvButton>
  </div>
</div>

<style>
  .bk { padding: 22px; max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  @media (max-width: 680px) { .cols { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span { font-size: 12.5px; font-weight: 600; }
  .summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 18px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 14px; background: var(--sg-bg, #fff); }
  .lines { display: flex; flex-direction: column; gap: 4px; }
  .lines div { display: flex; gap: 8px; font-size: 13px; }
  .lines dt { margin: 0; width: 64px; color: var(--sg-muted, #64748b); font-weight: 600; }
  .lines dd { margin: 0; color: var(--sg-fg, inherit); font-weight: 600; }
</style>
