<script lang="ts">
  /**
   * 98. Advanced filter builder (visual query builder)
   * --------------------------------------------------
   * A drag-and-drop AND/OR query builder, like Notion's filter panel
   * or Linear's view filters. Compose any number of rule rows ANDed
   * or ORed together; each rule picks (field × operator × value).
   * The filter runs entirely client-side over the dataset; we replace
   * the grid's data with the filtered subset on every change.
   *
   * The grid's own column menu still works for ad-hoc filtering - this
   * is the "Saved view" / "Build a complex query" surface that ships
   * with every modern BI tool.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'

  type Row = {
    id: string
    company: string
    region: 'Americas' | 'EMEA' | 'APAC'
    industry: 'SaaS' | 'Manufacturing' | 'Retail' | 'Healthcare' | 'Finance'
    arr: number
    seats: number
    churnRisk: 'low' | 'medium' | 'high'
    contractEnd: string
    healthScore: number
  }

  // ---- Seed data ---------------------------------------------------------
  let prng = 0xDEC0DE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const REGIONS = ['Americas', 'EMEA', 'APAC'] as const
  const INDUSTRIES = ['SaaS', 'Manufacturing', 'Retail', 'Healthcare', 'Finance'] as const
  const RISKS = ['low', 'medium', 'high'] as const
  const COMPANY_NAMES = [
    'Helios', 'Vertex', 'Atlas', 'Quantum', 'Stellar', 'Apex', 'Crescent', 'Sigma',
    'Pioneer', 'Aurora', 'Granite', 'Cobalt', 'Meridian', 'Polaris', 'Sentinel', 'Tessera',
    'Cascade', 'Beacon', 'Wavelength', 'Lumen', 'Echo', 'Cipher', 'Nimbus', 'Caldera',
    'Sterling', 'Onyx', 'Slate', 'Ember', 'Verdant', 'Halcyon',
  ]
  const SUFFIXES = ['Labs', 'Group', 'Holdings', 'Industries', 'Systems', 'Capital', 'Partners', 'Networks']

  let allRows: Row[] = Array.from({ length: 250 }, (_, i) => {
    const yearOffset = int(0, 18) // contract ends 0-18 months from now
    const d = new Date(); d.setMonth(d.getMonth() + yearOffset)
    return {
      id: `ACC-${(1000 + i).toString()}`,
      company:    `${pick(COMPANY_NAMES)} ${pick(SUFFIXES)}`,
      region:     pick(REGIONS),
      industry:   pick(INDUSTRIES),
      arr:        int(5_000, 480_000),
      seats:      int(3, 240),
      churnRisk:  pick(RISKS),
      contractEnd:d.toISOString().slice(0, 10),
      healthScore: int(15, 99),
    }
  })

  // ---- Field metadata for the builder ------------------------------------
  type FieldType = 'text' | 'number' | 'enum' | 'date'
  type FieldDef = {
    id: keyof Row
    label: string
    type: FieldType
    options?: readonly string[]
  }
  const FIELDS: FieldDef[] = [
    { id: 'company',     label: 'Company',      type: 'text' },
    { id: 'region',      label: 'Region',       type: 'enum',   options: REGIONS },
    { id: 'industry',    label: 'Industry',     type: 'enum',   options: INDUSTRIES },
    { id: 'arr',         label: 'ARR',          type: 'number' },
    { id: 'seats',       label: 'Seats',        type: 'number' },
    { id: 'churnRisk',   label: 'Churn risk',   type: 'enum',   options: RISKS },
    { id: 'contractEnd', label: 'Contract end', type: 'date' },
    { id: 'healthScore', label: 'Health score', type: 'number' },
  ]

  type OperatorId =
    | 'contains' | 'equals' | 'notEquals' | 'startsWith'
    | 'gt' | 'lt' | 'gte' | 'lte' | 'between'
    | 'inSet'
    | 'before' | 'after' | 'within'
  type OperatorDef = { id: OperatorId; label: string; types: FieldType[]; nValues: 1 | 2 | 'set' }
  const OPERATORS: OperatorDef[] = [
    { id: 'contains',   label: 'contains',    types: ['text'],         nValues: 1 },
    { id: 'equals',     label: 'equals',      types: ['text', 'enum'], nValues: 1 },
    { id: 'notEquals',  label: 'not equals',  types: ['text', 'enum'], nValues: 1 },
    { id: 'startsWith', label: 'starts with', types: ['text'],         nValues: 1 },
    { id: 'inSet',      label: 'is one of',   types: ['enum'],         nValues: 'set' },
    { id: 'gt',         label: '>',           types: ['number'],       nValues: 1 },
    { id: 'lt',         label: '<',           types: ['number'],       nValues: 1 },
    { id: 'gte',        label: '≥',           types: ['number'],       nValues: 1 },
    { id: 'lte',        label: '≤',           types: ['number'],       nValues: 1 },
    { id: 'between',    label: 'between',     types: ['number'],       nValues: 2 },
    { id: 'before',     label: 'before',      types: ['date'],         nValues: 1 },
    { id: 'after',      label: 'after',       types: ['date'],         nValues: 1 },
    { id: 'within',     label: 'within next N days', types: ['date'],   nValues: 1 },
  ]
  function operatorsFor(type: FieldType) { return OPERATORS.filter((o) => o.types.includes(type)) }

  type Rule = {
    id: string
    field: keyof Row
    operator: OperatorId
    v1: string
    v2: string
    set: string[]   // for 'inSet'
  }

  function newRule(): Rule {
    const f = FIELDS[0]!
    const op = operatorsFor(f.type)[0]!
    return { id: crypto.randomUUID(), field: f.id, operator: op.id, v1: '', v2: '', set: [] }
  }

  let combinator = $state<'AND' | 'OR'>('AND')
  let rules = $state<Rule[]>([
    { id: 'r1', field: 'region',     operator: 'equals', v1: 'EMEA',     v2: '', set: [] },
    { id: 'r2', field: 'arr',        operator: 'gt',     v1: '100000',   v2: '', set: [] },
    { id: 'r3', field: 'churnRisk',  operator: 'inSet',  v1: '',         v2: '', set: ['medium', 'high'] },
  ])
  let presetTouched = $state(false)

  function addRule() { rules = [...rules, newRule()]; presetTouched = true }
  function removeRule(id: string) { rules = rules.filter((r) => r.id !== id); presetTouched = true }
  function onFieldChange(rule: Rule, nextField: keyof Row) {
    const nextType = FIELDS.find((f) => f.id === nextField)!.type
    const stillValid = operatorsFor(nextType).find((o) => o.id === rule.operator)
    const nextOp = stillValid ?? operatorsFor(nextType)[0]!
    rules = rules.map((r) => r.id === rule.id
      ? { ...r, field: nextField, operator: nextOp.id, v1: '', v2: '', set: [] }
      : r)
    presetTouched = true
  }
  function updateRule(id: string, patch: Partial<Rule>) {
    rules = rules.map((r) => r.id === id ? { ...r, ...patch } : r)
    presetTouched = true
  }

  // ---- Filter evaluator -------------------------------------------------
  function evalRule(row: Row, rule: Rule): boolean {
    const field = FIELDS.find((f) => f.id === rule.field)!
    const raw = row[rule.field]
    switch (rule.operator) {
      case 'contains':   return String(raw).toLowerCase().includes(rule.v1.toLowerCase())
      case 'equals':     return String(raw) === rule.v1
      case 'notEquals':  return String(raw) !== rule.v1
      case 'startsWith': return String(raw).toLowerCase().startsWith(rule.v1.toLowerCase())
      case 'inSet':      return rule.set.length === 0 ? true : rule.set.includes(String(raw))
      case 'gt':         return Number(raw) >  Number(rule.v1)
      case 'lt':         return Number(raw) <  Number(rule.v1)
      case 'gte':        return Number(raw) >= Number(rule.v1)
      case 'lte':        return Number(raw) <= Number(rule.v1)
      case 'between': {
        const lo = Math.min(Number(rule.v1), Number(rule.v2))
        const hi = Math.max(Number(rule.v1), Number(rule.v2))
        return Number(raw) >= lo && Number(raw) <= hi
      }
      case 'before':     return rule.v1 ? String(raw) <  rule.v1 : true
      case 'after':      return rule.v1 ? String(raw) >  rule.v1 : true
      case 'within': {
        const n = Number(rule.v1)
        if (!Number.isFinite(n) || n <= 0) return true
        const now = new Date(); const future = new Date(); future.setDate(now.getDate() + n)
        const v = new Date(String(raw))
        return v >= now && v <= future
      }
      default: return true
    }
  }

  const filtered = $derived.by(() => {
    if (rules.length === 0) return allRows
    return allRows.filter((row) =>
      combinator === 'AND'
        ? rules.every((r) => evalRule(row, r))
        : rules.some((r)  => evalRule(row, r))
    )
  })

  function clearAll() { rules = []; presetTouched = true }
  function preset_atRisk_EMEA() {
    combinator = 'AND'
    rules = [
      { id: crypto.randomUUID(), field: 'region',     operator: 'equals', v1: 'EMEA',     v2: '', set: [] },
      { id: crypto.randomUUID(), field: 'churnRisk',  operator: 'inSet',  v1: '',         v2: '', set: ['medium', 'high'] },
      { id: crypto.randomUUID(), field: 'arr',        operator: 'gt',     v1: '50000',    v2: '', set: [] },
    ]
    presetTouched = false
  }
  function preset_expiring() {
    combinator = 'AND'
    rules = [
      { id: crypto.randomUUID(), field: 'contractEnd', operator: 'within', v1: '90', v2: '', set: [] },
      { id: crypto.randomUUID(), field: 'healthScore', operator: 'lt',     v1: '60', v2: '', set: [] },
    ]
    presetTouched = false
  }
  function preset_topAccounts() {
    combinator = 'OR'
    rules = [
      { id: crypto.randomUUID(), field: 'arr',   operator: 'gt', v1: '300000', v2: '', set: [] },
      { id: crypto.randomUUID(), field: 'seats', operator: 'gt', v1: '150',    v2: '', set: [] },
    ]
    presetTouched = false
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',          header: 'Account',      width: 110, editable: false },
    { field: 'company',     header: 'Company',      width: 200, editable: false },
    { field: 'region',      header: 'Region',       width: 110, editable: false },
    { field: 'industry',    header: 'Industry',     width: 130, editable: false },
    { field: 'arr',         header: 'ARR',          width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'seats',       header: 'Seats',        width:  90, align: 'right', editable: false },
    { field: 'churnRisk',   header: 'Churn risk',   width: 110, editable: false,
      cellClass: (ctx) => `risk-${ctx.getValue()}` },
    { field: 'contractEnd', header: 'Contract end', width: 130, editable: false },
    { field: 'healthScore', header: 'Health',       width: 110, align: 'right', editable: false },
  ]

  const usd = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
                          : n >= 1_000     ? `$${(n / 1_000).toFixed(0)}k`
                                           : `$${n.toFixed(0)}`
  const totalArr = $derived(filtered.reduce((s, r) => s + r.arr, 0))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Presets bar --------------------------------------------------- -->
  <div class="preset-bar shrink-0">
    <span class="preset-label">Quick views:</span>
    <button class="preset" onclick={preset_atRisk_EMEA}>At-risk EMEA accounts</button>
    <button class="preset" onclick={preset_expiring}>Expiring contracts (90 days)</button>
    <button class="preset" onclick={preset_topAccounts}>Top accounts (ARR or seats)</button>
    {#if presetTouched && rules.length > 0}
      <span class="preset-touched">● customised</span>
    {/if}
    <div class="preset-spacer"></div>
    <div class="match-stat">
      Matches: <strong>{filtered.length}</strong> / {allRows.length}
      <span class="match-stat-meta">· ARR {usd(totalArr)}</span>
    </div>
  </div>

  <!-- Builder ------------------------------------------------------- -->
  <div class="builder shrink-0">
    <div class="builder-head">
      <div class="combinator">
        <span class="builder-label">Match</span>
        <button class={`combo-btn ${combinator === 'AND' ? 'is-on' : ''}`} onclick={() => combinator = 'AND'}>ALL (AND)</button>
        <button class={`combo-btn ${combinator === 'OR'  ? 'is-on' : ''}`} onclick={() => combinator = 'OR'}>ANY (OR)</button>
        <span class="builder-label muted">of the rules below</span>
      </div>
      <div class="builder-actions">
        <button class="link-btn" onclick={addRule}>+ Add rule</button>
        <button class="link-btn danger" onclick={clearAll} disabled={rules.length === 0}>Clear all</button>
      </div>
    </div>

    {#if rules.length === 0}
      <div class="rules-empty">No rules - showing all rows. Click "+ Add rule" or pick a preset.</div>
    {:else}
      <ul class="rules">
        {#each rules as rule, i (rule.id)}
          {@const field = FIELDS.find((f) => f.id === rule.field)!}
          {@const opDef = OPERATORS.find((o) => o.id === rule.operator)!}
          <li class="rule">
            <span class="rule-link">{i === 0 ? 'WHERE' : combinator}</span>
            <select class="rule-field" value={rule.field}
              onchange={(e) => onFieldChange(rule, (e.currentTarget as HTMLSelectElement).value as keyof Row)}>
              {#each FIELDS as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
            </select>
            <select class="rule-op" value={rule.operator}
              onchange={(e) => updateRule(rule.id, { operator: (e.currentTarget as HTMLSelectElement).value as OperatorId, v1: '', v2: '', set: [] })}>
              {#each operatorsFor(field.type) as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
            </select>

            {#if opDef.nValues === 'set' && field.options}
              <span class="rule-set">
                {#each field.options as opt (opt)}
                  <label class="chip-check">
                    <input type="checkbox" checked={rule.set.includes(opt)}
                      onchange={(e) => updateRule(rule.id, {
                        set: (e.currentTarget as HTMLInputElement).checked
                          ? [...rule.set, opt]
                          : rule.set.filter((x) => x !== opt)
                      })} />
                    <span>{opt}</span>
                  </label>
                {/each}
              </span>
            {:else if field.type === 'enum' && field.options}
              <select class="rule-val" value={rule.v1}
                onchange={(e) => updateRule(rule.id, { v1: (e.currentTarget as HTMLSelectElement).value })}>
                <option value="">- choose -</option>
                {#each field.options as opt (opt)}<option value={opt}>{opt}</option>{/each}
              </select>
            {:else if field.type === 'number'}
              <input class="rule-val" type="number"
                value={rule.v1}
                oninput={(e) => updateRule(rule.id, { v1: (e.currentTarget as HTMLInputElement).value })} />
              {#if opDef.nValues === 2}
                <span class="rule-and">and</span>
                <input class="rule-val" type="number"
                  value={rule.v2}
                  oninput={(e) => updateRule(rule.id, { v2: (e.currentTarget as HTMLInputElement).value })} />
              {/if}
            {:else if field.type === 'date'}
              {#if opDef.id === 'within'}
                <input class="rule-val" type="number" min="1" max="365"
                  placeholder="N days"
                  value={rule.v1}
                  oninput={(e) => updateRule(rule.id, { v1: (e.currentTarget as HTMLInputElement).value })} />
              {:else}
                <input class="rule-val" type="date"
                  value={rule.v1}
                  oninput={(e) => updateRule(rule.id, { v1: (e.currentTarget as HTMLInputElement).value })} />
              {/if}
            {:else}
              <input class="rule-val" type="text"
                value={rule.v1}
                oninput={(e) => updateRule(rule.id, { v1: (e.currentTarget as HTMLInputElement).value })} />
            {/if}

            <button class="rule-x" aria-label="Remove rule"
              onclick={() => removeRule(rule.id)}>×</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={filtered}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  /* ---- Preset bar ---- */
  .preset-bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
  }
  .preset-label, .builder-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  .builder-label.muted { font-weight: 500; color: var(--sg-muted, #94a3b8); text-transform: none; letter-spacing: 0; }
  .preset {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 999px; padding: 4px 12px; font-size: 12px;
    font-weight: 600; cursor: pointer;
  }
  .preset:hover { background: color-mix(in oklab, #6366f1 8%, transparent); border-color: #6366f1; }
  .preset-touched { font-size: 11px; color: #f59e0b; font-weight: 700; padding: 0 6px; }
  .preset-spacer { flex: 1; }
  .match-stat {
    font-size: 13px; color: var(--sg-fg, #0f172a);
    font-variant-numeric: tabular-nums;
  }
  .match-stat strong { color: #6366f1; font-size: 16px; }
  .match-stat-meta { color: var(--sg-muted, #64748b); }

  /* ---- Builder ---- */
  .builder {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg, color-mix(in oklab, #6366f1 4%, var(--sg-bg, #fff)), var(--sg-bg, #fff));
    border-radius: 10px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .builder-head { display: flex; align-items: center; gap: 14px; }
  .combinator { display: flex; align-items: center; gap: 8px; flex: 1; }
  .combo-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px; padding: 4px 10px; font-size: 12px;
    font-weight: 700; cursor: pointer;
    color: var(--sg-muted, #64748b);
  }
  .combo-btn.is-on {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border-color: transparent;
  }
  .builder-actions { display: flex; gap: 6px; }
  .link-btn {
    background: transparent; border: 0; padding: 4px 8px;
    color: #6366f1; font-size: 12px; font-weight: 700; cursor: pointer;
    border-radius: 4px;
  }
  .link-btn:hover { background: color-mix(in oklab, #6366f1 12%, transparent); }
  .link-btn.danger { color: #b91c1c; }
  .link-btn:disabled { opacity: 0.4; cursor: default; }
  .link-btn:disabled:hover { background: transparent; }

  .rules-empty {
    padding: 8px 4px; font-size: 12px; font-style: italic;
    color: var(--sg-muted, #94a3b8);
  }
  .rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .rule {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px; padding: 6px 8px;
  }
  .rule-link {
    font-size: 10px; font-weight: 800;
    color: #6366f1; background: color-mix(in oklab, #6366f1 10%, transparent);
    border-radius: 4px; padding: 2px 6px;
    width: 56px; text-align: center;
  }
  .rule-field, .rule-op, .rule-val {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 5px; padding: 4px 8px; font-size: 12.5px; font-family: inherit;
  }
  .rule-field { font-weight: 600; }
  .rule-val { min-width: 120px; }
  .rule-and { font-size: 11px; color: var(--sg-muted, #64748b); padding: 0 2px; }
  .rule-set { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .chip-check {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 999px; padding: 2px 8px;
    font-size: 11px; cursor: pointer; user-select: none;
  }
  .chip-check input { accent-color: #6366f1; }
  .chip-check:has(input:checked) {
    background: color-mix(in oklab, #6366f1 15%, var(--sg-bg, #fff));
    border-color: #6366f1; color: #4338ca; font-weight: 600;
  }
  .rule-x {
    margin-left: auto;
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #94a3b8); font-size: 16px; padding: 2px 6px;
    border-radius: 4px;
  }
  .rule-x:hover { background: #fee2e2; color: #b91c1c; }

  /* Risk colors */
  :global(td.risk-low)    { color: #16a34a; font-weight: 600; }
  :global(td.risk-medium) { color: #d97706; font-weight: 600; }
  :global(td.risk-high)   { color: #dc2626; font-weight: 700; }
</style>
