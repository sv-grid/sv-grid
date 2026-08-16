<script lang="ts">
  // SvCard - themed surface with header, body and footer. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-card
  import { SvCard } from '@svgrid/grid'
</script>

<SvCard title="Revenue" subtitle="Last 30 days">
  <p>$42,180</p>
  {#snippet footer()}<a href="/reports">View report</a>{/snippet}
</SvCard>
