<script lang="ts">
  /**
   * Account & Security settings console - a real SaaS settings surface composed
   * entirely from the SvGrid UI kit. It foregrounds the newest/upgraded pieces:
   * SvMenubar app bar, promise + action (Undo) toasts on save, SvPopconfirm for
   * destructive rows, SvHoverCard teammate previews, and frame input adornments
   * (leading icons, prefix/suffix affixes, masked secrets).
   */
  import {
    SvMenubar, SvTabs, SvCard, SvStat, SvTextInput, SvSwitchButton,
    SvButton, SvBadge, SvAvatar, SvHoverCard, SvPopconfirm, SvDivider, SvToaster,
    toast, type MenubarMenu, type MenuItem,
  } from '@svgrid/grid'

  // --- profile ---
  let fullName = $state('Ada Lovelace')
  let email = $state('ada@northwind.io')
  let company = $state('Northwind Analytics')
  let site = $state('northwind.io')

  // --- security ---
  let twoFA = $state(true)
  let sso = $state(false)
  let sessionTimeout = $state(30)
  let apiKey = $state('sk_live_4f8a92c1d7e6')

  // --- team ---
  type Member = { id: number; name: string; email: string; role: string; tasks: number; status: 'active' | 'invited' }
  let members = $state<Member[]>([
    { id: 1, name: 'Ada Lovelace', email: 'ada@northwind.io', role: 'Owner', tasks: 12, status: 'active' },
    { id: 2, name: 'Grace Hopper', email: 'grace@northwind.io', role: 'Admin', tasks: 8, status: 'active' },
    { id: 3, name: 'Alan Turing', email: 'alan@northwind.io', role: 'Editor', tasks: 5, status: 'active' },
    { id: 4, name: 'Katherine Johnson', email: 'kat@northwind.io', role: 'Viewer', tasks: 0, status: 'invited' },
  ])

  const menus: MenubarMenu[] = [
    { label: 'File', items: [
      { label: 'Export settings', onSelect: () => toast('Exported settings.json') },
      { label: 'Import...', onSelect: () => toast('Import cancelled') },
    ] },
    { label: 'Team', items: [
      { label: 'Invite member', shortcut: 'Ctrl+I', onSelect: inviteMember },
      { label: 'Manage roles', onSelect: () => toast('Opening roles') },
    ] },
    { label: 'Security', items: [
      { label: 'Rotate API key', onSelect: rotateKey },
      { label: 'View audit log', onSelect: () => toast('Opening audit log') },
    ] },
    { label: 'Help', items: [{ label: 'Docs', onSelect: () => toast('Opening docs') }, { label: 'Contact support', onSelect: () => toast('Support ticket started') }] },
  ]
  const onMenu = (_: MenuItem) => {}

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'team', label: 'Team' },
    { id: 'security', label: 'Security' },
  ]
  let tab = $state('profile')

  // --- actions with promise + action toasts ---
  function fakeSave(ms = 900, fail = false) {
    return new Promise<void>((res, rej) => setTimeout(() => (fail ? rej(new Error('network')) : res()), ms))
  }
  function saveProfile() {
    toast.promise(fakeSave(), {
      loading: 'Saving profile...',
      success: 'Profile saved',
      error: (e) => `Could not save: ${(e as Error).message}`,
    })
  }
  function rotateKey() {
    const prev = apiKey
    apiKey = 'sk_live_' + Math.round(performance.now()).toString(16).slice(0, 12)
    toast('API key rotated', {
      variant: 'warning',
      action: { label: 'Undo', onClick: () => { apiKey = prev; toast.success('Key restored') } },
    })
  }
  function inviteMember() {
    const id = Math.max(0, ...members.map((m) => m.id)) + 1
    members = [...members, { id, name: 'New Teammate', email: 'pending@northwind.io', role: 'Viewer', tasks: 0, status: 'invited' }]
    toast.success('Invite sent')
  }
  function removeMember(m: Member) {
    members = members.filter((x) => x.id !== m.id)
    toast('Removed ' + m.name, {
      action: { label: 'Undo', onClick: () => { members = [...members, m].sort((a, b) => a.id - b.id) } },
    })
  }

  const activeCount = $derived(members.filter((m) => m.status === 'active').length)
</script>

