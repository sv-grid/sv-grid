<script lang="ts">
  // SvDrawer - an edge-anchored side sheet with backdrop. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-drawer
  import { SvDrawer, SvButton } from '@svgrid/grid'

  let open = $state(false)
</script>

<SvButton onclick={() => (open = true)}>Filters</SvButton>

<SvDrawer bind:open side="right" title="Filters">
  <p>Body content.</p>
  {#snippet footer()}<SvButton variant="primary" onclick={() => (open = false)}>Apply</SvButton>{/snippet}
</SvDrawer>
