<script lang="ts">
  // SvToaster - host that renders the shared toast queue. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-toaster
  import { SvToaster, SvButton, toast } from '@svgrid/grid'
</script>

<!-- Mount once, near the app root -->
<SvToaster position="bottom-right" />

<SvButton onclick={() => toast.success('Saved')}>Save</SvButton>
