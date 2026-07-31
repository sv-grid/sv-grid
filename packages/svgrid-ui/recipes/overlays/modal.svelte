<script lang="ts">
  // SvModal - an accessible modal dialog with focus trap. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-modal
  import { SvModal, SvButton } from '@svgrid/grid'

  let open = $state(false)
</script>

<SvButton onclick={() => (open = true)}>Edit row</SvButton>

<SvModal bind:open title="Edit row">
  <p>Body content.</p>
  {#snippet footer()}<SvButton variant="primary" onclick={() => (open = false)}>Save</SvButton>{/snippet}
</SvModal>
