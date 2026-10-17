<script lang="ts" module>
  /**
   * Settings with side nav block - a workspace settings page: a section menu
   * on the left (General, Security, Billing, Team) swaps the form on the
   * right. Each panel is a short form of its own: SvTextInput, SvDropDownList,
   * SvSwitchButton and SvSegmented fields with a Save SvButton, and the Team
   * panel invites members into the list. Below 720 px the menu becomes an
   * SvDropDownList above the panel. Pure UI-kit, --sg-* themed.
   *
   * Headless: createWorkspaceSettings() below owns the active section, each
   * section's values and validation, the save flow and the member invites
   * with no markup. The component under it is one styled render of that core;
   * import createWorkspaceSettings from this file (or `npx @svgrid/ui add
   * form-layouts-settings-nav --headless` for the core alone) to draw your own.
   */
  const SECTION_IDS = ['general', 'security', 'billing', 'team'] as const
  export type WorkspaceSectionId = (typeof SECTION_IDS)[number]
  export type WorkspaceSection = { value: WorkspaceSectionId; label: string; note: string }
  export type WorkspaceOption = { value: string; label: string }
  export type WorkspaceGeneral = { name: string; slug: string; zone: string | number }
  export type WorkspaceSecurity = { twoFactor: boolean; timeout: string | number; domain: string }
  export type WorkspaceBilling = { email: string; plan: string | number | null }
  export type WorkspaceMember = { email: string; role: string }
  export type WorkspaceSave =
    | { label: string; section: 'general'; values: WorkspaceGeneral }
    | { label: string; section: 'security'; values: WorkspaceSecurity }
    | { label: string; section: 'billing'; values: WorkspaceBilling }
  export type WorkspaceSettingsOptions = {
    sections?: WorkspaceSection[]
    zones?: WorkspaceOption[]
    timeouts?: WorkspaceOption[]
    plans?: WorkspaceOption[]
    roles?: WorkspaceOption[]
    general?: WorkspaceGeneral
    security?: WorkspaceSecurity
    billing?: WorkspaceBilling
    members?: WorkspaceMember[]
    /** Called with the valid values of one section; throw (or reject) to keep them unsaved. */
    onSave?: (save: WorkspaceSave) => Promise<void> | void
    /** Called after a member is added to the list. */
    onInvite?: (member: WorkspaceMember) => void
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const SAMPLE_SECTIONS: WorkspaceSection[] = [
    { value: 'general', label: 'General', note: 'Name, URL and time zone of the workspace.' },
    { value: 'security', label: 'Security', note: 'Sign-in rules for every member.' },
    { value: 'billing', label: 'Billing', note: 'Plan and where invoices go.' },
    { value: 'team', label: 'Team', note: 'Who can open this workspace.' },
  ]
  const SAMPLE_ZONES = ['Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore']
    .map((z) => ({ value: z, label: z.replace('_', ' ') }))
  const SAMPLE_TIMEOUTS = [{ value: '1h', label: '1 hour' }, { value: '8h', label: '8 hours' }, { value: '7d', label: '7 days' }]
  const SAMPLE_PLANS = [{ value: 'starter', label: 'Starter' }, { value: 'team', label: 'Team' }, { value: 'business', label: 'Business' }]
  const SAMPLE_ROLES = [{ value: 'Admin', label: 'Admin' }, { value: 'Editor', label: 'Editor' }, { value: 'Viewer', label: 'Viewer' }]

  export function createWorkspaceSettings(opts: WorkspaceSettingsOptions = {}) {
    // Sample data stands in when the app passes none; switching section clears the errors.
    const sections = opts.sections ?? SAMPLE_SECTIONS
    const roles = opts.roles ?? SAMPLE_ROLES

    let active = $state<WorkspaceSectionId>(sections[0]?.value ?? 'general')
    const general = $state<WorkspaceGeneral>({ ...(opts.general ?? { name: 'Acme Analytics', slug: 'acme-analytics', zone: 'Europe/London' }) })
    const security = $state<WorkspaceSecurity>({ ...(opts.security ?? { twoFactor: true, timeout: '8h', domain: 'acme.io' }) })
    const billing = $state<WorkspaceBilling>({ ...(opts.billing ?? { email: 'finance@acme.io', plan: 'team' }) })
    const members = $state<WorkspaceMember[]>((opts.members ?? [
      { email: 'ada@acme.io', role: 'Admin' }, { email: 'grace@acme.io', role: 'Editor' },
    ]).map((m) => ({ ...m })))
    const invite = $state<{ email: string; role: string | number }>({ email: '', role: 'Editor' })
    let errors = $state<Record<string, string>>({})
    let busy = $state(false)

    const current = $derived(sections.find((s) => s.value === active)!)

    function go(id: string | number) {
      const s = sections.find((x) => x.value === id)
      if (s) { active = s.value; errors = {} }
    }

    function validate(): boolean {
      const e: Record<string, string> = {}
      if (active === 'general') {
        if (!general.name.trim()) e.name = 'Enter a workspace name.'
        if (!/^[a-z0-9-]{3,}$/.test(general.slug)) e.slug = 'Use 3 or more lowercase letters, digits or hyphens.'
      } else if (active === 'security') {
        if (security.domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(security.domain)) e.domain = 'Enter a domain like acme.io, or leave it empty.'
      } else if (active === 'billing') {
        if (!EMAIL_RE.test(billing.email.trim())) e.email = 'Enter a valid billing email.'
      }
      errors = e
      return !Object.keys(e).length
    }

    function payload(): WorkspaceSave | null {
      const label = current.label
      if (active === 'general') return { section: active, label, values: $state.snapshot(general) }
      if (active === 'security') return { section: active, label, values: $state.snapshot(security) }
      if (active === 'billing') return { section: active, label, values: $state.snapshot(billing) }
      return null
    }

    async function save(ev?: Event) {
      ev?.preventDefault()
      if (busy || !validate()) return
      const p = payload()
      if (!p) return
      busy = true
      try {
        await opts.onSave?.(p)
      } catch {
        // Values stay as typed; the user can save again.
      } finally {
        busy = false
      }
    }

    function addMember(ev?: Event) {
      ev?.preventDefault()
      const email = invite.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email)) { errors = { invite: 'Enter a valid email address.' }; return }
      if (members.some((m) => m.email === email)) { errors = { invite: 'Already a member.' }; return }
      const member = { email, role: String(invite.role) }
      members.push(member)
      invite.email = ''
      errors = {}
      opts.onInvite?.(member)
    }

    return {
      sections, roles,
      zones: opts.zones ?? SAMPLE_ZONES,
      timeouts: opts.timeouts ?? SAMPLE_TIMEOUTS,
      plans: opts.plans ?? SAMPLE_PLANS,
      general, security, billing, members, invite,
      get active() { return active },
      set active(v: WorkspaceSectionId) { go(v) },
      get current() { return current },
      get errors() { return errors },
      get busy() { return busy },
      go, validate, save, addMember,
      clearErrors: () => { errors = {} },
      /** Spread on a plain <button> in your own section menu. */
      navProps: (id: WorkspaceSectionId) => ({
        type: 'button' as const,
        'aria-current': active === id ? ('page' as const) : undefined,
        onclick: () => go(id),
      }),
      /** Spread on the section's <form> (the Team panel uses inviteFormProps). */
      formProps: () => ({ novalidate: true, onsubmit: save }),
      inviteFormProps: () => ({ novalidate: true, onsubmit: addMember }),
    }
  }
