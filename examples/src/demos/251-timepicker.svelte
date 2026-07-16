<script lang="ts">
  /**
   * SvTimePicker - an analog clock-dial time picker. Standalone here, and the
   * `time` cell editor inside SvGrid. Drag the hand or click a number; the
   * hour dial auto-switches to minutes.
   */
  import { SvTimePicker } from '@svgrid/grid'

  let format = $state<'12-hour' | '24-hour'>('24-hour')
  let minuteInterval = $state(1)
  let autoSwitch = $state(true)
  let footer = $state(true)
  let value = $state<Date>(new Date(2026, 0, 1, 9, 30))

  const fmt = $derived(
    new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: format === '12-hour',
    }),
  )
</script>

<div class="wrap">
  <header>
    <h2>SvTimePicker</h2>
    <p>
      An analog clock dial with 12/24-hour, minute snapping and hour&nbsp;&rarr;&nbsp;minute auto-switch.
      Drag the hand or click a number. The same component is the <strong>time cell editor in SvGrid</strong>,
      and it themes from your <code>--sg-*</code> tokens.
    </p>
  </header>

  <div class="controls">
    <label>Format
      <select bind:value={format}>
        <option value="24-hour">24-hour</option>
        <option value="12-hour">12-hour</option>
      </select>
    </label>
    <label>Minute step
      <select bind:value={minuteInterval}>
        <option value={1}>1</option><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={autoSwitch} /> Auto-switch to minutes</label>
    <label class="chk"><input type="checkbox" bind:checked={footer} /> Now button</label>
  </div>

  <div class="stage">
    <SvTimePicker
      {value}
      {format}
      {minuteInterval}
      autoSwitchToMinutes={autoSwitch}
      {footer}
      onChange={(v) => (value = v)}
    />
    <aside class="readout">
      <h3>Selected time</h3>
      <p class="big">{fmt.format(value)}</p>
      <p class="hint">Click the hour or minute in the header to switch the dial. Arrow keys nudge the active field.</p>
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 760px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 620px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: end; }
  .controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .controls label.chk { flex-direction: row; align-items: center; gap: 6px; }
  .controls select { padding: 5px 8px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: inherit; font: inherit; font-size: 13px; }
  .stage { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
  .readout { flex: 1; min-width: 180px; }
  .readout h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .readout .big { font-size: 30px; font-weight: 700; margin: 0; font-variant-numeric: tabular-nums; }
  .readout .hint { margin-top: 14px; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
</style>
