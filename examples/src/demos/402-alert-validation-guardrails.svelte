<script lang="ts">
  /**
   * 402. Alert rules: validation guardrails (Enterprise)
   * ----------------------------------------------------
   * A validation-trigger alert is evaluated ON EDIT and can VETO the change.
   * A budget sheet is editable, and two guardrail rules block bad edits: a
   * negative amount, or an amount over that line's budget. The pure engine is
   * wired into the grid's per-column `validate` hook - the blessed integration
   * point for prevent-edit. Toggle a guardrail off to allow the edit through.
   *
   * Engine: @svgrid/enterprise.
   */
  import { SvGrid, SvSwitchButton, renderSnippet, type ColumnDef } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { createAlertEngine, enableAlerts, setLicenseKey, type AlertRule } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableAlerts()

  type Expense = { id: string; item: string; category: string; amount: number; budget: number }

  const seed: Expense[] = [
    { id: 'e1', item: 'Cloud hosting', category: 'Infra', amount: 4200, budget: 5000 },
    { id: 'e2', item: 'Design tools', category: 'Software', amount: 890, budget: 1200 },
    { id: 'e3', item: 'Conference travel', category: 'Travel', amount: 2600, budget: 3000 },
    { id: 'e4', item: 'Contractor - backend', category: 'Services', amount: 7800, budget: 8000 },
    { id: 'e5', item: 'Analytics platform', category: 'Software', amount: 1450, budget: 1500 },
    { id: 'e6', item: 'Office lease', category: 'Facilities', amount: 9200, budget: 10000 },
    { id: 'e7', item: 'Team offsite', category: 'Travel', amount: 3100, budget: 3500 },
    { id: 'e8', item: 'Recruiting fees', category: 'People', amount: 5400, budget: 6000 },
    { id: 'e9', item: 'Ad campaign', category: 'Marketing', amount: 6100, budget: 6500 },
    { id: 'e10', item: 'Legal retainer', category: 'Services', amount: 2200, budget: 2500 },
    { id: 'e11', item: 'Hardware refresh', category: 'Infra', amount: 4800, budget: 5000 },
    { id: 'e12', item: 'Support tooling', category: 'Software', amount: 760, budget: 900 },
    { id: 'e13', item: 'Security audit', category: 'Services', amount: 3300, budget: 4000 },
    { id: 'e14', item: 'Swag & events', category: 'Marketing', amount: 1900, budget: 2000 },
  ]

  let rows = $state.raw<Expense[]>(seed)

  const spend = $derived(rows.reduce((s, r) => s + r.amount, 0))
  const budget = $derived(rows.reduce((s, r) => s + r.budget, 0))
  const remaining = $derived(budget - spend)
  const overBudget = $derived(rows.filter((r) => r.amount > r.budget).length)
  const fmt = (n: number) => `$${n.toLocaleString()}`

  const guardrails: AlertRule[] = [
    {
      id: 'no-negative', name: 'No negative amounts', enabled: true, severity: 'error', scope: 'cell', columns: ['amount'],
      predicate: { kind: 'cmp', column: 'amount', op: 'lessThan', value: 0 },
      trigger: { type: 'validation' },
      actions: [{ kind: 'preventEdit', message: 'Amount cannot be negative' }],
      createdAt: 0,
    },
    {
      id: 'over-budget', name: 'Block over-budget amounts', enabled: true, severity: 'error', scope: 'cell', columns: ['amount'],
      predicate: { kind: 'scalarCmp', left: { kind: 'col', id: 'amount' }, op: '>', right: { kind: 'col', id: 'budget' } },
      trigger: { type: 'validation' },
      actions: [{ kind: 'preventEdit', message: '{item}: {value} is over the {budget} budget' }],
      createdAt: 0,
    },
  ]

  let ruleState = $state<AlertRule[]>(guardrails.map((r) => ({ ...r })))
  const engine = createAlertEngine<Expense>({ rules: ruleState, getRowId: (r) => r.id })

  function toggleRule(id: string, on: boolean) {
    ruleState = ruleState.map((r) => (r.id === id ? { ...r, enabled: on } : r))
    engine.setRules(ruleState)
  }

  // PURE: the grid calls `validate` inside a reactive computation to show cell
  // validity, so it must have no side effects. It just asks the engine whether
  // the candidate value trips a validation rule and returns the message (which
  // blocks the edit and shows inline) or null.
  function validateAmount(value: unknown, row: Expense): string | null {
    const result = engine.validateEdit(row, 'amount', Number(value))
    return result.vetoed ? result.events[0]?.message ?? 'Edit blocked' : null
  }

  // In-cell utilisation bar: amount as a share of that line's budget.
  const baseBars: ConditionalFormat<Expense>[] = [
    { type: 'dataBar', columns: ['amount'], color: '#4f46e5', compareColumn: 'budget' },
  ]

  const columns: ColumnDef<any, Expense>[] = [
    { id: 'item', header: 'Item', field: 'item', width: 180 },
    { id: 'category', header: 'Category', field: 'category', width: 120 },
    { id: 'amount', header: 'Amount', field: 'amount', editorType: 'number', editable: true, width: 150, format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } }, validate: ({ value, row }) => validateAmount(value, row) },
    { id: 'budget', header: 'Budget', field: 'budget', editorType: 'number', width: 120, format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { id: 'used', header: 'Used', field: 'amount', width: 100, cell: (ctx) => renderSnippet(UsedCell, { row: ctx.row.original }) },
  ]
