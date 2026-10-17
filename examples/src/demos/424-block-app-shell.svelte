<script lang="ts" module>
  /**
   * App shell block - a full application layout: an SvNavPane sidebar with
   * sections and badges, a top bar with SvBreadcrumb, an SvTextInput search
   * and an SvMenu account menu on an SvAvatar, and a content area that swaps
   * with the selected nav item (SvStat cards or an SvEmptyState). The toggle
   * collapses the sidebar to an icon rail. Pure UI-kit, --sg-* themed.
   *
   * Headless: createAppShell() below owns the nav sections, the active item,
   * the collapsed rail and the search text with no markup. The component
   * under it is one styled render of that core; import createAppShell from
   * this file (or `npx @svgrid/ui add app-shell --headless` for the core
   * alone) to draw your own.
   */
  import type { NavSection } from '@svgrid/grid'

  export type AppShellOptions = {
    sections?: NavSection[]
    /** Id of the nav item shown first; defaults to the first item. */
    active?: string
    /** Start with the sidebar collapsed to its icon rail. */
    collapsed?: boolean
    /** A nav item was picked: route to it here. */
    onNavigate?: (id: string) => void
    onSearch?: (query: string) => void
  }

  const SECTIONS: NavSection[] = [
    { id: 'main', label: 'Workspace', items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'orders', label: 'Orders', badge: 12 },
      { id: 'customers', label: 'Customers' },
    ] },
    { id: 'manage', label: 'Manage', items: [
      { id: 'reports', label: 'Reports' },
      { id: 'billing', label: 'Billing', badge: 'Due' },
      { id: 'team', label: 'Team' },
      { id: 'settings', label: 'Settings' },
    ] },
  ]

  export function createAppShell(opts: AppShellOptions = {}) {
    const sections = opts.sections ?? SECTIONS
    const labels = new Map(sections.flatMap((s) => s.items.map((i) => [i.id, i.label] as const)))
    let active = $state(opts.active ?? sections[0]?.items[0]?.id ?? '')
    let collapsed = $state(opts.collapsed ?? false)
    let query = $state('')
    const label = $derived(labels.get(active) ?? active)

    function navigate(id: string) {
      if (id === active) return
      active = id
      opts.onNavigate?.(id)
    }
    const toggle = () => { collapsed = !collapsed }

    return {
      sections,
      get active() { return active },
      set active(id: string | null) { if (id) navigate(id) },
      /** Label of the active item, for the heading and breadcrumb. */
      get label() { return label },
      get collapsed() { return collapsed },
      set collapsed(v: boolean) { collapsed = v },
      get query() { return query },
      set query(v: string) { query = v; opts.onSearch?.(v) },
      navigate,
      toggle,
      /** Spread on the sidebar toggle <button>. */
      toggleProps: () => ({
        type: 'button' as const,
        'aria-label': 'Toggle sidebar',
        'aria-expanded': !collapsed,
        onclick: toggle,
      }),
      /** Spread on a plain nav link or button for one item. */
      itemProps: (id: string) => ({
        'aria-current': active === id ? ('page' as const) : undefined,
        onclick: () => navigate(id),
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvNavPane, SvBreadcrumb, SvTextInput, SvButton, SvAvatar, SvBadge,
    SvMenu, SvCard, SvStat, SvEmptyState, SvToaster, toast,
    type MenuItem,
  } from '@svgrid/grid'

  const shell = createAppShell({
    // Start collapsed on a phone: the <= 720px rule below already gives the
    // sidebar the 64px rail width, so an expanded nav pane there could only
    // paint its labels over the page. The toggle still works either way.
    collapsed: typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  })

  const accountMenu: MenuItem[] = [
    { label: 'Profile', onSelect: () => toast('Profile') },
    { label: 'Preferences', onSelect: () => toast('Preferences') },
    { separator: true },
    { label: 'Sign out', onSelect: () => toast('Signed out') },
  ]
</script>

<div class="sv-shell" class:sv-shell-is-collapsed={shell.collapsed}>
  <!-- Sidebar -->
  <div class="sv-shell-side">
    <div class="sv-shell-brand">
      <span class="sv-shell-logo">◧</span>
      {#if !shell.collapsed}<strong>Northwind</strong>{/if}
    </div>
    <SvNavPane sections={shell.sections} bind:value={shell.active} collapsed={shell.collapsed} />
  </div>

  <!-- Main column -->
  <div class="sv-shell-main">
    <header class="sv-shell-bar">
      <button class="sv-shell-icon-btn" {...shell.toggleProps()}>☰</button>
      <SvBreadcrumb items={[{ label: 'Home', href: '#' }, { label: 'Workspace', href: '#' }, { label: shell.label }]} />
      <div class="sv-shell-spacer"></div>
      <div class="sv-shell-search">
        <SvTextInput bind:value={shell.query} placeholder="Search..." clearable block>
          {#snippet leading()}<span class="sv-shell-ic">🔎</span>{/snippet}
        </SvTextInput>
      </div>
      <SvButton variant="ghost" size="sm" ariaLabel="Notifications" onclick={() => toast('2 new notifications')}>🔔</SvButton>
      <SvMenu items={accountMenu}>
        {#snippet anchor()}<button class="sv-shell-acct" aria-label="Account menu"><SvAvatar name="Ada Lovelace" size="sm" status="online" /></button>{/snippet}
      </SvMenu>
    </header>

    <main class="sv-shell-content">
      <div class="sv-shell-page-head">
        <h2>{shell.label}</h2>
        <SvBadge variant="accent" pill>Live</SvBadge>
      </div>

      {#if shell.active === 'dashboard' || shell.active === 'analytics'}
        <div class="sv-shell-cards">
          <SvCard><SvStat label="Revenue" value="$48.1k" delta={12} hint="vs last month" /></SvCard>
          <SvCard><SvStat label="Orders" value="1,240" delta={8} hint="vs last month" /></SvCard>
          <SvCard><SvStat label="Customers" value="18.6k" delta={3} hint="vs last month" /></SvCard>
          <SvCard><SvStat label="Refunds" value="0.9%" delta={-0.4} invert hint="vs last month" /></SvCard>
        </div>
        <SvCard title="{shell.label} overview">
          <p class="sv-shell-muted">This is the <strong>{shell.label}</strong> page. Swap it for your own content - the shell (sidebar, breadcrumb, top bar, account menu) stays the same across every route.</p>
        </SvCard>
      {:else}
        <SvCard flush>
          <SvEmptyState
            title="{shell.label} goes here"
            description="Drop your real {shell.label.toLowerCase()} view into this content region. The shell handles navigation and chrome."
          >
            <SvButton variant="primary" size="sm" onclick={() => toast('Create')}>Create {shell.label.toLowerCase()}</SvButton>
          </SvEmptyState>
        </SvCard>
      {/if}
    </main>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-shell { display: grid; grid-template-columns: 232px 1fr; height: 620px; width: 100%; box-sizing: border-box; border: 1px solid var(--sg-border, #eef2f7); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); }
  .sv-shell.sv-shell-is-collapsed { grid-template-columns: 64px 1fr; }
  .sv-shell-side { display: flex; flex-direction: column; border-right: 1px solid var(--sg-border, #eef2f7); background: var(--sg-header-bg, #f8fafc); min-height: 0; }
  /* Let SvNavPane fill the sidebar column (flush - no card chrome) so its
     internal scroll region gets a real height instead of collapsing to 0. */
  .sv-shell-side :global(.sv-nav) { width: auto; flex: 1 1 0; min-height: 0; border: 0; border-radius: 0; background: transparent; }
  .sv-shell-brand { display: flex; align-items: center; gap: 10px; padding: 16px; font-size: 16px; font-weight: 700; height: 56px; box-sizing: border-box; }
  .sv-shell-logo { font-size: 20px; color: var(--sg-accent, #4f46e5); }

  .sv-shell-main { display: flex; flex-direction: column; min-width: 0; }
  .sv-shell-bar { display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 56px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .sv-shell-spacer { flex: 1; }
  .sv-shell-search { width: 220px; }
  .sv-shell-icon-btn { background: none; border: 0; font-size: 17px; cursor: pointer; padding: 4px 8px; border-radius: 6px; color: var(--sg-muted, #475569); }
  .sv-shell-icon-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-shell-icon-btn:focus-visible, .sv-shell-acct:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .sv-shell-acct { background: none; border: 0; padding: 0; cursor: pointer; display: inline-flex; border-radius: 50%; }

  .sv-shell-content { padding: 22px; overflow: auto; display: flex; flex-direction: column; gap: 16px; background: var(--sg-header-bg, #f8fafc); }
  .sv-shell-page-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sv-shell-page-head h2 { margin: 0; font-size: 22px; letter-spacing: -.01em; }
  .sv-shell-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .sv-shell-muted { color: var(--sg-muted, #64748b); font-size: 14px; line-height: 1.55; margin: 0; }
  .sv-shell-ic { display: inline-flex; font-size: 13px; }

  @media (max-width: 720px) {
    .sv-shell-search { display: none; }
    .sv-shell { grid-template-columns: 64px 1fr; }
    /* The 64px column is the collapsed rail's width, but `collapsed` is
       still the user's toggle - so hide the brand text and clip the nav
       pane's labels instead of letting them paint over the breadcrumb. */
    .sv-shell-brand strong { display: none; }
    .sv-shell-side { overflow: hidden; }
    /* The top bar wraps on a phone (bell + avatar drop to a second line),
       so it grows instead of painting that line over the page heading. */
    .sv-shell-bar { height: auto; min-height: 56px; padding: 8px 12px; flex-wrap: wrap; }
    /* As a flex item that hides overflow, the shell's automatic minimum is
       0, so it shrank to whatever the demo stage had left. Keep its height
       and let the page scroll. */
    .sv-shell { flex-shrink: 0; }
    /* The stat cards go 2-up here and the page grows past 620px; without a
       pinned row the implicit grid row grew with it and the shell clipped
       the bottom. Pin the row to the shell so the content area scrolls, as
       it does on desktop. */
    .sv-shell { grid-template-rows: minmax(0, 1fr); }
    /* The content area is a flex column with a definite height, so its cards
       (hidden overflow, automatic minimum 0) squeezed instead of making
       it scroll. Keep their heights; the column scrolls. */
    .sv-shell-content > :global(*) { flex-shrink: 0; }
  }
</style>
