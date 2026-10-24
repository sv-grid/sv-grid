<script lang="ts">
  /**
   * 703. Test results tree - reload one subtree
   * -------------------------------------------
   * A release-qualification board for a kernel candidate. Each test
   * environment (architecture + machine) holds its reported issues and its
   * test plans; a plan holds its runs, and a run its results split into
   * Failed, Passed and Skipped.
   *
   * The grid's own `treeData` builds the hierarchy from flat rows whose ids
   * are paths (`env:amd64-precision-3680/plans/automated/runs/2`). The reload
   * icon on an environment, plan or run row asks the server for that subtree
   * only and splices the answer back into the flat array in place. `getRowId`
   * keeps the ids stable, so the controlled `expanded` map leaves every open
   * node open across the reload.
   *
   * The server here is in memory and does not wait for you: a running run
   * reports a result every couple of seconds, and the grid sees it only when
   * that run, or a node above it, is reloaded. Rerun queues a new run, Add
   * result posts a manual result, Add records an environment issue, and the
   * environment checkboxes approve or reject in bulk. Every request is in the
   * log under the grid.
   */
  import {
    SvGrid,
    SvModal,
    SvButton,
    SvTextInput,
    SvTextArea,
    SvDropDownList,
    SvSegmented,
    tableFeatures,
    renderSnippet,
    type GridColumns,
  } from '@svgrid/grid'

  type Outcome = 'failed' | 'passed' | 'skipped'
  type Review = 'undecided' | 'approved' | 'rejected'
  type RunStatus = 'queued' | 'running' | 'complete'
  type Kind = 'env' | 'issues' | 'issue' | 'plans' | 'plan' | 'run' | 'bucket' | 'result'

  // ---- Server records --------------------------------------------------------
  type TestResult = { test: string; outcome: Outcome; seconds: number; comment: string }
  type RunRec = {
    n: number
    status: RunStatus
    startedAt: number
    startAt: number
    results: TestResult[]
    pending: TestResult[]
  }
  type PlanRec = { key: string; name: string; manual: boolean; tests: string[]; runs: RunRec[] }
  type IssueRec = { n: number; title: string; bug: string }
  type EnvRec = {
    key: string
    arch: string
    machine: string
    hardware: string
    review: Review
    issues: IssueRec[]
    plans: PlanRec[]
  }

  // ---- What the API returns: one flat row per node ---------------------------
  type TestRow = {
    id: string
    parentId: string | null
    kind: Kind
    name: string
    detail: string
    fetchedAt: number
    arch?: string
    review?: Review
    manual?: boolean
    tests?: string[]
    runStatus?: RunStatus
    done?: number
    total?: number
    outcome?: Outcome
    count?: number
    seconds?: number
  }

  const OUTCOMES: Outcome[] = ['failed', 'passed', 'skipped']
  const OUTCOME_LABEL: Record<Outcome, string> = { failed: 'Failed', passed: 'Passed', skipped: 'Skipped' }
  const REVIEW_LABEL: Record<Review, string> = { undecided: 'Undecided', approved: 'Approved', rejected: 'Rejected' }
  const RELOADABLE = new Set<Kind>(['env', 'plan', 'run'])

  const ARTEFACT = 'linux-generic 6.11.0-19.19'

  const AUTOMATED = [
    'boot/kernel-version',
    'cpu/topology',
    'cpu/frequency-governor',
    'memory/stress-ng-60s',
    'disk/read-performance',
    'disk/smart-self-test',
    'ethernet/ping-gateway',
    'wireless/connect-wpa2-5ghz',
    'bluetooth/detect',
    'suspend/resume-cycle',
    'suspend/wireless-after-resume',
    'usb/storage-insert',
    'graphics/modeset',
  ]
  const MANUAL = [
    'audio/headphone-jack-playback',
    'camera/preview',
    'display/external-hdmi-hotplug',
    'keys/brightness',
    'touchpad/two-finger-scroll',
  ]

  // Failures and skips each machine produces, with the comment the harness
  // attaches. Everything else passes.
  const FAILS: Record<string, Record<string, string>> = {
    'amd64-thinkpad-x13-g4': { 'suspend/wireless-after-resume': 'wlp0s20f3 has no carrier 30 s after resume' },
    'amd64-precision-3680': {
      'graphics/modeset': 'DP-2: atomic commit failed, -EINVAL',
      'disk/read-performance': '1.1 GB/s, threshold 1.5 GB/s',
    },
    'riscv64-visionfive-2': {
      'disk/smart-self-test': 'no NVMe controller on PCIe bus 0000:01',
      'disk/read-performance': 'no block device to test',
      'cpu/frequency-governor': 'schedutil not available',
    },
  }
  const SKIPS: Record<string, string[]> = {
    'amd64-thinkpad-x13-g4': ['bluetooth/detect'],
    'arm64-rpi5-8gb': ['wireless/connect-wpa2-5ghz', 'suspend/resume-cycle', 'suspend/wireless-after-resume'],
    'riscv64-visionfive-2': ['graphics/modeset', 'bluetooth/detect'],
    'arm64-manual': ['camera/preview'],
  }

  // Seeded so a reload of the page draws the same durations.
  let seed = 703
  function rand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  function resultsFor(envKey: string, tests: string[]): TestResult[] {
    return tests.map((test) => {
      const comment = FAILS[envKey]?.[test]
      const skipped = SKIPS[envKey]?.includes(test)
      return {
        test,
        outcome: comment ? 'failed' : skipped ? 'skipped' : 'passed',
        seconds: skipped ? 0 : Math.round(2 + rand() * 70),
        comment: comment ?? (skipped ? 'requirement not met on this machine' : ''),
      }
    })
  }

  const T0 = Date.now()
  function completeRun(n: number, envKey: string, tests: string[], minutesAgo: number): RunRec {
    return { n, status: 'complete', startedAt: T0 - minutesAgo * 60_000, startAt: 0, results: resultsFor(envKey, tests), pending: [] }
  }
  function liveRun(n: number, envKey: string, tests: string[], reported: number, minutesAgo: number): RunRec {
    const all = resultsFor(envKey, tests)
    return { n, status: 'running', startedAt: T0 - minutesAgo * 60_000, startAt: 0, results: all.slice(0, reported), pending: all.slice(reported) }
  }

  const db: EnvRec[] = [
    {
      key: 'amd64-precision-3680', arch: 'amd64', machine: 'dell-precision-3680', hardware: 'Core i9-14900K, RTX A2000',
      review: 'undecided',
      issues: [{ n: 1, title: 'DisplayPort 2 stays dark after modeset', bug: 'BUG-4127' }],
      plans: [{
        key: 'automated', name: 'Automated testing', manual: false, tests: AUTOMATED,
        runs: [completeRun(1, 'amd64-precision-3680', AUTOMATED, 190), liveRun(2, 'amd64-precision-3680', AUTOMATED, 6, 4)],
      }],
    },
    {
      key: 'arm64-manual', arch: 'arm64', machine: 'user manual tests', hardware: 'Lab bench, any arm64 laptop',
      review: 'approved',
      issues: [],
      plans: [{
        key: 'manual', name: 'Manual testing', manual: true, tests: MANUAL,
        runs: [{ ...completeRun(1, 'arm64-manual', MANUAL, 300), results: resultsFor('arm64-manual', MANUAL).slice(0, 4), status: 'running' }],
      }],
    },
    {
      key: 'amd64-thinkpad-x13-g4', arch: 'amd64', machine: 'lenovo-thinkpad-x13-g4', hardware: 'Core i7-1365U, AX211 Wi-Fi',
      review: 'undecided',
      issues: [{ n: 1, title: 'Wi-Fi does not come back after suspend (iwlwifi)', bug: 'BUG-4119' }],
      plans: [
        { key: 'automated', name: 'Automated testing', manual: false, tests: AUTOMATED, runs: [completeRun(1, 'amd64-thinkpad-x13-g4', AUTOMATED, 75)] },
        { key: 'manual', name: 'Manual testing', manual: true, tests: MANUAL, runs: [] },
      ],
    },
    {
      key: 'arm64-rpi5-8gb', arch: 'arm64', machine: 'raspberry-pi-5-8gb', hardware: 'Cortex-A76, 8 GB',
      review: 'undecided',
      issues: [],
      plans: [{ key: 'automated', name: 'Automated testing', manual: false, tests: AUTOMATED, runs: [liveRun(1, 'arm64-rpi5-8gb', AUTOMATED, 3, 2)] }],
    },
    {
      key: 'riscv64-visionfive-2', arch: 'riscv64', machine: 'starfive-visionfive-2', hardware: 'JH7110, 8 GB',
      review: 'rejected',
      issues: [{ n: 1, title: 'PCIe NVMe not detected on boot', bug: 'BUG-4102' }],
      plans: [{ key: 'automated', name: 'Automated testing', manual: false, tests: AUTOMATED, runs: [completeRun(1, 'riscv64-visionfive-2', AUTOMATED, 420)] }],
    },
  ]

  // ---- Rows for one environment, in tree order ------------------------------
  function envRows(env: EnvRec, at: number): TestRow[] {
    const id = `env:${env.key}`
    const out: TestRow[] = [{ id, parentId: null, kind: 'env', name: env.machine, arch: env.arch, detail: env.hardware, review: env.review, fetchedAt: at }]

    const issuesId = `${id}/issues`
    out.push({ id: issuesId, parentId: id, kind: 'issues', name: 'Reported environment issues', count: env.issues.length, detail: '', fetchedAt: at })
    for (const issue of env.issues) {
      out.push({ id: `${issuesId}/${issue.n}`, parentId: issuesId, kind: 'issue', name: issue.title, detail: issue.bug, fetchedAt: at })
    }

    const plansId = `${id}/plans`
    out.push({ id: plansId, parentId: id, kind: 'plans', name: 'Test plans', count: env.plans.length, detail: '', fetchedAt: at })
    for (const plan of env.plans) {
      const planId = `${plansId}/${plan.key}`
      out.push({
        id: planId, parentId: plansId, kind: 'plan', name: plan.name, manual: plan.manual, tests: plan.tests,
        detail: `${plan.tests.length} tests, ${plan.runs.length} run${plan.runs.length === 1 ? '' : 's'}`, fetchedAt: at,
      })
      // Newest run first, the one a reviewer cares about.
      for (const run of [...plan.runs].reverse()) {
        const runId = `${planId}/runs/${run.n}`
        out.push({
          id: runId, parentId: planId, kind: 'run', name: `Run ${run.n}`, runStatus: run.status,
          done: run.results.length, total: plan.tests.length,
          detail: run.status === 'queued' ? 'waiting for a machine' : `started ${clock(run.startedAt)}`, fetchedAt: at,
        })
        for (const outcome of OUTCOMES) {
          const bucketId = `${runId}/${outcome}`
          const hits = run.results.filter((r) => r.outcome === outcome)
          out.push({ id: bucketId, parentId: runId, kind: 'bucket', name: OUTCOME_LABEL[outcome], outcome, count: hits.length, detail: '', fetchedAt: at })
          for (const r of hits) {
            out.push({ id: `${bucketId}/${r.test}`, parentId: bucketId, kind: 'result', name: r.test, outcome, seconds: r.seconds, detail: r.comment, fetchedAt: at })
          }
        }
      }
    }
    return out
  }

  // ---- The server -------------------------------------------------------------
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 260 + Math.random() * 420))
  const envKeyOf = (id: string) => id.slice(4).split('/')[0]
  const findEnv = (id: string) => db.find((e) => e.key === envKeyOf(id))
  function findPlan(id: string): PlanRec | undefined {
    const m = /\/plans\/([^/]+)/.exec(id)
    return m ? findEnv(id)?.plans.find((p) => p.key === m[1]) : undefined
  }
  function findRun(id: string): RunRec | undefined {
    const m = /\/runs\/(\d+)/.exec(id)
    return m ? findPlan(id)?.runs.find((r) => r.n === Number(m[1])) : undefined
  }
  const inSubtree = (rootId: string, id: string) => id === rootId || id.startsWith(rootId + '/')

  const server = {
    snapshot(): TestRow[] {
      const at = Date.now()
      return db.flatMap((env) => envRows(env, at))
    },
    async getSubtree(id: string): Promise<TestRow[]> {
      await wait()
      const env = findEnv(id)
      return env ? envRows(env, Date.now()).filter((r) => inSubtree(id, r.id)) : []
    },
    async setReview(envIds: string[], review: Review): Promise<void> {
      await wait()
      for (const id of envIds) {
        const env = findEnv(id)
        if (env) env.review = review
      }
    },
    async addIssue(envId: string, title: string, bug: string): Promise<void> {
      await wait()
      const env = findEnv(envId)
      if (env) env.issues.push({ n: env.issues.length + 1, title, bug })
    },
    async rerun(planId: string): Promise<number> {
      await wait()
      const env = findEnv(planId)
      const plan = findPlan(planId)
      if (!env || !plan) return 0
      const n = plan.runs.length + 1
      plan.runs.push(
        plan.manual
          // A manual run is open until a tester has reported every test.
          ? { n, status: 'running', startedAt: Date.now(), startAt: 0, results: [], pending: [] }
          : { n, status: 'queued', startedAt: 0, startAt: Date.now() + 3000, results: [], pending: resultsFor(env.key, plan.tests) },
      )
      return n
    },
    async addResult(runId: string, result: TestResult): Promise<void> {
      await wait()
      const plan = findPlan(runId)
      const run = findRun(runId)
      if (!plan || !run) return
      run.results = [...run.results.filter((r) => r.test !== result.test), result]
      run.pending = run.pending.filter((r) => r.test !== result.test)
      if (run.results.length >= plan.tests.length) run.status = 'complete'
    },
    // The lab keeps working whether or not anyone is looking.
    tick() {
      const now = Date.now()
      for (const env of db) {
        for (const plan of env.plans) {
          for (const run of plan.runs) {
            if (run.status === 'queued' && run.startAt <= now) {
              run.status = 'running'
              run.startedAt = now
            } else if (run.status === 'running' && run.pending.length) {
              run.results.push(run.pending.shift()!)
              if (!run.pending.length) run.status = 'complete'
            }
          }
        }
      }
    },
  }

  // ---- Client state -----------------------------------------------------------
  const firstLoad = server.snapshot()
  let rows = $state<TestRow[]>(firstLoad)
  let expanded = $state<Record<string, boolean>>({
    'env:amd64-precision-3680': true,
    'env:amd64-precision-3680/plans': true,
    'env:amd64-precision-3680/plans/automated': true,
    'env:amd64-precision-3680/plans/automated/runs/2': true,
    'env:arm64-manual': true,
    'env:arm64-manual/plans': true,
    'env:arm64-manual/plans/manual': true,
    'env:arm64-manual/plans/manual/runs/1': true,
  })
  let reloading = $state<Record<string, boolean>>({})
  let arrived = $state<Record<string, number>>({})
  let selected = $state<Record<string, boolean>>({})
  let now = $state(Date.now())

  type LogEntry = { n: number; at: number; method: 'GET' | 'POST' | 'PATCH'; path: string; note: string }
  let log = $state<LogEntry[]>([{ n: 1, at: Date.now(), method: 'GET', path: `/api/v1/artefacts/${slug(ARTEFACT)}/environments`, note: `${firstLoad.length} rows, page load` }])
  function record(method: LogEntry['method'], path: string, note: string) {
    log = [{ n: (log[0]?.n ?? 0) + 1, at: Date.now(), method, path, note }, ...log].slice(0, 5)
  }

  $effect(() => {
    const lab = setInterval(() => server.tick(), 1800)
    const clockTimer = setInterval(() => (now = Date.now()), 1000)
    return () => {
      clearInterval(lab)
      clearInterval(clockTimer)
    }
  })

  function apiPath(id: string): string {
    return `/api/v1/environments/${id.slice(4)}`
  }

  /** Re-read one node and everything under it, and splice it back in place. */
  async function reload(id: string): Promise<void> {
    if (reloading[id]) return
    reloading = { ...reloading, [id]: true }
    const t0 = performance.now()
    try {
      const next = await server.getSubtree(id)
      const before = new Map(rows.filter((r) => inSubtree(id, r.id)).map((r) => [r.id, r]))
      const at = rows.findIndex((r) => r.id === id)
      const rest = rows.filter((r) => !inSubtree(id, r.id))
      // The subtree is one contiguous block starting at the node, so the rows
      // before it are exactly rest's first `at` entries.
      rows = at < 0 ? [...rest, ...next] : [...rest.slice(0, at), ...next, ...rest.slice(at)]

      const stamp = Date.now()
      const fresh = next.filter((r) => !before.has(r.id) && (r.kind === 'result' || r.kind === 'issue' || r.kind === 'run'))
      if (fresh.length) arrived = { ...arrived, ...Object.fromEntries(fresh.map((r) => [r.id, stamp])) }

      const results = fresh.filter((r) => r.kind === 'result').length
      const ms = Math.round(performance.now() - t0)
      const note = results
        ? `${results} new result${results === 1 ? '' : 's'}`
        : fresh.length ? `${fresh.length} new` : 'no changes'
      record('GET', apiPath(id), `${next.length} rows, ${ms} ms, ${note}`)
    } finally {
      reloading = Object.fromEntries(Object.entries(reloading).filter(([key]) => key !== id))
    }
  }

  function reloadAll() {
    for (const r of rows) if (r.kind === 'env') void reload(r.id)
  }

  async function setReview(envIds: string[], review: Review) {
    await server.setReview(envIds, review)
    record('PATCH', '/api/v1/environments/review', `${envIds.length} set to ${REVIEW_LABEL[review]}`)
    const ids = new Set(envIds)
    rows = rows.map((r) => (ids.has(r.id) ? { ...r, review } : r))
    selected = {}
  }

  async function rerun(planId: string) {
    const n = await server.rerun(planId)
    record('POST', `${apiPath(planId)}/runs`, `Run ${n} created`)
    expanded = { ...expanded, [planId]: true }
    await reload(planId)
  }

  // ---- Dialogs ----------------------------------------------------------------
  type Dialog = { kind: 'issue'; envId: string; title: string } | { kind: 'result'; runId: string; title: string } | null
  let dialog = $state<Dialog>(null)
  let form = $state({ title: '', bug: '', test: '', outcome: 'passed' as Outcome, comment: '' })
  let saving = $state(false)

  function envLabel(envId: string): string {
    const env = rows.find((r) => r.id === envId)
    return env ? `${env.arch} ${env.name}` : ''
  }

  function openIssue(issuesId: string) {
    const envId = issuesId.replace(/\/issues$/, '')
    form = { title: '', bug: '', test: '', outcome: 'passed', comment: '' }
    dialog = { kind: 'issue', envId, title: `Report an issue on ${envLabel(envId)}` }
  }

  /** Tests in the run's plan that have no result yet. */
  function untested(runId: string): string[] {
    const planId = runId.replace(/\/runs\/\d+$/, '')
    const plan = rows.find((r) => r.id === planId)
    const reported = new Set(rows.filter((r) => r.kind === 'result' && inSubtree(runId, r.id)).map((r) => r.name))
    return (plan?.tests ?? []).filter((t) => !reported.has(t))
  }

  function openResult(runId: string) {
    const first = untested(runId)[0] ?? ''
    const run = rows.find((r) => r.id === runId)
    form = { title: '', bug: '', test: first, outcome: 'passed', comment: '' }
    dialog = { kind: 'result', runId, title: `Add a result to ${run?.name ?? 'run'}, ${envLabel(runId.split('/')[0])}` }
  }

  const testOptions = $derived(dialog?.kind === 'result' ? untested(dialog.runId).map((t) => ({ value: t, label: t })) : [])
  const outcomeOptions = OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))
  const canSave = $derived(
    !saving && (dialog?.kind === 'issue' ? form.title.trim() !== '' : dialog?.kind === 'result' ? form.test !== '' : false),
  )

  async function save() {
    const d = dialog
    if (!d || !canSave) return
    saving = true
    try {
      if (d.kind === 'issue') {
        await server.addIssue(d.envId, form.title.trim(), form.bug.trim() || 'not filed')
        record('POST', `${apiPath(d.envId)}/issues`, form.title.trim())
        const issuesId = `${d.envId}/issues`
        expanded = { ...expanded, [d.envId]: true, [issuesId]: true }
        dialog = null
        await reload(issuesId)
      } else {
        const outcome = form.outcome
        await server.addResult(d.runId, { test: form.test, outcome, seconds: 0, comment: form.comment.trim() })
        record('POST', `${apiPath(d.runId)}/results`, `${form.test}: ${OUTCOME_LABEL[outcome]}`)
        expanded = { ...expanded, [d.runId]: true, [`${d.runId}/${outcome}`]: true }
        dialog = null
        await reload(d.runId)
      }
    } finally {
      saving = false
    }
  }

  // ---- Toolbar ----------------------------------------------------------------
  const selectedIds = $derived(Object.keys(selected).filter((id) => selected[id]))
  const envs = $derived(rows.filter((r) => r.kind === 'env'))
  const summary = $derived.by(() => {
    let failed = 0
    let running = 0
    for (const r of rows) {
      if (r.kind === 'bucket' && r.outcome === 'failed') failed += r.count ?? 0
      if (r.kind === 'run' && r.runStatus !== 'complete') running += 1
    }
    const approved = envs.filter((e) => e.review === 'approved').length
    return { failed, running, approved }
  })

  function expandAll() {
    const parents = new Set(rows.map((r) => r.parentId).filter((p): p is string => p != null))
    expanded = Object.fromEntries([...parents].map((id) => [id, true]))
  }

  function toggleSelected(id: string) {
    selected = { ...selected, [id]: !selected[id] }
  }

  // ---- Formatting -------------------------------------------------------------
  function clock(t: number): string {
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  function ago(t: number): string {
    const s = Math.max(0, Math.round((now - t) / 1000))
    if (s < 5) return 'just now'
    if (s < 60) return `${s} s ago`
    return `${Math.floor(s / 60)} min ago`
  }
  function slug(s: string): string {
    return s.replace(/[^a-z0-9.]+/gi, '-')
  }
  function labelOf(r: TestRow): string {
    if (r.kind === 'issues') return `${r.name} (${r.count ?? 0})`
    if (r.kind === 'bucket') return `${r.name} ${r.count ?? 0}`
    return r.name
  }
  const isNew = (id: string) => arrived[id] != null && now - arrived[id] < 6000
  // A running run's counts go stale while the lab keeps reporting.
  const isBehind = (r: TestRow) => r.kind === 'run' && r.runStatus !== 'complete' && now - r.fetchedAt > 15_000

  const features = tableFeatures({})
  const columns: GridColumns<TestRow> = [
    { id: 'name', header: 'Environment / test', width: 380, fieldFn: (r) => labelOf(r), cell: (ctx) => renderSnippet(NameCell, { row: ctx.row.original }) },
    { id: 'status', header: 'Status', width: 150, fieldFn: (r) => r.review ?? r.runStatus ?? r.outcome ?? '', cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
    { id: 'detail', header: 'Detail', width: 260, fieldFn: (r) => r.detail, cell: (ctx) => renderSnippet(DetailCell, { row: ctx.row.original }) },
    { id: 'updated', header: 'Fetched', width: 110, fieldFn: (r) => (RELOADABLE.has(r.kind) ? ago(r.fetchedAt) : ''), cell: (ctx) => renderSnippet(UpdatedCell, { row: ctx.row.original }) },
    { id: 'actions', header: '', width: 190, fieldFn: () => '', cell: (ctx) => renderSnippet(ActionsCell, { row: ctx.row.original }) },
  ]
</script>

{#snippet NameCell(props: { row: TestRow })}
  {@const r = props.row}
  <span class="tr703-name" data-kind={r.kind}>
    {#if r.kind === 'env'}
      <input
        type="checkbox"
        class="tr703-check"
        checked={!!selected[r.id]}
        onclick={(e) => e.stopPropagation()}
        onchange={() => toggleSelected(r.id)}
        aria-label={`Select ${r.arch} ${r.name}`}
      />
    {/if}
    {#if RELOADABLE.has(r.kind)}
      <button
        type="button"
        class="tr703-reload"
        class:tr703-spin={!!reloading[r.id]}
        disabled={!!reloading[r.id]}
        title="Reload this subtree from the server"
        aria-label={`Reload ${r.kind === 'env' ? `${r.arch} ${r.name}` : r.name}`}
        onclick={(e) => { e.stopPropagation(); void reload(r.id) }}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
          <polyline points="13.5 2.5 13.5 5.5 10.5 5.5" />
        </svg>
      </button>
    {/if}
    {#if r.kind === 'env'}
      <span class="tr703-arch">{r.arch}</span>
    {:else if r.kind === 'bucket' || r.kind === 'result'}
      <span class="tr703-glyph" data-outcome={r.outcome} aria-hidden="true">
        {#if r.outcome === 'passed'}
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.5" /><polyline points="5 8.2 7.1 10.2 11 6" /></svg>
        {:else if r.outcome === 'failed'}
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.5" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" /></svg>
        {:else}
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.5" /><path d="M5 8h6" /></svg>
        {/if}
      </span>
    {/if}
    <span class="tr703-label" class:tr703-mono={r.kind === 'result'}>{labelOf(r)}</span>
    {#if isNew(r.id)}<span class="tr703-new">new</span>{/if}
  </span>
{/snippet}

{#snippet StatusCell(props: { row: TestRow })}
  {@const r = props.row}
  {#if r.kind === 'env' && r.review}
    <span class="tr703-pill" data-tone={r.review}>{REVIEW_LABEL[r.review]}</span>
  {:else if r.kind === 'run'}
    {#if r.runStatus === 'queued'}
      <span class="tr703-pill" data-tone="undecided">Queued</span>
    {:else if r.runStatus === 'running'}
      <span class="tr703-progress" title={`${r.done} of ${r.total} tests reported`}>
        <span class="tr703-bar"><span style={`width:${((r.done ?? 0) / (r.total || 1)) * 100}%`}></span></span>
        <span class="tr703-num">{r.done}/{r.total}</span>
      </span>
    {:else}
      <span class="tr703-pill" data-tone="done">Complete</span>
    {/if}
  {:else if r.kind === 'plan'}
    <span class="tr703-tag">{r.manual ? 'manual' : 'automated'}</span>
  {:else if r.kind === 'result' && r.outcome}
    <span class="tr703-pill" data-tone={r.outcome}>{OUTCOME_LABEL[r.outcome]}</span>
  {/if}
{/snippet}

{#snippet DetailCell(props: { row: TestRow })}
  {@const r = props.row}
  {#if r.kind === 'result'}
    <span class="tr703-detail">
      {#if r.seconds}<span class="tr703-num">{r.seconds} s</span>{/if}
      {#if r.detail}<span class="tr703-muted" title={r.detail}>{r.detail}</span>{/if}
    </span>
  {:else if r.kind === 'issue'}
    <span class="tr703-bug">{r.detail}</span>
  {:else}
    <span class="tr703-muted">{r.detail}</span>
  {/if}
{/snippet}

{#snippet UpdatedCell(props: { row: TestRow })}
  {@const r = props.row}
  {#if RELOADABLE.has(r.kind)}
    <span class="tr703-ago" class:tr703-behind={isBehind(r)} title={isBehind(r) ? 'The lab may have reported more results since. Reload this run.' : undefined}>
      {ago(r.fetchedAt)}
    </span>
  {/if}
{/snippet}

{#snippet ActionsCell(props: { row: TestRow })}
  {@const r = props.row}
  <span class="tr703-actions">
    {#if r.kind === 'env'}
      {#if r.review === 'undecided'}
        <button type="button" class="tr703-link" onclick={() => setReview([r.id], 'approved')}>Approve</button>
        <button type="button" class="tr703-link" onclick={() => setReview([r.id], 'rejected')}>Reject</button>
      {:else}
        <button type="button" class="tr703-link" onclick={() => setReview([r.id], 'undecided')}>Reopen</button>
      {/if}
    {:else if r.kind === 'issues'}
      <button type="button" class="tr703-link" onclick={() => openIssue(r.id)}>Add</button>
    {:else if r.kind === 'plan'}
      <button type="button" class="tr703-link" onclick={() => rerun(r.id)}>Rerun</button>
    {:else if r.kind === 'run' && r.runStatus !== 'queued' && untested(r.id).length}
      <button type="button" class="tr703-link" onclick={() => openResult(r.id)}>Add result</button>
    {/if}
  </span>
{/snippet}

<section class="tr703 flex flex-col flex-1 min-h-0 gap-3">
  <header class="tr703-head">
    <div class="tr703-artefact">
      <span class="tr703-mono">{ARTEFACT}</span>
      <span class="tr703-tag">proposed</span>
    </div>
    <div class="tr703-facts">
      <span><strong>{summary.approved}</strong> of {envs.length} environments approved</span>
      <span><strong>{summary.failed}</strong> failed results</span>
      <span><strong>{summary.running}</strong> {summary.running === 1 ? 'run' : 'runs'} open</span>
    </div>
  </header>

  <div class="tr703-toolbar">
    {#if selectedIds.length}
      <span class="tr703-muted">{selectedIds.length} selected</span>
      <SvButton size="sm" onclick={() => setReview(selectedIds, 'approved')}>Approve</SvButton>
      <SvButton size="sm" variant="outline" onclick={() => setReview(selectedIds, 'rejected')}>Reject</SvButton>
      <SvButton size="sm" variant="ghost" onclick={() => (selected = {})}>Clear</SvButton>
    {:else}
      <span class="tr703-muted">Tick environments to review them together. The reload icon re-reads that node and everything under it.</span>
    {/if}
    <span class="tr703-spacer"></span>
    <SvButton size="sm" variant="outline" onclick={expandAll}>Expand all</SvButton>
    <SvButton size="sm" variant="outline" onclick={() => (expanded = {})}>Collapse all</SvButton>
    <SvButton size="sm" variant="outline" onclick={reloadAll}>Reload all</SvButton>
  </div>

  <div class="tr703-grid flex-1 min-h-0">
    <SvGrid
      data={rows}
      {columns}
      {features}
      treeData={{ parentField: 'parentId', column: 'name', indentPx: 18 }}
      getRowId={(r) => r.id}
      {expanded}
      onExpandedChange={(next) => (expanded = next)}
      selectionMode="none"
      filterMode="none"
      enableInlineEditing={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns
      columnResize
      responsive
    />
  </div>

  <ol class="tr703-log" aria-label="Requests" aria-live="polite">
    {#each log as entry (entry.n)}
      <li>
        <span class="tr703-method" data-method={entry.method}>{entry.method}</span>
        <span class="tr703-path">{entry.path}</span>
        <span class="tr703-muted">{entry.note}</span>
      </li>
    {/each}
  </ol>
</section>

<SvModal open={dialog != null} onClose={() => (dialog = null)} title={dialog?.title ?? ''} width={480}>
  {#if dialog?.kind === 'issue'}
    <div class="tr703-form">
      <label class="tr703-field">
        <span>What is wrong with this environment</span>
        <SvTextInput value={form.title} onChange={(v) => (form.title = v)} placeholder="Fan runs at full speed after resume" ariaLabel="Issue" block autofocus />
      </label>
      <label class="tr703-field">
        <span>Bug reference</span>
        <SvTextInput value={form.bug} onChange={(v) => (form.bug = v)} placeholder="BUG-4130" ariaLabel="Bug reference" block />
      </label>
    </div>
  {:else if dialog?.kind === 'result'}
    <div class="tr703-form">
      {#if testOptions.length}
        <div class="tr703-field">
          <span>Test</span>
          <SvDropDownList options={testOptions} value={form.test} onChange={(v) => (form.test = String(v))} ariaLabel="Test" block />
        </div>
        <div class="tr703-field">
          <span>Outcome</span>
          <SvSegmented options={outcomeOptions} value={form.outcome} onChange={(v) => (form.outcome = OUTCOMES.find((o) => o === v) ?? 'passed')} />
        </div>
        <label class="tr703-field">
          <span>Comment</span>
          <SvTextArea value={form.comment} onChange={(v) => (form.comment = v)} rows={3} placeholder="What the tester saw" ariaLabel="Comment" block />
        </label>
      {:else}
        <p class="tr703-muted">Every test in this plan already has a result in this run.</p>
      {/if}
    </div>
  {/if}
  {#snippet footer()}
    <SvButton variant="ghost" onclick={() => (dialog = null)}>Cancel</SvButton>
    <SvButton variant="primary" disabled={!canSave} loading={saving} onclick={save}>Save</SvButton>
  {/snippet}
</SvModal>

<style>
  .tr703 { min-height: 0; }

  .tr703-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 16px;
    flex-shrink: 0;
  }
  .tr703-artefact { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--sg-fg); }
  .tr703-facts { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12.5px; color: var(--sg-muted); }
  .tr703-facts strong { color: var(--sg-fg); font-variant-numeric: tabular-nums; }

  .tr703-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    flex-shrink: 0;
    font-size: 12.5px;
  }
  .tr703-spacer { flex: 1; }

  .tr703-grid {
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .tr703-log {
    list-style: none;
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    background: var(--sg-header-bg);
    font-size: 11.5px;
    flex-shrink: 0;
    display: grid;
    gap: 2px;
  }
  .tr703-log li { display: flex; gap: 8px; min-width: 0; white-space: nowrap; }
  .tr703-path {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--sg-fg);
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .tr703-method {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
    width: 44px;
    flex-shrink: 0;
    color: var(--sg-muted);
  }
  .tr703-method[data-method='POST'], .tr703-method[data-method='PATCH'] { color: var(--sg-accent); }

  .tr703-form { display: grid; gap: 14px; }
  .tr703-field { display: grid; gap: 6px; font-size: 12.5px; color: var(--sg-muted); }

  /* Cells render inside the grid, so their rules are global. */
  :global(.tr703-name) {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  :global(.tr703-name[data-kind='env'] .tr703-label) { font-weight: 600; }
  :global(.tr703-label) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global(.tr703-mono) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
  :global(.tr703-check) { width: 14px; height: 14px; margin: 0; accent-color: var(--sg-accent); flex-shrink: 0; }
  :global(.tr703-reload) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--sg-muted);
    cursor: pointer;
    flex-shrink: 0;
  }
  :global(.tr703-reload:hover) { background: var(--sg-header-bg); color: var(--sg-fg); }
  :global(.tr703-reload:focus-visible) { outline: 2px solid var(--sg-focus-ring, var(--sg-accent)); outline-offset: 1px; }
  :global(.tr703-reload:disabled) { cursor: default; }
  :global(.tr703-spin svg) { animation: tr703-spin 0.8s linear infinite; }
  @keyframes -global-tr703-spin { to { transform: rotate(360deg); } }
  :global(.tr703-arch) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--sg-fg);
  }
  :global(.tr703-glyph) { display: inline-flex; flex-shrink: 0; }
  :global(.tr703-glyph[data-outcome='failed']) { color: var(--sg-danger, #dc2626); }
  :global(.tr703-glyph[data-outcome='passed']) { color: var(--sg-success, #16a34a); }
  :global(.tr703-glyph[data-outcome='skipped']) { color: var(--sg-muted); }
  :global(.tr703-new) {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 6px;
    border-radius: 999px;
    color: var(--sg-accent);
    border: 1px solid currentColor;
    flex-shrink: 0;
  }

  :global(.tr703-pill) {
    display: inline-block;
    padding: 1px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    border: 1px solid var(--sg-border);
    color: var(--sg-muted);
    white-space: nowrap;
  }
  :global(.tr703-pill[data-tone='approved']),
  :global(.tr703-pill[data-tone='passed']) {
    color: var(--sg-success, #16a34a);
    border-color: color-mix(in srgb, var(--sg-success, #16a34a) 45%, transparent);
  }
  :global(.tr703-pill[data-tone='rejected']),
  :global(.tr703-pill[data-tone='failed']) {
    color: var(--sg-danger, #dc2626);
    border-color: color-mix(in srgb, var(--sg-danger, #dc2626) 45%, transparent);
  }
  :global(.tr703-pill[data-tone='done']) { color: var(--sg-fg); }
  :global(.tr703-tag) {
    font-size: 11px;
    padding: 0 7px;
    border-radius: 4px;
    background: var(--sg-header-bg);
    color: var(--sg-muted);
    font-weight: 500;
  }
  :global(.tr703-progress) { display: inline-flex; align-items: center; gap: 8px; width: 100%; }
  :global(.tr703-bar) {
    flex: 1;
    max-width: 80px;
    height: 5px;
    border-radius: 999px;
    background: var(--sg-border);
    overflow: hidden;
  }
  :global(.tr703-bar > span) { display: block; height: 100%; background: var(--sg-accent); transition: width 300ms ease; }
  :global(.tr703-num) { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--sg-fg); }

  :global(.tr703-detail) { display: inline-flex; gap: 10px; min-width: 0; }
  :global(.tr703-muted) { color: var(--sg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global(.tr703-bug) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--sg-fg); }
  :global(.tr703-ago) { font-size: 12px; color: var(--sg-muted); font-variant-numeric: tabular-nums; }
  :global(.tr703-behind) { color: var(--sg-warning, #b45309); }

  :global(.tr703-actions) { display: flex; justify-content: flex-end; gap: 12px; width: 100%; padding-right: 10px; }
  :global(.tr703-link) {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--sg-accent);
    font-size: 12.5px;
    cursor: pointer;
  }
  :global(.tr703-link:hover) { text-decoration: underline; }
  :global(.tr703-link:focus-visible) { outline: 2px solid var(--sg-focus-ring, var(--sg-accent)); outline-offset: 2px; border-radius: 2px; }
</style>
