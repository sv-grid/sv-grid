<script lang="ts">
  /**
   * SvDateTimePicker - a formatted text input plus a dropdown that composes the
   * calendar and time picker behind DATE / TIME tabs. Type a value or pick it;
   * the dropdown portals to <body> so it is never clipped. This is the SvGrid
   * `datetime` cell editor, usable standalone anywhere.
   */
  import { SvDateTimePicker } from '@svgrid/grid'

  let formatString = $state('yyyy-MM-dd HH:mm')
  let hourFormat = $state<'12-hour' | '24-hour'>('24-hour')
  let mode = $state<'both' | 'calendar' | 'time'>('both')
  let spin = $state(false)
  let value = $state<Date | null>(new Date(2026, 5, 7, 9, 30))

  const formats = ['yyyy-MM-dd HH:mm', 'dd-MMM-yy HH:mm:ss', 'MMMM d, yyyy h:mm tt', 'dd/MM/yyyy HH:mm']
</script>

<div class="wrap">
  <header>
    <h2>SvDateTimePicker</h2>
    <p>
      A formatted input backed by the date-format token engine, plus a portalled
      dropdown with <strong>DATE / TIME tabs</strong> (SvCalendar + SvTimePicker). Type any value in the
      mask or pick it. This is the SvGrid <strong>datetime cell editor</strong>, standalone here.
    </p>
  </header>

  <div class="controls">
    <label>Format mask
      <select bind:value={formatString}>
        {#each formats as f (f)}<option value={f}>{f}</option>{/each}
      </select>
    </label>
    <label>Clock
      <select bind:value={hourFormat}>
        <option value="24-hour">24-hour</option>
        <option value="12-hour">12-hour</option>
      </select>
    </label>
    <label>Dropdown
      <select bind:value={mode}>
        <option value="both">Date + Time</option>
        <option value="calendar">Calendar only</option>
        <option value="time">Time only</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={spin} /> Spin buttons</label>
  </div>

  <div class="stage">
    <SvDateTimePicker
      {value}
      {formatString}
      {hourFormat}
      dropDownDisplayMode={mode}
      spinButtons={spin}
      onChange={(v) => (value = v)}
    />
    <div class="readout">
      <span class="lbl">value</span>
      <code>{value ? value.toISOString() : 'null'}</code>
    </div>
  </div>

  <p class="tip">Try typing an out-of-mask value and tabbing away - it reverts to the last valid value. The dropdown escapes any scroll container.</p>
</div>

<style>
  .wrap { padding: 20px; max-width: 760px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 620px; }
  strong { color: var(--sg-fg, #0f172a); }
  .controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: end; }
  .controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .controls label.chk { flex-direction: row; align-items: center; gap: 6px; }
  .controls select { padding: 5px 8px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: inherit; font: inherit; font-size: 13px; }
  .stage { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
  .readout { display: flex; flex-direction: column; gap: 3px; }
  .readout .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8); }
  .readout code { font-size: 13px; background: var(--sg-row-hover-bg, #eef2ff); padding: 4px 8px; border-radius: 6px; }
  .tip { margin: 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
</style>
