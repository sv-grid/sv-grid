<script lang="ts">
  // SvCountryInput - searchable country picker emitting an ISO code. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-country-input
  import { SvCountryInput } from '@svgrid/grid'

  let value = $state<string | null>(null)
</script>

<SvCountryInput label="Country" {value} onChange={(code) => (value = code)} required />
