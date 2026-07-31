<script lang="ts">
  // SvTimePicker - an analog clock-dial time picker. This is your copy, edit it
  // freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-time-picker
  import { SvTimePicker } from '@svgrid/grid'

  let time = $state(new Date())
</script>

<SvTimePicker
  value={time}
  format="12-hour"
  minuteInterval={5}
  footer
  onChange={(d) => (time = d)}
/>
