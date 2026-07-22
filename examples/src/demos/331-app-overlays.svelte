<script lang="ts">
  /**
   * SvDrawer, SvContextMenu and the toast API - app-chrome overlays that share
   * the grid's a11y primitives (focus trap, scroll lock, dismissable layer
   * stack). All portal to <body>, animate in, and respect reduced-motion.
   */
  import { SvDrawer, SvContextMenu, SvToaster, toast, SvButton, type MenuItem } from '@svgrid/grid'

  let drawerOpen = $state(false)
  let side = $state<'right' | 'left' | 'top' | 'bottom'>('right')

  const menu: MenuItem[] = [
    { label: 'Copy', shortcut: 'Ctrl+C' },
    { label: 'Duplicate' },
    { separator: true },
    { label: 'Move to', children: [{ label: 'Inbox' }, { label: 'Archive' }] },
    { label: 'Delete', shortcut: 'Del' },
  ]
</script>

<div class="wrap">
  <header>
    <h2>App overlays</h2>
    <p>Drawer, right-click context menu and toasts - built on the shared focus-trap, scroll-lock and dismissable-layer primitives, so nested overlays close top-first and screen readers hear every toast.</p>
  </header>

  <section>
    <h3>Drawer</h3>
    <div class="row">
      <SvButton onclick={() => (drawerOpen = true)}>Open drawer</SvButton>
      <label class="chk">Side
        <select bind:value={side}>
          <option value="right">right</option>
          <option value="left">left</option>
          <option value="top">top</option>
          <option value="bottom">bottom</option>
        </select>
      </label>
    </div>
    <SvDrawer bind:open={drawerOpen} {side} title="Filters">
      <p>An edge-anchored side sheet. Focus is trapped, body scroll is locked, and Escape or the backdrop closes it.</p>
      <label class="field">Search<input type="text" placeholder="Keyword" /></label>
      <label class="field">Status
        <select><option>Any</option><option>Active</option><option>Archived</option></select>
      </label>
      {#snippet footer()}
        <SvButton variant="ghost" onclick={() => (drawerOpen = false)}>Cancel</SvButton>
        <SvButton onclick={() => (drawerOpen = false)}>Apply</SvButton>
      {/snippet}
    </SvDrawer>
  </section>

  <section>
    <h3>Context menu</h3>
    <SvContextMenu items={menu} onSelect={(i) => toast(`${i.label} clicked`)}>
      <div class="zone">Right-click anywhere in this box</div>
    </SvContextMenu>
  </section>

  <section>
    <h3>Toasts</h3>
    <div class="row">
      <SvButton size="sm" onclick={() => toast.info('Heads up - background sync started')}>Info</SvButton>
      <SvButton size="sm" variant="ghost" onclick={() => toast.success('Saved to the server')}>Success</SvButton>
      <SvButton size="sm" variant="ghost" onclick={() => toast.warning('Connection is slow')}>Warning</SvButton>
      <SvButton size="sm" variant="danger" onclick={() => toast.error('Could not save', { duration: 0 })}>Error (sticky)</SvButton>
    </div>
  </section>
</div>

<!-- Mount once near the app root; call toast() from anywhere. -->
<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 20px; max-width: 820px; display: flex; flex-direction: column; gap: 20px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13.5px; }
  .chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .chk select { font: inherit; font-size: 13px; padding: 5px 8px; border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
  .zone { display: grid; place-items: center; height: 120px; border: 1.5px dashed var(--sg-border, #cbd5e1); border-radius: 10px; color: var(--sg-muted, #64748b); font-size: 13.5px; user-select: none; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); margin-top: 12px; }
  .field input, .field select { font: inherit; font-size: 13px; padding: 7px 10px; border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 400; }
</style>
