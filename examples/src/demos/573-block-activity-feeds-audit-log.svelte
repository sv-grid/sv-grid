<script lang="ts" module>
  /**
   * Audit log block - a compact security log grouped by day: time, actor,
   * action (SvBadge), target and source IP per row. Two SvDropDownList filters
   * narrow it by actor and by action, with a clear button and an empty state.
   * Rows that changed settings expand to a before / after diff of each field.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createAuditLog() below owns the actor and action filters, the
   * day grouping, the expanded rows and the time formatting with no markup.
   * The component under it is one styled render of that core; import
   * createAuditLog from this file (or `npx @svgrid/ui add
   * activity-feeds-audit-log --headless` for the core alone) to draw your own.
   */
  export type AuditAction = 'created' | 'updated' | 'deleted' | 'signed in' | 'exported'
  export type AuditChange = { field: string; before: string; after: string }
  export type AuditEntry = { id: number; at: number; actor: string; action: AuditAction; target: string; ip: string; changes?: AuditChange[] }
  export type AuditLogOptions = {
    /** One clock for the whole log: every relative time is measured from here. */
    now?: number
    entries?: AuditEntry[]
    /** Rows expanded on first render. */
    expanded?: number[]
    /** Export the rows the filters leave. */
    onExport?: (rows: AuditEntry[]) => void
  }

  export const AUDIT_ACTIONS: AuditAction[] = ['created', 'updated', 'deleted', 'signed in', 'exported']

  // Sample timestamps: `ago` is minutes before now, `on` is a clock time a
  // number of days back.
  function sampleEntries(now: number): AuditEntry[] {
    const ago = (minutes: number) => now - minutes * 60_000
    const on = (daysBack: number, hh: number, mm: number) => {
      const d = new Date(now)
      d.setDate(d.getDate() - daysBack)
      return d.setHours(hh, mm, 0, 0)
    }
    return [
      { id: 1, at: ago(9), actor: 'Ines Duarte', action: 'updated', target: 'Role: Billing admin', ip: '84.21.170.12',
        changes: [{ field: 'invoices.refund', before: 'false', after: 'true' }, { field: 'invoices.export', before: 'false', after: 'true' }] },
      { id: 2, at: ago(31), actor: 'Ines Duarte', action: 'signed in', target: 'Web, Chrome on macOS', ip: '84.21.170.12' },
      { id: 3, at: ago(128), actor: 'Sam Rivera', action: 'exported', target: 'Customers (4,812 rows)', ip: '10.4.0.17' },
      { id: 4, at: ago(205), actor: 'Sam Rivera', action: 'updated', target: 'Workspace: Acme Analytics', ip: '10.4.0.17',
        changes: [{ field: 'session_timeout', before: '12h', after: '8h' }, { field: 'sso_required', before: 'off', after: 'on' }, { field: 'allowed_domains', before: 'acme.io', after: 'acme.io, acme.de' }] },
      { id: 5, at: on(1, 17, 42), actor: 'Leo Brandt', action: 'deleted', target: 'API key ci-deploy-old', ip: '172.16.8.40' },
      { id: 6, at: on(1, 17, 38), actor: 'Leo Brandt', action: 'created', target: 'API key ci-deploy-2026', ip: '172.16.8.40' },
      { id: 7, at: on(1, 9, 15), actor: 'Ines Duarte', action: 'updated', target: 'User: sam@acme.io', ip: '84.21.170.12',
        changes: [{ field: 'role', before: 'Analyst', after: 'Admin' }] },
      { id: 8, at: on(3, 8, 2), actor: 'Sam Rivera', action: 'signed in', target: 'API, token ending 9f2c', ip: '10.4.0.17' },
    ]
  }

  const timeFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  /** "signed in" -> "Signed in". */
  export const actionLabel = (a: string) => a[0]!.toUpperCase() + a.slice(1)

  export function createAuditLog(opts: AuditLogOptions = {}) {
    const now = opts.now ?? Date.now()
    const entries = opts.entries ?? sampleEntries(now)
    const actorOptions = [{ value: 'all', label: 'All actors' }, ...[...new Set(entries.map((e) => e.actor))].map((a) => ({ value: a, label: a }))]
    const actionOptions = [{ value: 'all', label: 'All actions' }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) }))]

    let actor = $state('all')
    let action = $state('all')
    let open = $state<number[]>(opts.expanded ?? [1])

    const filtered = $derived(entries.filter((e) => (actor === 'all' || e.actor === actor) && (action === 'all' || e.action === action)))

    function relative(at: number) {
      const m = Math.round(Math.min(0, at - now) / 60_000)
      if (m > -60) return rtf.format(m, 'minute')
      if (m > -1440) return rtf.format(Math.round(m / 60), 'hour')
      return rtf.format(Math.round(m / 1440), 'day')
    }
    function dayLabel(t: number) {
      const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000)
      return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : dayFmt.format(t)
    }

    // Newest first, one group per calendar day.
    const days = $derived.by(() => {
      const out: { key: number; label: string; rows: AuditEntry[] }[] = []
      for (const e of [...filtered].sort((a, b) => b.at - a.at)) {
        const key = startOfDay(e.at)
        const day = out.at(-1)
        if (day?.key === key) day.rows.push(e)
        else out.push({ key, label: dayLabel(e.at), rows: [e] })
      }
      return out
    })

    const isOpen = (id: number) => open.includes(id)
    const toggle = (id: number) => (open = open.includes(id) ? open.filter((x) => x !== id) : [...open, id])
    function clear() { actor = 'all'; action = 'all' }

    return {
      actorOptions, actionOptions,
      get total() { return entries.length },
      get filtered() { return filtered },
      get days() { return days },
      get actor() { return actor },
      set actor(v: string) { actor = String(v) },
      get action() { return action },
      set action(v: string) { action = String(v) },
      /** True while a filter narrows the log. */
      get narrowed() { return actor !== 'all' || action !== 'all' },
      isOpen,
      toggle,
      clear,
      exportRows: () => opts.onExport?.(filtered),
      relative,
      /** 24-hour clock time, e.g. "17:42". */
      time: (at: number) => timeFmt.format(at),
      /** DOM id of a row's diff table. */
      diffId: (id: number) => `sv-audit-diff-${id}`,
      /** Spread on a row's expand <button>. */
      expandProps: (e: AuditEntry) => ({
        type: 'button' as const,
        'aria-expanded': open.includes(e.id),
        'aria-controls': `sv-audit-diff-${e.id}`,
        'aria-label': `${open.includes(e.id) ? 'Hide' : 'Show'} changes to ${e.target}`,
        onclick: () => toggle(e.id),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvDropDownList, SvBadge, SvButton, SvAvatar, SvToaster, toast } from '@svgrid/grid'

  const BADGE = { created: 'success', updated: 'info', deleted: 'danger', 'signed in': 'neutral', exported: 'warning' } as const

  const log = createAuditLog({ onExport: () => toast('Audit log export queued, we will email a CSV') })
</script>

<section class="sv-audit" aria-labelledby="sv-audit-title">
  <header class="sv-audit-head">
    <div>
      <h2 id="sv-audit-title">Audit log</h2>
      <p class="sv-audit-muted">Acme Analytics workspace, last 7 days · {log.filtered.length} of {log.total} events</p>
    </div>
    <SvButton variant="outline" size="sm" onclick={log.exportRows}>Export CSV</SvButton>
  </header>

  <div class="sv-audit-filters">
    <SvDropDownList label="Actor" options={log.actorOptions} value={log.actor} onChange={(v) => (log.actor = String(v))} size="sm" block />
    <SvDropDownList label="Action" options={log.actionOptions} value={log.action} onChange={(v) => (log.action = String(v))} size="sm" block />
    {#if log.narrowed}
      <SvButton variant="ghost" size="sm" onclick={log.clear}>Clear filters</SvButton>
    {/if}
  </div>

  {#each log.days as day (day.key)}
    <div class="sv-audit-day">
      <h3>{day.label}</h3>
      <ul class="sv-audit-rows">
        {#each day.rows as e (e.id)}
          {@const expanded = log.isOpen(e.id)}
          <li class:sv-audit-expanded={expanded}>
            <div class="sv-audit-row">
              <time datetime={new Date(e.at).toISOString()} title={log.relative(e.at)}>{log.time(e.at)}</time>
              <span class="sv-audit-actor"><SvAvatar name={e.actor} size={22} />{e.actor}</span>
              <span class="sv-audit-action"><SvBadge size="sm" variant={BADGE[e.action]}>{actionLabel(e.action)}</SvBadge></span>
              <span class="sv-audit-target">{e.target}</span>
              <code class="sv-audit-ip">{e.ip}</code>
              {#if e.changes}
                <button class="sv-audit-expand" {...log.expandProps(e)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                </button>
              {/if}
            </div>
            {#if e.changes && expanded}
              <table class="sv-audit-diff" id={log.diffId(e.id)}>
                <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
                <tbody>
                  {#each e.changes as c (c.field)}
                    <tr><th scope="row"><code>{c.field}</code></th><td><del>{c.before}</del></td><td><ins>{c.after}</ins></td></tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <div class="sv-audit-empty">
      <p><strong>No events match these filters</strong></p>
      <SvButton variant="outline" size="sm" onclick={log.clear}>Clear filters</SvButton>
    </div>
  {/each}
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-audit {
    width: 100%; box-sizing: border-box; max-width: 900px; margin: 0 auto; padding: 28px 28px 32px; min-height: 560px;
    display: flex; flex-direction: column; gap: 18px;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); font-family: var(--sg-font, inherit);
  }
  .sv-audit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .sv-audit-head h2 { margin: 0 0 4px; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-audit-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-audit-filters { display: grid; grid-template-columns: 200px 200px auto; align-items: end; justify-content: start; gap: 12px; }
  .sv-audit-day h3 { margin: 0 0 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--sg-muted, #64748b); }
  .sv-audit-rows { list-style: none; margin: 0; padding: 0; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); overflow: hidden; }
  .sv-audit-rows li { display: flow-root; }
  .sv-audit-rows li + li { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-audit-rows li:hover, .sv-audit-rows li.sv-audit-expanded { background: var(--sg-row-hover-bg, #f8fafc); }
  .sv-audit-row {
    display: grid; grid-template-columns: 48px 150px 92px minmax(0, 1fr) 112px 28px; align-items: center; gap: 12px;
    min-height: 40px; padding: 4px 10px 4px 14px; font-size: 13px;
  }
  time { font-variant-numeric: tabular-nums; color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .sv-audit-actor { display: inline-flex; align-items: center; gap: 8px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  .sv-audit-target { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
  .sv-audit-ip { color: var(--sg-muted, #64748b); }
  .sv-audit-expand {
    grid-column: 6; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--sg-radius, 6px);
    background: none; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-audit-expand svg { display: block; transition: transform .15s; }
  .sv-audit-expand[aria-expanded='true'] svg { transform: rotate(90deg); }
  .sv-audit-expand:hover { color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); }
  .sv-audit-expand:focus-visible { outline: 2px solid var(--sg-focus-ring, #6366f1); outline-offset: -2px; }
  .sv-audit-diff { width: calc(100% - 28px); margin: 2px 14px 12px; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
  .sv-audit-diff th, .sv-audit-diff td { padding: 6px 10px; text-align: left; border-top: 1px solid var(--sg-border, #e2e8f0); overflow-wrap: anywhere; }
  .sv-audit-diff thead th { border-top: 0; font-size: 11.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-audit-diff tbody th { font-weight: 400; }
  del, ins { text-decoration: none; padding: 1px 6px; border-radius: 4px; }
  del { background: color-mix(in srgb, var(--sg-danger, #dc2626) 14%, transparent); }
  ins { background: color-mix(in srgb, var(--sg-success, #16a34a) 16%, transparent); }
  .sv-audit-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 16px; border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); }
  .sv-audit-empty p { margin: 0; font-size: 14px; }

  @media (max-width: 720px) {
    .sv-audit { padding: 20px 16px 24px; }
    .sv-audit-head { flex-direction: column; }
    .sv-audit-filters { grid-template-columns: 1fr 1fr; }
    .sv-audit-row { grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 10px; padding: 8px 8px 8px 12px; }
    .sv-audit-row time { grid-row: 1; grid-column: 1; }
    .sv-audit-actor { grid-row: 1; grid-column: 2; }
    .sv-audit-action { grid-row: 1; grid-column: 3; }
    .sv-audit-target { grid-row: 2; grid-column: 1 / 3; white-space: normal; }
    .sv-audit-ip { grid-row: 3; grid-column: 1 / 3; }
    .sv-audit-expand { grid-row: 2 / 4; grid-column: 3; justify-self: end; }
    .sv-audit-diff { width: calc(100% - 16px); margin: 0 8px 10px; }
    .sv-audit-diff th, .sv-audit-diff td { padding: 6px; }
    .sv-audit-diff thead th:first-child { width: 44%; }
  }
</style>
