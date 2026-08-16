<script lang="ts">
  // SvTree - a WAI-ARIA tree view with expand/select/checkboxes. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-tree
  import { SvTree, type SvTreeNode } from '@svgrid/grid'

  let selected = $state<string | null>(null)
  const nodes: SvTreeNode[] = [
    { id: 'src', label: 'src', children: [
      { id: 'app', label: 'App.svelte' },
      { id: 'main', label: 'main.ts' },
    ] },
  ]
</script>

<SvTree {nodes} {selected} onSelect={(id) => (selected = id)} />
