<script lang="ts">
  // SvTextInput - single-line text field for the whole editor kit. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-text-input
  import { SvTextInput } from '@svgrid/grid'

  let email = $state('')
</script>

<SvTextInput
  label="Work email"
  type="email"
  placeholder="you@company.com"
  bind:value={email}
  clearable
/>
