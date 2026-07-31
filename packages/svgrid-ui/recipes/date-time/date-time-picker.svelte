<script lang="ts">
  // SvDateTimePicker - a masked text field with DATE / TIME dropdown tabs. This
  // is your copy, edit it freely.
  // Docs: https://www.svgrid.com/docs/help/ui-components/sv-date-time-picker
  import { SvDateTimePicker } from '@svgrid/grid'

  let value = $state<Date | null>(new Date())
</script>

<SvDateTimePicker
  {value}
  formatString="yyyy-MM-dd HH:mm"
  dropDownDisplayMode="both"
  nullable
  onChange={(d) => (value = d)}
/>
