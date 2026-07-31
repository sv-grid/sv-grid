<script lang="ts">
  // SvSlider - single or dual-thumb range slider. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-slider
  import { SvSlider } from '@svgrid/grid'

  let price = $state<[number, number]>([20, 80])
</script>

<SvSlider
  label="Price range"
  range
  value={price}
  min={0}
  max={200}
  step={5}
  ticks={5}
  labels="endpoints"
  formatValue={(v) => `$${v}`}
  onChange={(v) => (price = v)}
/>
