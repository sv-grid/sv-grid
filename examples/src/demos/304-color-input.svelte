<script lang="ts">
  /**
   * SvColorInput on its own - a swatch that opens a portalled popover with a hex
   * field, the native picker and a preset palette. Emits a hex string; the
   * popover animates in. The SvGrid color cell editor, standalone.
   */
  import { SvColorInput } from '@svgrid/grid'

  let brand = $state('#2563eb')
  let accent = $state('#f59e0b')
  let custom = $state('#10b981')
  const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#0f172a']
</script>

<div class="wrap">
  <header>
    <h2>Color input</h2>
    <p><code>SvColorInput</code> - swatch + hex field + native picker + preset palette in a portalled, animated popover.</p>
  </header>

  <div class="row">
    <label class="cell">Brand
      <SvColorInput value={brand} onChange={(v) => (brand = v)} />
      <span class="val">{brand}</span>
    </label>
    <label class="cell">Accent
      <SvColorInput value={accent} onChange={(v) => (accent = v)} />
      <span class="val">{accent}</span>
    </label>
    <label class="cell">Custom palette
      <SvColorInput value={custom} {palette} onChange={(v) => (custom = v)} />
      <span class="val">{custom}</span>
    </label>
  </div>

  <div class="preview" style:--a={brand} style:--b={accent} style:--c={custom}>
    <span>Live preview</span>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 600px; display: flex; flex-direction: column; gap: 20px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .row { display: flex; gap: 22px; flex-wrap: wrap; }
  .cell { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .val { font-size: 12px; color: var(--sg-muted, #94a3b8); font-weight: 400; font-variant-numeric: tabular-nums; text-transform: lowercase; }
  .preview {
    height: 80px; border-radius: 12px; display: grid; place-items: center; color: #fff; font-weight: 700; letter-spacing: 0.02em;
    background: linear-gradient(120deg, var(--a), var(--b), var(--c));
  }
</style>
