<script lang="ts">
  // SvResult - a full result page (success / error / notfound). Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-result
  import { SvResult, SvButton } from '@svgrid/grid'
</script>

<SvResult
  status="success"
  title="Payment complete"
  description="Your receipt is on its way to ada@example.com."
>
  {#snippet actions()}
    <SvButton variant="primary">Back to dashboard</SvButton>
    <SvButton variant="ghost">View receipt</SvButton>
  {/snippet}
</SvResult>
