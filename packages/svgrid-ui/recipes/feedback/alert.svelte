<script lang="ts">
  // SvAlert - an inline contextual message with icon and actions. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-alert
  import { SvAlert, SvButton } from '@svgrid/grid'
</script>

<SvAlert variant="success" title="Saved">Your changes are live.</SvAlert>

<SvAlert variant="danger" title="Payment failed" dismissible>
  We could not charge your card.
  {#snippet actions()}<SvButton size="sm" variant="danger">Retry</SvButton>{/snippet}
</SvAlert>
