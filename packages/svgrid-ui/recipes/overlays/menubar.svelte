<script lang="ts">
  // SvMenubar - an app-style row of dropdown menus. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-menubar
  import { SvMenubar, type MenubarMenu, type MenuItem } from '@svgrid/grid'

  const menus: MenubarMenu[] = [
    { label: 'File', items: [
      { label: 'New', shortcut: 'Ctrl+N', onSelect: () => {} },
      { label: 'Open...', shortcut: 'Ctrl+O', onSelect: () => {} },
      { separator: true },
      { label: 'Export', children: [
        { label: 'CSV', onSelect: () => {} },
        { label: 'PDF', onSelect: () => {} },
      ] },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => {} },
      { label: 'Redo', shortcut: 'Ctrl+Y', onSelect: () => {} },
    ] },
    { label: 'View', items: [{ label: 'Zoom in', onSelect: () => {} }, { label: 'Zoom out', onSelect: () => {} }] },
  ]

  function onSelect(item: MenuItem) {
    console.log('chose', item.label)
  }
</script>

<SvMenubar {menus} {onSelect} />
