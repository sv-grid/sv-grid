<script lang="ts">
  /**
   * 100. Tree-grid with cascading checkboxes
   * ----------------------------------------
   * A permissions matrix laid out as a tree: workspaces → resources →
   * actions. Checking a parent checks every descendant; unchecking a
   * descendant flips its ancestors to the "partial" (indeterminate)
   * state. Auto-rolls up: when every child of a node is checked, the
   * parent flips to fully-checked.
   *
   * This is the classic tree-checkbox pattern that ships with every
   * "Save permission set" / "Edit IAM policy" / "Configure role" UI.
   * Pure user-land - we keep a Set of checked ids and recompute the
   * partial-state map per render.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Kind = 'workspace' | 'resource' | 'action'
  type Node = {
    id: string
    parentId: string | null
    depth: number
    label: string
    kind: Kind
    description: string
    childIds: string[]
    /** Cost in $ / yr when the action is licensed - sums up the cart total. */
    monthlyCost: number
  }

  // ---- Build the tree --------------------------------------------------
  type Seed = { id: string; parentId: string | null; depth: number;
                label: string; kind: Kind; description: string; monthlyCost?: number }
  const SEEDS: Seed[] = [
    // Workspace 1
    { id: 'w-prod',       parentId: null,        depth: 0, label: 'Production',     kind: 'workspace', description: 'Live customer-facing environment.' },
    { id: 'w-prod/users', parentId: 'w-prod',    depth: 1, label: 'Users',          kind: 'resource',  description: 'Customer accounts + team members.' },
    { id: 'a-pu-read',    parentId: 'w-prod/users', depth: 2, label: 'Read profile', kind: 'action', description: 'View user profile, role, last seen.', monthlyCost: 0 },
    { id: 'a-pu-write',   parentId: 'w-prod/users', depth: 2, label: 'Edit profile', kind: 'action', description: 'Change profile fields, role, status.', monthlyCost: 12 },
    { id: 'a-pu-delete',  parentId: 'w-prod/users', depth: 2, label: 'Delete user',  kind: 'action', description: 'Permanently delete account + audit trail.', monthlyCost: 24 },
    { id: 'a-pu-impersonate', parentId: 'w-prod/users', depth: 2, label: 'Impersonate', kind: 'action', description: 'Session-as user for support cases.', monthlyCost: 48 },
    { id: 'w-prod/billing', parentId: 'w-prod',  depth: 1, label: 'Billing',        kind: 'resource',  description: 'Invoices, subscriptions, payments.' },
    { id: 'a-pb-read',    parentId: 'w-prod/billing', depth: 2, label: 'View invoices', kind: 'action', description: 'Read-only access to invoices + statements.', monthlyCost: 8 },
    { id: 'a-pb-refund',  parentId: 'w-prod/billing', depth: 2, label: 'Issue refunds', kind: 'action', description: 'Process refunds up to $5,000 without approval.', monthlyCost: 36 },
    { id: 'a-pb-export',  parentId: 'w-prod/billing', depth: 2, label: 'Export ledger', kind: 'action', description: 'Download full chart-of-accounts.', monthlyCost: 16 },
    { id: 'w-prod/audit',   parentId: 'w-prod',  depth: 1, label: 'Audit log',      kind: 'resource',  description: 'Tamper-evident write log.' },
    { id: 'a-pa-read',    parentId: 'w-prod/audit', depth: 2, label: 'Read entries', kind: 'action', description: 'Inspect any audit entry.', monthlyCost: 6 },
    { id: 'a-pa-export',  parentId: 'w-prod/audit', depth: 2, label: 'Export evidence', kind: 'action', description: 'Cryptographically-signed export for legal.', monthlyCost: 28 },
    // Workspace 2
    { id: 'w-stage',      parentId: null,         depth: 0, label: 'Staging',        kind: 'workspace', description: 'QA + acceptance environment.' },
    { id: 'w-stage/seed', parentId: 'w-stage',    depth: 1, label: 'Seed data',      kind: 'resource',  description: 'Test fixtures for QA scenarios.' },
    { id: 'a-ss-load',    parentId: 'w-stage/seed', depth: 2, label: 'Load fixture set', kind: 'action', description: 'Spin up a snapshot of canned data.', monthlyCost: 4 },
    { id: 'a-ss-wipe',    parentId: 'w-stage/seed', depth: 2, label: 'Wipe environment', kind: 'action', description: 'Destroy all stored data + restart.', monthlyCost: 4 },
    { id: 'w-stage/deploy', parentId: 'w-stage',  depth: 1, label: 'Deployments',    kind: 'resource', description: 'Release management.' },
    { id: 'a-sd-trigger', parentId: 'w-stage/deploy', depth: 2, label: 'Trigger deploy', kind: 'action', description: 'Push a new build to staging.', monthlyCost: 6 },
    { id: 'a-sd-rollback', parentId: 'w-stage/deploy', depth: 2, label: 'Rollback',  kind: 'action', description: 'Revert to the previous stable release.', monthlyCost: 6 },
    // Workspace 3
    { id: 'w-dev',        parentId: null,         depth: 0, label: 'Development',    kind: 'workspace', description: 'Developer sandboxes.' },
    { id: 'w-dev/sandbox', parentId: 'w-dev',     depth: 1, label: 'Sandboxes',      kind: 'resource', description: 'Per-engineer ephemeral envs.' },
    { id: 'a-ds-create',  parentId: 'w-dev/sandbox', depth: 2, label: 'Create sandbox', kind: 'action', description: 'Spin up a sandbox in any region.', monthlyCost: 2 },
    { id: 'a-ds-destroy', parentId: 'w-dev/sandbox', depth: 2, label: 'Destroy sandbox', kind: 'action', description: 'Tear down a sandbox + reclaim resources.', monthlyCost: 2 },
    { id: 'a-ds-share',   parentId: 'w-dev/sandbox', depth: 2, label: 'Share sandbox link', kind: 'action', description: 'Generate guest URL for collaborators.', monthlyCost: 0 },
  ]

  const nodes: Node[] = SEEDS.map((s) => ({
    id: s.id, parentId: s.parentId, depth: s.depth,
    label: s.label, kind: s.kind, description: s.description,
    childIds: [], monthlyCost: s.monthlyCost ?? 0,
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const n of nodes) if (n.parentId) byId.get(n.parentId)!.childIds.push(n.id)

  function descendantsOf(id: string): string[] {
    const out: string[] = []
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const c of byId.get(cur)!.childIds) { out.push(c); stack.push(c) }
    }
    return out
  }
  function ancestorsOf(id: string): string[] {
    const out: string[] = []
    let cur: string | null = byId.get(id)!.parentId
    while (cur) { out.push(cur); cur = byId.get(cur)!.parentId }
    return out
  }
  /** Leaf descendants only - the actual action nodes for an internal node. */
  function leafDescendants(id: string): string[] {
    const me = byId.get(id)!
    if (me.childIds.length === 0) return [id]
    const out: string[] = []
    for (const c of me.childIds) out.push(...leafDescendants(c))
    return out
  }

  // ---- State -----------------------------------------------------------
  let checked  = $state<Set<string>>(new Set(['a-pu-read', 'a-pb-read', 'a-pa-read', 'a-ds-create']))
  let expanded = $state<Set<string>>(new Set(nodes.filter((n) => n.kind === 'workspace').map((n) => n.id)))

  /** A node is "checked" iff EVERY leaf descendant is in the set. */
  function isChecked(id: string): boolean {
    const leaves = leafDescendants(id)
    return leaves.every((l) => checked.has(l))
  }
  /** A node is "partial" iff some - but not all - leaf descendants are in. */
  function isPartial(id: string): boolean {
    const leaves = leafDescendants(id)
    const hits = leaves.filter((l) => checked.has(l)).length
    return hits > 0 && hits < leaves.length
  }

  function setChecked(id: string, on: boolean) {
    const next = new Set(checked)
    for (const leaf of leafDescendants(id)) {
      if (on) next.add(leaf); else next.delete(leaf)
    }
    checked = next
  }

  function selectAll() { checked = new Set(nodes.filter((n) => n.childIds.length === 0).map((n) => n.id)) }
  function selectNone() { checked = new Set() }

  function toggleExpanded(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  function expandAll() { expanded = new Set(nodes.filter((n) => n.childIds.length > 0).map((n) => n.id)) }
  function collapseAll() { expanded = new Set() }

  // ---- Visible rows (depth-first, respect expanded) --------------------
  const visible = $derived.by(() => {
    const out: Node[] = []
    function walk(id: string) {
      const n = byId.get(id)!
      out.push(n)
      if (expanded.has(id)) for (const c of n.childIds) walk(c)
    }
    for (const n of nodes) if (n.parentId === null) walk(n.id)
    return out
  })

  // ---- KPIs -------------------------------------------------------------
  const totals = $derived.by(() => {
    const checkedActions = nodes.filter((n) => n.kind === 'action' && checked.has(n.id))
    const monthly = checkedActions.reduce((s, n) => s + n.monthlyCost, 0)
    const totalActions = nodes.filter((n) => n.kind === 'action').length
    return {
      checked:  checkedActions.length,
      total:    totalActions,
      monthly,
      annual:   monthly * 12,
      coverage: totalActions > 0 ? checkedActions.length / totalActions : 0,
    }
  })

  // ---- Tree cell renderer ----------------------------------------------
  type Ctx = { node: Node; checked: boolean; partial: boolean; expandedOpen: boolean }
  function context(n: Node): Ctx {
    return { node: n, checked: isChecked(n.id), partial: isPartial(n.id), expandedOpen: expanded.has(n.id) }
  }

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Node>[] = [
    {
      field: 'label', header: 'Name', width: 360, editable: false,
      cell: (ctx) => renderSnippet(TreeCell, { ctx: context(ctx.row.original) }),
    },
    {
      field: 'kind', header: 'Kind', width: 110, editable: false,
      cell: (ctx) => renderSnippet(KindCell, { kind: ctx.row.original.kind }),
    },
    { field: 'description', header: 'Description', width: 380, editable: false },
    {
      field: 'monthlyCost', header: 'Monthly', width: 100, editable: false, align: 'right',
      cell: (ctx) => renderSnippet(CostCell, { node: ctx.row.original }),
    },
  ]
</script>

{#snippet TreeCell(props: { ctx: Ctx })}
  {@const { node, checked: c, partial: p, expandedOpen } = props.ctx}
  <span class="tree-row" style:padding-left={`${node.depth * 22}px`}>
    {#if node.childIds.length > 0}
      <button type="button" class="chev" aria-label={expandedOpen ? 'Collapse' : 'Expand'}
        onclick={(e) => { e.stopPropagation(); toggleExpanded(node.id) }}
      >
        <svg class={expandedOpen ? 'is-open' : ''} viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 4 10 8 6 12"></polyline>
        </svg>
      </button>
    {:else}
      <span class="chev-spacer"></span>
    {/if}
    <input type="checkbox" class="cbx"
      checked={c}
      indeterminate={p}
      onchange={(e) => setChecked(node.id, (e.currentTarget as HTMLInputElement).checked)}
      onclick={(e) => e.stopPropagation()}
    />
    <span class={`tree-label kind-${node.kind}`}>{node.label}</span>
  </span>
{/snippet}

{#snippet KindCell(props: { kind: Kind })}
  <span class={`kind-pill kind-pill-${props.kind}`}>{props.kind}</span>
{/snippet}

{#snippet CostCell(props: { node: Node })}
  {#if props.node.kind === 'action'}
    {#if props.node.monthlyCost === 0}
      <span class="cost-free">included</span>
    {:else}
      <span class="cost-paid">${props.node.monthlyCost}</span>
    {/if}
  {:else}
    {@const checkedDescendants = leafDescendants(props.node.id).filter((id) => checked.has(id))}
    {@const sum = checkedDescendants.reduce((s, id) => s + byId.get(id)!.monthlyCost, 0)}
    <span class="cost-rollup">{sum === 0 ? '-' : `$${sum}`}</span>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="kpi-strip shrink-0">
    <div class="kpi">
      <div class="kpi-label">Selected actions</div>
      <div class="kpi-value">{totals.checked} <span class="kpi-of">/ {totals.total}</span></div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Monthly cost</div>
      <div class="kpi-value accent">${totals.monthly}</div>
      <div class="kpi-hint">${totals.annual.toLocaleString()} / yr</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Coverage</div>
      <div class="kpi-value">{(totals.coverage * 100).toFixed(0)}%</div>
      <div class="coverage-bar">
        <span style:width={`${totals.coverage * 100}%`}></span>
      </div>
    </div>
    <div class="kpi action">
      <div class="kpi-label">Bulk actions</div>
      <div class="bulk">
        <button class="bulk-btn" onclick={selectAll}>Select all</button>
        <button class="bulk-btn alt" onclick={selectNone}>Clear all</button>
      </div>
      <div class="kpi-hint">
        <button class="link-btn" onclick={expandAll}>expand all</button>
        ·
        <button class="link-btn" onclick={collapseAll}>collapse all</button>
      </div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={visible}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .kpi-strip { display: grid; grid-template-columns: 1fr 1fr 1fr 1.4fr; gap: 10px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 14px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
               color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 22px; font-weight: 700; color: var(--sg-fg, #0f172a);
               font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi-value.accent { color: var(--sg-accent, #6366f1); }
  .kpi-of { font-size: 14px; color: var(--sg-muted, #94a3b8); font-weight: 500; }
  .kpi-hint { font-size: 11px; color: var(--sg-muted, #64748b); }
  .coverage-bar {
    height: 6px; background: var(--sg-row-hover-bg, rgba(148,163,184,0.15));
    border-radius: 3px; overflow: hidden; margin-top: 4px;
  }
  .coverage-bar span {
    display: block; height: 100%;
    background: var(--sg-accent, #6366f1);
    transition: width 200ms ease-out;
  }
  .kpi.action {
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 8%, transparent 92%);
    border-color: transparent;
  }
  .bulk { display: flex; gap: 6px; margin: 2px 0; }
  .bulk-btn {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border: 0; border-radius: 6px; padding: 5px 12px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .bulk-btn.alt {
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .bulk-btn:hover { filter: brightness(1.07); }
  .link-btn { background: transparent; border: 0; color: var(--sg-accent, #6366f1);
              font-size: 11px; cursor: pointer; padding: 0; font-weight: 700; }
  .link-btn:hover { text-decoration: underline; }

  /* Tree cell ------------------------------------------------------ */
  .tree-row { display: inline-flex; align-items: center; gap: 6px; }
  .chev {
    width: 18px; height: 18px;
    background: transparent; border: 0; border-radius: 4px;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    color: var(--sg-muted, #64748b);
  }
  .chev:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.15)); color: var(--sg-fg, #0f172a); }
  .chev svg { transition: transform 140ms; }
  .chev svg.is-open { transform: rotate(90deg); }
  .chev-spacer { display: inline-block; width: 18px; height: 18px; }

  .cbx { width: 14px; height: 14px; accent-color: var(--sg-accent, #6366f1); cursor: pointer; }

  .tree-label { font-size: 13px; color: var(--sg-fg, #0f172a); }
  .tree-label.kind-workspace { font-weight: 700; }
  .tree-label.kind-resource  { font-weight: 600; color: var(--sg-accent, #4338ca); }
  .tree-label.kind-action    { color: var(--sg-fg, #334155); }

  :global(.kind-pill) {
    display: inline-block; padding: 1px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.kind-pill-workspace) { background: #ede9fe; color: #5b21b6; }
  :global(.kind-pill-resource)  { background: #dbeafe; color: #1d4ed8; }
  :global(.kind-pill-action)    { background: #dcfce7; color: #166534; }

  :global(.cost-free)   { font-size: 11px; color: var(--sg-muted, #94a3b8); font-style: italic; }
  :global(.cost-paid)   { color: var(--sg-accent, #6366f1); font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(.cost-rollup) { color: var(--sg-muted, #64748b); font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
