<script lang="ts">
  // SvTimeline - a vertical activity or history feed. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-timeline
  import { SvTimeline } from '@svgrid/grid'
</script>

<SvTimeline items={[
  { title: 'Order placed', time: '09:12', color: '#16a34a', icon: '✓' },
  { title: 'Shipped', time: '14:40', description: 'Left the warehouse' },
  { title: 'Out for delivery', time: '08:05' },
]} />
