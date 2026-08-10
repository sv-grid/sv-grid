<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 49. Enterprise admin dashboard - users + permissions
   * -----------------------------------------------------
   * The CRUD-heavy back-office screen every internal tool ships
   * eventually: a users table with inline role + status + MFA
   * editing, bulk activate / deactivate / delete, an "Invite user"
   * dialog, and a live audit log that watches the admin's every
   * move.
   *
   *   1. **Bulk action toolbar.** Tick checkboxes -> the toolbar
   *      reveals "Activate / Deactivate / Delete / Export". Mirrors
   *      Gmail and Linear UX.
   *
   *   2. **Inline CRUD.** Role + status are list editors; MFA is a
   *      checkbox. Every edit hits the audit log on the right.
   *
   *   3. **Invite user dialog.** Lightweight modal with name +
   *      email + role validation. New row enters with a pending
   *      tint so you can spot the latest entry.
   *
   *   4. **Detail aside.** Click a row to see permissions broken
   *      out per resource and a per-user activity feed.
   *
   *   5. **Live audit log.** All mutations append entries with
   *      who / what / when. The log itself is a small SvGrid
   *      driving the same render pipeline as the main table.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type Role = 'owner' | 'admin' | 'editor' | 'analyst' | 'viewer'
  type Status = 'active' | 'pending' | 'suspended' | 'deactivated'

  type User = {
    id: string
    name: string
    email: string
    role: Role
    status: Status
    mfa: boolean
    /** epoch ms */
    lastLogin: number
    /** epoch ms */
    createdAt: number
    avatarColor: string
    activity: number  // # actions in last 30 days
    failedLogins: number
  }

  type AuditEntry = {
    id: string
    ts: number
    actor: string
    action: string
    target: string
    detail: string
    severity: 'info' | 'warn' | 'crit'
  }

  // ---- Seed -----------------------------------------------------------

  const ROLES: readonly Role[] = ['owner', 'admin', 'editor', 'analyst', 'viewer']
  const STATUSES: readonly Status[] = ['active', 'pending', 'suspended', 'deactivated']
  const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r }))
  const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }))

  const PERMISSIONS_BY_ROLE: Record<Role, Record<string, 'r' | 'rw' | 'rwd' | '-'>> = {
    owner:   { Users: 'rwd', Billing: 'rwd', Settings: 'rwd', Audit: 'r',   Data: 'rwd', API: 'rwd' },
    admin:   { Users: 'rwd', Billing: 'r',   Settings: 'rw',  Audit: 'r',   Data: 'rwd', API: 'rw'  },
    editor:  { Users: 'r',   Billing: '-',   Settings: '-',   Audit: '-',   Data: 'rw',  API: 'r'   },
    analyst: { Users: 'r',   Billing: '-',   Settings: '-',   Audit: 'r',   Data: 'r',   API: 'r'   },
    viewer:  { Users: '-',   Billing: '-',   Settings: '-',   Audit: '-',   Data: 'r',   API: '-'   },
  }

  const FIRST_NAMES = [
    'Sasha', 'Priya', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan', 'Riley',
    'Quinn', 'Avery', 'Reese', 'Alex', 'Sam', 'Taylor', 'Devon', 'Logan',
    'Cameron', 'Hayden', 'Skyler', 'Jordan', 'Parker', 'Sage', 'Kennedy', 'River',
  ]
  const LAST_NAMES = [
    'Park', 'Nair', 'Chen', 'Singh', 'Olsen', 'Diaz', 'Tran', 'Khan',
    'Cohen', 'Nakamura', 'Silva', 'Mehta', 'Brooks', 'Adler', 'Mason', 'Cole',
    'Reed', 'Owens', 'Patel', 'Wright', 'Lee', 'Ng', 'Lopez', 'Stewart',
  ]
  const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#f59e0b', '#0ea5e9']

  let prng = 0xADDBEEF0 >>> 0
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedUsers(): User[] {
    const out: User[] = []
    const today = Date.now()
    const usedEmails = new Set<string>()
    let i = 0
    while (out.length < 24) {
      const first = pick(FIRST_NAMES)
      const last = pick(LAST_NAMES)
      const handle = `${first}.${last}`.toLowerCase()
      const email = `${handle}@northwind.example`
      if (usedEmails.has(email)) continue
      usedEmails.add(email)
      const roleRoll = rnd()
      const role: Role = roleRoll < 0.05 ? 'owner'
        : roleRoll < 0.15 ? 'admin'
        : roleRoll < 0.4 ? 'editor'
        : roleRoll < 0.7 ? 'analyst' : 'viewer'
      const statusRoll = rnd()
      const status: Status = statusRoll < 0.78 ? 'active'
        : statusRoll < 0.88 ? 'pending'
        : statusRoll < 0.94 ? 'suspended' : 'deactivated'
      const daysAgoLastLogin = status === 'pending' ? -1 :
        status === 'deactivated' ? 180 + Math.floor(rnd() * 200) :
        Math.floor(rnd() * 18)
      const createdDays = 30 + Math.floor(rnd() * 700)
      out.push({
        id: `U-${(1000 + i).toString()}`,
        name: `${first} ${last}`,
        email,
        role,
        status,
        mfa: role === 'owner' ? true : rnd() < (role === 'admin' ? 0.9 : role === 'editor' ? 0.7 : 0.4),
        lastLogin: status === 'pending' ? 0 : today - daysAgoLastLogin * 86_400_000 - Math.floor(rnd() * 3600 * 1000 * 12),
        createdAt: today - createdDays * 86_400_000,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length]!,
        activity: status === 'active' ? Math.floor(rnd() * 220) : 0,
        failedLogins: status === 'suspended' ? 5 + Math.floor(rnd() * 5) : Math.floor(rnd() * 3),
      })
      i += 1
    }
    return out
  }

  // ---- Reactive state -------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let users = $state<User[]>(seedUsers())
  let search = $state('')
  let roleFilter = $state<Role | 'all'>('all')
  let statusFilter = $state<Status | 'all'>('all')
  let selectedIds = $state<Set<string>>(new Set())
  // svelte-ignore state_referenced_locally
  let activeUserId = $state<string | null>(users[0]?.id ?? null)
  let auditLog = $state<AuditEntry[]>([])
  let showInvite = $state(false)
  let inviteName = $state('')
  let inviteEmail = $state('')
  let inviteRole = $state<Role>('viewer')
  let inviteError = $state<string | null>(null)
  let confirmDelete = $state<{ ids: string[] } | null>(null)

  const ADMIN_NAME = 'You (admin)'

  function logAudit(action: string, target: string, detail: string, severity: AuditEntry['severity'] = 'info'): void {
    const entry: AuditEntry = {
      id: `A-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      ts: Date.now(),
      actor: ADMIN_NAME,
      action,
      target,
      detail,
      severity,
    }
    auditLog = [entry, ...auditLog].slice(0, 50)
  }

  const filteredUsers = $derived.by(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    })
  })

  const kpis = $derived.by(() => {
    const active = users.filter((u) => u.status === 'active').length
    const pending = users.filter((u) => u.status === 'pending').length
    const suspended = users.filter((u) => u.status === 'suspended').length
    const mfaOn = users.filter((u) => u.mfa).length
    const mfaPct = users.length ? Math.round((mfaOn / users.length) * 100) : 0
    const recentSignups = users.filter((u) => Date.now() - u.createdAt < 30 * 86_400_000).length
    return { active, pending, suspended, mfaPct, recentSignups }
  })

  const activeUser = $derived(users.find((u) => u.id === activeUserId) ?? null)

  // ---- Mutations ------------------------------------------------------

  function updateUser(id: string, patch: Partial<User>): void {
    users = users.map((u) => (u.id === id ? { ...u, ...patch } : u))
  }

  function bulkActivate(ids: string[]): void {
    users = users.map((u) => (ids.includes(u.id) ? { ...u, status: 'active' as Status, failedLogins: 0 } : u))
    logAudit('bulk activate', `${ids.length} users`, ids.join(', '))
  }
  function bulkDeactivate(ids: string[]): void {
    users = users.map((u) => (ids.includes(u.id) ? { ...u, status: 'deactivated' as Status } : u))
    logAudit('bulk deactivate', `${ids.length} users`, ids.join(', '), 'warn')
  }
  function bulkDelete(ids: string[]): void {
    users = users.filter((u) => !ids.includes(u.id))
    selectedIds = new Set()
    if (activeUserId && ids.includes(activeUserId)) activeUserId = null
    logAudit('delete', `${ids.length} users`, ids.join(', '), 'crit')
  }

  function inviteUser(): void {
    inviteError = null
    const name = inviteName.trim()
    const email = inviteEmail.trim().toLowerCase()
    if (!name) { inviteError = 'Name is required'; return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { inviteError = 'Invalid email format'; return }
    if (users.some((u) => u.email.toLowerCase() === email)) { inviteError = 'Email already exists'; return }
    const id = `U-${1000 + users.length + auditLog.length}`
    const user: User = {
      id, name, email, role: inviteRole, status: 'pending', mfa: false,
      lastLogin: 0, createdAt: Date.now(),
      avatarColor: AVATAR_COLORS[users.length % AVATAR_COLORS.length]!,
      activity: 0, failedLogins: 0,
    }
    users = [user, ...users]
    activeUserId = id
    logAudit('invite', `${name} <${email}>`, `role=${inviteRole}`)
    inviteName = ''
    inviteEmail = ''
    inviteRole = 'viewer'
    showInvite = false
  }

  function toggleRowSelected(id: string): void {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds = next
  }
  function toggleSelectAll(): void {
    if (selectedIds.size === filteredUsers.length) selectedIds = new Set()
    else selectedIds = new Set(filteredUsers.map((u) => u.id))
  }

  function clearAllFilters(): void {
    search = ''
    roleFilter = 'all'
    statusFilter = 'all'
  }

  // ---- Formatters -----------------------------------------------------

  function fmtRelativeTime(ts: number): string {
    if (!ts) return 'never'
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  function fmtTimeShort(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  function initials(name: string): string {
    return name.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet UserCell(props: { row: User })}
  <span class="ad-user">
    <span class="ad-avatar" style={`background:${props.row.avatarColor}`}>{initials(props.row.name)}</span>
    <span class="ad-user-text">
      <span class="ad-user-name">{props.row.name}</span>
      <span class="ad-user-email">{props.row.email}</span>
    </span>
  </span>
{/snippet}

{#snippet RoleCell(props: { row: User })}
  <span class={`ad-role ad-role-${props.row.role}`}>{props.row.role}</span>
{/snippet}

{#snippet StatusCell(props: { row: User })}
  <span class={`ad-status ad-status-${props.row.status}`}>
    <span class="ad-status-dot"></span>
    {props.row.status}
  </span>
{/snippet}

{#snippet LastLoginCell(props: { row: User })}
  {@const stale = props.row.lastLogin > 0 && Date.now() - props.row.lastLogin > 30 * 86_400_000}
  <span class={`ad-last ${stale ? 'ad-last-stale' : ''}`}>
    {#if props.row.lastLogin === 0}
      <span class="ad-muted">Invited - never</span>
    {:else}
      <span>{fmtRelativeTime(props.row.lastLogin)}</span>
      {#if props.row.failedLogins > 0}
        <span class="ad-failed">{props.row.failedLogins} fail</span>
      {/if}
    {/if}
  </span>
{/snippet}

{#snippet SelectCell(props: { row: User })}
  <input
    type="checkbox"
    class="ad-checkbox"
    checked={selectedIds.has(props.row.id)}
    onclick={(e) => { e.stopPropagation() }}
    onchange={() => toggleRowSelected(props.row.id)}
    aria-label={`Select ${props.row.name}`}
  />
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="ad-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="ad-kpi-strip">
    <div class="ad-kpi">
      <div class="ad-kpi-label">Active users</div>
      <div class="ad-kpi-value tabular-nums">{kpis.active}</div>
      <div class="ad-kpi-foot">{users.length} total accounts</div>
    </div>
    <div class="ad-kpi">
      <div class="ad-kpi-label">Pending invites</div>
      <div class="ad-kpi-value tabular-nums">{kpis.pending}</div>
      <div class="ad-kpi-foot">awaiting first login</div>
    </div>
    <div class="ad-kpi">
      <div class="ad-kpi-label">Suspended</div>
      <div class={`ad-kpi-value tabular-nums ${kpis.suspended > 0 ? 'ad-warn' : ''}`}>{kpis.suspended}</div>
      <div class="ad-kpi-foot">manual unlock required</div>
    </div>
    <div class="ad-kpi">
      <div class="ad-kpi-label">MFA coverage</div>
      <div class={`ad-kpi-value tabular-nums ${kpis.mfaPct < 80 ? 'ad-warn' : 'ad-up'}`}>{kpis.mfaPct}%</div>
      <div class="ad-kpi-foot">policy minimum: 80%</div>
    </div>
    <div class="ad-kpi">
      <div class="ad-kpi-label">Recent sign-ups</div>
      <div class="ad-kpi-value tabular-nums">{kpis.recentSignups}</div>
      <div class="ad-kpi-foot">last 30 days</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="ad-toolbar">
    <input
      type="search"
      class="ad-search"
      placeholder="Search by name, email, ID..."
      bind:value={search}
    />
    <select class="ad-select" bind:value={roleFilter} aria-label="Filter by role">
      <option value="all">All roles</option>
      {#each ROLES as r (r)}<option value={r}>{r}</option>{/each}
    </select>
    <select class="ad-select" bind:value={statusFilter} aria-label="Filter by status">
      <option value="all">All statuses</option>
      {#each STATUSES as s (s)}<option value={s}>{s}</option>{/each}
    </select>
    {#if search || roleFilter !== 'all' || statusFilter !== 'all'}
      <button type="button" class="ad-btn ad-btn-ghost" onclick={clearAllFilters}>Clear</button>
    {/if}
    <span class="ad-toolbar-spacer"></span>
    <button type="button" class="ad-btn ad-btn-primary" onclick={() => (showInvite = true)}>
      + Invite user
    </button>
  </div>

  <!-- Selection bar -->
  {#if selectedIds.size > 0}
    <div class="ad-bulk-bar">
      <span class="ad-bulk-count tabular-nums">{selectedIds.size} selected</span>
      <button type="button" class="ad-btn" onclick={() => bulkActivate([...selectedIds])}>Activate</button>
      <button type="button" class="ad-btn" onclick={() => bulkDeactivate([...selectedIds])}>Deactivate</button>
      <button type="button" class="ad-btn ad-btn-danger" onclick={() => (confirmDelete = { ids: [...selectedIds] })}>Delete</button>
      <button type="button" class="ad-btn ad-btn-ghost" onclick={() => (selectedIds = new Set())}>Clear</button>
    </div>
  {/if}

  <!-- Body: grid + detail panel -->
  <div class="ad-body flex flex-1 min-h-0 gap-3">
    <div class="ad-master flex-1 min-w-0">
      <SvGrid responsive={true}
        data={filteredUsers}
        columns={[
          { field: 'id', header: '', width: 40, editable: false,
            cell: (ctx) => renderSnippet(SelectCell, { row: ctx.row.original }) },
          { field: 'name', header: 'User', width: 250, editable: false,
            cell: (ctx) => renderSnippet(UserCell, { row: ctx.row.original }) },
          { field: 'role', header: 'Role', editorType: 'list', width: 110,
            editorOptions: ROLE_OPTIONS,
            cell: (ctx) => renderSnippet(RoleCell, { row: ctx.row.original }) },
          { field: 'status', header: 'Status', editorType: 'list', width: 130,
            editorOptions: STATUS_OPTIONS,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
          { field: 'mfa', header: 'MFA', editorType: 'checkbox', width: 80 },
          { field: 'lastLogin', header: 'Last login', width: 160, editable: false,
            cell: (ctx) => renderSnippet(LastLoginCell, { row: ctx.row.original }) },
          { field: 'activity', header: '30d actions', editorType: 'number', width: 110, editable: false },
        ] satisfies ColumnDef<typeof features, User>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        showPagination={false}
        enableInlineEditing={true}
        enableCellSelection={false}
        enableRowSummaries={false}
        rowHeight={52}
        containerHeight="100%"
        fitColumns={true}
        onCellValueChange={(args) => {
          const u = args.row
          if (args.columnId === 'role') {
            logAudit('change role', u.email, `${args.oldValue} -> ${args.newValue}`, 'warn')
          } else if (args.columnId === 'status') {
            logAudit('change status', u.email, `${args.oldValue} -> ${args.newValue}`,
              args.newValue === 'deactivated' || args.newValue === 'suspended' ? 'warn' : 'info')
          } else if (args.columnId === 'mfa') {
            logAudit('toggle MFA', u.email, args.newValue ? 'enabled' : 'disabled',
              args.newValue ? 'info' : 'warn')
          }
        }}
        onActiveCellChange={(args) => {
          const row = filteredUsers[args.rowIndex]
          if (row && row.id !== activeUserId) activeUserId = row.id
        }}
      />
    </div>

    <!-- Detail aside -->
    <aside class="ad-side">
      <div class="ad-side-section">
        <div class="ad-side-head">
          <span class="ad-side-title">Detail</span>
          {#if activeUser}
            <button type="button" class="ad-btn ad-btn-ghost ad-btn-sm" onclick={() => bulkDelete([activeUser!.id])}>Delete</button>
          {/if}
        </div>
        {#if !activeUser}
          <div class="ad-side-empty">Select a user to inspect their permissions and activity.</div>
        {:else}
          {@const u = activeUser}
          <div class="ad-detail-header">
            <span class="ad-avatar ad-avatar-lg" style={`background:${u.avatarColor}`}>{initials(u.name)}</span>
            <div class="ad-detail-id">
              <div class="ad-detail-name">{u.name}</div>
              <div class="ad-detail-email">{u.email}</div>
              <div class="ad-detail-tags">
                <span class={`ad-role ad-role-${u.role}`}>{u.role}</span>
                <span class={`ad-status ad-status-${u.status}`}><span class="ad-status-dot"></span>{u.status}</span>
                {#if u.mfa}<span class="ad-mfa-on">MFA on</span>{:else}<span class="ad-mfa-off">MFA off</span>{/if}
              </div>
            </div>
          </div>

          <div class="ad-detail-grid">
            <div class="ad-kv"><span>User ID</span><strong class="tabular-nums">{u.id}</strong></div>
            <div class="ad-kv"><span>Created</span><strong>{new Date(u.createdAt).toLocaleDateString('en-US')}</strong></div>
            <div class="ad-kv"><span>Last login</span><strong>{u.lastLogin === 0 ? '-' : fmtRelativeTime(u.lastLogin)}</strong></div>
            <div class="ad-kv"><span>30d actions</span><strong class="tabular-nums">{u.activity}</strong></div>
          </div>

          <div class="ad-perm-title">Permissions ({u.role})</div>
          <div class="ad-perm-grid">
            {#each Object.entries(PERMISSIONS_BY_ROLE[u.role]) as [resource, perm] (resource)}
              <div class={`ad-perm ${perm === '-' ? 'ad-perm-none' : ''}`}>
                <span class="ad-perm-res">{resource}</span>
                <span class={`ad-perm-pill ad-perm-${perm}`}>{perm === '-' ? 'denied' : perm.toUpperCase()}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Audit log -->
      <div class="ad-side-section ad-audit-section">
        <div class="ad-side-head">
          <span class="ad-side-title">Audit log</span>
          <span class="ad-muted tabular-nums">{auditLog.length}</span>
        </div>
        {#if auditLog.length === 0}
          <div class="ad-side-empty">No admin actions yet. Try editing a role or inviting a user.</div>
        {:else}
          <ul class="ad-audit">
            {#each auditLog.slice(0, 14) as e (e.id)}
              <li class={`ad-audit-row ad-audit-${e.severity}`}>
                <span class="ad-audit-time tabular-nums">{fmtTimeShort(e.ts)}</span>
                <div class="ad-audit-body">
                  <span class="ad-audit-action">{e.action}</span>
                  <span class="ad-audit-target"> - {e.target}</span>
                  <div class="ad-audit-detail">{e.detail}</div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </aside>
  </div>
</section>

<!-- ───────────────────── INVITE DIALOG ───────────────────── -->
{#if showInvite}
  <div
    class="ad-backdrop"
    role="button"
    tabindex="0"
    onclick={() => (showInvite = false)}
    onkeydown={(e) => { if (e.key === 'Escape') showInvite = false }}
  >
    <div
      class="ad-dialog"
      role="dialog"
      aria-label="Invite user"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      tabindex="0"
    >
      <header class="ad-dialog-head">
        <h3>Invite user</h3>
        <button type="button" class="ad-dialog-x" aria-label="Close" onclick={() => (showInvite = false)}>×</button>
      </header>
      <div class="ad-dialog-body">
        <label class="ad-field">
          <span>Full name</span>
          <input type="text" bind:value={inviteName} placeholder="Alex Park" />
        </label>
        <label class="ad-field">
          <span>Email</span>
          <input type="email" bind:value={inviteEmail} placeholder="alex.park@northwind.example" />
        </label>
        <label class="ad-field">
          <span>Role</span>
          <select bind:value={inviteRole}>
            {#each ROLES as r (r)}<option value={r}>{r}</option>{/each}
          </select>
        </label>
        {#if inviteError}<div class="ad-error">{inviteError}</div>{/if}
      </div>
      <footer class="ad-dialog-actions">
        <button type="button" class="ad-btn ad-btn-ghost" onclick={() => (showInvite = false)}>Cancel</button>
        <button type="button" class="ad-btn ad-btn-primary" onclick={inviteUser}>Send invite</button>
      </footer>
    </div>
  </div>
{/if}

<!-- ───────────────────── CONFIRM DELETE ───────────────────── -->
{#if confirmDelete}
  <div
    class="ad-backdrop"
    role="button"
    tabindex="0"
    onclick={() => (confirmDelete = null)}
    onkeydown={(e) => { if (e.key === 'Escape') confirmDelete = null }}
  >
    <div
      class="ad-dialog ad-dialog-confirm"
      role="dialog"
      aria-label="Confirm delete"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      tabindex="0"
    >
      <header class="ad-dialog-head">
        <h3>Delete {confirmDelete.ids.length} user{confirmDelete.ids.length === 1 ? '' : 's'}?</h3>
      </header>
      <div class="ad-dialog-body">
        <p class="ad-muted">This permanently removes their accounts and revokes all API keys. The action is logged in the audit trail.</p>
      </div>
      <footer class="ad-dialog-actions">
        <button type="button" class="ad-btn ad-btn-ghost" onclick={() => (confirmDelete = null)}>Cancel</button>
        <button type="button" class="ad-btn ad-btn-danger" onclick={() => { bulkDelete(confirmDelete!.ids); confirmDelete = null }}>Delete</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* KPI strip */
  .ad-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .ad-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .ad-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .ad-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .ad-kpi-foot { margin-top: 6px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .ad-warn { color: #d97706; }
  .ad-up   { color: #16a34a; }
  :global([data-theme='dark']) .ad-warn { color: #fbbf24; }
  :global([data-theme='dark']) .ad-up   { color: #4ade80; }
  .ad-muted { color: var(--sg-muted, #64748b); }

  /* Toolbar */
  .ad-toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .ad-toolbar-spacer { flex: 1 1 auto; }
  .ad-search {
    flex: 1 1 240px;
    min-width: 220px;
    max-width: 360px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12.5px;
  }
  .ad-select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12.5px;
    text-transform: capitalize;
  }

  /* Bulk action bar */
  .ad-bulk-bar {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 12px;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
    border-radius: 8px;
  }
  .ad-bulk-bar .ad-btn {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.32);
  }
  .ad-bulk-bar .ad-btn:hover { background: rgba(255, 255, 255, 0.28); }
  .ad-bulk-bar .ad-btn-danger { background: #b91c1c; border-color: transparent; }
  .ad-bulk-bar .ad-btn-ghost { background: transparent; border-color: transparent; }
  .ad-bulk-count {
    font-size: 12.5px;
    font-weight: 600;
    margin-right: 6px;
  }

  /* Body */
  .ad-body { min-height: 0; }
  .ad-master {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Buttons */
  .ad-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .ad-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .ad-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .ad-btn-primary:hover { filter: brightness(0.92); background: var(--sg-accent, #2563eb); }
  .ad-btn-danger {
    border-color: transparent;
    background: #dc2626;
    color: #fff;
  }
  .ad-btn-danger:hover { filter: brightness(0.92); background: #dc2626; }
  .ad-btn-ghost {
    border-color: transparent;
    background: transparent;
    color: var(--sg-muted, #64748b);
  }
  .ad-btn-ghost:hover { color: var(--sg-fg, #1e293b); background: var(--sg-header-bg, #f1f5f9); }
  .ad-btn-sm { padding: 3px 8px; font-size: 11px; }

  /* Cell snippets */
  :global(.ad-user) { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  :global(.ad-avatar) {
    width: 30px; height: 30px;
    border-radius: 50%;
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }
  :global(.ad-avatar-lg) { width: 44px; height: 44px; font-size: 14px; }
  :global(.ad-user-text) { display: inline-flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  :global(.ad-user-name) { font-weight: 600; }
  :global(.ad-user-email) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.ad-role) {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.ad-role-owner)   { background: #f3e8ff; color: #6b21a8; }
  :global(.ad-role-admin)   { background: #dbeafe; color: #1d4ed8; }
  :global(.ad-role-editor)  { background: #e0e7ff; color: #4338ca; }
  :global(.ad-role-analyst) { background: #fef3c7; color: #92400e; }
  :global(.ad-role-viewer)  { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .ad-role-owner)   { background: rgba(168,85,247,.2); color: #d8b4fe; }
  :global([data-theme='dark'] .ad-role-admin)   { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark'] .ad-role-editor)  { background: rgba(99,102,241,.2); color: #a5b4fc; }
  :global([data-theme='dark'] .ad-role-analyst) { background: rgba(245,158,11,.2); color: #fbbf24; }
  :global([data-theme='dark'] .ad-role-viewer)  { background: rgba(148,163,184,.2); color: #cbd5e1; }

  :global(.ad-status) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    text-transform: capitalize;
  }
  :global(.ad-status-dot) {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #94a3b8;
  }
  :global(.ad-status-active .ad-status-dot)      { background: #16a34a; box-shadow: 0 0 0 3px rgba(34,197,94,.18); }
  :global(.ad-status-pending .ad-status-dot)     { background: #f59e0b; }
  :global(.ad-status-suspended .ad-status-dot)   { background: #dc2626; box-shadow: 0 0 0 3px rgba(239,68,68,.18); }
  :global(.ad-status-deactivated .ad-status-dot) { background: #64748b; }

  :global(.ad-last) { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
  :global(.ad-last-stale) { color: var(--sg-muted, #64748b); }
  :global(.ad-failed) {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 10.5px;
    font-weight: 700;
  }
  :global([data-theme='dark'] .ad-failed) { background: rgba(239,68,68,.18); color: #f87171; }
  :global(.ad-muted) { color: var(--sg-muted, #64748b); }

  :global(.ad-checkbox) {
    width: 16px; height: 16px;
    accent-color: var(--sg-accent, #2563eb);
    cursor: pointer;
  }

  /* Detail aside */
  .ad-side {
    width: 360px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }
  .ad-side-section {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .ad-audit-section { flex: 1 1 0; min-height: 200px; }
  .ad-side-head {
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--sg-header-bg, #f1f5f9);
  }
  .ad-side-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    font-weight: 600;
  }
  .ad-side-empty {
    padding: 24px 14px;
    text-align: center;
    color: var(--sg-muted, #64748b);
    font-size: 12px;
    font-style: italic;
  }

  .ad-detail-header {
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .ad-detail-id { min-width: 0; }
  .ad-detail-name { font-size: 15px; font-weight: 700; }
  .ad-detail-email { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .ad-detail-tags { display: flex; gap: 5px; margin-top: 6px; flex-wrap: wrap; }
  .ad-mfa-on, .ad-mfa-off {
    font-size: 10.5px;
    padding: 1px 7px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ad-mfa-on  { background: #dcfce7; color: #166534; }
  .ad-mfa-off { background: #fef3c7; color: #92400e; }
  :global([data-theme='dark']) .ad-mfa-on  { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark']) .ad-mfa-off { background: rgba(245,158,11,.18); color: #fbbf24; }

  .ad-detail-grid {
    padding: 4px 16px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .ad-kv {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ad-kv span {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ad-kv strong { font-size: 12.5px; font-weight: 600; }

  .ad-perm-title {
    padding: 8px 16px 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .ad-perm-grid {
    padding: 4px 16px 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .ad-perm {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 5px;
  }
  .ad-perm-none { opacity: 0.55; }
  .ad-perm-res { font-size: 12px; font-weight: 500; }
  .ad-perm-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }
  .ad-perm-r   { background: #e0f2fe; color: #075985; }
  .ad-perm-rw  { background: #dbeafe; color: #1d4ed8; }
  .ad-perm-rwd { background: #dcfce7; color: #166534; }
  :global(.ad-perm-pill.ad-perm-\-) { background: #e2e8f0; color: #64748b; }
  :global([data-theme='dark']) .ad-perm-r   { background: rgba(14,165,233,.2); color: #7dd3fc; }
  :global([data-theme='dark']) .ad-perm-rw  { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark']) .ad-perm-rwd { background: rgba(34,197,94,.2); color: #4ade80; }

  /* Audit log */
  .ad-audit {
    list-style: none;
    padding: 6px;
    margin: 0;
    overflow: auto;
    flex: 1 1 0;
  }
  .ad-audit-row {
    display: flex;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 5px;
    border-left: 3px solid #94a3b8;
    background: var(--sg-header-bg, #f1f5f9);
    margin-bottom: 5px;
  }
  .ad-audit-info  { border-left-color: #2563eb; }
  .ad-audit-warn  { border-left-color: #f59e0b; }
  .ad-audit-crit  { border-left-color: #dc2626; }
  .ad-audit-time {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    flex-shrink: 0;
    min-width: 42px;
  }
  .ad-audit-body { font-size: 12px; min-width: 0; line-height: 1.3; }
  .ad-audit-action { font-weight: 600; }
  .ad-audit-target { color: var(--sg-muted, #64748b); }
  .ad-audit-detail { font-size: 10.5px; color: var(--sg-muted, #64748b); margin-top: 2px; }

  /* Dialogs */
  .ad-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    border: 0;
  }
  .ad-dialog {
    background: var(--sg-bg, #ffffff);
    border-radius: 12px;
    width: 380px;
    max-width: calc(100vw - 40px);
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
    display: flex;
    flex-direction: column;
    cursor: default;
  }
  .ad-dialog-confirm { width: 340px; }
  .ad-dialog-head {
    padding: 14px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ad-dialog-head h3 { font-size: 15px; font-weight: 700; margin: 0; }
  .ad-dialog-x {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
  }
  .ad-dialog-body {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ad-dialog-actions {
    padding: 12px 16px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .ad-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ad-field > span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
  }
  .ad-field > input,
  .ad-field > select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 6px 9px;
    font-size: 13px;
  }
  .ad-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 5px;
    padding: 6px 10px;
    font-size: 12px;
  }
  :global([data-theme='dark']) .ad-error { background: rgba(239,68,68,.18); color: #f87171; }
</style>
