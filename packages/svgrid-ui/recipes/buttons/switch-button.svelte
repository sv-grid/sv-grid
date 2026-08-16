<script lang="ts">
  // SvSwitchButton - an on/off sliding switch for immediate settings. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-switch-button
  import { SvSwitchButton } from '@svgrid/grid'

  let notify = $state(true)
</script>

<SvSwitchButton
  label="Email notifications"
  checked={notify}
  onChange={(v) => (notify = v)}
/>
