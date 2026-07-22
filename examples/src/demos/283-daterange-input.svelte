<script lang="ts">
  /**
   * SvDateRangeInput - a compact start/end range FIELD (not a full inline
   * calendar): a text field that opens a portalled two-month range calendar with
   * one-click presets. It composes the same headless range engine SvCalendar
   * uses, and carries the shared editor contract - label / hint / error
   * validation, `dir` (RTL) and localizable `messages` - like every field editor.
   */
  import { SvDateRangeInput } from '@svgrid/grid'
  import type { DateRangeValue, CalendarPreset } from '@svgrid/grid'

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

  const presets: CalendarPreset[] = [
    { label: 'Today', value: () => { const t = startOfDay(new Date()); return [t, t] } },
    { label: 'Last 7 days', value: () => [addDays(startOfDay(new Date()), -6), startOfDay(new Date())] },
    { label: 'Last 30 days', value: () => [addDays(startOfDay(new Date()), -29), startOfDay(new Date())] },
    { label: 'This month', value: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), startOfDay(n)] } },
    { label: 'Year to date', value: () => [new Date(new Date().getFullYear(), 0, 1), startOfDay(new Date())] },
  ]

  let basic = $state<DateRangeValue>([addDays(startOfDay(new Date()), -6), startOfDay(new Date())])
  let reportRange = $state<DateRangeValue>(null)
  let rtl = $state(false)

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
  const days = (r: DateRangeValue) => (r ? Math.round((+r[1] - +r[0]) / 86400000) + 1 : 0)
  // A required field is "invalid" until a range is chosen.
  const reportError = $derived(reportRange ? undefined : 'Please choose a reporting period')
</script>

<div class="wrap">
  <header>
    <h2>Date-range input</h2>
    <p>
      A field-shaped range picker: it reads back <code>[start, end]</code> and opens a
      two-month range calendar with presets. Same headless engine as
      <code>SvCalendar</code>, plus the shared editor contract (label, validation, RTL).
    </p>
    <label class="rtl-toggle"><input type="checkbox" bind:checked={rtl} /> Right-to-left</label>
  </header>

  <div class="grid">
    <section>
      <h3>Basic</h3>
      <SvDateRangeInput
        value={basic}
        {presets}
        firstDayOfWeek={1}
        dir={rtl ? 'rtl' : undefined}
        onChange={(r) => (basic = r)}
      />
      <p class="out">
        {#if basic}{fmt.format(basic[0])} &rarr; {fmt.format(basic[1])} <span class="muted">&middot; {days(basic)} days</span>{:else}<span class="muted">No range</span>{/if}
      </p>
    </section>

    <section>
      <h3>As a form field (label + validation)</h3>
      <SvDateRangeInput
        value={reportRange}
        label="Reporting period"
        hint="Used for the exported summary"
        required
        invalid={!!reportError}
        error={reportError}
        {presets}
        dir={rtl ? 'rtl' : undefined}
        onChange={(r) => (reportRange = r)}
      />
    </section>

    <section>
      <h3>Localized messages (French)</h3>
      <SvDateRangeInput
        value={basic}
        formatString="dd/MM/yyyy"
        locale="fr-FR"
        placeholder="Choisir une periode"
        dir={rtl ? 'rtl' : undefined}
        messages={{ clear: 'Effacer', open: 'Ouvrir le calendrier', to: 'au', dialog: 'Choisir une periode' }}
        onChange={(r) => (basic = r)}
      />
      <p class="muted small">Every string (including the "to" separator) is overridable via <code>messages</code>.</p>
    </section>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .rtl-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .out { margin: 10px 0 0; font-size: 14px; font-weight: 600; }
  .muted { color: var(--sg-muted, #94a3b8); font-weight: 400; }
  .small { font-size: 12px; line-height: 1.5; margin-top: 8px; }
</style>
