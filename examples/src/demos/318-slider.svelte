<script lang="ts">
  /**
   * SvSlider - a production filter block: a dual-thumb price range plus single
   * sliders for rating and distance, with live formatted readouts. Copy-paste
   * ready.
   */
  import { SvSlider } from '@svgrid/grid'

  let price = $state<[number, number]>([200, 800])
  let minRating = $state(4)
  let distance = $state(10)
  const money = (n: number) => `$${n.toLocaleString()}`
</script>

<div class="wrap">
  <header>
    <h2>Slider</h2>
    <p>Single or dual-thumb range (WAI-ARIA slider) with steps, ticks and keyboard - price filters, thresholds, settings.</p>
  </header>

  <div class="panel">
    <div class="filter">
      <div class="lbl"><span>Price range</span><strong>{money(price[0])} - {money(price[1])}</strong></div>
      <SvSlider value={price} range min={0} max={1000} step={50} ticks={5} labels="all" formatValue={(v) => `$${v}`} onChange={(v) => (price = v)} />
    </div>

    <div class="filter">
      <div class="lbl"><span>Minimum rating</span><strong>{minRating}+ stars</strong></div>
      <SvSlider value={minRating} min={1} max={5} step={1} ticks={5} labels="endpoints" showValue onChange={(v) => (minRating = v)} />
    </div>

    <div class="filter">
      <div class="lbl"><span>Within</span><strong>{distance} km</strong></div>
      <SvSlider value={distance} min={1} max={50} formatValue={(v) => `${v} km`} onChange={(v) => (distance = v)} />
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 460px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .panel { display: flex; flex-direction: column; gap: 22px; padding: 18px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
  .filter { display: flex; flex-direction: column; gap: 4px; }
  .lbl { display: flex; justify-content: space-between; font-size: 13px; }
  .lbl span { color: var(--sg-muted, #64748b); font-weight: 600; }
</style>
