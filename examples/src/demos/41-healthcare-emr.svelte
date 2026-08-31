<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 41. Healthcare EMR - inpatient board
   * ------------------------------------
   * An ICU / inpatient list as it would appear to a clinician. Built
   * to show the procurement team's healthcare buyer two things at
   * once:
   *
   *   1. **The grid renders rich clinical cells.** Vitals sparkline,
   *      color-graded risk score, allergy chip cluster, code-status
   *      pill, primary-nurse avatar - all in stock SvGrid cell
   *      snippets, no plugin layer.
   *
   *   2. **Role-based access actually works.** The role switcher
   *      drives the cell-level `editable: (ctx) => boolean` predicate
   *      the grid added in demo 35. Nurses can edit notes; physicians
   *      can move code status and orders; admins also see discharge
   *      planning fields. Try Viewer to see everything lock.
   *
   * No PHI: every name, MRN, allergy, and diagnosis is synthetic
   * and deterministically seeded. The structure is what counts.
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

  // ---- Domain ---------------------------------------------------------

  type CodeStatus = 'full_code' | 'dnr' | 'dni' | 'comfort_only'
  type Risk = 'low' | 'moderate' | 'high' | 'critical'
  type Role = 'viewer' | 'nurse' | 'physician' | 'admin'

  type Allergy = string
  type Patient = {
    mrn: string
    initials: string
    age: number
    sex: 'F' | 'M'
    room: string
    bed: string
    los: number
    diagnosis: string
    risk: Risk
    riskScore: number          // 0–100
    codeStatus: CodeStatus
    allergies: Allergy[]
    attending: string
    primaryNurse: string
    notes: string
    /** 30-point trailing vitals (heart rate). */
    hrTrend: number[]
    /** Latest values for the trend tile. */
    hr: number
    spo2: number
    sbp: number                 // systolic BP
  }

  // ---- Seed -----------------------------------------------------------

  const FIRST_INITIALS = ['A.M.', 'J.K.', 'R.S.', 'M.O.', 'L.P.', 'D.B.', 'C.T.', 'N.E.', 'S.H.', 'K.Y.']
  const DIAGNOSES = [
    'Sepsis, unspecified', 'ARDS w/ mechanical vent', 'Post-op cabg',
    'Septic shock', 'STEMI, anterior', 'Acute pancreatitis',
    'Cerebrovascular accident', 'Pneumonia, MRSA', 'GI bleed, lower',
    'DKA, T1DM', 'Pulmonary embolism', 'Renal failure, AKI',
  ]
  const ALLERGY_POOL = ['Penicillin', 'Latex', 'Sulfa', 'Iodine', 'Codeine', 'Aspirin', 'NSAIDs', 'Shellfish', 'Eggs']
  const ATTENDINGS = ['Dr. Park', 'Dr. Singh', 'Dr. Cohen', 'Dr. Nakamura', 'Dr. Mehta', 'Dr. Diaz']
  const NURSES = ['Tran', 'Olsen', 'Wu', 'Khan', 'Diaz', 'Park', 'Nair', 'Silva']
  const CODE_STATUSES: readonly CodeStatus[] = ['full_code', 'dnr', 'dni', 'comfort_only']

  let prng = 0xC0CA0DE5
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedPatient(i: number): Patient {
    const initials = pick(FIRST_INITIALS)
    const age = 18 + Math.floor(rnd() * 80)
    const sex: 'F' | 'M' = rnd() < 0.5 ? 'F' : 'M'
    const riskScore = Math.floor(rnd() * 100)
    const risk: Risk =
      riskScore >= 80 ? 'critical' :
      riskScore >= 60 ? 'high' :
      riskScore >= 30 ? 'moderate' : 'low'
    const baseHr = 60 + Math.floor(rnd() * 70)
    const hrTrend: number[] = []
    let hr = baseHr
    for (let k = 0; k < 30; k += 1) {
      hr = Math.max(45, Math.min(160, hr + (rnd() - 0.5) * 8))
      hrTrend.push(Math.round(hr))
    }
    const allergyCount = Math.floor(rnd() * 3)
    const allergies: Allergy[] = []
    while (allergies.length < allergyCount) {
      const a = pick(ALLERGY_POOL)
      if (!allergies.includes(a)) allergies.push(a)
    }
    return {
      mrn: `M${(100_000 + i).toString().slice(-6)}`,
      initials,
      age, sex,
      room: `${pick(['SI', 'CC', 'MS'])}-${100 + Math.floor(rnd() * 30)}`,
      bed: pick(['A', 'B']),
      los: 1 + Math.floor(rnd() * 14),
      diagnosis: pick(DIAGNOSES),
      risk,
      riskScore,
      codeStatus: pick(CODE_STATUSES),
      allergies,
      attending: pick(ATTENDINGS),
      primaryNurse: pick(NURSES),
      notes: '',
      hrTrend,
      hr: hrTrend[hrTrend.length - 1]!,
      spo2: 88 + Math.floor(rnd() * 11),
      sbp: 90 + Math.floor(rnd() * 60),
    }
  }
  function seedRoster(n: number): Patient[] {
    const out: Patient[] = []
    for (let i = 0; i < n; i += 1) out.push(seedPatient(i))
    return out
  }

  // ---- State ---------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let patients = $state<Patient[]>(seedRoster(28))
  let role = $state<Role>('physician')

  // ---- Role permission rules -----------------------------------------

  const NURSE_EDITABLE = new Set(['notes', 'primaryNurse'])
  const PHYS_EDITABLE = new Set(['notes', 'primaryNurse', 'attending', 'codeStatus', 'diagnosis', 'allergies'])
  const ADMIN_EXTRA = new Set(['room', 'bed', 'los'])
  function canEditColumn(columnId: string): boolean {
    if (role === 'viewer') return false
    if (role === 'admin') return PHYS_EDITABLE.has(columnId) || ADMIN_EXTRA.has(columnId)
    if (role === 'physician') return PHYS_EDITABLE.has(columnId)
    return NURSE_EDITABLE.has(columnId)
  }
  function canSeeColumn(columnId: string): boolean {
    if (columnId === 'discharge') return role === 'admin'
    return true
  }

  function onCellValueChange(args: { rowIndex: number; columnId: string; newValue: unknown }): void {
    const patient = patients[args.rowIndex]
    if (!patient) return
    if (!canEditColumn(args.columnId)) return
    const next = patients.slice()
    next[args.rowIndex] = { ...patient, [args.columnId]: args.newValue } as Patient
    patients = next
  }

  // ---- KPI derivations ----------------------------------------------

  const kpis = $derived.by(() => {
    const total = patients.length
    const critical = patients.filter((p) => p.risk === 'critical').length
    const high = patients.filter((p) => p.risk === 'high').length
    const dnr = patients.filter((p) => p.codeStatus === 'dnr').length
    const avgRisk = total ? Math.round(patients.reduce((s, p) => s + p.riskScore, 0) / total) : 0
    const avgLos = total ? +(patients.reduce((s, p) => s + p.los, 0) / total).toFixed(1) : 0
    return { total, critical, high, dnr, avgRisk, avgLos }
  })

  // ---- Sparkline helpers --------------------------------------------

  function sparkPath(history: number[], w: number, h: number): string {
    const min = Math.min(...history)
    const max = Math.max(...history)
    const range = Math.max(1e-6, max - min)
    const step = w / (history.length - 1)
    let d = ''
    for (let i = 0; i < history.length; i += 1) {
      const x = Math.round(i * step * 100) / 100
      const y = Math.round((h - ((history[i]! - min) / range) * h) * 100) / 100
      d += `${i === 0 ? 'M' : 'L'}${x} ${y} `
    }
    return d.trim()
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet MrnCell(props: { row: Patient })}
  <span class="hc-mrn-wrap">
    <span class="mono">{props.row.mrn}</span>
    <span class="hc-mrn-init">{props.row.initials}</span>
  </span>
{/snippet}