<div class="wrap">
  <SvMenubar {menus} onSelect={onMenu} ariaLabel="Settings menu" />

  <div class="stats">
    <SvCard><SvStat label="Seats used" value={`${activeCount} / 10`} hint="2 invites pending" /></SvCard>
    <SvCard><SvStat label="API calls (24h)" value="18.2k" delta="+6%" trend="up" /></SvCard>
    <SvCard><SvStat label="Storage" value="42 GB" hint="of 100 GB" /></SvCard>
    <SvCard><SvStat label="Plan" value="Business" hint="Renews Aug 1" /></SvCard>
  </div>

  <SvTabs {tabs} bind:value={tab} />

  {#if tab === 'profile'}
    <SvCard title="Profile" subtitle="How your account appears to teammates.">
      <div class="grid">
        <SvTextInput label="Full name" bind:value={fullName} block>
          {#snippet leading()}<span class="ic">👤</span>{/snippet}
        </SvTextInput>
        <SvTextInput label="Email" type="email" bind:value={email} block>
          {#snippet leading()}<span class="ic">✉</span>{/snippet}
        </SvTextInput>
        <SvTextInput label="Company" bind:value={company} block />
        <SvTextInput label="Website" bind:value={site} prefix="https://" block />
      </div>
      {#snippet footer()}
        <div class="actions">
          <SvButton variant="ghost">Cancel</SvButton>
          <SvButton variant="primary" onclick={saveProfile}>Save changes</SvButton>
        </div>
      {/snippet}
    </SvCard>
  {:else if tab === 'team'}
    <SvCard title="Team" subtitle="Invite teammates and manage their roles.">
      <div class="card-head-action">
        <SvButton size="sm" variant="outline" onclick={inviteMember}>Invite member</SvButton>
      </div>
      <ul class="members">
        {#each members as m (m.id)}
          <li>
            <SvHoverCard placement="right">
              {#snippet anchor()}<button class="who"><SvAvatar name={m.name} size="sm" />{m.name}</button>{/snippet}
              <div class="prof">
                <SvAvatar name={m.name} />
                <div>
                  <strong>{m.name}</strong>
                  <div class="muted">{m.email}</div>
                  <div class="muted">{m.tasks} open tasks - {m.role}</div>
                </div>
              </div>
            </SvHoverCard>
            <span class="role"><SvBadge variant={m.role === 'Owner' ? 'accent' : 'neutral'}>{m.role}</SvBadge></span>
            <span class="st">{#if m.status === 'invited'}<SvBadge variant="warning" dot>Invited</SvBadge>{:else}<SvBadge variant="success" dot>Active</SvBadge>{/if}</span>
            <span class="rm">
              {#if m.role !== 'Owner'}
                <SvPopconfirm title={`Remove ${m.name}?`} description="They lose access immediately." confirmLabel="Remove" confirmVariant="danger" onConfirm={() => removeMember(m)}>
                  {#snippet anchor()}<SvButton size="sm" variant="ghost">Remove</SvButton>{/snippet}
                </SvPopconfirm>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </SvCard>
  {:else}
    <SvCard title="Security" subtitle="Protect your account and data.">
      <div class="rows">
        <div class="setting"><div><strong>Two-factor authentication</strong><div class="muted">Require a code at sign-in.</div></div><SvSwitchButton checked={twoFA} onChange={(v) => (twoFA = v)} /></div>
        <SvDivider />
        <div class="setting"><div><strong>Single sign-on (SSO)</strong><div class="muted">Let members sign in with your IdP.</div></div><SvSwitchButton checked={sso} onChange={(v) => (sso = v)} /></div>
        <SvDivider />
        <div class="setting">
          <div><strong>API key</strong><div class="muted">Used for server-to-server calls.</div></div>
          <div class="keyrow">
            <SvTextInput value={apiKey} readonly>
              {#snippet leading()}<span class="ic">🔑</span>{/snippet}
            </SvTextInput>
            <SvPopconfirm title="Rotate API key?" description="The current key stops working right away." confirmLabel="Rotate" confirmVariant="danger" onConfirm={rotateKey}>
              {#snippet anchor()}<SvButton size="sm" variant="outline">Rotate</SvButton>{/snippet}
            </SvPopconfirm>
          </div>
        </div>
      </div>
    </SvCard>
  {/if}
</div>

<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 16px; max-width: 780px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .card-head-action { display: flex; justify-content: flex-end; }
  .members { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .members li { display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 12px; padding: 9px 2px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .who { display: inline-flex; align-items: center; gap: 9px; background: none; border: 0; font: inherit; font-size: 13.5px; color: inherit; cursor: pointer; padding: 0; }
  .prof { display: flex; gap: 12px; align-items: center; }
  .prof strong { font-size: 14px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .rows { display: flex; flex-direction: column; }
  .setting { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 6px 0; }
  .setting strong { font-size: 13.5px; }
  .keyrow { display: flex; align-items: center; gap: 8px; }
  .ic { display: inline-flex; font-size: 13px; }
</style>