</script>

<script lang="ts">
  import {
    SvTextInput, SvDropDownList, SvSwitchButton, SvSegmented, SvButton, SvBadge,
    SvToaster, toast,
  } from '@svgrid/grid'

  const ws = createWorkspaceSettings({
    // Replace with your request per section; a thrown error keeps the values unsaved.
    onSave: ({ label }) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 800)), {
        loading: `Saving ${label.toLowerCase()} settings...`,
        success: `${label} settings saved`,
        error: 'Could not save',
      }),
    onInvite: (m) => toast.success(`Invite sent to ${m.email}`),
  })
</script>

<main class="sv-setnav">
  <h2>Workspace settings</h2>
  <div class="sv-setnav-layout">
    <nav aria-label="Settings sections">
      {#each ws.sections as s (s.value)}
        <button class:sv-setnav-is-on={ws.active === s.value} {...ws.navProps(s.value)}>{s.label}</button>
      {/each}
    </nav>
    <div class="sv-setnav-picker">
      <SvDropDownList label="Section" options={ws.sections} value={ws.active} block onChange={ws.go} />
    </div>

    <section class="sv-setnav-panel" aria-labelledby="panel-title">
      <h3 id="panel-title">{ws.current.label}</h3>
      <p class="sv-setnav-muted">{ws.current.note}</p>

      {#if ws.active === 'team'}
        <form class="sv-setnav-invite" {...ws.inviteFormProps()}>
          <SvTextInput label="Invite by email" name="email" type="email" placeholder="name@acme.io" bind:value={ws.invite.email}
            block error={ws.errors.invite} invalid={!!ws.errors.invite} onChange={ws.clearErrors} />
          <SvDropDownList label="Role" name="role" options={ws.roles} value={ws.invite.role} block onChange={(v) => (ws.invite.role = v)} />
          <SvButton type="submit">Invite</SvButton>
        </form>
        <ul class="sv-setnav-members">
          {#each ws.members as m (m.email)}
            <li><span>{m.email}</span><SvBadge size="sm" variant="neutral">{m.role}</SvBadge></li>
          {/each}
        </ul>
      {:else}
        <form class="sv-setnav-fields" {...ws.formProps()}>
          {#if ws.active === 'general'}
            <SvTextInput label="Workspace name" name="name" bind:value={ws.general.name} block required
              error={ws.errors.name} invalid={!!ws.errors.name} />
            <SvTextInput label="Workspace URL" name="slug" prefix="acme.app/" bind:value={ws.general.slug} block required
              error={ws.errors.slug} invalid={!!ws.errors.slug} />
            <SvDropDownList label="Time zone" name="zone" options={ws.zones} value={ws.general.zone} block
              onChange={(v) => (ws.general.zone = v)} />
          {:else if ws.active === 'security'}
            <SvSwitchButton label="Require two-factor sign-in" name="twoFactor" checked={ws.security.twoFactor}
              hint="Members without it are asked to set it up at their next sign-in."
              onChange={(v) => (ws.security.twoFactor = v)} />
            <SvDropDownList label="Sign members out after" name="timeout" options={ws.timeouts} value={ws.security.timeout} block
              onChange={(v) => (ws.security.timeout = v)} />
            <SvTextInput label="Allowed email domain" name="domain" bind:value={ws.security.domain} block
              hint="Only addresses on this domain can join." error={ws.errors.domain} invalid={!!ws.errors.domain} />
          {:else}
            <SvSegmented label="Plan" name="plan" options={ws.plans} bind:value={ws.billing.plan} block />
            <SvTextInput label="Billing email" name="email" type="email" bind:value={ws.billing.email} block required
              error={ws.errors.email} invalid={!!ws.errors.email} />
          {/if}
          <div class="sv-setnav-bar"><SvButton type="submit" loading={ws.busy}>Save {ws.current.label.toLowerCase()}</SvButton></div>
        </form>
      {/if}
    </section>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-setnav {
    flex: none; width: 100%;
    min-height: 560px; max-width: 920px; margin: 0 auto; padding: 32px 24px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  h2 { font-weight: 700; margin: 0 0 20px; font-size: 22px; letter-spacing: -.01em; }
  .sv-setnav-layout { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 28px; align-items: start; }
  nav { display: flex; flex-direction: column; gap: 2px; }
  nav button {
    text-align: left; padding: 8px 12px; font: inherit; font-size: 13.5px; cursor: pointer;
    color: var(--sg-muted, #64748b); background: none; border: 0; border-radius: var(--sg-radius, 8px);
  }
  nav button:hover { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  nav button.sv-setnav-is-on { color: var(--sg-fg, #0f172a); font-weight: 600; background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)); }
  nav button:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #6366f1)); outline-offset: 1px; }
  .sv-setnav-picker { display: none; }
  .sv-setnav-panel {
    padding: 24px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  h3 { font-weight: 600; margin: 0 0 4px; font-size: 16px; }
  .sv-setnav-muted { margin: 0 0 20px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-setnav-fields { display: flex; flex-direction: column; gap: 18px; max-width: 460px; }
  .sv-setnav-bar { display: flex; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-setnav-invite { display: grid; grid-template-columns: minmax(0, 1fr) 130px auto; gap: 10px; align-items: start; }
  .sv-setnav-invite :global(.sv-btn) { margin-top: 20px; min-height: 36px; }
  .sv-setnav-members { list-style: none; margin: 18px 0 0; padding: 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-setnav-members li {
    display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 2px;
    font-size: 13.5px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-setnav-members span { overflow: hidden; text-overflow: ellipsis; }

  @media (max-width: 720px) {
    .sv-setnav { padding: 20px 12px; }
    .sv-setnav-layout { grid-template-columns: minmax(0, 1fr); gap: 14px; }
    nav { display: none; }
    .sv-setnav-picker { display: grid; }
    .sv-setnav-panel { padding: 16px; }
    .sv-setnav-bar { flex-wrap: wrap; }
    .sv-setnav-invite { grid-template-columns: minmax(0, 1fr); }
    .sv-setnav-invite :global(.sv-btn) { margin-top: 0; }
  }
</style>
