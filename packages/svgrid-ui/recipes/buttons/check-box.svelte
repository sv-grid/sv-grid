<script lang="ts">
  // SvCheckBox - a themed checkbox with a true indeterminate state. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-check-box
  import { SvCheckBox } from '@svgrid/grid'

  let agree = $state(false)
</script>

<SvCheckBox checked={agree} onChange={(v) => (agree = v)}>
  I accept the terms
</SvCheckBox>
