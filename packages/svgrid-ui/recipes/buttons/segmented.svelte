<script lang="ts">
  // SvSegmented - a compact single-select track. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-segmented
  import { SvSegmented } from '@svgrid/grid'
  let view = $state('board')
</script>

<SvSegmented
  bind:value={view}
  options={[
    { value: 'board', label: 'Board' },
    { value: 'table', label: 'Table' },
    { value: 'calendar', label: 'Calendar' },
  ]}
/>