</script>

{#snippet UsedCell(props: { row: Expense })}
  {@const pct = Math.round((props.row.amount / props.row.budget) * 100)}
  {@const over = pct > 100}
  <span class="used" style={`color:${over ? '#dc2626' : pct > 90 ? '#d97706' : 'inherit'}`}>{pct}%{#if over} <span class="over">over</span>{/if}</span>
{/snippet}

<div class="app">
  <header class="app-bar">
    <div class="app-title">
      <span class="app-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
      </span>
      <div>
        <h2>Budget Guard</h2>
        <p>Edit an Amount. A validation rule checks the new value on the fly and blocks it if it breaks a guardrail.</p>
      </div>
    </div>
    <div class="app-tools">
      {#each ruleState as rule (rule.id)}
        <label class="chip">
          <SvSwitchButton checked={rule.enabled} onChange={(on) => toggleRule(rule.id, on)} ariaLabel={rule.name} />
          <span>{rule.name}</span>
        </label>
      {/each}
    </div>
  </header>

  <div class="kpis">
    <div class="kpi"><span class="kpi-label">Total spend</span><span class="kpi-value">{fmt(spend)}</span></div>
    <div class="kpi"><span class="kpi-label">Total budget</span><span class="kpi-value">{fmt(budget)}</span></div>
    <div class="kpi"><span class="kpi-label">Remaining</span><span class="kpi-value" style={`color:${remaining < 0 ? '#dc2626' : '#16a34a'}`}>{fmt(remaining)}</span></div>
    <div class="kpi"><span class="kpi-label">Over budget</span><span class="kpi-value" style={`color:${overBudget ? '#dc2626' : '#16a34a'}`}>{overBudget}</span></div>
  </div>

  <div class="app-grid">
    <SvGrid data={rows} {columns} getRowId={(r) => r.id} conditionalFormats={baseBars} enableInlineEditing={true} containerHeight={300} />
  </div>

  <footer class="app-foot">
    <span class="foot-hint">Double-click an <strong>Amount</strong> and set it to 9000 (over its budget) or a negative number - the edit is rejected inline. Toggle a guardrail off to allow it through; the <strong>Over budget</strong> count then reflects it.</span>
  </footer>
</div>

<style>
  .app { border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 16px; overflow: hidden; background: color-mix(in srgb, currentColor 2%, transparent); font-family: var(--sg-font, inherit); color: inherit; }
  .app-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 18px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); flex-wrap: wrap; }
  .app-title { display: flex; align-items: center; gap: 13px; }
  .app-icon { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 15%, transparent); color: var(--sg-accent, #4f46e5); flex: none; }
  .app-title h2 { margin: 0; font-size: 16px; font-weight: 650; }
  .app-title p { margin: 2px 0 0; font-size: 12.5px; opacity: 0.6; max-width: 52ch; line-height: 1.45; }
  .app-tools { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 6px 11px; border-radius: 9px; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); background: color-mix(in srgb, currentColor 4%, transparent); }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: color-mix(in srgb, currentColor 10%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
  .kpi { padding: 12px 16px; background: color-mix(in srgb, currentColor 2%, transparent); display: flex; flex-direction: column; gap: 3px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; }
  .kpi-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }

  .app-grid { padding: 12px; }
  .app-foot { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 11px 18px; border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent); font-size: 12px; }
  .foot-hint { opacity: 0.72; line-height: 1.5; }
  :global(.used) { font-weight: 600; font-variant-numeric: tabular-nums; }
  :global(.used .over) { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #dc2626; background: color-mix(in srgb, #dc2626 14%, transparent); padding: 1px 5px; border-radius: 999px; margin-left: 3px; }
</style>
