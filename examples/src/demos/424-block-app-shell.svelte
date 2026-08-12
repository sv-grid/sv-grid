<script lang="ts">
  /**
   * App shell block - a full application layout (shadcn sidebar-01 style): a
   * SvNavPane sidebar with sections + badges, a top bar with breadcrumb, search
   * and account menu, and a routed content area. Selecting a nav item swaps the
   * page. Collapse the rail with the toggle. Pure UI-kit, --sg-* themed.
   */
  import {
    SvNavPane, SvBreadcrumb, SvTextInput, SvButton, SvAvatar, SvBadge,
    SvMenu, SvCard, SvStat, SvEmptyState, SvToaster, toast,
    type NavSection, type MenuItem,
  } from '@svgrid/grid'

  const sections: NavSection[] = [
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

  const labelOf: Record<string, string> = {
    dashboard: 'Dashboard', analytics: 'Analytics', orders: 'Orders', customers: 'Customers',
    reports: 'Reports', billing: 'Billing', team: 'Team', settings: 'Settings',
  }

  let active = $state('dashboard')
  let collapsed = $state(false)
  let query = $state('')

  const accountMenu: MenuItem[] = [
    { label: 'Profile', onSelect: () => toast('Profile') },
    { label: 'Preferences', onSelect: () => toast('Preferences') },
    { separator: true },
    { label: 'Sign out', onSelect: () => toast('Signed out') },
  ]
</script>

<div class="shell" class:collapsed>
  <!-- Sidebar -->
  <div class="side">
    <div class="brand">
      <span class="logo">◧</span>
      {#if !collapsed}<strong>Northwind</strong>{/if}
    </div>
    <SvNavPane
      {sections}
      bind:value={active}
      {collapsed}
      onSelect={(id) => (active = id)}
    />
  </div>

  <!-- Main column -->
  <div class="main">
    <header class="bar">
      <button class="icon-btn" onclick={() => (collapsed = !collapsed)} aria-label="Toggle sidebar">☰</button>
      <SvBreadcrumb items={[{ label: 'Home', href: '#' }, { label: 'Workspace', href: '#' }, { label: labelOf[active] }]} />
      <div class="spacer"></div>
      <div class="search">
        <SvTextInput bind:value={query} placeholder="Search..." clearable block>
          {#snippet leading()}<span class="ic">🔎</span>{/snippet}
        </SvTextInput>
      </div>
      <SvButton variant="ghost" size="sm" ariaLabel="Notifications" onclick={() => toast('2 new notifications')}>🔔</SvButton>
      <SvMenu items={accountMenu}>
        {#snippet anchor()}<button class="acct"><SvAvatar name="Ada Lovelace" size="sm" status="online" /></button>{/snippet}
      </SvMenu>
    </header>

    <main class="content">
      <div class="page-head">
        <h1>{labelOf[active]}</h1>
        <SvBadge variant="accent" pill>Live</SvBadge>
      </div>

      {#if active === 'dashboard' || active === 'analytics'}
        <div class="cards">
          <SvCard><SvStat label="Revenue" value="$48.1k" delta={12} hint="vs last month" /></SvCard>
          <SvCard><SvStat label="Orders" value="1,240" delta={8} hint="vs last month" /></SvCard>
          <SvCard><SvStat label="Customers" value="18.6k" delta={3} hint="vs last month" /></SvCard>
          <SvCard><SvStat label="Refunds" value="0.9%" delta={-0.4} invert hint="vs last month" /></SvCard>
        </div>
        <SvCard title="{labelOf[active]} overview">
          <p class="muted">This is the <strong>{labelOf[active]}</strong> page. Swap it for your own content - the shell (sidebar, breadcrumb, top bar, account menu) stays the same across every route.</p>
        </SvCard>
      {:else}
        <SvCard flush>
          <SvEmptyState
            title="{labelOf[active]} goes here"
            description="Drop your real {labelOf[active].toLowerCase()} view into this content region. The shell handles navigation and chrome."
          >
            <SvButton variant="primary" size="sm" onclick={() => toast('Create')}>Create {labelOf[active].toLowerCase()}</SvButton>
          </SvEmptyState>
        </SvCard>
      {/if}
    </main>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .shell { display: grid; grid-template-columns: 232px 1fr; height: 620px; border: 1px solid var(--sg-border, #eef2f7); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); }
  .shell.collapsed { grid-template-columns: 64px 1fr; }
  .side { display: flex; flex-direction: column; border-right: 1px solid var(--sg-border, #eef2f7); background: var(--sg-header-bg, #f8fafc); min-height: 0; }
  /* Let SvNavPane fill the sidebar column (flush - no card chrome) so its
     internal scroll region gets a real height instead of collapsing to 0. */
  .side :global(.sv-nav) { width: auto; flex: 1 1 0; min-height: 0; border: 0; border-radius: 0; background: transparent; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 16px; font-size: 16px; font-weight: 700; height: 56px; box-sizing: border-box; }
  .logo { font-size: 20px; color: var(--sg-accent, #4f46e5); }

  .main { display: flex; flex-direction: column; min-width: 0; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 56px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .spacer { flex: 1; }
  .search { width: 220px; }
  .icon-btn { background: none; border: 0; font-size: 17px; cursor: pointer; padding: 4px 8px; border-radius: 6px; color: var(--sg-muted, #475569); }
  .icon-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .acct { background: none; border: 0; padding: 0; cursor: pointer; display: inline-flex; }

  .content { padding: 22px; overflow: auto; display: flex; flex-direction: column; gap: 16px; background: var(--sg-header-bg, #f8fafc); }
  .page-head { display: flex; align-items: center; gap: 10px; }
  .page-head h1 { margin: 0; font-size: 22px; letter-spacing: -.01em; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 14px; line-height: 1.55; margin: 0; }
  .ic { display: inline-flex; font-size: 13px; }

  @media (max-width: 720px) {
    .search { display: none; }
    .shell { grid-template-columns: 64px 1fr; }
  }
</style>
