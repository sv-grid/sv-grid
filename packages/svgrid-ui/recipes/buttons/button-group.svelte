<script lang="ts">
  // SvButtonGroup - a segmented single/multi-select button bar. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-button-group
  import { SvButtonGroup, type ButtonGroupItem } from '@svgrid/grid'

  const views: ButtonGroupItem[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ]
  let view = $state<string | number>('week')
</script>

<SvButtonGroup
  items={views}
  value={view}
  mode="single"
  onChange={(v) => (view = v as string)}
/>
