<script lang="ts">
  // SvNumberInput - numeric field with min/max/step, grouping and prefix/suffix. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-number-input
  import { SvNumberInput } from '@svgrid/grid'

  let price = $state<number | null>(1299.5)
</script>

<SvNumberInput
  label="Price"
  value={price}
  onChange={(v) => (price = v)}
  min={0}
  step={0.5}
  precision={2}
  grouping
  prefix="$"
/>
