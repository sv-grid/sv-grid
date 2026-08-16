<script lang="ts">
  // SvPasswordInput - password field with a reveal toggle and strength meter. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-password-input
  import { SvPasswordInput } from '@svgrid/grid'

  let pw = $state('')
</script>

<SvPasswordInput
  label="Password"
  value={pw}
  onChange={(v) => (pw = v)}
  showStrength
  autocomplete="new-password"
/>
