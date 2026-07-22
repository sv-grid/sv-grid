<script lang="ts">
  /**
   * SvMenu - a dropdown / actions menu with submenus, separators, icons and
   * keyboard shortcuts. Portalled + animated; full keyboard (arrows, Enter,
   * Escape, ArrowRight/Left for submenus).
   */
  import { SvMenu, SvButton } from '@svgrid/grid'
  import type { MenuItem } from '@svgrid/grid'

  let last = $state('')

  const items: MenuItem[] = [
    { label: 'New file', shortcut: 'Ctrl+N', onSelect: () => (last = 'New file') },
    { label: 'Open...', shortcut: 'Ctrl+O', onSelect: () => (last = 'Open') },
    { separator: true },
    {
      label: 'Share',
      children: [
        { label: 'Copy link', onSelect: () => (last = 'Copy link') },
        { label: 'Email', onSelect: () => (last = 'Email') },
        { separator: true },
        { label: 'Export as PDF', onSelect: () => (last = 'Export PDF') },
      ],
    },
    { label: 'Rename', shortcut: 'F2', onSelect: () => (last = 'Rename') },
    { separator: true },
    { label: 'Delete', shortcut: 'Del', onSelect: () => (last = 'Delete') },
    { label: 'Archived (disabled)', disabled: true },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Menu</h2>
    <p>A dropdown menu with submenus, separators, shortcuts and full keyboard. Arrow to navigate, Enter to pick, ArrowRight opens a submenu.</p>
  </header>

  <div class="row">
    <SvMenu {items}>
      {#snippet anchor()}<SvButton variant="primary">File actions ▾</SvButton>{/snippet}
    </SvMenu>

    <SvMenu {items} ariaLabel="Row actions">
      {#snippet anchor()}<SvButton variant="outline">⋯</SvButton>{/snippet}
    </SvMenu>

    <span class="last">{last ? `Chose: ${last}` : 'Nothing chosen yet'}</span>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 620px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .row { display: flex; align-items: center; gap: 14px; }
  .last { font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
