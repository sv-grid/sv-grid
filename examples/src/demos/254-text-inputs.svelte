<script lang="ts">
  /**
   * Text inputs - the SvGrid UI kit's typed text controls. Each emits a clean
   * value and themes from --sg-* tokens. Standalone or as grid cell editors.
   */
  import { SvNumberInput, SvPasswordInput, SvMaskedInput, SvPhoneInput, SvColorInput } from '@svgrid/grid'

  let qty = $state<number | null>(1250.5)
  let pw = $state('Sv-Grid!23')
  let card = $state('')
  let phone = $state('+14155551234')
  let color = $state('#6366f1')
</script>

<div class="wrap">
  <header>
    <h2>Text inputs</h2>
    <p>Typed text controls from <code>@svgrid/grid</code>: numeric, password, masked, phone and color. Each is theme-driven and works standalone or as a grid cell editor.</p>
  </header>

  <div class="grid">
    <div class="cell">
      <label>SvNumberInput <span class="muted">(min 0, max 100k, grouping, 2dp)</span></label>
      <SvNumberInput value={qty} onChange={(v) => (qty = v)} min={0} max={100000} step={10} precision={2} grouping prefix="$" />
      <code class="out">{qty}</code>
    </div>

    <div class="cell">
      <label>SvPasswordInput <span class="muted">(reveal + strength)</span></label>
      <SvPasswordInput value={pw} onChange={(v) => (pw = v)} showStrength />
    </div>

    <div class="cell">
      <label>SvMaskedInput <span class="muted">(card: #### #### #### ####)</span></label>
      <SvMaskedInput mask="#### #### #### ####" onChange={(_m, raw) => (card = raw)} />
      <code class="out">raw: {card || '-'}</code>
    </div>

    <div class="cell">
      <label>SvPhoneInput <span class="muted">(country + national mask)</span></label>
      <SvPhoneInput value={phone} onChange={(v) => (phone = v)} />
      <code class="out">{phone}</code>
    </div>

    <div class="cell">
      <label>SvColorInput <span class="muted">(swatch + palette popover)</span></label>
      <SvColorInput value={color} onChange={(v) => (color = v)} />
      <code class="out">{color}</code>
    </div>
  </div>
</div>

<style>
  .wrap { padding: 22px; max-width: 780px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; max-width: 620px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px 28px; }
  .cell { display: flex; flex-direction: column; gap: 7px; align-items: flex-start; }
  label { font-size: 12.5px; font-weight: 600; }
  .muted { color: var(--sg-muted, #64748b); font-weight: 400; }
  .out { align-self: stretch; }
</style>
