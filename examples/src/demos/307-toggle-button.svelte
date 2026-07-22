<script lang="ts">
  /**
   * SvToggleButton - a pressed on/off button. A production text-formatting toolbar
   * and a set of view/pin toggles. Copy-paste ready.
   */
  import { SvToggleButton } from '@svgrid/grid'

  let bold = $state(true)
  let italic = $state(false)
  let underline = $state(false)
  let pinned = $state(false)
  let live = $state(true)
</script>

<div class="wrap">
  <header>
    <h2>Toggle button</h2>
    <p>A button that stays pressed (<code>aria-pressed</code>) - formatting toolbars, pin / favorite / mute toggles.</p>
  </header>

  <section class="block">
    <h3>Formatting toolbar</h3>
    <div class="toolbar">
      <SvToggleButton pressed={bold} ariaLabel="Bold" onChange={(v) => (bold = v)}><strong>B</strong></SvToggleButton>
      <SvToggleButton pressed={italic} ariaLabel="Italic" onChange={(v) => (italic = v)}><em>I</em></SvToggleButton>
      <SvToggleButton pressed={underline} ariaLabel="Underline" onChange={(v) => (underline = v)}><u>U</u></SvToggleButton>
    </div>
    <p class="preview" class:b={bold} class:i={italic} class:u={underline}>The quick brown fox</p>
  </section>

  <section class="block">
    <h3>State toggles</h3>
    <div class="toolbar">
      <SvToggleButton pressed={pinned} onChange={(v) => (pinned = v)}>{pinned ? 'Pinned' : 'Pin'}</SvToggleButton>
      <SvToggleButton pressed={live} onChange={(v) => (live = v)}>{live ? 'Live' : 'Paused'}</SvToggleButton>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 560px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .toolbar { display: inline-flex; gap: 6px; }
  .preview { margin: 14px 0 0; font-size: 18px; }
  .preview.b { font-weight: 800; }
  .preview.i { font-style: italic; }
  .preview.u { text-decoration: underline; }
</style>
