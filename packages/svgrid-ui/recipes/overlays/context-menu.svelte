<script lang="ts">
  // SvContextMenu - opens a menu at the pointer on right-click. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-context-menu
  import { SvContextMenu, type MenuItem } from '@svgrid/grid'

  const items: MenuItem[] = [
    { label: 'Copy', shortcut: 'Ctrl+C', onSelect: () => {} },
    { label: 'Duplicate', onSelect: () => {} },
    { separator: true },
    { label: 'Delete', onSelect: () => {} },
  ]
</script>

<SvContextMenu {items} onSelect={(i) => console.log(i.label)}>
  <div class="drop-zone">Right-click me</div>
</SvContextMenu>
