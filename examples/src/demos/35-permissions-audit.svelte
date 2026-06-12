<script lang="ts">
  /**
   * 35. Permissions, audit & history
   * --------------------------------
   * A B2B sales pipeline with role-based editing rules, full audit
   * log, per-cell change history, and one-click revert. The
   * enterprise-table-vendor-checklist demo.
   *
   * What it demonstrates that earlier demos didn't:
   *
   *   1. **Cell-level editable callbacks.** The grid's `editable`
   *      column-def field accepts `(ctx) => boolean`, so a single
   *      column can be editable for some rows and locked for others.
   *      Exercised here for "rep can only edit OWN deals" and
   *      "manager can only edit deals in OWN region" - both flowing
   *      from the active user object, no row-by-row prop juggling.
   *
   *   2. **Column-level role gating.** PII columns (email / phone)
   *      are entirely locked to admins. The header still renders but
   *      the cell content is masked, and `editable: false` is wired
   *      through the same `currentUser`.
   *
   *   3. **Comprehensive audit log.** Every `onCellValueChange` lands
   *      in a ring buffer with who / when / what cell / before / after.
   *      The side panel filters by user, by row, or by column.
   *
   *   4. **Per-cell history popover.** Click any cell - if it has any
   *      audit entries we show its full timeline in a floating chip,
   *      newest first.
   *
   *   5. **One-click revert.** Each audit entry has an "↶ revert"
   *      action that restores the cell to its pre-change value. The
   *      revert ITSELF is audited so you keep a perfect trail.
   *
   *   6. **Compliance read-only mode.** A toggle freezes the grid for
   *      everyone but keeps the audit log visible. Used during release
   *      cuts, after-hours, etc.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type CellContext,
  } from 'sv-grid-community'

  // ---- Domain ----------------------------------------------------------

  type Role = 'viewer' | 'rep' | 'manager' | 'admin'
  type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'
  type Stage =
    | 'discovery'
    | 'qualified'
    | 'proposal'
    | 'negotiation'
    | 'closed_won'
    | 'closed_lost'

  type Deal = {
    id: string
    customer: string
    ownerRep: string
    ownerRegion: Region
    stage: Stage
    amount: number
    probability: number
    closeDate: string
    email: string
    phone: string
    notes: string
  }

  type User = {
    id: string
    name: string
    role: Role
    /** A rep / manager's home region. Admins are 'global'. */
    region: Region | 'global'
    /** Initials shown in the avatar pill. */
    initials: string
  }

  type AuditEntry = {
    id: number
    at: number
    user: User
    rowId: string
    rowLabel: string
    columnId: string
    columnLabel: string
    before: unknown
    after: unknown
    /** Marks entries created by clicking ↶ revert. */
    isRevert: boolean
  }

  // ---- Constants -------------------------------------------------------

  const REGIONS: readonly Region[] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const STAGES: readonly Stage[] = [
    'discovery', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost',
  ]
  const REPS = ['Sasha Park', 'Jamie Chen', 'Robin Diaz', 'Casey Singh', 'Drew Olsen', 'Avery Mehta']
  const COMPANIES = [
    'Nordic Holdings', 'Pacific Industries', 'Atlas Logistics', 'Helios Group',
    'Vertex Trust', 'Quantum Resources', 'Stellar Networks', 'Apex Bio',
    'Crescent Labs', 'Sigma Capital', 'Pioneer Mining', 'Aurora Trading',
    'Granite Energy', 'Cobalt Systems', 'Meridian Materials', 'Polaris Bio',
    'Sentinel Capital', 'Tessera Partners', 'Vanguard Tech', 'Cascade Industries',
  ]

  const USERS: User[] = [
    { id: 'u-viewer',  name: 'Viewer (read-only)', role: 'viewer',  region: 'global', initials: 'RO' },
    { id: 'u-sasha',   name: 'Sasha Park',         role: 'rep',     region: 'EMEA',   initials: 'SP' },
    { id: 'u-jordan',  name: 'Jordan Wu',          role: 'manager', region: 'NA',     initials: 'JW' },
    { id: 'u-priya',   name: 'Priya Nair',         role: 'admin',   region: 'global', initials: 'PN' },
  ]

  const COLUMN_LABELS: Record<string, string> = {
    id: 'Deal ID',
    customer: 'Customer',
    ownerRep: 'Owner',
    ownerRegion: 'Region',
    stage: 'Stage',
    amount: 'Amount',
    probability: 'Probability',
    closeDate: 'Close date',
    email: 'Email (PII)',
    phone: 'Phone (PII)',
    notes: 'Notes',
  }

  // ---- Synthetic seed --------------------------------------------------

  let seedRng = 0x4D45474150
  function rnd(): number {
    seedRng = (seedRng * 1664525 + 1013904223) >>> 0
    return seedRng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(rnd() * arr.length)]!
  }
  function dealId(i: number): string {
    return `DL-${(100000 + i).toString(36).toUpperCase()}`
  }
  function seedDeals(count: number): Deal[] {
    const out: Deal[] = []
    for (let i = 0; i < count; i += 1) {
      const customer = `${pick(COMPANIES)}`
      const ownerRep = pick(REPS)
      const ownerRegion = pick(REGIONS)
      const stage = pick(STAGES)
      const amount = Math.round((10_000 + rnd() * 490_000) / 1000) * 1000
      const probability = Math.round(rnd() * 100)
      const monthOffset = Math.floor(rnd() * 6)
      const date = new Date()
      date.setMonth(date.getMonth() + monthOffset)
      date.setDate(1 + Math.floor(rnd() * 28))
      const closeDate = date.toISOString().slice(0, 10)
      // Synthetic PII - deliberately phony so nothing in the demo is real.
      const slug = customer.toLowerCase().replace(/[^a-z]+/g, '-')
      const email = `accounts@${slug}.example`
      const phone = `+1 (555) ${String(100 + Math.floor(rnd() * 900))}-${String(1000 + Math.floor(rnd() * 9000))}`
      out.push({
        id: dealId(i),
        customer, ownerRep, ownerRegion, stage,
        amount, probability, closeDate,
        email, phone,
        notes: '',
      })
    }
    return out
  }

  // ---- Reactive state --------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let deals = $state<Deal[]>(seedDeals(50))
  // Start as admin so the demo is immediately interactive - the role
  // switcher lets the viewer click any user to watch editability
  // collapse around them.
  let currentUser = $state<User>(USERS[3]!)
  let complianceLock = $state(false)
  let auditLog = $state.raw<AuditEntry[]>([])
  let auditFilter = $state<{ user: string; column: string; row: string }>({
    user: '', column: '', row: '',
  })
  let auditSeq = 0

  /** Track which cells have ever changed so we can show a tiny "edited" mark.
   *  Keyed by `${dealId}:${columnId}`. */
  let touchedCells = $state.raw<Set<string>>(new Set())
  let activeCellKey = $state<string>('')
  let activeCellHistory = $state<AuditEntry[]>([])

  // ---- Permission rules -------------------------------------------------

  const PII_COLUMNS = new Set(['email', 'phone'])
  // Identity columns are never editable (id, customer).
  const IDENTITY_COLUMNS = new Set(['id', 'customer'])
  // Columns a rep can edit on their OWN deals.
  const REP_EDITABLE = new Set(['stage', 'probability', 'closeDate', 'notes'])
  // Plus what a manager can edit on deals in their region.
  const MANAGER_EXTRA_EDITABLE = new Set(['amount', 'ownerRep'])

  function canEditColumn(user: User, columnId: string): 'no' | 'maybe' | 'yes' {
    if (complianceLock) return 'no'
    if (IDENTITY_COLUMNS.has(columnId)) return 'no'
    if (PII_COLUMNS.has(columnId)) return user.role === 'admin' ? 'yes' : 'no'
    if (user.role === 'viewer') return 'no'
    if (user.role === 'admin') return 'yes'
    if (user.role === 'manager') {
      // 'maybe' means "depends on the row" - gated per-row at cell time.
      return REP_EDITABLE.has(columnId) || MANAGER_EXTRA_EDITABLE.has(columnId) ? 'maybe' : 'no'
    }
    // Rep: only their own deals, and only certain columns.
    return REP_EDITABLE.has(columnId) ? 'maybe' : 'no'
  }

  function canEditCell(user: User, deal: Deal, columnId: string): boolean {
    const verdict = canEditColumn(user, columnId)
    if (verdict !== 'maybe') return verdict === 'yes'
    if (user.role === 'manager') return deal.ownerRegion === user.region
    if (user.role === 'rep') return deal.ownerRep === user.name
    return false
  }

  function canSeePii(user: User): boolean {
    return user.role === 'admin'
  }

  // ---- Edit pipeline ----------------------------------------------------

  function applyCellChange(
    args: { rowIndex: number; columnId: string; newValue: unknown; oldValue: unknown },
    opts: { isRevert?: boolean } = {},
  ): void {
    const deal = deals[args.rowIndex]
    if (!deal) return
    // Permission re-check (defensive - the grid already gated double-click).
    if (!opts.isRevert && !canEditCell(currentUser, deal, args.columnId)) return
    // Identity / unknown columns never accept writes.
    if (IDENTITY_COLUMNS.has(args.columnId)) return

    const before = (deal as unknown as Record<string, unknown>)[args.columnId]
    const after = args.newValue
    if (before === after) return

    const next = deals.slice()
    next[args.rowIndex] = { ...deal, [args.columnId]: after } as Deal
    deals = next

    const cellKey = `${deal.id}:${args.columnId}`
    touchedCells = new Set(touchedCells).add(cellKey)

    auditSeq += 1
    const entry: AuditEntry = {
      id: auditSeq,
      at: Date.now(),
      user: currentUser,
      rowId: deal.id,
      rowLabel: deal.customer,
      columnId: args.columnId,
      columnLabel: COLUMN_LABELS[args.columnId] ?? args.columnId,
      before, after,
      isRevert: opts.isRevert ?? false,
    }
    auditLog = [entry, ...auditLog].slice(0, 200)
    if (activeCellKey === cellKey) {
      activeCellHistory = [entry, ...activeCellHistory]
    }
  }

  /** Wired into SvGrid's onCellValueChange. */
  function onCellValueChange(args: {
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
  }): void {
    applyCellChange(args)
  }

  /** Restore a cell to its pre-change value. The revert itself is audited
   *  so you can see "Priya reverted Sasha's edit at 14:32". */
  function revertEntry(entry: AuditEntry): void {
    const rowIndex = deals.findIndex((d) => d.id === entry.rowId)
    if (rowIndex < 0) return
    if (!canEditColumn(currentUser, entry.columnId)) {
      // Soft check - admins can revert anyone, others can only revert
      // their own edits on rows they can still edit.
      if (currentUser.role !== 'admin' && entry.user.id !== currentUser.id) return
    }
    applyCellChange(
      { rowIndex, columnId: entry.columnId, newValue: entry.before, oldValue: entry.after },
      { isRevert: true },
    )
  }

  // ---- Active cell history --------------------------------------------

  function onActiveCellChange(args: { rowIndex: number; columnId: string }): void {
    const deal = deals[args.rowIndex]
    if (!deal) {
      activeCellKey = ''
      activeCellHistory = []
      return
    }
    const key = `${deal.id}:${args.columnId}`
    activeCellKey = key
    activeCellHistory = auditLog.filter(
      (e) => e.rowId === deal.id && e.columnId === args.columnId,
    )
  }

  // ---- KPI derivations --------------------------------------------------

  const visibleDeals = $derived(deals)
  const editableCellCount = $derived.by(() => {
    let count = 0
    for (const deal of visibleDeals) {
      for (const columnId of Object.keys(COLUMN_LABELS)) {
        if (canEditCell(currentUser, deal, columnId)) count += 1
      }
    }
    return count
  })
  const lockedCellCount = $derived(visibleDeals.length * Object.keys(COLUMN_LABELS).length - editableCellCount)

  // ---- Filtered audit log -----------------------------------------------

  const filteredAudit = $derived.by(() => {
    return auditLog.filter((entry) => {
      if (auditFilter.user && entry.user.id !== auditFilter.user) return false
      if (auditFilter.column && entry.columnId !== auditFilter.column) return false
      if (auditFilter.row && entry.rowId !== auditFilter.row) return false
      return true
    })
  })

  // ---- Formatters -------------------------------------------------------

  function fmtMoney(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }
  function fmtVal(v: unknown): string {
    if (v == null || v === '') return '∅'
    if (typeof v === 'number') return v.toLocaleString()
    return String(v)
  }
  function maskEmail(email: string): string {
    const [name, domain] = email.split('@')
    if (!domain) return '•••@•••'
    const visible = name && name.length > 1 ? name[0]! + '•••' : '•••'
    return `${visible}@${domain.replace(/^[^.]+/, '•••')}`
  }
  function maskPhone(phone: string): string {
    return phone.replace(/\d(?=\d{4})/g, '•')
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Deal })}
  <span class="mono pii-clean">{props.row.id}</span>
{/snippet}

