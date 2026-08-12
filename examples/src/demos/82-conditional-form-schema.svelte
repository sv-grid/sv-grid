<script lang="ts">
  /**
   * 82. Conditional form schema
   * ---------------------------
   * Declarative schema-driven field visibility and editability inside a
   * grid. Each column carries a `when` rule (or array of rules); the
   * runtime evaluates the rules against the row's current values and:
   *
   *   - hides cells whose `visible.when` fails
   *   - disables editing on cells whose `editable.when` fails
   *   - shows a contextual reason ("locked: status is not 'pending'")
   *
   * The pattern: instead of imperative checks scattered across columns,
   * define WHEN a field applies; SvGrid's `editable: (ctx) => boolean`
   * already supports per-cell rules - this demo layers a declarative
   * schema on top so designers can hand-tune workflows without touching
   * rendering code.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type CellContext,
  } from '@svgrid/grid'

  // ---- Domain -----------------------------------------------------------

  type RecordType = 'individual' | 'business' | 'nonprofit'
  type Status     = 'draft' | 'pending' | 'approved' | 'rejected'

  type Application = {
    id: string
    legalName: string
    recordType: RecordType
    status: Status
    // Business-only
    taxId: string
    industry: string
    annualRevenue: number
    // Nonprofit-only
    ein: string
    missionStatement: string
    // Individual-only
    ssnLast4: string
    dateOfBirth: string
    // Universal
    contactEmail: string
    contactPhone: string
    rejectionReason: string
  }

  let rows = $state<Application[]>([
    { id: 'A001', legalName: 'Atlas Holdings LLC',      recordType: 'business',   status: 'pending',  taxId: '47-1234567', industry: 'Manufacturing', annualRevenue: 4_200_000, ein: '', missionStatement: '', ssnLast4: '', dateOfBirth: '', contactEmail: 'cfo@atlas.example',     contactPhone: '+1 415 555 0112', rejectionReason: '' },
    { id: 'A002', legalName: 'Helios Foundation',       recordType: 'nonprofit',  status: 'approved', taxId: '',           industry: '',              annualRevenue: 0,         ein: '88-7654321', missionStatement: 'Advance clean-energy literacy in K-12 schools.', ssnLast4: '', dateOfBirth: '', contactEmail: 'admin@helios.org',      contactPhone: '+1 503 555 0144', rejectionReason: '' },
    { id: 'A003', legalName: 'Sarah Chen',              recordType: 'individual', status: 'draft',    taxId: '',           industry: '',              annualRevenue: 0,         ein: '', missionStatement: '', ssnLast4: '4421',                                       dateOfBirth: '1988-04-12', contactEmail: 'sarah.chen@example.com', contactPhone: '+1 212 555 0188', rejectionReason: '' },
    { id: 'A004', legalName: 'Vertex Capital',          recordType: 'business',   status: 'rejected', taxId: '94-9876543', industry: 'Finance',       annualRevenue: 8_900_000, ein: '', missionStatement: '', ssnLast4: '', dateOfBirth: '', contactEmail: 'ops@vertex.example',    contactPhone: '+1 646 555 0166', rejectionReason: 'Documentation insufficient - missing 2024 audit.' },
    { id: 'A005', legalName: 'Crescent Labs',           recordType: 'nonprofit',  status: 'pending',  taxId: '',           industry: '',              annualRevenue: 0,         ein: '12-3456789', missionStatement: 'Community biotech research mentorship.',           ssnLast4: '', dateOfBirth: '', contactEmail: 'apply@crescent.org',    contactPhone: '+1 312 555 0199', rejectionReason: '' },
    { id: 'A006', legalName: 'James Park',              recordType: 'individual', status: 'pending',  taxId: '',           industry: '',              annualRevenue: 0,         ein: '', missionStatement: '', ssnLast4: '8821',                                       dateOfBirth: '1992-11-03', contactEmail: 'james.p@example.com',    contactPhone: '+1 408 555 0122', rejectionReason: '' },
    { id: 'A007', legalName: 'Pioneer Mining Co.',      recordType: 'business',   status: 'draft',    taxId: '36-2468013', industry: 'Mining',        annualRevenue: 1_300_000, ein: '', missionStatement: '', ssnLast4: '', dateOfBirth: '', contactEmail: 'compliance@pioneer.ex', contactPhone: '+1 720 555 0133', rejectionReason: '' },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Schema rules ------------------------------------------------------
  // A `Rule` is a predicate over the row plus a human-readable reason
  // shown in tooltips and locked-cell badges. Rules compose by AND -
  // EVERY rule must pass for the field to be visible/editable.
  type Rule = {
    when: (row: Application) => boolean
    reason: string
  }

  /** The schema declares per-field rules. `visible.when` controls whether
   * the cell shows any value at all (otherwise a "-" placeholder); the
   * column's editable rule is built from the union of visibility and
   * editability rules so the editor never opens on a field that should
   * not apply to this row. */
  type FieldSchema = {
    visible?: Rule
    editable?: Rule
  }
  const schema: Partial<Record<keyof Application, FieldSchema>> = {
    // Business-only fields
    taxId:           { visible: { when: (r) => r.recordType === 'business',  reason: 'Tax ID only applies to businesses.' } },
    industry:        { visible: { when: (r) => r.recordType === 'business',  reason: 'Industry only applies to businesses.' } },
    annualRevenue:   { visible: { when: (r) => r.recordType === 'business',  reason: 'Annual revenue only applies to businesses.' } },
    // Nonprofit-only fields
    ein:              { visible: { when: (r) => r.recordType === 'nonprofit', reason: 'EIN only applies to nonprofits.' } },
    missionStatement: { visible: { when: (r) => r.recordType === 'nonprofit', reason: 'Mission statement only applies to nonprofits.' } },
    // Individual-only fields (PII)
    ssnLast4:    { visible: { when: (r) => r.recordType === 'individual', reason: 'SSN field only applies to individuals.' } },
    dateOfBirth: { visible: { when: (r) => r.recordType === 'individual', reason: 'DOB only applies to individuals.' } },
    // Rejection reason - visible only when status is rejected
    rejectionReason: {
      visible:  { when: (r) => r.status === 'rejected', reason: 'Rejection reason only applies to rejected applications.' },
      editable: { when: (r) => r.status === 'rejected', reason: 'Only editable while status is rejected.' },
    },
    // Universal contact - editable only while draft or pending
    legalName:    { editable: { when: (r) => r.status === 'draft' || r.status === 'pending', reason: 'Locked once the application is approved or rejected.' } },
    contactEmail: { editable: { when: (r) => r.status === 'draft' || r.status === 'pending', reason: 'Locked once the application is approved or rejected.' } },
    contactPhone: { editable: { when: (r) => r.status === 'draft' || r.status === 'pending', reason: 'Locked once the application is approved or rejected.' } },
    // recordType cannot change after submission
    recordType:   { editable: { when: (r) => r.status === 'draft', reason: 'Record type locks at submission.' } },
  }

  function isVisible(field: keyof Application, row: Application): boolean {
    const s = schema[field]
    if (!s?.visible) return true
    return s.visible.when(row)
  }
  function isEditable(field: keyof Application, row: Application): boolean {
    const s = schema[field]
    // A field is editable if it's visible AND any explicit editable rule passes.
    if (!isVisible(field, row)) return false
    if (!s?.editable) return true
    return s.editable.when(row)
  }
  function lockReason(field: keyof Application, row: Application): string | null {
    const s = schema[field]
    if (!s) return null
    if (s.visible && !s.visible.when(row))   return s.visible.reason
    if (s.editable && !s.editable.when(row)) return s.editable.reason
    return null
  }

  // ---- Build the SvGrid editable callback from the schema ---------------
  function ruleEditable<K extends keyof Application>(field: K) {
    return (ctx: CellContext<Application>) => isEditable(field, ctx.row.original)
  }

  // ---- KPI strip --------------------------------------------------------
  const draftN    = $derived(rows.filter((r) => r.status === 'draft').length)
  const pendingN  = $derived(rows.filter((r) => r.status === 'pending').length)
  const approvedN = $derived(rows.filter((r) => r.status === 'approved').length)
  const rejectedN = $derived(rows.filter((r) => r.status === 'rejected').length)
  const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  // ---- Cell snippet helpers ---------------------------------------------
  // A snippet that renders the field value when visible, "-" when not,
  // with a title tooltip explaining the schema decision.
  function renderConditional(field: keyof Application, row: Application, format: (v: unknown) => string = String) {
    const visible = isVisible(field, row)
    const reason  = lockReason(field, row)
    const editable = isEditable(field, row)
    return { visible, reason, editable, value: visible ? format(row[field]) : '-' }
  }

  // Reusable column builder so we don't write `cell: (ctx) => renderSnippet(...)`
  // ten times in the columns array.
  function condColumn<K extends keyof Application>(
    field: K,
    header: string,
    editorType: ColumnDef<typeof features, Application>['editorType'],
    extra: Partial<ColumnDef<typeof features, Application>> = {},
  ): ColumnDef<typeof features, Application> {
    return {
      field,
      header,
      editorType,
      editable: ruleEditable(field),
      cell: (ctx) => renderSnippet(ConditionalCell, { row: ctx.row.original, field }),
      ...extra,
    } as ColumnDef<typeof features, Application>
  }

  const columns: ColumnDef<typeof features, Application>[] = [
    { field: 'id', header: 'ID', editorType: 'text', width: 80, editable: false },
    condColumn('legalName', 'Legal name', 'text', { width: 200 }),
    {
      field: 'recordType', header: 'Type',
      editorType: 'list',
      editorOptions: ['individual', 'business', 'nonprofit'] as unknown as ReadonlyArray<string>,
      editable: ruleEditable('recordType'),
      width: 130,
    },
    {
      field: 'status', header: 'Status',
      editorType: 'list',
      editorOptions: ['draft', 'pending', 'approved', 'rejected'] as unknown as ReadonlyArray<string>,
      width: 130,
      cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }),
    },

    // Business-only
    condColumn('taxId',         'Tax ID',          'text',   { width: 130 }),
    condColumn('industry',      'Industry',        'text',   { width: 150 }),
    condColumn('annualRevenue', 'Annual revenue',  'number', { width: 150,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } }),

    // Nonprofit-only
    condColumn('ein',              'EIN',           'text', { width: 130 }),
    condColumn('missionStatement', 'Mission',       'text', { width: 280 }),

    // Individual-only
    condColumn('ssnLast4',    'SSN (last 4)', 'text', { width: 110 }),
    condColumn('dateOfBirth', 'DOB',          'date', { width: 130,
      format: { type: 'date', pattern: 'y-m-d' } }),

    // Universal
    condColumn('contactEmail', 'Email', 'text', { width: 200 }),
    condColumn('contactPhone', 'Phone', 'text', { width: 160 }),

    // Conditional - rejection
    condColumn('rejectionReason', 'Reject reason', 'text', { width: 280 }),
  ]
