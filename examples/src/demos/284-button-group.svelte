<script lang="ts">
  /**
   * SvButtonGroup - a segmented button bar. `mode="single"` gives radio
   * semantics (a view switcher), `mode="multiple"` a toggle set (a formatting
   * toolbar). Roving tabindex + arrow keys, and the shared editor contract
   * (label / validation / dir) come built in.
   */
  import { SvButtonGroup } from '@svgrid/grid'
  import type { ButtonGroupItem } from '@svgrid/grid'

  const views: ButtonGroupItem[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ]
  const formats: ButtonGroupItem[] = [
    { value: 'bold', label: 'B' },
    { value: 'italic', label: 'I' },
    { value: 'underline', label: 'U' },
    { value: 'strike', label: 'S' },
  ]
  const align: ButtonGroupItem[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ]

  let view = $state<string | number>('week')
  let marks = $state<Array<string | number>>(['bold'])
  let alignVal = $state<string | number | null>(null)
  let rtl = $state(false)

  const alignError = $derived(alignVal ? undefined : 'Choose an alignment')
</script>

<div class="wrap">
  <header>
    <h2>Button group</h2>
    <p>A segmented control: single-select (radio), multi-select (toggle set), or plain actions. Arrow keys move; the whole kit's label / validation / RTL contract applies.</p>
    <label class="rtl-toggle"><input type="checkbox" bind:checked={rtl} /> Right-to-left</label>
  </header>

  <section>
    <h3>Single-select (view switcher)</h3>
    <SvButtonGroup items={views} value={view} mode="single" dir={rtl ? 'rtl' : undefined} onChange={(v) => (view = v as string)} />
    <p class="out">View: <strong>{view}</strong></p>
  </section>

  <section>
    <h3>Multi-select (formatting toolbar)</h3>
    <SvButtonGroup items={formats} value={marks} mode="multiple" variant="outline" dir={rtl ? 'rtl' : undefined} onChange={(v) => (marks = v as string[])} />
    <p class="out">Active: <strong>{marks.length ? marks.join(', ') : 'none'}</strong></p>
  </section>

  <section>
    <h3>As a form field (label + required)</h3>
    <SvButtonGroup
      items={align}
      value={alignVal}
      mode="single"
      label="Text alignment"
      required
      invalid={!!alignError}
      error={alignError}
      dir={rtl ? 'rtl' : undefined}
      onChange={(v) => (alignVal = v as string)}
    />
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 820px; display: flex; flex-direction: column; gap: 20px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 640px; }
  .rtl-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .out { margin: 12px 0 0; font-size: 14px; }
</style>
