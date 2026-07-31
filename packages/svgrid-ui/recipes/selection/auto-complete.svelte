<script lang="ts">
  // SvAutoComplete - free-text input with a live suggestion list. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-auto-complete
  import { SvAutoComplete } from '@svgrid/grid'

  const cities = ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin']
  let value = $state('')
</script>

<SvAutoComplete label="City" suggestions={cities}
  {value} onChange={(v) => (value = v)} placeholder="Search a city" />
