<script lang="ts">
  /**
   * A table's automations, in a dialog: the list on the left (each can be
   * turned off), the one picked on the right as "When", "Only for records
   * where" and "Do", and the history of runs. Every change is kept at once
   * (`onChange`), as the view bar keeps a view's settings.
   */
  import { SvModal, SvSwitchButton } from '@svgrid/grid'
  import FilterPanel from './viewbar/FilterPanel.svelte'
  import { CRON_PRESETS } from '../scheduling'
  import { primaryOf, rowIdOf, type BaseTable } from './base-tables'
  import { getFieldUsers } from './sources.svelte'
  import {
    actionLabel,
    listAutomationActions,
    tableFields,
    triggerText,
    type AutomationAction,
    type AutomationRun,
    type AutomationRunner,
    type AutomationTrigger,
    type BaseAutomation,
  } from './automations.svelte'
  import type { FieldFilter } from './filter-model'
  import type { FieldView } from './view-model'

  let {
    open = $bindable(false),
    table,
    tables,
    ctrl,
    views = [],
    runner,
    serverRuns,
    onChange,
  }: {
    open?: boolean
    table: BaseTable
    tables: BaseTable[]
    /** The grid of the table, for the condition's fields. */
    ctrl: any
    views?: FieldView[]
    runner: AutomationRunner
    /** The server runner's latest runs (an endpoint returning `server.runs`). */
    serverRuns?: () => Promise<ReadonlyArray<AutomationRun>>
    onChange: (automations: BaseAutomation[]) => void
  } = $props()

  // svelte-ignore state_referenced_locally
  let list = $state<BaseAutomation[]>($state.snapshot(table.automations ?? []) as BaseAutomation[])
  // svelte-ignore state_referenced_locally
  let selectedId = $state<string | null>(list[0]?.id ?? null)
  let tab = $state<'edit' | 'runs'>('edit')
  const selected = $derived(list.find((a) => a.id === selectedId) ?? null)

  const fields = $derived([...tableFields(table).values()])
  const fieldsOf = (t: BaseTable | undefined) => (t ? [...tableFields(t).values()] : [])
  const COMPUTED = new Set(['formula', 'lookup', 'rollup', 'count', 'button', 'autoNumber', 'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy'])
  const writable = (t: BaseTable | undefined) => fieldsOf(t).filter((c) => !COMPUTED.has(String(c.fieldType ?? '')))
  const forms = $derived(views.filter((v) => v.type === 'form'))
  const buttons = $derived(fields.filter((c) => c.fieldType === 'button'))
  const appActions = listAutomationActions()

  function save(next: BaseAutomation[]) {
    list = next
    onChange($state.snapshot(next) as BaseAutomation[])
  }
  function patch(change: Partial<BaseAutomation>) {
    if (!selected) return
    save(list.map((a) => (a.id === selected.id ? { ...a, ...change } : a)))
  }
  function add() {
    const primary = fields.find((c) => c.id === primaryOf(table)) ?? fields[0]
    const a: BaseAutomation = {
      id: `auto-${Date.now().toString(36)}`,
      name: 'New automation',
      enabled: true,
      trigger: { type: 'recordCreated' },
      actions: [{ type: 'notify', message: `New record: {${primary?.header ?? 'Name'}}` }],
    }
    save([...list, a])
    selectedId = a.id
    tab = 'edit'
  }
  let deleting = $state<string | null>(null)
  function remove(id: string) {
    const next = list.filter((a) => a.id !== id)
    save(next)
    selectedId = next[0]?.id ?? null
  }

  // ---- When ----
  const TRIGGERS: Array<{ value: AutomationTrigger['type']; label: string }> = [
    { value: 'recordCreated', label: 'A record is created' },
    { value: 'recordUpdated', label: 'A record changes' },
    { value: 'recordMatches', label: 'A record matches a condition' },
    { value: 'formSubmitted', label: 'A form is sent' },
    { value: 'button', label: 'A button is pressed' },
    { value: 'scheduled', label: 'At a scheduled time' },
  ]
  function setTrigger(type: AutomationTrigger['type']) {
    const trigger: AutomationTrigger =
      type === 'recordUpdated' ? { type, fields: [] }
      : type === 'formSubmitted' ? { type }
      : type === 'button' ? { type, field: buttons[0]?.id ?? '' }
      : type === 'scheduled' ? { type, cron: CRON_PRESETS[3]!.cron }
      : { type }
    patch({ trigger })
  }
  function toggleWatched(id: string) {
    if (selected?.trigger.type !== 'recordUpdated') return
    const now = new Set(selected.trigger.fields ?? [])
    if (now.has(id)) now.delete(id)
    else now.add(id)
    patch({ trigger: { type: 'recordUpdated', fields: [...now] } })
  }

  // ---- Only for records where ----
  const EMPTY: FieldFilter = { kind: 'fieldFilter', conjunction: 'and', conditions: [] }
  function setCondition(f: FieldFilter) {
    patch({ condition: f.conditions.length ? f : undefined })
  }

  // ---- Do ----
  const ACTIONS: Array<{ value: AutomationAction['type'] | `run:${string}`; label: string }> = [
    { value: 'updateRecord', label: 'Update the record' },
    { value: 'createRecord', label: 'Create a record' },
    { value: 'notify', label: 'Show a notice' },
    { value: 'highlight', label: 'Color the record while it matches' },
    { value: 'webhook', label: 'Call a webhook' },
    { value: 'email', label: 'Send an email' },
    ...appActions.map((a) => ({ value: `run:${a.id}` as const, label: a.label })),
  ]
  function newAction(value: string): AutomationAction {
    if (value.startsWith('run:')) return { type: 'run', action: value.slice(4) }
    switch (value) {
      case 'updateRecord':
        return { type: 'updateRecord', values: {} }
      case 'createRecord':
        return { type: 'createRecord', table: table.id, values: {} }
      case 'highlight':
        return { type: 'highlight', background: '#fee2e2', color: '#991b1b' }
      case 'webhook':
        return { type: 'webhook', url: 'https://', body: '' }
      case 'email':
        return { type: 'email', to: '', subject: '', body: '' }
      default:
        return { type: 'notify', message: '', severity: 'info' }
    }
  }
  const actionKey = (a: AutomationAction) => (a.type === 'run' ? `run:${a.action}` : a.type)
  function setAction(i: number, next: AutomationAction | null) {
    if (!selected) return
    const actions = [...selected.actions]
    if (next) actions[i] = next
    else actions.splice(i, 1)
    patch({ actions })
  }
  function moveAction(i: number, dir: -1 | 1) {
    if (!selected) return
    const actions = [...selected.actions]
    const j = i + dir
    if (j < 0 || j >= actions.length) return
    ;[actions[i], actions[j]] = [actions[j]!, actions[i]!]
    patch({ actions })
  }
  function setValue(i: number, values: Record<string, unknown>, id: string, value: unknown) {
    const a = selected?.actions[i]
    if (!a || (a.type !== 'updateRecord' && a.type !== 'createRecord')) return
    setAction(i, { ...a, values: { ...values, [id]: value } })
  }
  function dropValue(i: number, id: string) {
    const a = selected?.actions[i]
    if (!a || (a.type !== 'updateRecord' && a.type !== 'createRecord')) return
    const { [id]: _gone, ...values } = a.values
    setAction(i, { ...a, values })
  }

  /** What a field's value box suggests: its options, people, record names, dates, tokens. */
  function suggestions(t: BaseTable | undefined, c: { fieldType?: string; def: Record<string, any> }): string[] {
    const tokens = fields.map((f) => `{${f.header}}`)
    switch (c.fieldType) {
      case 'singleSelect':
      case 'multiSelect':
        return ((c.def.fieldProps?.options ?? []) as Array<{ value: string }>).map((o) => o.value)
      case 'user':
        return getFieldUsers().map((u) => u.name)
      case 'checkbox':
        return ['true', 'false']
      case 'date':
        return ['today', 'today+1', 'today+7', 'today-1', 'now']
      case 'link': {
        const target = tables.find((x) => x.id === c.def.fieldProps?.table)
        const names = target ? target.data.slice(0, 50).map((r) => String(r?.[primaryOf(target)] ?? '')).filter(Boolean) : []
        return [...(target?.id === table.id || c.def.fieldProps?.table === table.id ? ['{record}'] : []), ...names]
      }
      default:
        return t ? tokens : []
    }
  }
  const PLACEHOLDER: Record<string, string> = { date: 'today+7', checkbox: 'true', number: '0, or 100% for a percent', link: 'a record name, or {record}', user: 'a name' }

  // ---- Try it ----
  let tryRecord = $state('')
  const records = $derived(table.data.filter(Boolean).slice(0, 200).map((r) => ({ id: rowIdOf(table, r), name: String(r[primaryOf(table)] ?? '') || '(no name)' })))
  function tryNow() {
    if (!selected) return
    void runner.runNow($state.snapshot(selected) as BaseAutomation, table.id, tryRecord || null)
    tab = 'runs'
  }

  // ---- Runs: this page's and, when the app hands them over, the server's ----
  let fromServer = $state.raw<ReadonlyArray<AutomationRun>>([])
  let serverError = $state('')
  function showRuns() {
    tab = 'runs'
    if (!serverRuns) return
    serverRuns().then(
      (r) => {
        fromServer = r
        serverError = ''
      },
      (e) => (serverError = e instanceof Error ? e.message : String(e)),
    )
  }
  const allRuns = $derived(
    [...runner.runs.map((r) => ({ ...r, side: 'browser' as const })), ...fromServer.map((r) => ({ ...r, side: 'server' as const }))].sort((x, y) => y.at - x.at),
  )
  /** `Name: value` lines, as a webhook's headers. */
  function parseHeaders(text: string): Record<string, string> {
    const out: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const at = line.indexOf(':')
      if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim()
    }
    return out
  }
  const headerText = (h: Record<string, string> | undefined) => Object.entries(h ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n')

  const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
</script>

<SvModal bind:open title={`Automations in ${table.name}`} width={1000} resizable>
  <div class="sv-bauto">
    <aside class="sv-bauto-list" aria-label="Automations">
      {#each list as a (a.id)}
        <div class="sv-bauto-item" class:is-on={a.id === selectedId && tab === 'edit'}>
          <button type="button" class="sv-bauto-pick" onclick={() => { selectedId = a.id; tab = 'edit' }}>
            <span class="sv-bauto-name">{a.name || 'Untitled'}</span>
            <span class="sv-bauto-when">{triggerText(table, a)}</span>
          </button>
          <SvSwitchButton
            checked={a.enabled}
            ariaLabel={`${a.name} on`}
            onChange={(on: boolean) => save(list.map((x) => (x.id === a.id ? { ...x, enabled: on } : x)))}
          />
        </div>
      {:else}
        <p class="sv-bauto-empty">No automations yet. An automation does something when a record is added, changes or matches a condition.</p>
      {/each}
      <div class="sv-bauto-list-foot">
        <button type="button" class="sv-fvb-text-btn" onclick={add}>+ New automation</button>
        <button type="button" class="sv-bauto-runs-btn" class:is-on={tab === 'runs'} onclick={showRuns}>
          Runs{#if allRuns.length}<span class="sv-bauto-count">{allRuns.length}</span>{/if}
        </button>
      </div>
    </aside>

    <section class="sv-bauto-main">
      {#if tab === 'runs'}
        <header class="sv-bauto-runs-head">
          <h3>Runs</h3>
          {#if runner.runs.length}<button type="button" class="sv-fvb-text-btn" onclick={() => runner.clearRuns()}>Clear this page's runs</button>{/if}
        </header>
        {#if serverError}<p class="sv-bauto-hint sv-bauto-bad">The server's runs did not load: {serverError}</p>{/if}
        {#each allRuns as run (`${run.side}-${run.id}`)}
          <article class="sv-bauto-run" data-status={run.status}>
            <div class="sv-bauto-run-head">
              <span class="sv-bauto-status">{run.status === 'ok' ? 'Done' : run.status === 'error' ? 'Failed' : 'Stopped'}</span>
              <strong>{run.name}</strong>
              {#if run.record}<span class="sv-bauto-muted">on {run.record}</span>{/if}
              {#if run.table !== table.name}<span class="sv-bauto-muted">in {run.table}</span>{/if}
              {#if run.side === 'server'}<span class="sv-bauto-tag">Server</span>{/if}
              <span class="sv-bauto-muted sv-bauto-time">{time(run.at)}</span>
            </div>
            <ul>
              {#each run.steps as s, i (i)}
                <li class:is-error={!!s.error}><span>{s.action}</span> {s.error ?? s.detail}</li>
              {/each}
            </ul>
          </article>
        {:else}
          <p class="sv-bauto-empty">Nothing has run yet. Runs show here with what each action did.</p>
        {/each}
      {:else if selected}
        {@const a = selected}
        <div class="sv-bauto-head">
          <label class="sv-bauto-field">
            <span>Name</span>
            <input class="sv-fvb-input" value={a.name} onchange={(e) => patch({ name: e.currentTarget.value })} />
          </label>
          <label class="sv-bauto-field">
            <span>Runs in</span>
            <select class="sv-fvb-select" value={a.runOn ?? 'browser'} onchange={(e) => patch({ runOn: e.currentTarget.value === 'server' ? 'server' : undefined })}>
              <option value="browser">This browser</option>
              <option value="server">The server</option>
            </select>
          </label>
        </div>
        <p class="sv-bauto-hint">
          {a.runOn === 'server'
            ? 'Your server runs it (createAutomationServer): it hears changes from the database, whoever made them, reads secrets and sends email.'
            : 'It runs in the browser of the person who makes the change, right away.'}
        </p>

        <div class="sv-bauto-step">
          <h4><span class="sv-bauto-badge">When</span></h4>
          <select class="sv-fvb-select" aria-label="Trigger" value={a.trigger.type} onchange={(e) => setTrigger(e.currentTarget.value as AutomationTrigger['type'])}>
            {#each TRIGGERS as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
          </select>
          {#if a.trigger.type === 'recordUpdated'}
            {@const watched = new Set(a.trigger.fields ?? [])}
            <p class="sv-bauto-hint">{watched.size ? 'Only when one of these fields changes:' : 'Any field. Pick fields to watch only those:'}</p>
            <div class="sv-bauto-chips">
              {#each writable(table) as c (c.id)}
                <button type="button" class="sv-bauto-chip" class:is-on={watched.has(c.id)} aria-pressed={watched.has(c.id)} onclick={() => toggleWatched(c.id)}>{c.header}</button>
              {/each}
            </div>
          {:else if a.trigger.type === 'formSubmitted'}
            <select class="sv-fvb-select" aria-label="Form" value={a.trigger.view ?? ''} onchange={(e) => patch({ trigger: { type: 'formSubmitted', ...(e.currentTarget.value ? { view: e.currentTarget.value } : {}) } })}>
              <option value="">Any form of this table</option>
              {#each forms as v (v.id)}<option value={v.id}>{v.name}</option>{/each}
            </select>
          {:else if a.trigger.type === 'button'}
            {#if buttons.length}
              <select class="sv-fvb-select" aria-label="Button field" value={a.trigger.field} onchange={(e) => patch({ trigger: { type: 'button', field: e.currentTarget.value } })}>
                {#each buttons as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
              </select>
            {:else}
              <p class="sv-bauto-hint">Add a Button field to the table first.</p>
            {/if}
          {:else if a.trigger.type === 'scheduled'}
            {@const cron = a.trigger.cron}
            <select class="sv-fvb-select" aria-label="Schedule" value={CRON_PRESETS.some((p) => p.cron === cron) ? cron : ''} onchange={(e) => e.currentTarget.value && patch({ trigger: { type: 'scheduled', cron: e.currentTarget.value } })}>
              {#each CRON_PRESETS as p (p.cron)}<option value={p.cron}>{p.label}</option>{/each}
              <option value="">Custom</option>
            </select>
            <input class="sv-fvb-input sv-bauto-mono sv-bauto-cron" aria-label="Cron expression" value={cron} onchange={(e) => patch({ trigger: { type: 'scheduled', cron: e.currentTarget.value.trim() } })} />
            <p class="sv-bauto-hint">Runs while the base is open in a browser. With a condition, it runs once for each record that matches at that time.</p>
          {/if}
        </div>

        <div class="sv-bauto-step">
          <h4><span class="sv-bauto-badge">{a.trigger.type === 'recordMatches' ? 'Condition' : 'Only for records where'}</span></h4>
          <FilterPanel
            {ctrl}
            value={a.condition ?? EMPTY}
            onChange={setCondition}
            title={a.trigger.type === 'recordMatches' ? 'Runs when a record starts to match' : ''}
            empty={a.trigger.type === 'recordMatches' ? 'Add the condition a record has to start matching.' : 'Every record. Add a condition to narrow it.'}
          />
        </div>

        <div class="sv-bauto-step">
          <h4><span class="sv-bauto-badge">Do</span></h4>
          {#each a.actions as action, i (i)}
            <div class="sv-bauto-action">
              <div class="sv-bauto-action-head">
                <span class="sv-bauto-n">{i + 1}</span>
                <select class="sv-fvb-select" aria-label="Action" value={actionKey(action)} onchange={(e) => setAction(i, newAction(e.currentTarget.value))}>
                  {#each ACTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
                </select>
                <button type="button" class="sv-fvb-icon-btn" aria-label="Move up" title="Move up" disabled={i === 0} onclick={() => moveAction(i, -1)}>↑</button>
                <button type="button" class="sv-fvb-icon-btn" aria-label="Move down" title="Move down" disabled={i === a.actions.length - 1} onclick={() => moveAction(i, 1)}>↓</button>
                <button type="button" class="sv-fvb-icon-btn" aria-label="Remove action" title="Remove action" onclick={() => setAction(i, null)}>×</button>
              </div>

              {#if action.type === 'notify'}
                <div class="sv-bauto-row">
                  <input class="sv-fvb-input" aria-label="Message" value={action.message} placeholder={`{${fields[0]?.header ?? 'Name'}} needs a look`} onchange={(e) => setAction(i, { ...action, message: e.currentTarget.value })} />
                  <select class="sv-fvb-select sv-bauto-narrow" aria-label="Kind" value={action.severity ?? 'info'} onchange={(e) => setAction(i, { ...action, severity: e.currentTarget.value as 'info' })}>
                    <option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option>
                  </select>
                </div>
                <p class="sv-bauto-hint">Name a field in braces for its value: {fields.slice(0, 3).map((c) => `{${c.header}}`).join(', ')}.</p>
              {:else if action.type === 'highlight'}
                {#if a.trigger.type !== 'recordMatches' && !a.condition}
                  <p class="sv-bauto-hint">Colors records while they match the condition above; add one.</p>
                {/if}
                <div class="sv-bauto-row">
                  <label class="sv-bauto-color">Fill <input type="color" value={action.background} onchange={(e) => setAction(i, { ...action, background: e.currentTarget.value })} /></label>
                  <label class="sv-bauto-color">Text <input type="color" value={action.color ?? '#0f172a'} onchange={(e) => setAction(i, { ...action, color: e.currentTarget.value })} /></label>
                  <span class="sv-bauto-sample" style:background={action.background} style:color={action.color}>Sample</span>
                </div>
                <div class="sv-bauto-chips">
                  <button type="button" class="sv-bauto-chip" class:is-on={!action.fields?.length} onclick={() => setAction(i, { ...action, fields: [] })}>Whole row</button>
                  {#each fields as c (c.id)}
                    {@const on = action.fields?.includes(c.id) ?? false}
                    <button type="button" class="sv-bauto-chip" class:is-on={on} aria-pressed={on} onclick={() => setAction(i, { ...action, fields: on ? (action.fields ?? []).filter((x) => x !== c.id) : [...(action.fields ?? []), c.id] })}>{c.header}</button>
                  {/each}
                </div>
              {:else if action.type === 'updateRecord' || action.type === 'createRecord'}
                {@const target = action.type === 'createRecord' ? tables.find((x) => x.id === action.table) : table}
                {#if action.type === 'createRecord'}
                  <div class="sv-bauto-row">
                    <span class="sv-bauto-label">In</span>
                    <select class="sv-fvb-select" aria-label="Table" value={action.table} onchange={(e) => setAction(i, { type: 'createRecord', table: e.currentTarget.value, values: {} })}>
                      {#each tables as x (x.id)}<option value={x.id}>{x.name}</option>{/each}
                    </select>
                  </div>
                  {@const links = fieldsOf(target).filter((c) => c.fieldType === 'link' && c.def.fieldProps?.table === table.id)}
                  {#if links.length}
                    <div class="sv-bauto-row">
                      <span class="sv-bauto-label">Link it back</span>
                      <select class="sv-fvb-select" aria-label="Link field" value={action.linkField ?? ''} onchange={(e) => setAction(i, { ...action, linkField: e.currentTarget.value || undefined })}>
                        <option value="">No link</option>
                        {#each links as c (c.id)}<option value={c.id}>through {c.header}</option>{/each}
                      </select>
                    </div>
                  {/if}
                {/if}
                {#each Object.entries(action.values) as [id, value] (id)}
                  {@const c = tableFields(target ?? table).get(id)}
                  {#if c}
                    <div class="sv-bauto-row">
                      <span class="sv-bauto-label">{c.header}</span>
                      <input
                        class="sv-fvb-input"
                        aria-label={`${c.header} value`}
                        list={`sv-bauto-${i}-${id}`}
                        value={typeof value === 'string' ? value : JSON.stringify(value)}
                        placeholder={PLACEHOLDER[String(c.fieldType)] ?? 'a value, or {Field}'}
                        onchange={(e) => setValue(i, action.values, id, e.currentTarget.value)}
                      />
                      <datalist id={`sv-bauto-${i}-${id}`}>{#each suggestions(target, c) as s (s)}<option value={s}></option>{/each}</datalist>
                      <button type="button" class="sv-fvb-icon-btn" aria-label={`Do not set ${c.header}`} title="Remove" onclick={() => dropValue(i, id)}>×</button>
                    </div>
                  {/if}
                {/each}
                {@const free = writable(target).filter((c) => !(c.id in action.values) && !(action.type === 'createRecord' && c.id === action.linkField))}
                {#if free.length}
                  <select class="sv-fvb-select sv-bauto-add" aria-label="Set a field" value="" onchange={(e) => { if (e.currentTarget.value) setValue(i, action.values, e.currentTarget.value, '') }}>
                    <option value="">+ Set a field</option>
                    {#each free as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
                  </select>
                {/if}
              {:else if action.type === 'run'}
                <p class="sv-bauto-hint">Runs <code>{action.action}</code>, an action the app registered.</p>
              {:else if action.type === 'webhook'}
                <div class="sv-bauto-row">
                  <select class="sv-fvb-select sv-bauto-narrow" aria-label="Method" value={action.method ?? 'POST'} onchange={(e) => setAction(i, { ...action, method: e.currentTarget.value as 'POST' })}>
                    <option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option>
                  </select>
                  <input class="sv-fvb-input sv-bauto-mono" aria-label="URL" value={action.url} placeholder={'https://hooks.example.com/{secret:HOOK_ID}'} onchange={(e) => setAction(i, { ...action, url: e.currentTarget.value.trim() })} />
                </div>
                <textarea class="sv-fvb-input sv-bauto-text sv-bauto-mono" aria-label="Headers" rows="2" placeholder={'Authorization: Bearer {secret:API_KEY}'} value={headerText(action.headers)} onchange={(e) => setAction(i, { ...action, headers: parseHeaders(e.currentTarget.value) })}></textarea>
                <textarea class="sv-fvb-input sv-bauto-text sv-bauto-mono" aria-label="Body" rows="3" placeholder={'{"text": "{' + (fields[0]?.header ?? 'Name') + '} needs a look"}'} value={action.body ?? ''} onchange={(e) => setAction(i, { ...action, body: e.currentTarget.value })}></textarea>
                <p class="sv-bauto-hint">Empty body: the record as JSON. <code>{'{secret:NAME}'}</code> is read on the server only{a.runOn === 'server' ? '' : '; set Runs in to The server to use one'}.</p>
              {:else if action.type === 'email'}
                {#if a.runOn !== 'server'}<p class="sv-bauto-hint sv-bauto-bad">Email is sent by the server: set Runs in to The server.</p>{/if}
                <div class="sv-bauto-row"><span class="sv-bauto-label">To</span><input class="sv-fvb-input" aria-label="To" value={action.to} placeholder="team@example.com, {'{'}Owner email{'}'}" onchange={(e) => setAction(i, { ...action, to: e.currentTarget.value })} /></div>
                <div class="sv-bauto-row"><span class="sv-bauto-label">Subject</span><input class="sv-fvb-input" aria-label="Subject" value={action.subject} onchange={(e) => setAction(i, { ...action, subject: e.currentTarget.value })} /></div>
                <textarea class="sv-fvb-input sv-bauto-text" aria-label="Email text" rows="3" value={action.body} onchange={(e) => setAction(i, { ...action, body: e.currentTarget.value })}></textarea>
              {/if}
            </div>
          {/each}
          <select class="sv-fvb-select sv-bauto-add" aria-label="Add an action" value="" onchange={(e) => { if (e.currentTarget.value) patch({ actions: [...a.actions, newAction(e.currentTarget.value)] }) }}>
            <option value="">+ Add an action</option>
            {#each ACTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
          </select>
        </div>

        <footer class="sv-bauto-foot">
          {#if deleting === a.id}
            <span class="sv-bauto-hint">Delete it?</span>
            <button type="button" class="sv-bauto-danger" onclick={() => { deleting = null; remove(a.id) }}>Delete</button>
            <button type="button" class="sv-fvb-text-btn" onclick={() => (deleting = null)}>Keep</button>
          {:else}
            <button type="button" class="sv-bauto-danger" onclick={() => (deleting = a.id)}>Delete automation</button>
          {/if}
          <span class="sv-bauto-spacer"></span>
          {#if a.runOn === 'server'}
            <span class="sv-bauto-hint">Runs on your server when its trigger happens.</span>
          {:else}
            <select class="sv-fvb-select sv-bauto-try" aria-label="Record to try it on" bind:value={tryRecord}>
              {#if a.trigger.type === 'scheduled'}<option value="">No record</option>{/if}
              {#each records as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
            </select>
            <button type="button" class="sv-fvb-solid-btn" onclick={tryNow}>Run now</button>
          {/if}
        </footer>
      {:else}
        <p class="sv-bauto-empty">Pick an automation, or add one.</p>
      {/if}
    </section>
  </div>
</SvModal>

<style>
  .sv-bauto { display: grid; grid-template-columns: 270px minmax(0, 1fr); min-height: 520px; max-height: 72vh; font-size: 13px; }
  @media (max-width: 760px) { .sv-bauto { grid-template-columns: 1fr; } }
  .sv-bauto-list { display: flex; flex-direction: column; gap: 2px; padding: 10px; overflow: auto; border-right: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-header-bg, transparent); }
  .sv-bauto-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 4px; border-radius: 8px; }
  .sv-bauto-item.is-on { background: color-mix(in srgb, var(--sg-accent, #2563eb) 12%, transparent); }
  .sv-bauto-pick { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 6px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 6px; }
  .sv-bauto-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-bauto-when { font-size: 12px; color: var(--sg-muted, #64748b); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sv-bauto-list-foot { margin-top: auto; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-bauto-runs-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px; background: none; color: inherit; font: inherit; cursor: pointer; }
  .sv-bauto-runs-btn.is-on { border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb); }
  .sv-bauto-count { min-width: 18px; padding: 0 5px; border-radius: 999px; font-size: 11px; font-weight: 700; background: color-mix(in srgb, var(--sg-fg, #0f172a) 10%, transparent); text-align: center; }
  .sv-bauto-main { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; overflow: auto; min-width: 0; }
  .sv-bauto-head { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 12px; max-width: 620px; }
  .sv-bauto-field { display: grid; gap: 4px; }
  .sv-bauto-text { width: 100%; height: auto; padding: 6px; resize: vertical; line-height: 1.4; }
  .sv-bauto-bad { color: var(--sg-danger, #dc2626); }
  .sv-bauto-tag { font-size: 11px; font-weight: 600; padding: 0 6px; border-radius: 4px; border: 1px solid var(--sg-border, #cbd5e1); color: var(--sg-muted, #64748b); }
  .sv-bauto-field > span, .sv-bauto-label { color: var(--sg-muted, #64748b); font-size: 12px; }
  .sv-bauto-step { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; }
  .sv-bauto-step h4 { margin: 0; }
  .sv-bauto-badge { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .sv-bauto-step > .sv-fvb-select { max-width: 340px; }
  .sv-bauto-hint { margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-bauto-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sv-bauto-chip { height: 26px; padding: 0 10px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 999px; background: none; color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
  .sv-bauto-chip.is-on { border-color: var(--sg-accent, #2563eb); background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent); }
  .sv-bauto-action { display: grid; gap: 8px; padding: 10px; border-radius: 8px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, transparent); }
  .sv-bauto-action-head { display: grid; grid-template-columns: 22px minmax(0, 300px) 26px 26px 26px; gap: 6px; align-items: center; }
  .sv-bauto-n { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 700; background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); }
  .sv-bauto-row { display: flex; align-items: center; gap: 8px; }
  .sv-bauto-row > .sv-bauto-label { flex: 0 0 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-bauto-row > .sv-fvb-input { flex: 1; }
  .sv-bauto-narrow { flex: 0 0 110px; width: 110px; }
  .sv-bauto-add { max-width: 220px; }
  .sv-bauto-color { display: inline-flex; align-items: center; gap: 6px; color: var(--sg-muted, #64748b); }
  .sv-bauto-color input { width: 32px; height: 24px; padding: 0; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 4px; background: none; }
  .sv-bauto-sample { padding: 2px 10px; border-radius: 4px; font-size: 12px; }
  .sv-bauto-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .sv-bauto-cron { max-width: 220px; }
  .sv-bauto-foot { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
  .sv-bauto-spacer { flex: 1; }
  .sv-bauto-try { width: 220px; }
  .sv-bauto-danger { border: 0; background: none; padding: 0; font: inherit; color: var(--sg-danger, #dc2626); cursor: pointer; }
  .sv-bauto-danger:hover { text-decoration: underline; }
  .sv-bauto-empty { margin: 8px 4px; color: var(--sg-muted, #64748b); }
  .sv-bauto-runs-head { display: flex; align-items: center; justify-content: space-between; }
  .sv-bauto-runs-head h3 { margin: 0; font-size: 15px; }
  .sv-bauto-run { padding: 10px 12px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; }
  .sv-bauto-run-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .sv-bauto-status { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; color: #fff; background: var(--sg-success, #16a34a); }
  .sv-bauto-run[data-status='error'] .sv-bauto-status { background: var(--sg-danger, #dc2626); }
  .sv-bauto-run[data-status='stopped'] .sv-bauto-status { background: var(--sg-warning, #d97706); }
  .sv-bauto-muted { color: var(--sg-muted, #64748b); }
  .sv-bauto-time { margin-left: auto; font-variant-numeric: tabular-nums; }
  .sv-bauto-run ul { margin: 6px 0 0; padding-left: 18px; }
  .sv-bauto-run li > span { font-weight: 600; }
  .sv-bauto-run li.is-error { color: var(--sg-danger, #dc2626); }
</style>
