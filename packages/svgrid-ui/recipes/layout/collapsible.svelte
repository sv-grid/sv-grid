<script lang="ts">
  // SvCollapsible - a single animated show/hide section. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-collapsible
  import { SvCollapsible } from '@svgrid/grid'
  let advanced = $state(false)
</script>

<SvCollapsible title="Shipping details" open>
  <p>Standard delivery, 3-5 business days. Tracking sent on dispatch.</p>
</SvCollapsible>

<SvCollapsible title="Advanced options" bind:open={advanced}>
  <label><input type="checkbox" /> Signature on delivery</label>
</SvCollapsible>
