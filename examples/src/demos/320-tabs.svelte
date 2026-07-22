<script lang="ts">
  /**
   * SvTabs - a production settings screen: line tabs with real panels, plus a
   * pill-style variant. Roving arrow-key focus, automatic activation. Copy-paste
   * ready.
   */
  import { SvTabs } from '@svgrid/grid'
  import type { TabItem } from '@svgrid/grid'

  const tabs: TabItem[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'billing', label: 'Billing' },
    { id: 'team', label: 'Team', disabled: true },
  ]
  let active = $state('profile')
  const view: TabItem[] = [
    { id: 'grid', label: 'Grid' },
    { id: 'list', label: 'List' },
    { id: 'board', label: 'Board' },
  ]
  let viewMode = $state('grid')
</script>

<div class="wrap">
  <header>
    <h2>Tabs</h2>
    <p>WAI-ARIA tabs with roving arrow-key focus - settings screens, detail panels, view switchers. Line and pill variants.</p>
  </header>

  <div class="card">
    <SvTabs {tabs} bind:value={active}>
      {#snippet panel(id)}
        <div class="panel">
          {#if id === 'profile'}
            <h4>Profile</h4><p>Update your name, avatar and public bio. Changes are visible to your team immediately.</p>
          {:else if id === 'security'}
            <h4>Security</h4><p>Manage your password, two-factor authentication and active sessions.</p>
          {:else if id === 'billing'}
            <h4>Billing</h4><p>Your plan renews on the 1st. Update your card or download past invoices here.</p>
          {/if}
        </div>
      {/snippet}
    </SvTabs>
  </div>

  <div class="pillrow">
    <span class="pl">View</span>
    <SvTabs tabs={view} variant="pill" bind:value={viewMode} />
    <span class="cur">{viewMode}</span>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 560px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .card { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; padding: 4px 16px 8px; }
  .panel h4 { margin: 0 0 6px; font-size: 15px; }
  .panel p { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); line-height: 1.6; }
  .pillrow { display: flex; align-items: center; gap: 12px; }
  .pl { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .cur { font-size: 13px; color: var(--sg-muted, #94a3b8); }
</style>
