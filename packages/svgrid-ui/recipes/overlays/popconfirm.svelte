<script lang="ts">
  // SvPopconfirm - a quick confirm step in a popover. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-popconfirm
  import { SvPopconfirm, SvButton } from '@svgrid/grid'

  function remove() {
    // ...delete the thing
  }
</script>

<SvPopconfirm
  title="Delete this row?"
  description="This cannot be undone."
  confirmLabel="Delete"
  confirmVariant="danger"
  onConfirm={remove}
>
  {#snippet anchor()}<SvButton size="sm" variant="danger">Delete</SvButton>{/snippet}
</SvPopconfirm>
