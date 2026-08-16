<script lang="ts">
  // SvCalendar - a themeable month / year / decade calendar. This is your copy,
  // edit it freely. Docs: https://svgrid.com/docs/help/ui-components/sv-calendar
  import { SvCalendar } from '@svgrid/grid'

  let value = $state<Date[]>([new Date()])
</script>

<SvCalendar
  {value}
  selectionMode="range"
  firstDayOfWeek={1}
  footer
  onChange={(dates) => (value = dates)}
/>
