<script lang="ts">
  // SvDateRangeInput - a compact start/end field over a two-month range calendar.
  // This is your copy, edit it freely.
  // Docs: https://www.svgrid.com/docs/help/ui-components/sv-date-range-input
  import { SvDateRangeInput } from '@svgrid/grid'

  let range = $state<[Date, Date] | null>(null)
</script>

<SvDateRangeInput
  value={range}
  formatString="yyyy-MM-dd"
  months={2}
  onChange={(v) => (range = v)}
/>
