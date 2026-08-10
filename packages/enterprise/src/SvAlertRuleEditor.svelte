<script lang="ts">
  /**
   * SvAlertRuleEditor - a modal that authors a single alert rule: name /
   * severity / scope, the trigger (data change, relative change, validation,
   * scheduled), the predicate (embedded SvExpressionEditor), and the actions
   * (toast / badge / highlight / flash / prevent-edit / log). Reuses the grid
   * UI kit so it matches the rest of the app.
   */
  import { SvModal, SvField, SvTextInput, SvDropDownList, SvColorInput, SvTagsInput } from '@svgrid/grid'
  import SvExpressionEditor from './SvExpressionEditor.svelte'
  import { CRON_PRESETS } from './scheduling'
  import type { ExprColumn } from './expressions/expression-columns'
  import type { PredicateExpr } from './expressions/expression-types'
  import type {
    AlertAction,
    AlertActionKind,
    AlertRule,
    AlertScope,
    AlertSeverity,
    AlertTrigger,
  } from './alerts/alert-types'

  type Props = {
    open?: boolean
    columns: ReadonlyArray<ExprColumn>
    rule?: AlertRule | null
    rows?: ReadonlyArray<Record<string, unknown>>
    onSave?: (rule: AlertRule) => void
    onClose?: () => void
  }

  let {
    open = $bindable(false),
    columns,
    rule = null,
    rows = [],
    onSave,
    onClose,
  }: Props = $props()

  const ACTION_KINDS: { kind: AlertActionKind; label: string }[] = [
    { kind: 'toast', label: 'Toast notification' },
    { kind: 'highlight', label: 'Highlight row/cell' },
    { kind: 'badge', label: 'Colour badge' },
    { kind: 'cellFlash', label: 'Flash the cell' },
    { kind: 'preventEdit', label: 'Prevent the edit' },
    { kind: 'log', label: 'Log only' },
  ]

  const TRIGGERS = [
    { value: 'dataChange', label: 'When data matches' },
    { value: 'relativeChange', label: 'When a value moves' },
    { value: 'validation', label: 'On edit (validation)' },
    { value: 'scheduled', label: 'On a schedule' },
  ]

  const CHANGE_KINDS = [
    { value: 'changed', label: 'changed at all' },
    { value: 'delta', label: 'moved by (absolute)' },
    { value: 'percentChange', label: 'moved by (percent)' },
    { value: 'crossed', label: 'crossed a threshold' },
  ]

  // --- Draft state ---------------------------------------------------------

  let name = $state('')
  let severity = $state<AlertSeverity>('warning')
  let scope = $state<AlertScope>('row')
  let triggerType = $state<AlertTrigger['type']>('dataChange')
  let predicate = $state<PredicateExpr>({ kind: 'const', value: true })
  let selected = $state<Set<AlertActionKind>>(new Set(['toast']))
  let message = $state('')
  let background = $state('#fee2e2')
  let color = $state('#991b1b')
  let targetColumns = $state<string[]>([])

  // relativeChange draft
  let changeKind = $state<'changed' | 'delta' | 'percentChange' | 'crossed'>('percentChange')
  let changeColumn = $state('')
  let changeOp = $state<'>' | '<' | '>=' | '<='>('>')
  let changeValue = $state('5')
  let changeAbs = $state(true)
  let changeDirection = $state<'above' | 'below'>('above')

  // scheduled draft
  let cron = $state(CRON_PRESETS[3].cron)

  let createdAt = $state(0)
  let ruleId = $state('')

  // Re-seed the draft each time the modal opens.
  let wasOpen = $state(false)
  $effect(() => {
    if (open && !wasOpen) seed()
    wasOpen = open
  })

  function seed() {
    name = rule?.name ?? ''
    severity = rule?.severity ?? 'warning'
    scope = rule?.scope ?? 'row'
    triggerType = rule?.trigger.type ?? 'dataChange'
    predicate = rule?.predicate ?? { kind: 'const', value: true }
    selected = new Set(rule?.actions.map((a) => a.kind) ?? ['toast'])
    message = rule?.actions.find((a) => a.message)?.message ?? ''
    const styled = rule?.actions.find((a) => a.style)
    background = styled?.style?.background ?? '#fee2e2'
    color = styled?.style?.color ?? '#991b1b'
    targetColumns = rule?.columns ?? []
    createdAt = rule?.createdAt ?? Date.now()
    ruleId = rule?.id ?? `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    changeColumn = columns[0]?.id ?? ''
    if (rule?.trigger.type === 'relativeChange') {
      const e = rule.trigger.expr
      changeKind = e.kind
      changeColumn = e.column
      if (e.kind === 'delta' || e.kind === 'percentChange') {
        changeOp = e.op as '>' | '<' | '>=' | '<='
        changeValue = String(e.value)
        changeAbs = e.abs ?? false
      } else if (e.kind === 'crossed') {
        changeValue = String(e.threshold)
        changeDirection = e.direction
      }
    }
    if (rule?.trigger.type === 'scheduled') cron = rule.trigger.schedule.cron ?? CRON_PRESETS[3].cron
  }

  function toggle(kind: AlertActionKind, on: boolean) {
    const next = new Set(selected)
    if (on) next.add(kind)
    else next.delete(kind)
    selected = next
  }

  const showStyle = $derived(selected.has('highlight') || selected.has('badge'))
  const showTargets = $derived(showStyle || selected.has('cellFlash') || scope === 'cell')

  function buildTrigger(): AlertTrigger {
    if (triggerType === 'relativeChange') {
      const column = changeColumn
      const value = Number(changeValue)
      if (changeKind === 'changed') return { type: 'relativeChange', expr: { kind: 'changed', column } }
      if (changeKind === 'crossed')
        return { type: 'relativeChange', expr: { kind: 'crossed', column, threshold: value, direction: changeDirection } }
      return { type: 'relativeChange', expr: { kind: changeKind, column, op: changeOp, value, abs: changeAbs } }
    }
    if (triggerType === 'scheduled') return { type: 'scheduled', schedule: { id: ruleId, cron } }
    if (triggerType === 'validation') return { type: 'validation' }
    return { type: 'dataChange' }
  }

  function buildActions(): AlertAction[] {
    const cols = targetColumns.length ? targetColumns : undefined
    return [...selected].map((kind) => {
      const action: AlertAction = { kind }
      if (message && (kind === 'toast' || kind === 'log' || kind === 'preventEdit')) action.message = message
      if (kind === 'highlight' || kind === 'badge') {
        action.style = { background, color }
        if (cols) action.columns = cols
      }
      if (kind === 'cellFlash' && cols) action.columns = cols
      return action
    })
  }

  function save() {
    if (!name.trim()) { name = 'Untitled alert' }
    const built: AlertRule = {
      id: ruleId,
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      severity,
      scope,
      predicate,
      trigger: buildTrigger(),
      actions: buildActions(),
      ...(targetColumns.length ? { columns: targetColumns } : {}),
      createdAt,
    }
    onSave?.(built)
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open size="lg" title={rule ? 'Edit alert rule' : 'New alert rule'} onClose={() => onClose?.()}>
  <div class="ar-body">
    <div class="ar-grid">
      <SvField label="Name">
        <SvTextInput value={name} onChange={(v) => (name = v)} placeholder="e.g. Price spike" />
      </SvField>
      <SvField label="Severity">
        <SvDropDownList
          options={[{ value: 'info', label: 'Info' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'error', label: 'Error' }]}
          value={severity}
          onChange={(v) => (severity = v as AlertSeverity)} />
      </SvField>
      <SvField label="Scope">
        <SvDropDownList
          options={[{ value: 'row', label: 'Row' }, { value: 'cell', label: 'Cell' }, { value: 'aggregate', label: 'Aggregate' }]}
          value={scope}
          onChange={(v) => (scope = v as AlertScope)} />
      </SvField>
      <SvField label="Trigger">
        <SvDropDownList options={TRIGGERS} value={triggerType} onChange={(v) => (triggerType = v as AlertTrigger['type'])} />
      </SvField>
    </div>

    {#if triggerType === 'relativeChange'}
      <fieldset class="ar-fieldset">
        <legend>Value movement</legend>
        <div class="ar-change">
          <SvDropDownList size="sm" options={columns.map((c) => ({ value: c.id, label: c.name ?? c.id }))} value={changeColumn} onChange={(v) => (changeColumn = String(v))} ariaLabel="Column" />
          <SvDropDownList size="sm" options={CHANGE_KINDS} value={changeKind} onChange={(v) => (changeKind = v as typeof changeKind)} ariaLabel="Change kind" />
          {#if changeKind === 'delta' || changeKind === 'percentChange'}
            <SvDropDownList size="sm" options={[{ value: '>', label: '>' }, { value: '<', label: '<' }, { value: '>=', label: '>=' }, { value: '<=', label: '<=' }]} value={changeOp} onChange={(v) => (changeOp = v as typeof changeOp)} ariaLabel="Operator" />
            <SvTextInput size="sm" value={changeValue} onChange={(v) => (changeValue = v)} placeholder={changeKind === 'percentChange' ? '%' : 'amount'} ariaLabel="Amount" />
            <label class="ar-check"><input type="checkbox" checked={changeAbs} onchange={(e) => (changeAbs = e.currentTarget.checked)} /> absolute</label>
          {:else if changeKind === 'crossed'}
            <SvDropDownList size="sm" options={[{ value: 'above', label: 'upward through' }, { value: 'below', label: 'downward through' }]} value={changeDirection} onChange={(v) => (changeDirection = v as typeof changeDirection)} ariaLabel="Direction" />
            <SvTextInput size="sm" value={changeValue} onChange={(v) => (changeValue = v)} placeholder="threshold" ariaLabel="Threshold" />
          {/if}
        </div>
      </fieldset>
    {:else if triggerType === 'scheduled'}
      <SvField label="Schedule">
        <SvDropDownList options={CRON_PRESETS.map((p) => ({ value: p.cron, label: p.label }))} value={cron} onChange={(v) => (cron = String(v))} />
      </SvField>
    {/if}

    <SvField label={triggerType === 'validation' ? 'Reject the edit when' : 'Condition'}>
      <SvExpressionEditor {columns} bind:value={predicate} {rows} />
    </SvField>

    <fieldset class="ar-fieldset">
      <legend>When it fires</legend>
      <div class="ar-actions">
        {#each ACTION_KINDS as a (a.kind)}
          <label class="ar-check">
            <input type="checkbox" checked={selected.has(a.kind)} onchange={(e) => toggle(a.kind, e.currentTarget.checked)} />
            {a.label}
          </label>
        {/each}
      </div>
      <div class="ar-message">
        <SvField label="Message (tokens: {'{value}'}, {'{column}'}, {'{field}'})">
          <SvTextInput value={message} onChange={(v) => (message = v)} placeholder="e.g. {'{'}region{'}'} price hit {'{'}value{'}'}" />
        </SvField>
      </div>
      {#if showStyle}
        <div class="ar-style">
          <SvField label="Background"><SvColorInput value={background} onChange={(v) => (background = v)} /></SvField>
          <SvField label="Text"><SvColorInput value={color} onChange={(v) => (color = v)} /></SvField>
        </div>
      {/if}
      {#if showTargets}
        <SvField label="Target columns (blank = whole row)">
          <SvTagsInput value={targetColumns} onChange={(v) => (targetColumns = v)} placeholder="column id…" />
        </SvField>
      {/if}
    </fieldset>
  </div>

  {#snippet footer()}
    <button type="button" class="ar-btn ar-ghost" onclick={() => { open = false; onClose?.() }}>Cancel</button>
    <button type="button" class="ar-btn ar-primary" onclick={save}>{rule ? 'Save changes' : 'Create alert'}</button>
  {/snippet}
</SvModal>

<style>
  /* Theme-agnostic surfaces: currentColor + inherit (readable in any theme). */
  .ar-body { display: flex; flex-direction: column; gap: 14px; max-height: 64vh; overflow: auto; padding: 2px; font-family: var(--sg-font, inherit); color: inherit; }
  .ar-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ar-fieldset { border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 10px; padding: 12px 14px 14px; margin: 0; background: color-mix(in srgb, currentColor 3%, transparent); }
  .ar-fieldset legend { font-size: 11px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; opacity: 0.6; padding: 0 6px; }
  .ar-change { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .ar-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
  .ar-check {
    display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: inherit;
    padding: 7px 10px; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: 8px;
    background: color-mix(in srgb, currentColor 3%, transparent);
    cursor: pointer; transition: border-color 0.13s ease, background 0.13s ease;
  }
  .ar-check:hover { border-color: color-mix(in srgb, var(--sg-accent, #4f46e5) 45%, currentColor); background: color-mix(in srgb, var(--sg-accent, #4f46e5) 7%, transparent); }
  .ar-check input { accent-color: var(--sg-accent, #4f46e5); width: 15px; height: 15px; }
  .ar-message { margin-top: 10px; }
  .ar-style { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
  .ar-btn { border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: background 0.14s ease, border-color 0.14s ease, filter 0.14s ease; }
  .ar-ghost { background: color-mix(in srgb, currentColor 5%, transparent); border-color: color-mix(in srgb, currentColor 22%, transparent); color: inherit; }
  .ar-ghost:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
  .ar-primary { background: var(--sg-accent, #4f46e5); color: #fff; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
  .ar-primary:hover { filter: brightness(1.08); }
</style>
