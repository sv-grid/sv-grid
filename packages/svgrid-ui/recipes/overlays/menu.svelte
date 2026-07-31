<script lang="ts">
  // SvMenu - a trigger-opened dropdown / actions menu. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-menu
  import { SvMenu, SvButton, type MenuItem } from '@svgrid/grid'

  const items: MenuItem[] = [
    { label: 'New', shortcut: 'Ctrl+N', onSelect: () => {} },
    { label: 'Duplicate', onSelect: () => {} },
    { separator: true },
    { label: 'Delete', onSelect: () => {} },
  ]
</script>

<SvMenu {items} onSelect={(i) => console.log(i.label)}>
  {#snippet anchor()}<SvButton>Actions</SvButton>{/snippet}
</SvMenu>