</script>

{#snippet StatusCell(props: { row: Application })}
  <span class={`cf-status cf-status-${props.row.status}`}>{props.row.status}</span>
{/snippet}

{#snippet ConditionalCell(props: { row: Application; field: keyof Application })}
  {@const info = renderConditional(props.field, props.row, String)}
  <span class="cf-cell" class:cf-na={!info.visible} class:cf-locked={info.visible && !info.editable} title={info.reason ?? ''}>
    {info.value}
    {#if info.visible && !info.editable}
      <span class="cf-lock" aria-hidden="true">🔒</span>
    {/if}
  </span>
{/snippet}

<section class="cf-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="cf-kpi-strip shrink-0">
    <div class="cf-kpi"><div class="cf-kpi-label">Draft</div><div class="cf-kpi-value">{draftN}</div></div>
    <div class="cf-kpi cf-kpi-warn"><div class="cf-kpi-label">Pending review</div><div class="cf-kpi-value">{pendingN}</div></div>
    <div class="cf-kpi cf-kpi-good"><div class="cf-kpi-label">Approved</div><div class="cf-kpi-value">{approvedN}</div></div>
    <div class="cf-kpi cf-kpi-bad"><div class="cf-kpi-label">Rejected</div><div class="cf-kpi-value">{rejectedN}</div></div>
  </div>

  <!-- Schema explainer -->
  <div class="cf-explain shrink-0">
    <strong>Schema-driven editability.</strong>
    Cells hide automatically when their field doesn't apply (e.g. <em>EIN</em> only on nonprofits, <em>SSN</em> only on individuals).
    Cells lock automatically when their workflow doesn't allow edits (e.g. <em>Email</em> locks once status moves to Approved).
    Try editing the <em>Type</em> dropdown on a draft row to watch its conditional columns appear; toggle a row's <em>Status</em> to see the Rejection reason column reveal itself.
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>
</section>

<style>
  /* Status pill colours carry meaning, so they stay off the theme tokens;
     only their dark ramp is adjusted here for legibility. */
  .cf-shell {
    height: 100%;
    --cf-warn-bg: #fef3c7; --cf-warn-fg: #92400e;
    --cf-good-bg: #dcfce7; --cf-good-fg: #166534;
    --cf-bad-bg:  #fee2e2; --cf-bad-fg:  #991b1b; --cf-bad-ring: #dc2626;
  }
  :global([data-theme='dark']) .cf-shell {
    --cf-warn-bg: rgba(245,158,11,0.20); --cf-warn-fg: #fbbf24;
    --cf-good-bg: rgba(34,197,94,0.18);  --cf-good-fg: #4ade80;
    --cf-bad-bg:  rgba(239,68,68,0.22);  --cf-bad-fg:  #fca5a5; --cf-bad-ring: #ef4444;
  }

  .cf-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .cf-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .cf-kpi-warn { border-left: 3px solid #f59e0b; }
  .cf-kpi-good { border-left: 3px solid #10b981; }
  .cf-kpi-bad  { border-left: 3px solid #ef4444; }
  .cf-kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .cf-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); }

  .cf-explain {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
    line-height: 1.55;
  }
  .cf-explain em {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 5px;
    border-radius: 3px;
    font-style: normal; font-weight: 500;
  }

  /* Cell rendering */
  :global(.cf-cell) {
    display: inline-flex; align-items: center; gap: 6px;
  }
  :global(.cf-na) {
    color: var(--sg-muted, #94a3b8);
    font-style: italic;
  }
  :global(.cf-locked) {
    color: var(--sg-muted, #64748b);
  }
  :global(.cf-lock) {
    font-size: 11px; opacity: 0.7;
  }

  /* Status pills */
  :global(.cf-status) {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  :global(.cf-status-draft)    { background: var(--sg-bg-subtle, var(--sg-header-bg, #f1f5f9)); color: var(--sg-fg, #334155); }
  :global(.cf-status-pending)  { background: var(--cf-warn-bg); color: var(--cf-warn-fg); }
  :global(.cf-status-approved) { background: var(--cf-good-bg); color: var(--cf-good-fg); }
  :global(.cf-status-rejected) { background: var(--cf-bad-bg);  color: var(--cf-bad-fg); box-shadow: inset 0 0 0 1px var(--cf-bad-ring); }
</style>
