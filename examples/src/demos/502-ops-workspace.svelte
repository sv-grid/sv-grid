<script lang="ts">
  /**
   * 502. Ops workspace (app template)
   * ---------------------------------
   * An on-call workspace on SvDockManager. Panes: a live service grid,
   * p50 / p95 / p99 latency and error charts for the selected service, an
   * incident board (Board or Table over the same SvGrid), deploys, on-call and
   * an alert feed. Every pane drags, tabs, floats and auto-hides, and the
   * arrangement saves to localStorage.
   *
   * The panes run one incident loop, the way a real on-call tool does:
   *   1. A deploy goes out (progress, then live) and the service degrades.
   *   2. An alert rule fires: the row tints, the feed logs it, an incident
   *      opens in Triage and the team's primary is paged.
   *   3. The primary acknowledges; the incident's timeline records each step.
   *   4. Rolling back the deploy recovers the service and moves the incident
   *      to Mitigated; resolve it from the incident drawer.
   * A scripted bad deploy runs the loop a few seconds after load; Inject
   * failure runs it again on the selected service.
   *
   * Dock layout, grid, charts, drawer: @svgrid/grid.
   * Alert rules, Kanban board renderer, export: @svgrid/enterprise.
   */
  import { untrack } from 'svelte'
  import {
    SvGrid,
    SvDockManager,
    SvChart,
    SvDrawer,
    SvMenu,
    SvAvatar,
    SvToaster,
    toast,
    renderSnippet,
    dockGroup,
    dockTabs,
    dockPane,
    type ColumnDef,
    type ChartSpec,
    type DockManagerState,
    type MenuItem,
    type SvGridApi,
    type BoardCardMoveEvent,
  } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import {
    SvGridAlerts,
    alertStore,
    enableAlerts,
    enableBoardView,
    installEnterprise,
    type AlertEvent,
    type AlertRule,
    type EnterpriseGridApi,
    type ExportColumn,
    type ExportFormat,
    type ExprColumn,
  } from '@svgrid/enterprise'

  enableAlerts()
  enableBoardView()

  // ---- Domain ---------------------------------------------------------------
  type Status = 'healthy' | 'degraded' | 'down'
  type Service = {
    id: string
    name: string
    team: string
    tier: 'P0' | 'P1' | 'P2'
    region: string
    rps: number
    p95: number
    errorPct: number
    cpu: number
    version: string
    status: Status
    p95History: number[]
  }
  type Baseline = { p95: number; rps: number; err: number; cpu: number }
  type IncStatus = 'triage' | 'investigating' | 'mitigated' | 'resolved'
  type Severity = 'SEV1' | 'SEV2' | 'SEV3'
  type TimelineEntry = { at: number; who: string; text: string; kind: 'open' | 'status' | 'sev' | 'page' | 'ack' | 'note' | 'deploy' }
  type Incident = {
    id: string
    title: string
    service: string
    severity: Severity
    status: IncStatus
    commander: string
    opened: string
    source: 'alert' | 'manual'
    timeline: TimelineEntry[]
  }
  type Deploy = {
    id: number
    service: string
    version: string
    from: string
    author: string
    at: number
    sha: string
    message: string
    kind: 'deploy' | 'rollback'
    state: 'deploying' | 'live'
    progress: number
    rolledBack?: boolean
    /** A bad deploy turns its service sour once it is live. */
    chaos?: Chaos['kind']
  }
  type Chaos = { kind: 'latency' | 'errors'; ticks: number }

  const SLO_P95 = 800
  const ERROR_LIMIT = 5
  const HISTORY = 40
  const TICK_MS = 1500
  const ME = 'Robin Hale'

  const ROTA: Record<string, { primary: string; secondary: string; until: number }> = {
    Payments: { primary: 'Priya Nair', secondary: 'Leo Marsh', until: 18 },
    Platform: { primary: 'Owen Bradley', secondary: 'Ana Ruiz', until: 20 },
    Growth: { primary: 'Grace Kim', secondary: 'Tom Haas', until: 17 },
    Search: { primary: 'Sam Ortiz', secondary: 'Ivy Okafor', until: 19 },
    Data: { primary: 'Mia Chen', secondary: 'Lena Fischer', until: 18 },
  }
  const PEOPLE = [ME, ...Object.values(ROTA).flatMap((r) => [r.primary, r.secondary])]

  const SEED: Array<Omit<Service, 'rps' | 'p95' | 'errorPct' | 'cpu' | 'status' | 'p95History'> & Baseline> = [
    { id: 'checkout-api', name: 'checkout-api', team: 'Payments', tier: 'P0', region: 'us-east', version: 'v2.13.4', p95: 310, rps: 1840, err: 0.4, cpu: 52 },
    { id: 'payments-gw', name: 'payments-gw', team: 'Payments', tier: 'P0', region: 'us-east', version: 'v5.2.0', p95: 420, rps: 960, err: 0.6, cpu: 47 },
    { id: 'auth', name: 'auth', team: 'Platform', tier: 'P0', region: 'global', version: 'v8.0.3', p95: 95, rps: 5200, err: 0.1, cpu: 38 },
    { id: 'edge-proxy', name: 'edge-proxy', team: 'Platform', tier: 'P0', region: 'global', version: 'v1.31.0', p95: 42, rps: 14800, err: 0.05, cpu: 61 },
    { id: 'catalog', name: 'catalog', team: 'Growth', tier: 'P1', region: 'eu-west', version: 'v3.9.1', p95: 180, rps: 3100, err: 0.3, cpu: 44 },
    { id: 'search', name: 'search', team: 'Search', tier: 'P1', region: 'eu-west', version: 'v12.4.2', p95: 260, rps: 2650, err: 0.5, cpu: 66 },
    { id: 'recommendations', name: 'recommendations', team: 'Growth', tier: 'P2', region: 'eu-west', version: 'v0.18.7', p95: 540, rps: 720, err: 0.8, cpu: 71 },
    { id: 'notifications', name: 'notifications', team: 'Platform', tier: 'P1', region: 'us-west', version: 'v4.4.0', p95: 150, rps: 1300, err: 0.2, cpu: 29 },
    { id: 'orders', name: 'orders', team: 'Payments', tier: 'P0', region: 'us-east', version: 'v6.1.2', p95: 230, rps: 1500, err: 0.3, cpu: 41 },
    { id: 'inventory', name: 'inventory', team: 'Data', tier: 'P1', region: 'us-west', version: 'v2.2.9', p95: 205, rps: 880, err: 0.4, cpu: 35 },
    { id: 'analytics-ingest', name: 'analytics-ingest', team: 'Data', tier: 'P2', region: 'us-west', version: 'v9.0.0', p95: 610, rps: 4100, err: 1.1, cpu: 78 },
    { id: 'media', name: 'media', team: 'Growth', tier: 'P2', region: 'ap-south', version: 'v1.6.3', p95: 330, rps: 640, err: 0.6, cpu: 33 },
  ]
  const base = new Map<string, Baseline>(SEED.map((s) => [s.id, { p95: s.p95, rps: s.rps, err: s.err, cpu: s.cpu }]))
  const teamOf = (serviceId: string) => SEED.find((s) => s.id === serviceId)?.team ?? 'Platform'

  const statusOf = (s: { p95: number; errorPct: number }): Status =>
    s.errorPct > ERROR_LIMIT ? 'down' : s.p95 > SLO_P95 || s.errorPct > 2 ? 'degraded' : 'healthy'
  const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d

  // A seeded random walk, so the first frames look the same every visit.
  let rngState = 7
  const rnd = () => ((rngState = (rngState * 16807) % 2147483647) / 2147483647)
  const shaOf = () => Array.from({ length: 7 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')

  const firstRows: Service[] = SEED.map((s) => {
    const hist = Array.from({ length: HISTORY }, () => round(s.p95 * (0.9 + rnd() * 0.2)))
    const row = { ...s, rps: s.rps, p95: hist[HISTORY - 1]!, errorPct: s.err, cpu: s.cpu, p95History: hist }
    return { ...row, status: statusOf(row) }
  })
  let services = $state.raw<Service[]>(firstRows)
  // Percentile and error histories live beside the rows; the grid has no use for them.
  const p50Hist = new Map<string, number[]>(firstRows.map((s) => [s.id, s.p95History.map((v) => round(v * (0.48 + rnd() * 0.06)))]))
  const p99Hist = new Map<string, number[]>(firstRows.map((s) => [s.id, s.p95History.map((v) => round(v * (1.5 + rnd() * 0.3)))]))
  const errHistory = new Map<string, number[]>(SEED.map((s) => [s.id, Array.from({ length: HISTORY }, () => round(s.err * (0.8 + rnd() * 0.4), 2))]))
  let histVersion = $state(0)
  const chaos = new Map<string, Chaos>()

  // Wall clock for relative times and the UTC readout, so "3m ago" keeps moving.
  let now = $state(Date.now())
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(t)
  })
  const utc = $derived(new Date(now).toISOString().slice(11, 19))

  let paused = $state(false)
  let tickCount = 0
  const hms = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  let clock = $state<string[]>(Array.from({ length: HISTORY }, (_, i) => hms(Date.now() - (HISTORY - 1 - i) * TICK_MS)))

  function tick() {
    if (paused) return
    tickCount++
    // One scripted bad deploy a few seconds in, so the loop runs without a click.
    if (tickCount === 2) ship('checkout-api', 'latency', 'ci-bot', 'Batch tax lookups per cart instead of per line')
    advanceDeploys()
    services = services.map((s) => {
      const b = base.get(s.id)!
      const c = chaos.get(s.id)
      const wobble = () => 1 + (rnd() - 0.5) * 0.18
      let p95 = b.p95 * wobble()
      let errorPct = b.err * (0.7 + rnd() * 0.6)
      let rps = b.rps * wobble()
      let cpu = b.cpu * (0.92 + rnd() * 0.16)
      if (c) {
        const ramp = Math.min(1, (40 - c.ticks) / 4 + 0.25)
        // Additive, so even a 40 ms service crosses the SLO when it breaks.
        if (c.kind === 'latency') { p95 += (900 + rnd() * 600) * ramp; cpu = Math.min(99, cpu * 1.45); errorPct += 1.2 * ramp }
        else { errorPct = 6 + rnd() * 6 * ramp; rps *= 0.82 }
        c.ticks--
        if (c.ticks <= 0) chaos.delete(s.id)
      }
      const next = { ...s, p95: round(p95), errorPct: round(errorPct, 2), rps: round(rps), cpu: round(cpu), p95History: [...s.p95History.slice(1), round(p95)] }
      push(p50Hist, s.id, round(p95 * (0.48 + rnd() * 0.06)))
      push(p99Hist, s.id, round(p95 * (1.5 + rnd() * 0.3)))
      push(errHistory, s.id, next.errorPct)
      return { ...next, status: statusOf(next) }
    })
    histVersion++
    clock = [...clock.slice(1), hms(Date.now())]
  }
  function push(map: Map<string, number[]>, id: string, v: number) {
    const arr = map.get(id)!
    arr.push(v)
    arr.shift()
  }
  $effect(() => {
    const t = setInterval(tick, TICK_MS)
    return () => clearInterval(t)
  })

  // Timers the workspace starts (page acknowledgements); cleared on unmount.
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { timers.delete(t); fn() }, ms)
    timers.add(t)
  }
  $effect(() => () => { for (const t of timers) clearTimeout(t) })

  const ago = (t: number) => {
    const s = Math.max(0, Math.round((now - t) / 1000))
    if (s < 45) return 'just now'
    const m = Math.round(s / 60)
    return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`
  }
  const age = (iso: string) => {
    const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
    return m < 1 ? 'now' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }
  const clockTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // ---- Deploys ----------------------------------------------------------------
  let deploySeq = 0
  const minutesAgo = (m: number) => Date.now() - m * 60_000
  const liveDeploy = (d: Omit<Deploy, 'id' | 'kind' | 'state' | 'progress' | 'sha'>): Deploy => ({ id: ++deploySeq, kind: 'deploy', state: 'live', progress: 100, sha: shaOf(), ...d })
  let deploys = $state<Deploy[]>([
    liveDeploy({ service: 'search', version: 'v12.4.2', from: 'v12.4.1', author: 'sam', at: minutesAgo(38), message: 'Cache facet counts per shard' }),
    liveDeploy({ service: 'auth', version: 'v8.0.3', from: 'v8.0.2', author: 'owen', at: minutesAgo(95), message: 'Rotate signing keys without dropping sessions' }),
    liveDeploy({ service: 'catalog', version: 'v3.9.1', from: 'v3.9.0', author: 'grace', at: minutesAgo(160), message: 'Variant images served from the CDN' }),
    liveDeploy({ service: 'orders', version: 'v6.1.2', from: 'v6.1.1', author: 'priya', at: minutesAgo(240), message: 'Idempotency keys on order create' }),
  ])
  const bump = (v: string) => v.replace(/(\d+)$/, (n) => String(Number(n) + 1))

  /** A deploy: three ticks of progress, then live. A bad one turns its service sour. */
  function ship(id: string, kind: Chaos['kind'] | undefined, author: string, message: string) {
    const s = services.find((x) => x.id === id)
    if (!s) return
    const pending = deploys.find((d) => d.service === id && d.state === 'deploying')
    if (pending) return
    deploys = [{ id: ++deploySeq, service: id, version: bump(s.version), from: s.version, author, at: Date.now(), sha: shaOf(), message, kind: 'deploy', state: 'deploying', progress: 8, chaos: kind }, ...deploys]
  }
  function advanceDeploys() {
    if (!deploys.some((d) => d.state === 'deploying')) return
    deploys = deploys.map((d) => {
      if (d.state !== 'deploying') return d
      const progress = Math.min(100, d.progress + 34)
      if (progress < 100) return { ...d, progress }
      services = services.map((x) => (x.id === d.service ? { ...x, version: d.version } : x))
      if (d.chaos) chaos.set(d.service, { kind: d.chaos, ticks: 40 })
      untrack(() => toast(`${d.service} ${d.version} is live`, { title: 'Deploy finished' }))
      return { ...d, progress: 100, state: 'live' as const, at: Date.now() }
    })
  }

  /** Only the newest live entry per service can be undone, and only a deploy. */
  const latestEntry = $derived(deploys.reduceRight((m, d) => m.set(d.service, d.id), new Map<string, number>()))
  const canRollback = (d: Deploy) => d.kind === 'deploy' && d.state === 'live' && latestEntry.get(d.service) === d.id
  function rollback(d: Deploy) {
    chaos.delete(d.service)
    services = services.map((x) => (x.id === d.service ? { ...x, version: d.from } : x))
    deploys = [
      { id: ++deploySeq, service: d.service, version: d.from, from: d.version, author: 'you', at: Date.now(), sha: d.sha, message: `Revert "${d.message}"`, kind: 'rollback', state: 'live', progress: 100 },
      ...deploys.map((x) => (x.id === d.id ? { ...x, rolledBack: true } : x)),
    ]
    const moved = incidents.filter((i) => i.service === d.service && (i.status === 'triage' || i.status === 'investigating'))
    for (const i of incidents.filter((x) => x.service === d.service && x.status !== 'resolved')) log(i.id, ME, `Rolled back ${d.service} to ${d.from}`, 'deploy')
    for (const i of moved) setStatus(i.id, 'mitigated', ME)
    toast.success(`${d.service} rolled back to ${d.from}${moved.length ? `; ${moved.map((i) => i.id).join(', ')} moved to Mitigated` : ''}`)
  }

  // ---- Incidents ----------------------------------------------------------------
  let incSeq = 1040
  const isoAgo = (m: number) => new Date(minutesAgo(m)).toISOString()
  const STATUS_LABEL: Record<IncStatus, string> = { triage: 'Triage', investigating: 'Investigating', mitigated: 'Mitigated', resolved: 'Resolved' }
  let incidents = $state<Incident[]>([
    { id: `INC-${++incSeq}`, title: 'search: slow facet queries in eu-west', service: 'search', severity: 'SEV3', status: 'investigating', commander: 'Sam Ortiz', opened: isoAgo(52), source: 'manual',
      timeline: [
        { at: minutesAgo(52), who: 'Ivy Okafor', text: 'Opened from a support ticket', kind: 'open' },
        { at: minutesAgo(49), who: 'Sam Ortiz', text: 'Took command', kind: 'ack' },
        { at: minutesAgo(31), who: 'Sam Ortiz', text: 'Status: Triage to Investigating', kind: 'status' },
        { at: minutesAgo(18), who: 'Sam Ortiz', text: 'Only shards 3 and 7 are slow; their cache hit rate dropped after the reindex', kind: 'note' },
      ] },
    { id: `INC-${++incSeq}`, title: 'analytics-ingest: consumer lag above 2 min', service: 'analytics-ingest', severity: 'SEV3', status: 'mitigated', commander: 'Mia Chen', opened: isoAgo(130), source: 'alert',
      timeline: [
        { at: minutesAgo(130), who: 'Alert rules', text: 'Opened: consumer lag above 2 min', kind: 'open' },
        { at: minutesAgo(128), who: 'Mia Chen', text: 'Acknowledged the page', kind: 'ack' },
        { at: minutesAgo(96), who: 'Mia Chen', text: 'Scaled consumers from 6 to 10; lag is draining', kind: 'note' },
        { at: minutesAgo(80), who: 'Mia Chen', text: 'Status: Investigating to Mitigated', kind: 'status' },
      ] },
    { id: `INC-${++incSeq}`, title: 'auth: token refresh 401s after rotation', service: 'auth', severity: 'SEV2', status: 'resolved', commander: 'Owen Bradley', opened: isoAgo(400), source: 'alert',
      timeline: [
        { at: minutesAgo(400), who: 'Alert rules', text: 'Opened: error rate over 5%', kind: 'open' },
        { at: minutesAgo(397), who: 'Owen Bradley', text: 'Acknowledged the page', kind: 'ack' },
        { at: minutesAgo(360), who: 'Owen Bradley', text: 'Status: Mitigated to Resolved', kind: 'status' },
      ] },
  ])
  const openIncidents = $derived(incidents.filter((i) => i.status !== 'resolved').length)
  const openSev1 = $derived(incidents.filter((i) => i.status !== 'resolved' && i.severity === 'SEV1').length)

  function log(id: string, who: string, text: string, kind: TimelineEntry['kind']) {
    incidents = incidents.map((i) => (i.id === id ? { ...i, timeline: [...i.timeline, { at: Date.now(), who, text, kind }] } : i))
  }
  function setStatus(id: string, status: IncStatus, who = ME) {
    const inc = incidents.find((i) => i.id === id)
    if (!inc || inc.status === status) return
    log(id, who, `Status: ${STATUS_LABEL[inc.status]} to ${STATUS_LABEL[status]}`, 'status')
    incidents = incidents.map((i) => (i.id === id ? { ...i, status } : i))
  }
  function setSeverity(id: string, severity: Severity, who = ME) {
    const inc = incidents.find((i) => i.id === id)
    if (!inc || inc.severity === severity) return
    log(id, who, `Severity: ${inc.severity} to ${severity}`, 'sev')
    incidents = incidents.map((i) => (i.id === id ? { ...i, severity } : i))
  }
  function setCommander(id: string, commander: string) {
    log(id, ME, `Commander: ${commander}`, 'ack')
    incidents = incidents.map((i) => (i.id === id ? { ...i, commander } : i))
  }
  /** Page a person; they acknowledge a few seconds later, as on-call people do. */
  function page(person: string, team: string, incId?: string) {
    const targets = incId ? [incId] : incidents.filter((i) => i.status !== 'resolved' && teamOf(i.service) === team).map((i) => i.id)
    for (const id of targets) log(id, 'Paging', `Paged ${person} (${team})`, 'page')
    toast(`Paged ${person}`, { title: `${team} on-call` })
    later(4000 + Math.round(rnd() * 3000), () => {
      for (const id of targets) log(id, person, 'Acknowledged the page', 'ack')
      toast.success(`${person} acknowledged`)
    })
  }

  function openIncidentFor(e: AlertEvent) {
    const svc = services.find((s) => s.id === e.rowId)
    if (!svc) return
    const errors = e.ruleId === RULE_ERRORS
    const severity: Severity = svc.tier === 'P0' ? (errors ? 'SEV1' : 'SEV2') : errors ? 'SEV2' : 'SEV3'
    const existing = incidents.find((i) => i.service === svc.id && i.status !== 'resolved')
    if (existing) {
      // Escalate an open incident rather than opening a second one.
      if (severity < existing.severity) {
        setSeverity(existing.id, severity, 'Alert rules')
        toast.warning(`${existing.id} escalated to ${severity}`)
      }
      return
    }
    const rota = ROTA[svc.team]
    const inc: Incident = {
      id: `INC-${++incSeq}`,
      title: errors ? `${svc.name}: error rate above ${ERROR_LIMIT}%` : `${svc.name}: p95 latency over the ${SLO_P95} ms SLO`,
      service: svc.id, severity, status: 'triage', commander: rota?.primary ?? 'Unassigned', opened: new Date().toISOString(), source: 'alert',
      timeline: [{ at: Date.now(), who: 'Alert rules', text: `Opened: ${e.ruleName}`, kind: 'open' }],
    }
    incidents = [inc, ...incidents]
    if (rota) page(rota.primary, svc.team, inc.id)
  }
  function newIncident() {
    const svc = services.find((s) => s.id === selectedId) ?? services[0]!
    const id = `INC-${++incSeq}`
    incidents = [{ id, title: `${svc.name}: reported by support`, service: svc.id, severity: 'SEV3', status: 'triage', commander: ME, opened: new Date().toISOString(), source: 'manual',
      timeline: [{ at: Date.now(), who: ME, text: 'Opened by hand', kind: 'open' }] }, ...incidents]
    drawerId = id
  }
  function onCardMove(e: BoardCardMoveEvent<Incident>) {
    setStatus(e.row.id, e.toLane as IncStatus)
  }

  // ---- Incident drawer --------------------------------------------------------
  let drawerId = $state<string | null>(null)
  const drawerInc = $derived(incidents.find((i) => i.id === drawerId) ?? null)
  const drawerSvc = $derived(drawerInc ? services.find((s) => s.id === drawerInc.service) : undefined)
  const drawerDeploy = $derived(drawerInc ? deploys.find((d) => d.service === drawerInc.service && d.kind === 'deploy') : undefined)
  let note = $state('')
  function addNote() {
    const text = note.trim()
    if (!text || !drawerInc) return
    log(drawerInc.id, ME, text, 'note')
    note = ''
  }

  // ---- Alert rules (Enterprise) ---------------------------------------------
  const RULE_P95 = 'ops-p95-slo'
  const RULE_ERRORS = 'ops-error-rate'
  const OUR_RULES = new Set([RULE_P95, RULE_ERRORS])
  const exprColumns: ExprColumn[] = [
    { id: 'name', name: 'Service', type: 'text' },
    { id: 'team', name: 'Team', type: 'text' },
    { id: 'tier', name: 'Tier', type: 'text' },
    { id: 'region', name: 'Region', type: 'text' },
    { id: 'rps', name: 'Requests / s', type: 'number' },
    { id: 'p95', name: 'p95 latency (ms)', type: 'number' },
    { id: 'errorPct', name: 'Error rate (%)', type: 'number' },
    { id: 'cpu', name: 'CPU (%)', type: 'number' },
  ]
  const seededRules: AlertRule[] = [
    {
      id: RULE_P95, name: `p95 over the ${SLO_P95} ms SLO`, enabled: true, severity: 'warning', scope: 'row',
      predicate: { kind: 'cmp', column: 'p95', op: 'greaterThan', value: SLO_P95 },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'toast', message: '{name}: p95 is {value} ms' }, { kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } }],
      createdAt: 0,
    },
    {
      id: RULE_ERRORS, name: `Error rate over ${ERROR_LIMIT}%`, enabled: true, severity: 'error', scope: 'row',
      predicate: { kind: 'cmp', column: 'errorPct', op: 'greaterThan', value: ERROR_LIMIT },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'toast', message: '{name}: error rate {value}%' }, { kind: 'highlight', style: { background: '#fee2e2', color: '#991b1b' } }],
      createdAt: 0,
    },
  ]
  let alertFormats = $state<ConditionalFormat<Service>[]>([])

  // The alert log is shared across the page; only events from this
  // workspace's rules count, and only the ones fired after it mounted.
  const keyOf = (e: AlertEvent) => `${e.ruleId}|${e.rowId ?? ''}|${e.firedAt}`
  const mountedAt = Date.now()
  const seen = new Set(alertStore.events.map(keyOf))
  const feed = $derived(alertStore.events.filter((e) => OUR_RULES.has(e.ruleId) && e.firedAt >= mountedAt))
  const unacked = $derived(feed.filter((e) => !e.acknowledged).length)
  /** Acknowledge this workspace's alerts only; the log is shared with the page. */
  function ackAll() {
    for (const e of feed) {
      if (!e.acknowledged) alertStore.acknowledge(alertStore.events.indexOf(e))
    }
  }
  const incidentForService = (id: string | undefined) => incidents.find((i) => i.service === id && i.status !== 'resolved')
  $effect(() => {
    const events = alertStore.events
    untrack(() => {
      for (const e of [...events].reverse()) {
        const k = keyOf(e)
        if (seen.has(k)) continue
        seen.add(k)
        if (OUR_RULES.has(e.ruleId) && e.rowId) openIncidentFor(e)
      }
    })
  })

  // ---- Selection + charts -------------------------------------------------------
  let selectedId = $state('checkout-api')
  const selected = $derived(services.find((s) => s.id === selectedId) ?? services[0]!)
  const latencySpec = $derived.by<ChartSpec>(() => {
    void histVersion
    return {
      type: 'line',
      categories: clock,
      xAxis: { labelRotation: 0 },
      series: [
        { label: 'p99', values: [...(p99Hist.get(selected.id) ?? [])], color: '#93c5fd', marker: 'none', smooth: 'monotone' },
        { label: 'p95', values: selected.p95History, color: '#2563eb', type: 'area', marker: 'none', smooth: 'monotone' },
        { label: 'p50', values: [...(p50Hist.get(selected.id) ?? [])], color: '#64748b', marker: 'none', smooth: 'monotone' },
      ],
      referenceLines: [{ value: SLO_P95, label: `SLO ${SLO_P95} ms`, dashed: true, color: '#dc2626' }],
      yAxisTitle: 'ms',
    }
  })
  const errorSpec = $derived.by<ChartSpec>(() => {
    void histVersion
    return {
      type: 'area',
      categories: clock,
      xAxis: { labelRotation: 0 },
      series: [{ label: 'Errors (%)', values: [...(errHistory.get(selected.id) ?? [])], color: '#d97706', marker: 'none', smooth: 'monotone' }],
      referenceLines: [{ value: ERROR_LIMIT, label: `Limit ${ERROR_LIMIT}%`, dashed: true, color: '#dc2626' }],
      yAxisTitle: '%',
    }
  })

  // ---- KPIs ---------------------------------------------------------------------
  const healthy = $derived(services.filter((s) => s.status === 'healthy').length)
  const fleetP95 = $derived.by(() => {
    const sorted = services.map((s) => s.p95).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 0
  })
  const totalRps = $derived(services.reduce((n, s) => n + s.rps, 0))
  const fleetErr = $derived(round(services.reduce((n, s) => n + s.errorPct * s.rps, 0) / Math.max(1, totalRps), 2))

  // ---- Grids --------------------------------------------------------------------
  let servicesApi = $state<EnterpriseGridApi<any, Service> | null>(null)
  let incidentsApi = $state<EnterpriseGridApi<any, Incident> | null>(null)
  let incidentView = $state<'board' | 'table'>('board')

  const serviceColumns: ColumnDef<any, Service>[] = [
    { id: 'name', field: 'name', header: 'Service', width: 190, cell: (ctx) => renderSnippet(ServiceCell, { row: ctx.row.original }) },
    { id: 'status', field: 'status', header: 'Status', width: 104, cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
    { id: 'tier', field: 'tier', header: 'Tier', width: 64 },
    { id: 'p95', field: 'p95', header: 'p95 ms', width: 88, format: { type: 'number' } },
    { id: 'trend', field: 'p95History', header: 'p95, last 60 s', width: 130, sparkline: { type: 'area', color: '#2563eb', lineWidth: 1.5 } },
    { id: 'errorPct', field: 'errorPct', header: 'Errors', width: 84, cell: (ctx) => renderSnippet(ErrorCell, { row: ctx.row.original }) },
    { id: 'rps', field: 'rps', header: 'Req/s', width: 88, format: { type: 'number' } },
    { id: 'cpu', field: 'cpu', header: 'CPU %', width: 76, format: { type: 'number' } },
    { id: 'region', field: 'region', header: 'Region', width: 92 },
    { id: 'version', field: 'version', header: 'Version', width: 96 },
  ]
  const incidentColumns: ColumnDef<any, Incident>[] = [
    { field: 'id', header: 'ID', width: 96, editable: false },
    { field: 'title', header: 'Title', width: 280, editorType: 'text' },
    { field: 'severity', header: 'Sev', width: 80, editorType: 'list', editorOptions: ['SEV1', 'SEV2', 'SEV3'] },
    { field: 'status', header: 'Status', width: 130, editorType: 'list', editorOptions: ['triage', 'investigating', 'mitigated', 'resolved'] },
    { field: 'commander', header: 'Commander', width: 140, editorType: 'text' },
    { field: 'service', header: 'Service', width: 140, editable: false },
    { field: 'opened', header: 'Opened', width: 150, editable: false, format: { type: 'datetime', pattern: 'short' } },
  ]
  const lanes = [
    { id: 'triage', title: 'Triage', color: '#dc2626' },
    { id: 'investigating', title: 'Investigating', color: '#d97706' },
    { id: 'mitigated', title: 'Mitigated', color: '#2563eb' },
    { id: 'resolved', title: 'Resolved', color: '#16a34a' },
  ]

  // ---- Export (Enterprise) ------------------------------------------------------
  const SERVICE_EXPORT: ExportColumn<Service>[] = [
    { field: 'name', header: 'Service' }, { field: 'team', header: 'Team' }, { field: 'tier', header: 'Tier' },
    { field: 'status', header: 'Status' }, { field: 'p95', header: 'p95 (ms)' }, { field: 'errorPct', header: 'Error rate (%)' },
    { field: 'rps', header: 'Requests / s' }, { field: 'cpu', header: 'CPU (%)' }, { field: 'region', header: 'Region' }, { field: 'version', header: 'Version' },
  ]
  const INCIDENT_EXPORT: ExportColumn<Incident>[] = [
    { field: 'id', header: 'ID' }, { field: 'title', header: 'Title' }, { field: 'severity', header: 'Severity' }, { field: 'status', header: 'Status' },
    { field: 'commander', header: 'Commander' }, { field: 'service', header: 'Service' },
    { field: 'opened', header: 'Opened', format: { type: 'datetime', pattern: 'short' } }, { field: 'source', header: 'Source' },
  ]
  const stamp = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  }
  async function run(label: string, job: () => Promise<unknown> | undefined) {
    try {
      await job()
      toast.success(`Exported ${label}`)
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const exportServices = (format: ExportFormat) =>
    run(`services to ${format.toUpperCase()}`, () => servicesApi?.exportData({ format, filename: `services-${stamp()}`, columns: SERVICE_EXPORT, rows: 'all' }))
  const exportIncidents = (format: ExportFormat) =>
    run(`incidents to ${format.toUpperCase()}`, () => incidentsApi?.exportData({ format, filename: `incidents-${stamp()}`, columns: INCIDENT_EXPORT, rows: incidents }))
  const exportItems: MenuItem[] = [
    { label: 'Services snapshot to Excel', onSelect: () => exportServices('xlsx') },
    { label: 'Services snapshot to PDF', onSelect: () => exportServices('pdf') },
    { separator: true },
    { label: 'Incident log to Excel', onSelect: () => exportIncidents('xlsx') },
    { label: 'Incident log to CSV', onSelect: () => exportIncidents('csv') },
  ]
  const injectItems = $derived<MenuItem[]>([
    { label: `Bad deploy on ${selected.name}: latency`, onSelect: () => ship(selected.id, 'latency', 'you', 'Switch the connection pool to lazy init') },
    { label: `Bad deploy on ${selected.name}: errors`, onSelect: () => ship(selected.id, 'errors', 'you', 'Tighten request validation') },
    { separator: true },
    { label: `Clean deploy on ${selected.name}`, onSelect: () => ship(selected.id, undefined, 'you', 'Bump dependencies') },
  ])

  // ---- Dock layout ----------------------------------------------------------------
  // The board sits under the service grid, in the wide column, so all four
  // lanes fit; the charts and logs are narrow by nature.
  const LAYOUT_KEY = 'svgrid-demo-ops-layout-v3'
  const defaultLayout = (): DockManagerState => ({
    main: dockGroup('row', [
      dockGroup('column', [
        dockTabs([dockPane('services', 'Services', { closable: false, minSize: 180 })]),
        dockTabs([dockPane('incidents', 'Incidents', { minSize: 200 })]),
      ], [0.5, 0.5]),
      dockGroup('column', [
        dockTabs([dockPane('latency', 'Latency'), dockPane('errors', 'Errors')]),
        dockTabs([dockPane('deploys', 'Deploys'), dockPane('oncall', 'On-call'), dockPane('feed', 'Alert feed')]),
      ], [0.5, 0.5]),
    ], [0.64, 0.36]),
    floating: [],
    autoHide: [],
  })
  function loadLayout(): DockManagerState {
    try {
      const s = localStorage.getItem(LAYOUT_KEY)
      if (s) return JSON.parse(s) as DockManagerState
    } catch {
      /* storage blocked or malformed: fall back to the default */
    }
    return defaultLayout()
  }
  let workspace = $state<DockManagerState>(loadLayout())
  function saveLayout() {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspace))
      toast.success('Layout saved; it comes back on reload')
    } catch {
      toast.error('Could not save: storage is blocked in this browser')
    }
  }
  function resetLayout() {
    workspace = defaultLayout()
    try { localStorage.removeItem(LAYOUT_KEY) } catch { /* ignore */ }
  }

  function onServicesReady(a: SvGridApi<any, Service>) { servicesApi = installEnterprise(a) }
  function onIncidentsReady(a: SvGridApi<any, Incident>) { incidentsApi = installEnterprise(a) }

  // Status and severity colours carry meaning, so they stay literal.
  const STATUS_COLOR: Record<Status, string> = { healthy: '#16a34a', degraded: '#d97706', down: '#dc2626' }
  const SEV_COLOR: Record<Severity, string> = { SEV1: '#dc2626', SEV2: '#d97706', SEV3: '#64748b' }
  const SEVERITY_COLOR: Record<string, string> = { error: '#dc2626', warning: '#d97706', info: '#2563eb', success: '#16a34a' }
  const LANE_COLOR: Record<IncStatus, string> = { triage: '#dc2626', investigating: '#d97706', mitigated: '#2563eb', resolved: '#16a34a' }
  const TL_ICON: Record<TimelineEntry['kind'], string> = {
    open: 'M12 8v4 M12 16h.01 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    status: 'M5 12h14 M13 6l6 6-6 6',
    sev: 'M12 3 2 20h20z M12 10v4 M12 17h.01',
    page: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4',
    ack: 'M5 13l4 4L19 7',
    note: 'M4 5h16v11H8l-4 4z',
    deploy: 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  }
  const SEVERITIES: Severity[] = ['SEV1', 'SEV2', 'SEV3']
  const STATUSES: IncStatus[] = ['triage', 'investigating', 'mitigated', 'resolved']
  const ROTA_ROWS = Object.entries(ROTA)
</script>

{#snippet ico(d: string, size = 15)}
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
{/snippet}

{#snippet ServiceCell(props: { row: Service })}
  <span class="ops-svc">
    <span class="ops-dot" style:background={STATUS_COLOR[props.row.status]}></span>
    <span class="ops-svc-txt"><strong>{props.row.name}</strong><span>{props.row.team}</span></span>
  </span>
{/snippet}
{#snippet StatusCell(props: { row: Service })}
  <span class="ops-pill" style:--c={STATUS_COLOR[props.row.status]}>{props.row.status}</span>
{/snippet}
{#snippet ErrorCell(props: { row: Service })}
  <span class="ops-num" class:is-bad={props.row.errorPct > ERROR_LIMIT} class:is-warn={props.row.errorPct > 2 && props.row.errorPct <= ERROR_LIMIT}>{props.row.errorPct.toFixed(2)}%</span>
{/snippet}
{#snippet incidentCard(i: Incident)}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ops-card" onclick={() => (drawerId = i.id)} title="Open {i.id}">
    <div class="ops-card-top">
      <span class="ops-sev" style:--c={SEV_COLOR[i.severity]}>{i.severity}</span>
      <span class="ops-card-id">{i.id}</span>
      <span class="ops-card-age">{age(i.opened)}</span>
    </div>
    <div class="ops-card-title">{i.title}</div>
    <div class="ops-card-foot">
      <SvAvatar name={i.commander} size={18} />
      <span class="ops-card-who">{i.commander}</span>
      {#if i.source === 'alert'}<span class="ops-card-src" title="Opened by an alert rule" aria-label="Opened by an alert rule">{@render ico('M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4', 12)}</span>{/if}
    </div>
  </div>
{/snippet}

<div class="ops">
  <header class="ops-head">
    <div class="ops-title">
      <span class="ops-logo">{@render ico('M3 12h4l3-8 4 16 3-8h4', 18)}</span>
      <div>
        <h2>Ops center <span class="ops-live" class:is-paused={paused}>{paused ? 'Paused' : 'Live'}</span></h2>
        <p><span class="ops-env">production</span> us-east-1 · {services.length} services · <span class="ops-utc">{utc} UTC</span></p>
      </div>
    </div>
    <div class="ops-tools">
      <button type="button" class="ops-btn" onclick={() => (paused = !paused)}>{@render ico(paused ? 'M8 5v14l11-7z' : 'M7 5h3v14H7z M14 5h3v14h-3z')}{paused ? 'Resume' : 'Pause'}</button>
      <SvMenu items={injectItems}>
        {#snippet anchor()}<button type="button" class="ops-btn">{@render ico('M12 19V5 M5 12l7-7 7 7')}Deploy</button>{/snippet}
      </SvMenu>
      <SvMenu items={exportItems}>
        {#snippet anchor()}<button type="button" class="ops-btn">{@render ico('M12 3v12 M8 11l4 4 4-4 M4 17v3h16v-3')}Export</button>{/snippet}
      </SvMenu>
      <button type="button" class="ops-btn" onclick={saveLayout}>Save layout</button>
      <button type="button" class="ops-btn" onclick={resetLayout}>Reset</button>
      <SvGridAlerts data={services} columns={exprColumns} getRowId={(s) => s.id} rules={seededRules} storageKey="svgrid-demo:ops-alerts" bind:formats={alertFormats} toastCooldownMs={8000} onJump={(e) => { if (e.rowId) selectedId = e.rowId }} />
    </div>
  </header>

  <div class="ops-kpis">
    <div class="ops-kpi"><span>Healthy</span><strong class:is-warn={healthy < services.length}>{healthy}<small> / {services.length}</small></strong></div>
    <div class="ops-kpi"><span>Median p95</span><strong>{fleetP95}<small> ms</small></strong></div>
    <div class="ops-kpi"><span>Error rate</span><strong class:is-bad={fleetErr > 2}>{fleetErr.toFixed(2)}<small>%</small></strong></div>
    <div class="ops-kpi"><span>Traffic</span><strong>{Math.round(totalRps / 100) / 10}<small>k req/s</small></strong></div>
    <div class="ops-kpi"><span>Open incidents</span><strong class:is-bad={openSev1 > 0}>{openIncidents}{#if openSev1}<small> ({openSev1} SEV1)</small>{/if}</strong></div>
    <div class="ops-kpi"><span>Alerts fired</span><strong>{feed.length}{#if unacked}<small> ({unacked} new)</small>{/if}</strong></div>
  </div>

  <div class="ops-stage">
    <SvDockManager bind:workspace minSize={120} keepAlive>
      {#snippet pane(p)}
        {#if p.id === 'services'}
          <div class="ops-pane">
            <SvGrid
              data={services}
              columns={serviceColumns}
              getRowId={(s) => s.id}
              conditionalFormats={alertFormats}
              sortable
              selectionMode="none"
              enableRowSummaries={false}
              rowHeight={44}
              containerHeight="100%"
              initialColumnPinning={{ left: ['name'] }}
              columnVirtualization={false}
              rowClass={({ row }) => ({ 'ops-row-sel': row.id === selectedId })}
              onRowClick={(e) => (selectedId = e.row.id)}
              onApiReady={onServicesReady}
            />
          </div>
        {:else if p.id === 'latency' || p.id === 'errors'}
          {@const inc = incidentForService(selected.id)}
          <div class="ops-pane ops-chart">
            <div class="ops-chart-head">
              <strong>{selected.name}</strong>
              <span class="ops-pill" style:--c={STATUS_COLOR[selected.status]}>{selected.status}</span>
              <span class="ops-muted">{p.id === 'latency' ? `p95 ${selected.p95} ms` : `errors ${selected.errorPct.toFixed(2)}%`} · {selected.version} · on call {ROTA[selected.team]?.primary}</span>
              {#if inc}<button type="button" class="ops-link" onclick={() => (drawerId = inc.id)}>{inc.id}</button>{/if}
            </div>
            <div class="ops-chart-body">
              <SvChart spec={p.id === 'latency' ? latencySpec : errorSpec} legend={p.id === 'latency'} autosize animate={false} />
            </div>
          </div>
        {:else if p.id === 'incidents'}
          <div class="ops-pane ops-inc">
            <div class="ops-inc-bar">
              <div class="ops-seg" role="group" aria-label="Incident view">
                <button type="button" class:is-on={incidentView === 'board'} aria-pressed={incidentView === 'board'} onclick={() => (incidentView = 'board')}>Board</button>
                <button type="button" class:is-on={incidentView === 'table'} aria-pressed={incidentView === 'table'} onclick={() => (incidentView = 'table')}>Table</button>
              </div>
              <span class="ops-muted">The same grid, two views. {openIncidents} open; click one for its timeline.</span>
              <button type="button" class="ops-btn ops-btn-sm" onclick={newIncident}>{@render ico('M12 5v14 M5 12h14', 13)}New</button>
            </div>
            <div class="ops-inc-grid">
              {#if incidentView === 'board'}
                <SvGrid
                  data={incidents}
                  columns={incidentColumns}
                  getRowId={(i) => i.id}
                  containerHeight="100%"
                  onApiReady={onIncidentsReady}
                  board={{ groupBy: 'status', lanes, card: incidentCard, onCardMove, searchable: false, laneSummary: (list) => `${list.length}` }}
                />
              {:else}
                <SvGrid
                  data={incidents}
                  columns={incidentColumns}
                  getRowId={(i) => i.id}
                  sortable
                  filterable
                  enableInlineEditing
                  selectionMode="none"
                  enableRowSummaries={false}
                  rowHeight={36}
                  containerHeight="100%"
                  onApiReady={onIncidentsReady}
                  onRowDoubleClick={(e) => (drawerId = e.row.id)}
                  onCellValueChange={() => (incidents = [...incidents])}
                />
              {/if}
            </div>
          </div>
        {:else if p.id === 'deploys'}
          <div class="ops-pane ops-list">
            {#each deploys as d (d.id)}
              <div class="ops-dep">
                <span class="ops-dep-ic" class:is-rb={d.kind === 'rollback'}>{@render ico(d.kind === 'rollback' ? 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3' : 'M12 19V5 M5 12l7-7 7 7', 13)}</span>
                <div class="ops-dep-txt">
                  <span><strong>{d.service}</strong> {d.from} → {d.version}{#if d.rolledBack}<span class="ops-tag">rolled back</span>{/if}</span>
                  <span class="ops-dep-msg">{d.message}</span>
                  <span class="ops-muted"><code>{d.sha}</code> · {d.kind === 'rollback' ? `rollback by ${d.author}` : `by ${d.author}`} · {d.state === 'deploying' ? 'deploying' : ago(d.at)}</span>
                  {#if d.state === 'deploying'}<span class="ops-progress" role="progressbar" aria-valuenow={d.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Deploy progress"><span style:width="{d.progress}%"></span></span>{/if}
                </div>
                {#if canRollback(d)}
                  <button type="button" class="ops-btn ops-btn-sm" onclick={() => rollback(d)}>Roll back</button>
                {/if}
              </div>
            {/each}
          </div>
        {:else if p.id === 'oncall'}
          <div class="ops-pane ops-list">
            {#each ROTA_ROWS as [team, r] (team)}
              {@const open = incidents.filter((i) => i.status !== 'resolved' && teamOf(i.service) === team).length}
              <div class="ops-dep">
                <SvAvatar name={r.primary} size={30} status="online" />
                <div class="ops-dep-txt">
                  <span><strong>{r.primary}</strong> <span class="ops-muted">· {team}</span>{#if open}<span class="ops-tag ops-tag-bad">{open} open</span>{/if}</span>
                  <span class="ops-muted">Primary until {r.until}:00 · secondary {r.secondary}</span>
                </div>
                <button type="button" class="ops-btn ops-btn-sm" onclick={() => page(r.primary, team)}>Page</button>
              </div>
            {/each}
          </div>
        {:else if p.id === 'feed'}
          <div class="ops-pane ops-list">
            {#if feed.length}
              <div class="ops-list-head">
                <span class="ops-muted">{unacked} unacknowledged of {feed.length}</span>
                <button type="button" class="ops-btn ops-btn-sm" disabled={unacked === 0} onclick={ackAll}>Acknowledge all</button>
              </div>
            {/if}
            {#if feed.length === 0}
              <div class="ops-empty">No alerts yet. The scripted deploy trips one a few seconds after load, or ship a bad one from Deploy.</div>
            {/if}
            {#each feed as e (keyOf(e))}
              {@const inc = incidentForService(e.rowId)}
              <div class="ops-alert" class:is-ack={e.acknowledged}>
                <span class="ops-dot" style:background={SEVERITY_COLOR[e.severity] ?? '#64748b'}></span>
                <div class="ops-dep-txt">
                  <span>{e.message}</span>
                  <span class="ops-muted">{e.ruleName} · {clockTime(e.firedAt)}{#if inc} · <button type="button" class="ops-link" onclick={() => (drawerId = inc.id)}>{inc.id}</button>{/if}</span>
                </div>
                {#if !e.acknowledged}
                  <button type="button" class="ops-btn ops-btn-sm" onclick={() => alertStore.acknowledge(alertStore.events.indexOf(e))}>Ack</button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/snippet}
    </SvDockManager>
  </div>
</div>

<SvDrawer open={drawerInc != null} onClose={() => (drawerId = null)} side="right" size="440px" title={drawerInc ? `${drawerInc.id} · ${drawerInc.title}` : ''}>
  {#if drawerInc}
    {@const inc = drawerInc}
    <div class="ops-dr">
      <div class="ops-dr-row">
        <span class="ops-dr-label">Severity</span>
        <div class="ops-seg" role="group" aria-label="Severity">
          {#each SEVERITIES as s (s)}
            <button type="button" class:is-on={inc.severity === s} style:--c={SEV_COLOR[s]} aria-pressed={inc.severity === s} onclick={() => setSeverity(inc.id, s)}>{s}</button>
          {/each}
        </div>
      </div>
      <div class="ops-dr-row">
        <span class="ops-dr-label">Status</span>
        <div class="ops-seg" role="group" aria-label="Status">
          {#each STATUSES as s (s)}
            <button type="button" class:is-on={inc.status === s} aria-pressed={inc.status === s} onclick={() => setStatus(inc.id, s)}>{STATUS_LABEL[s]}</button>
          {/each}
        </div>
      </div>
      <div class="ops-dr-row">
        <span class="ops-dr-label">Commander</span>
        <select class="ops-select" value={inc.commander} onchange={(e) => setCommander(inc.id, e.currentTarget.value)} aria-label="Commander">
          {#each PEOPLE as name (name)}<option value={name}>{name}</option>{/each}
        </select>
        <button type="button" class="ops-btn ops-btn-sm" onclick={() => page(inc.commander, teamOf(inc.service), inc.id)}>Page</button>
      </div>

      {#if drawerSvc}
        <div class="ops-dr-card">
          <div class="ops-dr-card-head">
            <span class="ops-dot" style:background={STATUS_COLOR[drawerSvc.status]}></span>
            <strong>{drawerSvc.name}</strong>
            <span class="ops-pill" style:--c={STATUS_COLOR[drawerSvc.status]}>{drawerSvc.status}</span>
            <button type="button" class="ops-link" onclick={() => (selectedId = drawerSvc.id)}>Show in charts</button>
          </div>
          <div class="ops-dr-stats">
            <span><small>p95</small>{drawerSvc.p95} ms</span>
            <span><small>Errors</small>{drawerSvc.errorPct.toFixed(2)}%</span>
            <span><small>Traffic</small>{drawerSvc.rps.toLocaleString()} req/s</span>
            <span><small>Version</small>{drawerSvc.version}</span>
          </div>
          {#if drawerDeploy}
            <div class="ops-dr-deploy">
              <span class="ops-muted">Last deploy {drawerDeploy.from} → {drawerDeploy.version} by {drawerDeploy.author}, {drawerDeploy.state === 'deploying' ? 'in progress' : ago(drawerDeploy.at)}{#if drawerDeploy.rolledBack} (rolled back){/if}</span>
              {#if canRollback(drawerDeploy)}<button type="button" class="ops-btn ops-btn-sm" onclick={() => drawerDeploy && rollback(drawerDeploy)}>Roll back</button>{/if}
            </div>
          {/if}
        </div>
      {/if}

      <h3 class="ops-dr-h">Timeline</h3>
      <ol class="ops-tl">
        {#each [...inc.timeline].reverse() as t, i (t.at + t.text + i)}
          <li class="ops-tl-item" data-kind={t.kind}>
            <span class="ops-tl-ic">{@render ico(TL_ICON[t.kind], 13)}</span>
            <div class="ops-tl-txt">
              <span>{#if t.kind === 'note'}<strong>{t.who}</strong> {t.text}{:else}{t.text}{#if t.who !== 'Alert rules' && t.who !== 'Paging' && !t.text.includes(t.who)}{' '}<span class="ops-muted">by {t.who}</span>{/if}{/if}</span>
              <span class="ops-muted">{clockTime(t.at)} · {ago(t.at)}</span>
            </div>
          </li>
        {/each}
      </ol>
      <form class="ops-note" onsubmit={(e) => { e.preventDefault(); addNote() }}>
        <textarea bind:value={note} rows="2" placeholder="Add a note to the timeline" aria-label="Note" onkeydown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addNote() } }}></textarea>
        <button type="submit" class="ops-btn ops-btn-sm" disabled={!note.trim()}>Add note</button>
      </form>
    </div>
  {/if}
  {#snippet footer()}
    {#if drawerInc}
      {@const inc = drawerInc}
      <div class="ops-dr-foot">
        <span class="ops-muted">Opened {age(inc.opened) === 'now' ? 'just now' : `${age(inc.opened)} ago`} {inc.source === 'alert' ? 'by an alert rule' : 'by hand'}</span>
        {#if inc.status === 'resolved'}
          <button type="button" class="ops-btn" onclick={() => setStatus(inc.id, 'investigating')}>Reopen</button>
        {:else}
          <button type="button" class="ops-btn ops-btn-primary" style:--c={LANE_COLOR.resolved} onclick={() => { setStatus(inc.id, 'resolved'); toast.success(`${inc.id} resolved`) }}>Resolve</button>
        {/if}
      </div>
    {/if}
  {/snippet}
</SvDrawer>

<SvToaster position="bottom-right" />

<style>
  .ops {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 760px;
    height: 100%;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    font-size: 13px;
  }
  .ops-muted { color: var(--sg-muted, #64748b); }

  .ops-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex: none; }
  .ops-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .ops-logo { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); flex: none; }
  .ops-title h2 { margin: 0; font-size: 16px; font-weight: 650; display: flex; align-items: center; gap: 8px; }
  .ops-title p { margin: 2px 0 0; font-size: 12px; color: var(--sg-muted, #64748b); display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  /* Production red-ish pill is a warning label, like every deploy tool shows. */
  .ops-env { font-size: 10.5px; font-weight: 700; padding: 0 6px; border-radius: 4px; color: #b91c1c; background: color-mix(in srgb, #dc2626 12%, transparent); }
  .ops-utc { font-variant-numeric: tabular-nums; }
  /* Live / paused are status, so green and amber stay literal. */
  .ops-live { font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #15803d; background: color-mix(in srgb, #16a34a 14%, transparent); padding: 2px 8px; border-radius: 999px; }
  .ops-live.is-paused { color: #b45309; background: color-mix(in srgb, #d97706 14%, transparent); }
  .ops-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ops-btn {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px;
    border: 1px solid var(--sg-border, #e5e7eb); border-radius: 7px; background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap;
  }
  .ops-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .ops-btn:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 1px; }
  .ops-btn:disabled { opacity: 0.45; cursor: default; }
  .ops-btn-sm { height: 26px; padding: 0 8px; font-size: 12px; }
  .ops-btn-primary { background: var(--c); border-color: var(--c); color: #fff; }
  .ops-btn-primary:hover { background: color-mix(in srgb, var(--c) 88%, #000); }
  .ops-link { border: 0; background: none; padding: 0; font: inherit; font-size: 12px; font-weight: 600; color: var(--sg-accent, #2563eb); cursor: pointer; }
  .ops-link:hover { text-decoration: underline; }

  .ops-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-bottom: 1px solid var(--sg-border, #e5e7eb); flex: none; }
  .ops-kpi { display: flex; flex-direction: column; gap: 2px; padding: 9px 16px; border-right: 1px solid var(--sg-border, #e5e7eb); min-width: 0; }
  .ops-kpi:last-child { border-right: 0; }
  .ops-kpi span { font-size: 11px; color: var(--sg-muted, #64748b); white-space: nowrap; }
  .ops-kpi strong { font-size: 19px; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.15; white-space: nowrap; }
  .ops-kpi small { font-size: 12px; font-weight: 500; color: var(--sg-muted, #64748b); }
  .ops-kpi strong.is-bad, .ops :global(.ops-num.is-bad) { color: #dc2626; }
  .ops-kpi strong.is-warn, .ops :global(.ops-num.is-warn) { color: #b45309; }
  .ops-kpi strong.is-bad small, .ops-kpi strong.is-warn small { color: inherit; opacity: 0.8; }

  .ops-stage { flex: 1 1 0; min-height: 0; padding: 8px; display: flex; flex-direction: column; }
  .ops-stage > :global(*) { flex: 1 1 0; min-height: 0; }
  .ops-pane { height: 100%; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box; }
  .ops-pane > :global(.sv-grid-root-fill), .ops-pane > :global(*:only-child) { flex: 1 1 0; min-height: 0; }
  .ops-pane :global(.sv-grid-row) { cursor: pointer; }

  /* Service grid cells */
  .ops :global(.ops-svc) { display: inline-flex; align-items: center; gap: 9px; min-width: 0; }
  .ops :global(.ops-dot), .ops-dr :global(.ops-dot) { width: 8px; height: 8px; border-radius: 999px; flex: none; display: inline-block; }
  .ops :global(.ops-svc-txt) { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  .ops :global(.ops-svc-txt strong) { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .ops :global(.ops-svc-txt span) { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .ops :global(.ops-pill), .ops-dr .ops-pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); text-transform: capitalize; }
  .ops :global(.ops-num) { font-variant-numeric: tabular-nums; }
  .ops :global(.ops-row-sel > td) { background: var(--sg-selection-bg, #eff6ff); }

  /* Charts */
  .ops-chart-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px 0; flex: none; flex-wrap: wrap; }
  .ops-chart-head .ops-muted { font-size: 12px; }
  .ops-chart-body { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; padding: 4px 8px 8px; }
  .ops-chart-body > :global(*) { flex: 1 1 0; min-height: 0; }

  /* Incidents */
  .ops-inc { --sg-board-lane-w: 158px; }
  .ops-inc-bar { display: flex; align-items: center; gap: 10px; padding: 8px 10px; flex: none; }
  .ops-inc-bar .ops-muted { flex: 1; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ops-inc-grid { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
  .ops-inc-grid > :global(*) { flex: 1 1 0; min-height: 0; }
  .ops-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 7px; overflow: hidden; flex: none; }
  .ops-seg button { border: 0; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; font-size: 12px; padding: 4px 11px; cursor: pointer; }
  .ops-seg button + button { border-left: 1px solid var(--sg-border, #e5e7eb); }
  .ops-seg button.is-on { background: var(--c, var(--sg-fg, #0f172a)); color: var(--sg-bg, #fff); }
  .ops :global(.ops-card) { display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
  .ops :global(.ops-card-top) { display: flex; align-items: center; gap: 6px; font-size: 11px; white-space: nowrap; }
  .ops :global(.ops-sev) { font-weight: 700; padding: 0 6px; border-radius: 4px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
  .ops :global(.ops-card-id) { color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .ops :global(.ops-card-src) { display: inline-flex; margin-left: auto; color: var(--sg-muted, #64748b); }
  .ops :global(.ops-card-who) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .ops :global(.ops-card-age) { margin-left: auto; color: var(--sg-muted, #64748b); }
  .ops :global(.ops-card-title) { font-weight: 600; font-size: 12.5px; line-height: 1.35; }
  .ops :global(.ops-card-foot) { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--sg-muted, #64748b); }

  /* Lists: deploys, on-call, alert feed */
  .ops-list { overflow: auto; padding: 0 0 4px; }
  .ops-list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--sg-border, #e5e7eb); font-size: 12px; position: sticky; top: 0; background: var(--sg-bg, #fff); z-index: 1; }
  .ops-dep, .ops-alert { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ops-dep:hover, .ops-alert:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .ops-dep-ic { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; flex: none; border: 1px solid var(--sg-border, #e5e7eb); color: var(--sg-muted, #64748b); }
  .ops-dep-ic.is-rb { color: #b45309; }
  .ops-dep-txt { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
  .ops-dep-txt > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ops-dep-txt .ops-muted { font-size: 11.5px; }
  .ops-dep-msg { font-size: 12px; }
  .ops-dep-txt code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
  .ops-progress { display: block; height: 4px; margin-top: 4px; border-radius: 2px; background: var(--sg-border, #e5e7eb); overflow: hidden; }
  .ops-progress > span { display: block; height: 100%; background: var(--sg-accent, #2563eb); transition: width 1.2s linear; }
  .ops-alert.is-ack { opacity: 0.55; }
  .ops-tag { margin-left: 6px; font-size: 10.5px; padding: 0 6px; border-radius: 4px; border: 1px solid var(--sg-border, #e5e7eb); color: var(--sg-muted, #64748b); }
  .ops-tag-bad { color: #b91c1c; border-color: color-mix(in srgb, #dc2626 35%, transparent); }
  .ops-empty { padding: 18px 14px; color: var(--sg-muted, #64748b); font-size: 12.5px; line-height: 1.5; }

  /* Incident drawer (portalled, so its rules are not under .ops) */
  .ops-dr { display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .ops-dr .ops-muted { color: var(--sg-muted, #64748b); }
  .ops-dr-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ops-dr-label { width: 78px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .ops-select { font: inherit; font-size: 13px; padding: 4px 8px; border: 1px solid var(--sg-input-border, var(--sg-border, #d1d5db)); border-radius: 6px; background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a); }
  .ops-dr-card { border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; overflow: hidden; }
  .ops-dr-card-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--sg-header-bg, #f8fafc); border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ops-dr-card-head .ops-link { margin-left: auto; }
  .ops-dr-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 10px 12px; gap: 8px; font-variant-numeric: tabular-nums; }
  .ops-dr-stats span { display: flex; flex-direction: column; font-weight: 600; }
  .ops-dr-stats small { font-size: 11px; font-weight: 500; color: var(--sg-muted, #64748b); }
  .ops-dr-deploy { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--sg-border, #e5e7eb); font-size: 12px; }
  .ops-dr-h { margin: 4px 0 0; font-size: 13px; font-weight: 650; }
  .ops-tl { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .ops-tl-item { position: relative; display: flex; gap: 10px; padding: 0 0 12px; }
  .ops-tl-item:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 24px; bottom: 0; width: 1px; background: var(--sg-border, #e5e7eb); }
  .ops-tl-ic { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 999px; flex: none; border: 1px solid var(--sg-border, #e5e7eb); background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b); }
  /* Timeline kinds use the same status palette as the board. */
  .ops-tl-item[data-kind='open'] .ops-tl-ic { color: #dc2626; }
  .ops-tl-item[data-kind='ack'] .ops-tl-ic { color: #15803d; }
  .ops-tl-item[data-kind='deploy'] .ops-tl-ic { color: #b45309; }
  .ops-tl-item[data-kind='page'] .ops-tl-ic { color: #2563eb; }
  .ops-tl-txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-top: 2px; }
  .ops-tl-txt .ops-muted { font-size: 11.5px; }
  .ops-note { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .ops-note textarea { width: 100%; box-sizing: border-box; resize: vertical; font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid var(--sg-input-border, var(--sg-border, #d1d5db)); border-radius: 6px; background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a); }
  .ops-note textarea:focus { outline: none; border-color: var(--sg-accent, #2563eb); }
  .ops-dr-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; font-size: 12px; }
  .ops-dr .ops-btn, .ops-dr-foot .ops-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 7px; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; font-size: 12.5px; cursor: pointer; }
  .ops-dr .ops-btn-sm { height: 26px; padding: 0 8px; font-size: 12px; }
  .ops-dr-foot .ops-btn-primary { background: var(--c); border-color: var(--c); color: #fff; }
  .ops-dr .ops-btn:disabled { opacity: 0.45; cursor: default; }
  .ops-dr .ops-link { border: 0; background: none; padding: 0; font: inherit; font-size: 12px; font-weight: 600; color: var(--sg-accent, #2563eb); cursor: pointer; }
  .ops-dr .ops-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 7px; overflow: hidden; }
  .ops-dr .ops-seg button { border: 0; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; font-size: 12px; padding: 4px 10px; cursor: pointer; }
  .ops-dr .ops-seg button + button { border-left: 1px solid var(--sg-border, #e5e7eb); }
  .ops-dr .ops-seg button.is-on { background: var(--c, var(--sg-fg, #0f172a)); color: var(--sg-bg, #fff); }

  @media (max-width: 900px) {
    .ops-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ops-kpi:nth-child(3) { border-right: 0; }
    .ops-kpi:nth-child(-n + 3) { border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  }
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .ops { flex-shrink: 0; min-height: 900px; }
    .ops-dr-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