{#snippet OwnerCell(props: { row: Deal })}
  {@const initials = props.row.ownerRep.split(' ').map((p) => p[0]).join('').slice(0, 2)}
  <span class="pa-owner">
    <span class="pa-avatar">{initials}</span>
    <span>{props.row.ownerRep}</span>
  </span>
{/snippet}

{#snippet RegionCell(props: { row: Deal })}
  <span class={`pa-region pa-region-${props.row.ownerRegion}`}>{props.row.ownerRegion}</span>
{/snippet}

{#snippet StageCell(props: { row: Deal })}
  <span class={`pa-stage pa-stage-${props.row.stage}`}>
    {props.row.stage.replace('_', ' ')}
  </span>
{/snippet}

{#snippet AmountCell(props: { row: Deal; touched: boolean })}
  <span class="pa-amount">
    {fmtMoney(props.row.amount)}
    {#if props.touched}<span class="pa-touched" aria-label="edited">●</span>{/if}
  </span>
{/snippet}

{#snippet ProbCell(props: { row: Deal })}
  <span class="pa-prob">
    <span class="pa-prob-bar"><span class="pa-prob-fill" style={`width: ${props.row.probability}%`}></span></span>
    <span class="pa-prob-text tabular-nums">{props.row.probability}%</span>
  </span>
{/snippet}

{#snippet EmailCell(props: { row: Deal })}
  {#if canSeePii(currentUser)}
    <span class="mono pii-clear">{props.row.email}</span>
  {:else}
    <span class="mono pii-masked" title="Visible to admins only">{maskEmail(props.row.email)}</span>
  {/if}
{/snippet}

{#snippet PhoneCell(props: { row: Deal })}
  {#if canSeePii(currentUser)}
    <span class="mono pii-clear">{props.row.phone}</span>
  {:else}
    <span class="mono pii-masked" title="Visible to admins only">{maskPhone(props.row.phone)}</span>
  {/if}
{/snippet}

{#snippet PlainCell(props: { row: Deal; field: keyof Deal })}
  <span>{props.row[props.field]}</span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="pa-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="pa-kpi-strip">
    <div class="pa-kpi">
      <div class="pa-kpi-label">Acting as</div>
      <div class="pa-kpi-value pa-current-user">
        <span class="pa-avatar pa-avatar-lg">{currentUser.initials}</span>
        <span class="pa-current-name">{currentUser.name}</span>
      </div>
      <div class="pa-kpi-foot">
        <span class={`pa-role pa-role-${currentUser.role}`}>{currentUser.role}</span>
        {#if currentUser.region !== 'global'}
          · {currentUser.region}
        {/if}
      </div>
    </div>
    <div class="pa-kpi">
      <div class="pa-kpi-label">Editable cells</div>
      <div class="pa-kpi-value tabular-nums">{editableCellCount.toLocaleString()}</div>
      <div class="pa-kpi-foot">{lockedCellCount.toLocaleString()} locked for this user</div>
    </div>
    <div class="pa-kpi">
      <div class="pa-kpi-label">Audit entries</div>
      <div class="pa-kpi-value tabular-nums">{auditLog.length}</div>
      <div class="pa-kpi-foot">{auditLog.filter((e) => e.isRevert).length} reverts</div>
    </div>
    <div class="pa-kpi">
      <div class="pa-kpi-label">PII visibility</div>
      <div class={`pa-kpi-value ${canSeePii(currentUser) ? 'pa-up' : 'pa-down'}`}>
        {canSeePii(currentUser) ? 'CLEAR' : 'MASKED'}
      </div>
      <div class="pa-kpi-foot">{canSeePii(currentUser) ? 'admin role' : 'role lacks permission'}</div>
    </div>
    <div class="pa-kpi">
      <div class="pa-kpi-label">Compliance lock</div>
      <div class={`pa-kpi-value ${complianceLock ? 'pa-down' : ''}`}>
        {complianceLock ? 'LOCKED' : 'open'}
      </div>
      <div class="pa-kpi-foot">{complianceLock ? 'no edits accepted' : 'edits flow normally'}</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="pa-toolbar">
    <span class="pa-role-switcher">
      <span class="pa-throttle-label">Acting as</span>
      {#each USERS as user (user.id)}
        <button
          type="button"
          class={`pa-user-btn pa-role-${user.role}`}
          class:pa-user-active={user.id === currentUser.id}
          onclick={() => (currentUser = user)}
        >
          <span class="pa-avatar">{user.initials}</span>
          <span>{user.name}</span>
        </button>
      {/each}
    </span>
    <div class="pa-toolbar-spacer"></div>
    <label class="pa-lock-label">
      <input type="checkbox" bind:checked={complianceLock} />
      <span>Compliance lock</span>
    </label>
  </div>

  <!-- Main: grid + audit panel -->
  <div class="pa-body">
    <div class="pa-grid-wrap">
      <SvGrid
        data={visibleDeals}
        columns={[
          {
            field: 'id', header: 'Deal', width: 130,
            editable: false,
            cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }),
          },
          {
            field: 'customer', header: 'Customer', width: 200,
            editable: false,
            cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'customer' }),
          },
          {
            field: 'ownerRep', header: 'Owner', width: 170,
            editorType: 'list',
            editorOptions: REPS as unknown as ReadonlyArray<string>,
            editable: (ctx: CellContext<Deal>) => canEditCell(currentUser, ctx.row.original, 'ownerRep'),
            cell: (ctx) => renderSnippet(OwnerCell, { row: ctx.row.original }),
          },
          {
            field: 'ownerRegion', header: 'Region', width: 90,
            editable: false,
            cell: (ctx) => renderSnippet(RegionCell, { row: ctx.row.original }),
          },
          {
            field: 'stage', header: 'Stage', width: 140,
            editorType: 'list',
            editorOptions: STAGES as unknown as ReadonlyArray<string>,
            editable: (ctx: CellContext<Deal>) => canEditCell(currentUser, ctx.row.original, 'stage'),
            cell: (ctx) => renderSnippet(StageCell, { row: ctx.row.original }),
          },
          {
            field: 'amount', header: 'Amount', editorType: 'number', width: 130,
            editable: (ctx: CellContext<Deal>) => canEditCell(currentUser, ctx.row.original, 'amount'),
            cell: (ctx) => renderSnippet(AmountCell, {
              row: ctx.row.original,
              touched: touchedCells.has(`${ctx.row.original.id}:amount`),
            }),
          },
          {
            field: 'probability', header: 'Win %', editorType: 'number', width: 140,
            editable: (ctx: CellContext<Deal>) => canEditCell(currentUser, ctx.row.original, 'probability'),
            cell: (ctx) => renderSnippet(ProbCell, { row: ctx.row.original }),
          },
          {
            field: 'closeDate', header: 'Close date', editorType: 'date', width: 130,
            editable: (ctx: CellContext<Deal>) => canEditCell(currentUser, ctx.row.original, 'closeDate'),
            cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'closeDate' }),
          },
          {
            field: 'email', header: 'Email (PII)', width: 190,
            editable: () => canSeePii(currentUser) && !complianceLock,
            cell: (ctx) => renderSnippet(EmailCell, { row: ctx.row.original }),
          },
          {
            field: 'phone', header: 'Phone (PII)', width: 160,
            editable: () => canSeePii(currentUser) && !complianceLock,
            cell: (ctx) => renderSnippet(PhoneCell, { row: ctx.row.original }),
          },
          {
            field: 'notes', header: 'Notes', width: 200,
            editorType: 'text',
            editable: (ctx: CellContext<Deal>) => canEditCell(currentUser, ctx.row.original, 'notes'),
          },
        ] satisfies ColumnDef<typeof features, Deal>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={!complianceLock}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={40}
        containerHeight="100%"
        fitColumns={false}
        onCellValueChange={onCellValueChange}
        onActiveCellChange={onActiveCellChange}
      />
    </div>

    <aside class="pa-side">
      <header class="pa-side-head">
        <span>Audit log</span>
        <span class="pa-side-stats tabular-nums">
          {filteredAudit.length} / {auditLog.length}
        </span>
      </header>
      <div class="pa-audit-filters">
        <select bind:value={auditFilter.user} class="pa-audit-filter">
          <option value="">All users</option>
          {#each USERS as user (user.id)}<option value={user.id}>{user.name}</option>{/each}
        </select>
        <select bind:value={auditFilter.column} class="pa-audit-filter">
          <option value="">All columns</option>
          {#each Object.entries(COLUMN_LABELS) as [id, label] (id)}
            <option value={id}>{label}</option>
          {/each}
        </select>
        {#if auditFilter.row}
          <button
            type="button"
            class="pa-audit-clear-row"
            onclick={() => (auditFilter.row = '')}
            title="Clear row filter"
          >row: {auditFilter.row} ✕</button>
        {/if}
      </div>
      <div class="pa-audit-list">
        {#each filteredAudit as entry (entry.id)}
          <div class={`pa-audit-row ${entry.isRevert ? 'pa-audit-revert' : ''}`}>
            <div class="pa-audit-meta">
              <span class="pa-avatar pa-avatar-sm">{entry.user.initials}</span>
              <span class="pa-audit-user">{entry.user.name}</span>
              <span class="pa-audit-time">{fmtTime(entry.at)}</span>
            </div>
            <div class="pa-audit-cell">
              <button
                type="button"
                class="pa-audit-rowlink"
                onclick={() => (auditFilter.row = entry.rowId)}
                title="Filter by this row"
              >{entry.rowLabel}</button>
              <span class="pa-audit-col">· {entry.columnLabel}</span>
            </div>
            <div class="pa-audit-diff">
              <span class="pa-diff-before">{fmtVal(entry.before)}</span>
              <span class="pa-diff-arrow">→</span>
              <span class="pa-diff-after">{fmtVal(entry.after)}</span>
              {#if entry.isRevert}
                <span class="pa-revert-tag">revert</span>
              {/if}
              <button
                type="button"
                class="pa-revert-btn"
                onclick={() => revertEntry(entry)}
                title="Restore the previous value (audited)"
              >↶</button>
            </div>
          </div>
        {:else}
          <div class="pa-audit-empty">No audit entries yet - double-click a cell to start the trail.</div>
        {/each}
      </div>

      {#if activeCellKey && activeCellHistory.length > 0}
        <div class="pa-cell-history">
          <header class="pa-cell-history-head">
            History for <strong>{activeCellKey}</strong>
            <span class="pa-cell-history-count">· {activeCellHistory.length}</span>
          </header>
          <div class="pa-cell-history-list">
            {#each activeCellHistory as entry (entry.id)}
              <div class="pa-cell-history-row">
                <span class="pa-audit-time">{fmtTime(entry.at)}</span>
                <span class="pa-audit-user">{entry.user.initials}</span>
                <span class="pa-diff-after">{fmtVal(entry.after)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </aside>
  </div>
</section>

<style>
  /* ─── KPI strip ──────────────────────────────────────────────── */
  .pa-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .pa-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .pa-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .pa-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .pa-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .pa-current-user {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }
  .pa-current-name {
    font-size: 16px;
    line-height: 1.2;
  }
  .pa-up { color: #16a34a; }
  .pa-down { color: #dc2626; }
  :global([data-theme='dark']) .pa-up { color: #4ade80; }
  :global([data-theme='dark']) .pa-down { color: #f87171; }

  /* ─── Avatar pills ───────────────────────────────────────────── */
  :global(.pa-avatar) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--sg-accent, #2563eb);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  :global(.pa-avatar-lg) { width: 32px; height: 32px; font-size: 13px; }
  :global(.pa-avatar-sm) { width: 18px; height: 18px; font-size: 9px; }

  /* ─── Role badges ────────────────────────────────────────────── */
  :global(.pa-role) {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  :global(.pa-role-viewer)  { background: #e2e8f0; color: #475569; }
  :global(.pa-role-rep)     { background: #dbeafe; color: #1d4ed8; }
  :global(.pa-role-manager) { background: #fef3c7; color: #92400e; }
  :global(.pa-role-admin)   { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .pa-role-viewer)  { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark'] .pa-role-rep)     { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .pa-role-manager) { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .pa-role-admin)   { background: rgba(239,68,68,.18); color: #f87171; }

  /* ─── Toolbar ────────────────────────────────────────────────── */
  .pa-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .pa-toolbar-spacer { flex: 1 1 auto; }
  .pa-role-switcher {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pa-throttle-label {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    margin-right: 4px;
  }
  .pa-user-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
  }
  .pa-user-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .pa-user-active {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--sg-accent, #2563eb) inset;
    font-weight: 600;
  }
  .pa-lock-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--sg-fg, #1e293b);
  }

  /* ─── Body ───────────────────────────────────────────────────── */
  .pa-body {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 10px;
  }
  .pa-grid-wrap { min-width: 0; }

  /* ─── Cell badges ─────────────────────────────────────────────── */
  :global(.mono) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
  }
  :global(.pa-owner) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :global(.pa-region) {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  :global(.pa-region-NA)    { background: #dbeafe; color: #1d4ed8; }
  :global(.pa-region-EMEA)  { background: #fce7f3; color: #9d174d; }
  :global(.pa-region-APAC)  { background: #ccfbf1; color: #115e59; }
  :global(.pa-region-LATAM) { background: #ffedd5; color: #9a3412; }
  :global([data-theme='dark'] .pa-region-NA)    { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .pa-region-EMEA)  { background: rgba(236,72,153,.18); color: #f9a8d4; }
  :global([data-theme='dark'] .pa-region-APAC)  { background: rgba(20,184,166,.18); color: #5eead4; }
  :global([data-theme='dark'] .pa-region-LATAM) { background: rgba(249,115,22,.18); color: #fdba74; }

  :global(.pa-stage) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.pa-stage-discovery)    { background: #e0e7ff; color: #3730a3; }
  :global(.pa-stage-qualified)    { background: #dbeafe; color: #1d4ed8; }
  :global(.pa-stage-proposal)     { background: #fef3c7; color: #92400e; }
  :global(.pa-stage-negotiation)  { background: #fde68a; color: #78350f; }
  :global(.pa-stage-closed_won)   { background: #dcfce7; color: #166534; }
  :global(.pa-stage-closed_lost)  { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .pa-stage-discovery)   { background: rgba(99,102,241,.18); color: #a5b4fc; }
  :global([data-theme='dark'] .pa-stage-qualified)   { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .pa-stage-proposal)    { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .pa-stage-negotiation) { background: rgba(217,119,6,.18); color: #fcd34d; }
  :global([data-theme='dark'] .pa-stage-closed_won)  { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .pa-stage-closed_lost) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.pa-amount) {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  :global(.pa-touched) {
    color: var(--sg-accent, #2563eb);
    font-size: 8px;
  }
  :global(.pa-prob) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :global(.pa-prob-bar) {
    position: relative;
    width: 70px;
    height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
  }
  :global(.pa-prob-fill) {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, #2563eb, #22d3ee);
    transition: width 250ms ease-out;
  }
  :global(.pa-prob-text) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    min-width: 32px;
  }
  :global(.pii-masked) {
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  :global(.pii-clear)  { color: var(--sg-fg, #1e293b); }

  /* ─── Side panel ─────────────────────────────────────────────── */
  .pa-side {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
  .pa-side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pa-side-stats { color: var(--sg-muted, #64748b); font-weight: 500; }
  .pa-audit-filters {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .pa-audit-filter {
    flex: 1 1 0;
    min-width: 0;
    padding: 3px 8px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    font-size: 11.5px;
  }
  .pa-audit-clear-row {
    border: 0;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .pa-audit-list {
    flex: 1 1 auto;
    overflow: auto;
    padding: 6px 0;
    min-height: 0;
  }
  .pa-audit-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    font-size: 11.5px;
  }
  .pa-audit-revert {
    background: var(--sg-header-bg, #f1f5f9);
  }
  .pa-audit-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pa-audit-user { font-weight: 600; }
  .pa-audit-time { color: var(--sg-muted, #64748b); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; }
  .pa-audit-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--sg-muted, #64748b);
  }
  .pa-audit-rowlink {
    background: transparent;
    border: 0;
    color: var(--sg-accent, #2563eb);
    cursor: pointer;
    padding: 0;
    font: inherit;
    font-weight: 600;
  }
  .pa-audit-rowlink:hover { text-decoration: underline; }
  .pa-audit-col { color: var(--sg-muted, #64748b); }
  .pa-audit-diff {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pa-diff-before {
    background: rgba(239, 68, 68, 0.08);
    color: #b91c1c;
    padding: 1px 6px;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
  }
  .pa-diff-after {
    background: rgba(34, 197, 94, 0.10);
    color: #166534;
    padding: 1px 6px;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
  }
  :global([data-theme='dark']) .pa-diff-before { color: #f87171; background: rgba(239,68,68,.15); }
  :global([data-theme='dark']) .pa-diff-after  { color: #4ade80; background: rgba(34,197,94,.15); }
  .pa-diff-arrow { color: var(--sg-muted, #64748b); }
  .pa-revert-tag {
    margin-left: auto;
    background: rgba(202, 138, 4, 0.15);
    color: #92400e;
    padding: 0 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global([data-theme='dark']) .pa-revert-tag { color: #fbbf24; background: rgba(245,158,11,.18); }
  .pa-revert-btn {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    line-height: 1;
  }
  .pa-revert-btn:hover { color: var(--sg-accent, #2563eb); }
  .pa-audit-empty {
    padding: 16px;
    color: var(--sg-muted, #64748b);
    text-align: center;
    font-style: italic;
    font-size: 11.5px;
  }

  .pa-cell-history {
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    padding: 8px 12px;
    font-size: 11.5px;
    max-height: 140px;
    overflow: auto;
  }
  .pa-cell-history-head {
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .pa-cell-history-head strong { color: var(--sg-fg, #1e293b); }
  .pa-cell-history-count { color: var(--sg-muted, #64748b); }
  .pa-cell-history-row {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 2px 0;
  }
</style>
