<script lang="ts">
  // SvTreeSelect - single-select dropdown over a collapsible tree. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-tree-select
  import { SvTreeSelect, type TreeSelectNode } from '@svgrid/grid'

  const nodes: TreeSelectNode[] = [
    { value: 'eng', label: 'Engineering', children: [
      { value: 'fe', label: 'Frontend' },
      { value: 'be', label: 'Backend' },
    ] },
    { value: 'design', label: 'Design' },
  ]
  let value = $state<string | number | null>(null)
</script>

<SvTreeSelect label="Team" {nodes} bind:value showPath />