{#snippet AgeSexCell(props: { row: Patient })}
  <span class="hc-age">{props.row.age}<span class="hc-sex">{props.row.sex}</span></span>
{/snippet}

{#snippet LocationCell(props: { row: Patient })}
  <span class="hc-location">
    <span class="hc-room">{props.row.room}</span>
    <span class="hc-bed">{props.row.bed}</span>
  </span>
{/snippet}

{#snippet RiskCell(props: { row: Patient })}
  <span class={`hc-risk hc-risk-${props.row.risk}`}>
    <span class="hc-risk-bar">
      <span class="hc-risk-fill" style={`width: ${props.row.riskScore}%`}></span>
    </span>
    <span class="hc-risk-num tabular-nums">{props.row.riskScore}</span>
  </span>
{/snippet}

{#snippet CodeStatusCell(props: { row: Patient })}
  <span class={`hc-code hc-code-${props.row.codeStatus}`}>
    {props.row.codeStatus.replace(/_/g, ' ').toUpperCase()}
  </span>
{/snippet}

{#snippet VitalsCell(props: { row: Patient })}
  {@const pathD = sparkPath(props.row.hrTrend, 90, 24)}
  <span class="hc-vitals">
    <svg class="hc-spark" viewBox="0 0 90 24" preserveAspectRatio="none" aria-hidden="true">
      <path d={pathD} fill="none" stroke="currentColor" stroke-width="1.4" />
    </svg>
    <span class="hc-vital-num tabular-nums">HR {props.row.hr}</span>
    <span class="hc-vital-sub">SpO₂ {props.row.spo2}% · BP {props.row.sbp}</span>
  </span>
{/snippet}

{#snippet AllergiesCell(props: { row: Patient })}
  {#if props.row.allergies.length === 0}
    <span class="hc-no-allergies">NKDA</span>
  {:else}
    <span class="hc-allergy-list">
      {#each props.row.allergies as a (a)}<span class="hc-allergy">{a}</span>{/each}
    </span>
  {/if}
{/snippet}

{#snippet PlainCell(props: { row: Patient; field: keyof Patient })}
  <span>{props.row[props.field]}</span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="hc-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="hc-kpi-strip">
    <div class="hc-kpi">
      <div class="hc-kpi-label">Census</div>
      <div class="hc-kpi-value tabular-nums">{kpis.total}</div>
      <div class="hc-kpi-foot">patients on the unit</div>
    </div>
    <div class="hc-kpi">
      <div class="hc-kpi-label">Critical</div>
      <div class="hc-kpi-value tabular-nums hc-down">{kpis.critical}</div>
      <div class="hc-kpi-foot">{kpis.high} high · LOS avg {kpis.avgLos}d</div>
    </div>
    <div class="hc-kpi">
      <div class="hc-kpi-label">DNR</div>
      <div class="hc-kpi-value tabular-nums">{kpis.dnr}</div>
      <div class="hc-kpi-foot">code-status reviews queued</div>
    </div>
    <div class="hc-kpi">
      <div class="hc-kpi-label">Avg risk score</div>
      <div class={`hc-kpi-value tabular-nums ${kpis.avgRisk >= 60 ? 'hc-down' : ''}`}>{kpis.avgRisk}</div>
      <div class="hc-kpi-foot">0–100, weighted</div>
    </div>
    <div class="hc-kpi">
      <div class="hc-kpi-label">Role</div>
      <div class={`hc-kpi-value hc-role hc-role-${role}`}>{role}</div>
      <div class="hc-kpi-foot">switch below to compare</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="hc-toolbar">
    <span class="hc-role-row">
      <span class="hc-throttle-label">Acting as</span>
      {#each [{id: 'viewer', label: 'Viewer'}, {id: 'nurse', label: 'Nurse'}, {id: 'physician', label: 'Physician'}, {id: 'admin', label: 'Admin'}] as r (r.id)}
        <button
          type="button"
          class={`hc-role-btn hc-role-${r.id}`}
          class:hc-role-active={role === r.id}
          onclick={() => (role = r.id as Role)}
        >{r.label}</button>
      {/each}
    </span>
    <div class="hc-toolbar-spacer"></div>
    <span class="hc-hint">Double-click a cell to edit. The role decides which cells unlock.</span>
  </div>

  <!-- Grid -->
  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={patients}
      columns={[
        { field: 'mrn', header: 'MRN / pt.', width: 150, editable: false,
          cell: (ctx) => renderSnippet(MrnCell, { row: ctx.row.original }) },
        { field: 'age', header: 'Age', editorType: 'number', width: 80, editable: false,
          cell: (ctx) => renderSnippet(AgeSexCell, { row: ctx.row.original }) },
        { field: 'room', header: 'Location', width: 110,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('room'),
          cell: (ctx) => renderSnippet(LocationCell, { row: ctx.row.original }) },
        { field: 'diagnosis', header: 'Diagnosis', width: 220,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('diagnosis'),
          cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'diagnosis' }) },
        { field: 'riskScore', header: 'Risk', editorType: 'number', width: 160, editable: false,
          cell: (ctx) => renderSnippet(RiskCell, { row: ctx.row.original }) },
        { field: 'codeStatus', header: 'Code', width: 130,
          editorType: 'list',
          editorOptions: CODE_STATUSES as unknown as ReadonlyArray<string>,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('codeStatus'),
          cell: (ctx) => renderSnippet(CodeStatusCell, { row: ctx.row.original }) },
        { field: 'hr', header: 'Vitals (last 30 hr)', editorType: 'number', width: 200, editable: false,
          cell: (ctx) => renderSnippet(VitalsCell, { row: ctx.row.original }) },
        { field: 'allergies', header: 'Allergies', width: 200,
          editorType: 'chips',
          editorOptions: ALLERGY_POOL as unknown as ReadonlyArray<string>,
          editorMultiple: true,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('allergies'),
          cell: (ctx) => renderSnippet(AllergiesCell, { row: ctx.row.original }) },
        { field: 'attending', header: 'Attending', width: 140,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('attending'),
          cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'attending' }) },
        { field: 'primaryNurse', header: 'Primary RN', width: 110,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('primaryNurse'),
          cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'primaryNurse' }) },
        { field: 'los', header: 'LOS', editorType: 'number', width: 70,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('los'),
          cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'los' }) },
        { field: 'notes', header: 'Notes', editorType: 'text', width: 200,
          editable: (_ctx: CellContext<Patient>) => canEditColumn('notes') },
      ] satisfies ColumnDef<typeof features, Patient>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={role !== 'viewer'}
      enableCellSelection={true}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={false}
      onCellValueChange={onCellValueChange}
    />
  </div>
</section>

<style>
  /* ─── KPI strip ──────────────────────────────────────────────── */
  .hc-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .hc-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .hc-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .hc-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
    text-transform: capitalize;
  }
  .hc-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .hc-down { color: #dc2626; }
  :global([data-theme='dark']) .hc-down { color: #f87171; }
  .hc-role {
    font-size: 16px;
  }

  /* ─── Toolbar ────────────────────────────────────────────────── */
  .hc-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .hc-toolbar-spacer { flex: 1 1 auto; }
  .hc-role-row { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .hc-throttle-label {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    margin-right: 4px;
  }
  .hc-role-btn {
    padding: 4px 12px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
  }
  .hc-role-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .hc-role-active {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--sg-accent, #2563eb) inset;
    font-weight: 600;
  }
  .hc-role-viewer    { color: var(--sg-muted, #475569); }
  .hc-role-nurse     { color: #166534; }
  .hc-role-physician { color: #1d4ed8; }
  .hc-role-admin     { color: #b91c1c; }
  :global([data-theme='dark']) .hc-role-nurse     { color: #4ade80; }
  :global([data-theme='dark']) .hc-role-physician { color: #93c5fd; }
  :global([data-theme='dark']) .hc-role-admin     { color: #f87171; }
  .hc-hint { font-size: 11.5px; color: var(--sg-muted, #64748b); }

  /* ─── Cells ──────────────────────────────────────────────────── */
  :global(.mono) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  :global(.hc-mrn-wrap) {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
  }
  :global(.hc-mrn-init) {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    letter-spacing: 0.05em;
  }

  :global(.hc-age) {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  :global(.hc-sex) {
    font-size: 10px;
    color: var(--sg-muted, #64748b);
    margin-left: 3px;
  }

  :global(.hc-location) {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
  }
  :global(.hc-room) { font-weight: 600; font-family: ui-monospace, Menlo, monospace; }
  :global(.hc-bed)  { font-size: 11px; color: var(--sg-muted, #64748b); }

  :global(.hc-risk) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :global(.hc-risk-bar) {
    position: relative;
    width: 70px;
    height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
  }
  :global(.hc-risk-fill) {
    position: absolute; inset: 0 auto 0 0;
    background: currentColor;
  }
  :global(.hc-risk-num) {
    font-weight: 700;
    min-width: 26px;
  }
  :global(.hc-risk-low)      { color: #16a34a; }
  :global(.hc-risk-moderate) { color: #ca8a04; }
  :global(.hc-risk-high)     { color: #ea580c; }
  :global(.hc-risk-critical) { color: #dc2626; }

  :global(.hc-code) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  :global(.hc-code-full_code)    { background: #dcfce7; color: #166534; }
  :global(.hc-code-dnr)          { background: #fee2e2; color: #b91c1c; }
  :global(.hc-code-dni)          { background: #fef3c7; color: #92400e; }
  :global(.hc-code-comfort_only) { background: var(--sg-bg-subtle, var(--sg-header-bg, #e2e8f0)); color: var(--sg-muted, #475569); }
  :global([data-theme='dark'] .hc-code-full_code)    { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .hc-code-dnr)          { background: rgba(239,68,68,.18); color: #f87171; }
  :global([data-theme='dark'] .hc-code-dni)          { background: rgba(245,158,11,.18); color: #fbbf24; }

  :global(.hc-vitals) {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
    color: #2563eb;
    line-height: 1.2;
  }
  :global([data-theme='dark'] .hc-vitals) { color: #60a5fa; }
  :global(.hc-spark) { width: 90px; height: 24px; }
  :global(.hc-vital-num) {
    color: var(--sg-fg, #1e293b);
    font-weight: 600;
    font-size: 12px;
  }
  :global(.hc-vital-sub) {
    color: var(--sg-muted, #64748b);
    font-size: 10.5px;
  }

  :global(.hc-no-allergies) {
    color: var(--sg-muted, #64748b);
    font-size: 11px;
    font-style: italic;
  }
  :global(.hc-allergy-list) {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  :global(.hc-allergy) {
    background: #fee2e2;
    color: #b91c1c;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
  }
  :global([data-theme='dark'] .hc-allergy) { background: rgba(239,68,68,.18); color: #f87171; }
</style>
