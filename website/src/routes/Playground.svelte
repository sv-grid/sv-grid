<script lang="ts">
  /**
   * Playground tool
   * ---------------
   * Not a demo - a standalone tool reachable only via the "Edit" button on a
   * demo. It loads the demo's ACTUAL Svelte source, compiles it in the browser
   * (TypeScript + Svelte compiler, against the app's own runtimes), and mounts
   * it live. Edit the source on the left; the real demo re-runs on the right.
   *
   * Optional AI assist: paste your own Anthropic API key and describe a change
   * in plain English. The key stays in your browser (localStorage) and is sent
   * directly to Anthropic - nothing is proxied.
   */
  import { mount, unmount } from 'svelte'
  import { CATALOG, GRID_PROPS, COLUMN_OPTIONS } from '../lib/playground-catalog'
  import { compileComponent } from '../lib/svelte-runner'
  import { downloadProject, buildStandaloneHtml } from '../lib/project-export'
  import { findDemo, demoGroups, communityDemos, type Demo } from '../lib/demos'
  import { buildShareUrl, withCommunityHeader, slugify, discussionUrl, fetchDiscussionUpvotes, avatarUrl } from '../lib/community'
  import { votingEnabled, getMe, signIn, getReactionState, toggleReaction, type VoteMe, type VoteState } from '../lib/github-vote'
  import { router } from '../lib/router.svelte'

  let { demoId = '' }: { demoId?: string } = $props()

  const DEFAULT_SOURCE = `<script>
  import { SvGrid } from '@svgrid/grid'

  const data = [
    { id: 1, name: 'Ada Lovelace',  dept: 'Engineering', salary: 165000, active: true },
    { id: 2, name: 'Liam Chen',     dept: 'Sales',       salary: 98000,  active: true },
    { id: 3, name: 'Noah Patel',    dept: 'Support',     salary: 72000,  active: false },
    { id: 4, name: 'Mia Rossi',     dept: 'Design',      salary: 88000,  active: true },
    { id: 5, name: 'Zoe Nakamura',  dept: 'Engineering', salary: 142000, active: true },
  ]
  const columns = [
    { field: 'name',   header: 'Name', width: 170 },
    { field: 'dept',   header: 'Department' },
    { field: 'salary', header: 'Salary', align: 'right',
      format: { type: 'currency', currency: 'USD' }, aggregate: 'sum' },
    { field: 'active', header: 'Active', editorType: 'checkbox', align: 'center' },
  ]
<\/script>

<SvGrid
  {data}
  {columns}
  sortable
  filterable
  zebraRows
  selectionMode="both"
  showRowNumbers
  containerHeight="100%"
/>`

  const demoPath = $derived(
    !demoId
      ? 'examples/src/demos/_playground.svelte'
      : demoId.startsWith('community-')
        ? `examples/src/demos/community/${demoId.slice('community-'.length)}.svelte`
        : `examples/src/demos/${demoId}.svelte`,
  )

  let code = $state('')
  let originalSource = $state('')
  let demoTitle = $state('')
  let loadedFor = $state<string | null>(null)
  let hint = $state<string | null>(null)
  let hintTimer: ReturnType<typeof setTimeout> | undefined

  function toast(msg: string) {
    hint = msg
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => (hint = null), 1700)
  }

  function switchDemo(id: string) {
    if (id && id !== demoId) router.navigate(`playground/${id}`)
  }

  // ---- Community demo context (attribution + GitHub-native upvotes) --------
  const currentDemo = $derived(demoId ? findDemo(demoId) : null)
  const isCommunity = $derived(!!currentDemo && currentDemo.id === demoId && !!currentDemo.community)
  let upvotes = $state<number | null>(null)
  $effect(() => {
    upvotes = null
    const n = isCommunity ? currentDemo?.discussion ?? 0 : 0
    if (n > 0) fetchDiscussionUpvotes(n).then((v) => (upvotes = v))
  })

  // In-place voting (optional): when VITE_VOTE_API is configured, the Upvote
  // control becomes a live 👍 toggle via the visitor's own GitHub account (token
  // stays server-side in the worker). Without it, `canVote` is false and the UI
  // falls back to linking out to the discussion.
  const canVote = votingEnabled()
  let voteMe = $state<VoteMe | null>(null)
  let voteState = $state<VoteState | null>(null)
  let voteBusy = $state(false)
  const displayCount = $derived(voteState?.count ?? upvotes)
  const displayReacted = $derived(voteState?.viewerReacted ?? false)
  $effect(() => {
    voteState = null
    const n = isCommunity ? currentDemo?.discussion ?? 0 : 0
    if (!canVote || n <= 0) return
    getMe().then((m) => {
      voteMe = m
      if (m.authenticated) getReactionState(n).then((s) => { if (s) voteState = s })
    })
  })
  async function vote() {
    const n = currentDemo?.discussion ?? 0
    if (!n) return
    if (!voteMe?.authenticated) { signIn(window.location.href); return }
    const next = !displayReacted
    const prev = voteState
    voteBusy = true
    voteState = { count: (displayCount ?? 0) + (next ? 1 : -1), viewerReacted: next } // optimistic
    try {
      voteState = await toggleReaction(n, next)
    } catch (e) {
      voteState = prev
      if (e instanceof Error && e.message === 'NOT_AUTHENTICATED') signIn(window.location.href)
      else toast('Could not record your vote')
    } finally {
      voteBusy = false
    }
  }

  // "Share as a community demo" opens a small dialog to set the demo metadata and
  // flag anything that would stop it running as a bare community demo (imports of
  // ../shared/* etc.), then opens GitHub's new-file PR flow pre-filled with the
  // final file. Zero backend.
  let shareOpen = $state(false)
  let shareTitle = $state('')
  let shareTags = $state('')
  const shareFile = $derived(withCommunityHeader(code, { title: shareTitle, tags: shareTags }))
  // GitHub caps new-file URLs at ~8 KB, so only small demos can ride in the URL
  // pre-filled; larger ones open an empty editor + clipboard paste. The dialog
  // says which will happen so an empty editor is never a surprise.
  const shareInlined = $derived(buildShareUrl(shareFile, slugify(shareTitle || 'my-demo')).inlined)
  function openShare() {
    shareTitle = demoTitle || 'My demo'
    shareTags = currentDemo?.tags?.join(', ') ?? ''
    shareOpen = true
  }
  // Runs from the dialog's confirm click, so window.open keeps the user gesture.
  function confirmShare() {
    const slug = slugify(shareTitle || 'my-demo')
    const file = shareFile
    const { url, inlined } = buildShareUrl(file, slug)
    try { void navigator.clipboard?.writeText(file) } catch { /* ignore */ }
    window.open(url, '_blank', 'noopener')
    shareOpen = false
    toast(
      inlined
        ? 'Opened a pre-filled PR on GitHub - review and Propose changes'
        : 'Code copied - press Ctrl/Cmd+V in the GitHub editor to paste it, then Propose changes',
    )
  }

  // ---- Demo picker gallery (switcher) --------------------------------------
  // The switcher opens a gallery-style popover: community demos up top as cards
  // (avatar + upvote count, top-rated first), first-party demos grouped below.
  let galleryOpen = $state(false)
  let gallerySearch = $state('')
  // demo id -> upvote count (null = unknown/loading) and whether the signed-in
  // viewer has 👍'd it. Loaded each time the gallery opens so cards sort by
  // "stars" and render the filled/unfilled vote state.
  let communityStars = $state<Record<string, number | null>>({})
  let communityReacted = $state<Record<string, boolean>>({})
  async function loadCommunityStars() {
    const me = canVote ? await getMe() : { authenticated: false }
    for (const d of communityDemos) {
      const n = d.discussion ?? 0
      if (n <= 0) { communityStars = { ...communityStars, [d.id]: 0 }; continue }
      if (canVote && me.authenticated) {
        // One call gives both the count and the viewer's reaction state.
        getReactionState(n).then((s) => {
          if (s) {
            communityStars = { ...communityStars, [d.id]: s.count }
            communityReacted = { ...communityReacted, [d.id]: s.viewerReacted }
          } else {
            fetchDiscussionUpvotes(n).then((v) => { communityStars = { ...communityStars, [d.id]: v ?? 0 } })
          }
        })
      } else if (communityStars[d.id] == null) {
        fetchDiscussionUpvotes(n).then((v) => { communityStars = { ...communityStars, [d.id]: v ?? 0 } })
      }
    }
  }
  function openGallery() { galleryOpen = true; void loadCommunityStars() }

  // Vote on a card without selecting the demo. Falls back to opening the
  // discussion when in-place voting isn't configured.
  async function voteCard(d: Demo, e: MouseEvent) {
    e.stopPropagation()
    const n = d.discussion ?? 0
    if (!n) return
    if (!canVote) { window.open(discussionUrl(n), '_blank', 'noopener'); return }
    if (!voteMe) voteMe = await getMe()
    if (!voteMe.authenticated) { signIn(window.location.href); return }
    const wasReacted = communityReacted[d.id] ?? false
    const next = !wasReacted
    const prevCount = communityStars[d.id] ?? 0
    communityReacted = { ...communityReacted, [d.id]: next } // optimistic
    communityStars = { ...communityStars, [d.id]: prevCount + (next ? 1 : -1) }
    try {
      const fresh = await toggleReaction(n, next)
      communityStars = { ...communityStars, [d.id]: fresh.count }
      communityReacted = { ...communityReacted, [d.id]: fresh.viewerReacted }
    } catch (err) {
      communityReacted = { ...communityReacted, [d.id]: wasReacted }
      communityStars = { ...communityStars, [d.id]: prevCount }
      if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') signIn(window.location.href)
      else toast('Could not record your vote')
    }
  }
  const gallerySearchToks = $derived(gallerySearch.trim().toLowerCase())
  function demoMatches(d: { title: string; author?: string; tags?: string[] }): boolean {
    if (!gallerySearchToks) return true
    const hay = `${d.title} ${d.author ?? ''} ${(d.tags ?? []).join(' ')}`.toLowerCase()
    return hay.includes(gallerySearchToks)
  }
  // Community demos sorted by stars desc (unknown = 0), then title.
  const communitySorted = $derived(
    [...communityDemos]
      .filter(demoMatches)
      .sort((a, b) => (communityStars[b.id] ?? 0) - (communityStars[a.id] ?? 0) || a.title.localeCompare(b.title)),
  )
  // First-party groups, filtered by the search box (community shown separately).
  // Demos flagged `noPlayground` (they import an npm module the in-browser
  // runner can't resolve - chart.js, ag-grid, hyperformula, PGlite) are hidden
  // from the picker; they're still available via "Edit in StackBlitz".
  const galleryGroups = $derived(
    demoGroups
      .map((g) => ({ category: g.category, demos: g.demos.filter((d) => !d.noPlayground && demoMatches(d)) }))
      .filter((g) => g.demos.length > 0),
  )
  function pickDemo(id: string) {
    galleryOpen = false
    gallerySearch = ''
    switchDemo(id)
  }
  function initials(s: string): string {
    const parts = s.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  }

  // Load the demo's real source (or the default component) when the launching
  // demo changes.
  $effect(() => {
    if (!demoId) {
      if (loadedFor !== '') { code = DEFAULT_SOURCE; originalSource = DEFAULT_SOURCE; demoTitle = ''; loadedFor = '' }
      return
    }
    if (loadedFor !== demoId) {
      loadedFor = demoId
      try {
        const d = findDemo(demoId)
        demoTitle = d?.title ?? demoId
        d?.loadSource?.()
          .then((s) => { const clean = s.replace(/^﻿/, ''); code = clean; originalSource = clean })
          .catch(() => { code = DEFAULT_SOURCE; originalSource = DEFAULT_SOURCE })
      } catch {
        demoTitle = demoId; code = DEFAULT_SOURCE; originalSource = DEFAULT_SOURCE
      }
    }
  })

  // ---- Compile + mount -----------------------------------------------------
  let mountEl: HTMLDivElement | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let instance: any = null
  let styleEl: HTMLStyleElement | null = null
  let compileErr = $state<string | null>(null)
  let compileErrLine = $state<number | null>(null)
  let building = $state(false)
  let ranOnce = $state(false)

  async function build(srcRaw: string) {
    const src = srcRaw.replace(/^﻿/, '')
    if (!src.trim() || !mountEl) return
    building = true
    logs = [] // each recompile is a fresh run
    try {
      const { Component, css } = await compileComponent(src, demoPath)
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.dataset.playground = ''; document.head.appendChild(styleEl) }
      styleEl.textContent = css
      if (instance) { try { unmount(instance) } catch { /* ignore */ } instance = null }
      mountEl.innerHTML = ''
      instance = mount(Component, { target: mountEl })
      compileErr = null
      compileErrLine = null
      ranOnce = true
    } catch (e) {
      compileErr = e instanceof Error ? e.message : String(e)
      // Svelte compile errors carry `start.line`; TS/other errors may not.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      compileErrLine = (e as any)?.start?.line ?? (e as any)?.line ?? null
    } finally {
      building = false
    }
  }

  // Debounced rebuild whenever the source changes.
  let buildTimer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    const src = code
    clearTimeout(buildTimer)
    buildTimer = setTimeout(() => build(src), 260)
    return () => clearTimeout(buildTimer)
  })

  $effect(() => () => {
    if (instance) { try { unmount(instance) } catch { /* ignore */ } }
    styleEl?.remove()
  })

  // ---- Console + runtime errors (surfaced in a panel) ----------------------
  type LogEntry = { type: 'log' | 'warn' | 'error' | 'info'; text: string; n: number }
  let logs = $state<LogEntry[]>([])
  let consoleOpen = $state(false)
  const errorCount = $derived(logs.filter((l) => l.type === 'error').length)
  function fmtArg(a: unknown): string {
    if (typeof a === 'string') return a
    if (a instanceof Error) return a.message
    try { return JSON.stringify(a) } catch { return String(a) }
  }
  function pushLog(type: LogEntry['type'], args: unknown[]) {
    const text = args.map(fmtArg).join(' ')
    const last = logs[logs.length - 1]
    if (last && last.type === type && last.text === text) { last.n += 1; logs = [...logs] }
    else logs = [...logs.slice(-199), { type, text, n: 1 }]
    if (type === 'error') consoleOpen = true
  }
  // Patch the console + window error events while the playground is open so the
  // mounted component's logs/throws show up in the panel (they run in this page).
  $effect(() => {
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info }
    const wrap = (t: LogEntry['type'], fn: (...a: unknown[]) => void) =>
      (...a: unknown[]) => { pushLog(t, a); fn.apply(console, a as never) }
    console.log = wrap('log', orig.log)
    console.warn = wrap('warn', orig.warn)
    console.error = wrap('error', orig.error)
    console.info = wrap('info', orig.info)
    const onErr = (ev: ErrorEvent) => {
      // "ResizeObserver loop completed with undelivered notifications" is a
      // benign browser warning (a resize callback that itself changes layout),
      // not a real error - don't surface it in the panel as one.
      if (/ResizeObserver loop/i.test(ev.message)) return
      pushLog('error', [ev.message || String((ev.error as Error)?.message ?? 'Error')])
    }
    const onRej = (ev: PromiseRejectionEvent) =>
      pushLog('error', ['Unhandled rejection: ' + fmtArg((ev.reason as Error)?.message ?? ev.reason)])
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      Object.assign(console, orig)
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  })

  // ---- Syntax highlighting (dependency-free overlay) -----------------------
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const HL_RE =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(true|false|null|undefined)\b|\b(import|from|export|const|let|function|return|if|else|for|of|new|await|async)\b|(-?\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*:)|(=>|[{}[\](),;:.])/g
  function highlight(src: string): string {
    let out = ''
    let last = 0
    let m: RegExpExecArray | null
    HL_RE.lastIndex = 0
    while ((m = HL_RE.exec(src))) {
      out += esc(src.slice(last, m.index))
      const t = m[0]
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'b' : m[4] ? 'w' : m[5] ? 'n' : m[6] ? 'k' : 'p'
      out += `<span class="t-${cls}">${esc(t)}</span>`
      last = m.index + t.length
    }
    out += esc(src.slice(last))
    return out + '\n'
  }
  const highlighted = $derived(highlight(code))
  const lineCount = $derived(code ? code.split('\n').length : 1)

  let taEl: HTMLTextAreaElement | undefined
  let preEl: HTMLPreElement | undefined
  let gutterEl: HTMLDivElement | undefined
  let errLineEl: HTMLDivElement | undefined
  function syncScroll() {
    if (!taEl) return
    if (preEl) { preEl.scrollTop = taEl.scrollTop; preEl.scrollLeft = taEl.scrollLeft }
    if (gutterEl) gutterEl.scrollTop = taEl.scrollTop
    if (errLineEl) errLineEl.style.transform = `translateY(${-taEl.scrollTop}px)`
  }

  // ---- Resizable split (editor | preview) ----------------------------------
  const SPLIT_STORE = 'sg-playground-split'
  const SPLIT_MIN = 22
  const SPLIT_MAX = 78
  let bodyEl: HTMLDivElement | undefined
  let editorPct = $state(50)
  let dragging = $state(false)
  const clampSplit = (v: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v))
  $effect(() => {
    try {
      const v = parseFloat(localStorage.getItem(SPLIT_STORE) ?? '')
      if (Number.isFinite(v)) editorPct = clampSplit(v)
    } catch { /* storage blocked */ }
  })
  function persistSplit() {
    try { localStorage.setItem(SPLIT_STORE, String(Math.round(editorPct))) } catch { /* ignore */ }
  }
  function startSplit(e: PointerEvent) {
    if (!bodyEl) return
    e.preventDefault()
    dragging = true
    const rect = bodyEl.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      editorPct = clampSplit(((ev.clientX - rect.left) / rect.width) * 100)
    }
    const up = () => {
      dragging = false
      persistSplit()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  function nudgeSplit(e: KeyboardEvent) {
    const step = e.shiftKey ? 5 : 2
    if (e.key === 'ArrowLeft') { editorPct = clampSplit(editorPct - step); persistSplit(); e.preventDefault() }
    else if (e.key === 'ArrowRight') { editorPct = clampSplit(editorPct + step); persistSplit(); e.preventDefault() }
    else if (e.key === 'Home') { editorPct = 50; persistSplit(); e.preventDefault() }
  }
  function resetSplit() { editorPct = 50; persistSplit() }

  // ---- Reference drawer ----------------------------------------------------
  let refOpen = $state(false)
  let search = $state('')
  let refFilter = $state<'all' | 'Grid props' | 'Column options'>('all')
  const matches = (text: string) => text.toLowerCase().includes(search.trim().toLowerCase())
  const filteredCatalog = $derived(
    CATALOG.filter((g) => refFilter === 'all' || g.title === refFilter)
      .map((g) => ({ ...g, entries: g.entries.filter((e) => matches(e.name) || matches(e.description)) }))
      .filter((g) => g.entries.length > 0),
  )
  function copyEntry(snippet: string) {
    const key = snippet.split(':')[0]!.trim()
    void navigator.clipboard?.writeText(snippet)
    toast(`Copied ${key}`)
  }

  function reset() { code = originalSource; toast('Reset to demo source') }
  function copySource() { void navigator.clipboard?.writeText(code); toast('Source copied') }
  let copyingHtml = $state(false)
  async function copyRunnable() {
    if (copyingHtml) return
    copyingHtml = true
    try {
      const html = await buildStandaloneHtml(code, demoTitle || 'Playground')
      await navigator.clipboard.writeText(html)
      toast('Runnable HTML copied')
    } catch (e) {
      toast('Copy failed')
      console.error(e)
    } finally {
      copyingHtml = false
    }
  }

  let downloading = $state(false)
  async function download() {
    downloading = true
    try {
      const name = await downloadProject(code, demoId || 'playground', demoTitle || 'Playground')
      toast(`Downloaded ${name}`)
    } catch (e) {
      toast('Download failed')
      console.error(e)
    } finally {
      downloading = false
    }
  }

  function onEditorKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget as HTMLTextAreaElement
      const { selectionStart: s, selectionEnd: en } = el
      code = code.slice(0, s) + '  ' + code.slice(en)
      queueMicrotask(() => (el.selectionStart = el.selectionEnd = s + 2))
    }
  }

  // ---- Optional AI assist --------------------------------------------------
  const KEY_STORE = 'sg-playground-anthropic-key'
  let showAi = $state(false)
  let apiKey = $state('')
  let model = $state('claude-sonnet-4-6')
  let aiPrompt = $state('')
  let aiBusy = $state(false)
  let aiError = $state<string | null>(null)
  // The AI returns a proposed source; the user reviews a diff and accepts/rejects.
  let aiPending = $state<string | null>(null)

  const STARTER_PROMPTS = [
    'Group rows by the first text column',
    'Colour negative numbers red',
    'Add a Status column with a coloured badge',
    'Enable pagination, 25 rows per page',
  ]

  $effect(() => {
    try {
      const k = localStorage.getItem(KEY_STORE) ?? ''
      if (k && !apiKey) { apiKey = k; showAi = true }
    } catch { /* storage blocked */ }
  })
  $effect(() => {
    try { if (apiKey) localStorage.setItem(KEY_STORE, apiKey) } catch { /* ignore */ }
  })
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (aiPending != null) aiPending = null; else if (shareOpen) shareOpen = false; else if (galleryOpen) galleryOpen = false; else if (refOpen) refOpen = false }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function propSummary(): string {
    const grid = GRID_PROPS.map((p) => `${p.name}: ${p.type}`).join('\n')
    const col = COLUMN_OPTIONS.map((p) => `${p.name}: ${p.type}`).join('\n')
    return `GRID PROPS (on <SvGrid>):\n${grid}\n\nCOLUMN OPTIONS (per column def):\n${col}`
  }
  function stripFences(s: string): string {
    return s.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
  }

  // Minimal LCS line diff for the accept/reject review.
  type DiffLine = { t: 'ctx' | 'add' | 'del'; s: string }
  function lineDiff(a: string, b: string): DiffLine[] {
    const A = a.split('\n'), B = b.split('\n')
    const m = A.length, n = B.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = m - 1; i >= 0; i--)
      for (let j = n - 1; j >= 0; j--)
        dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    const out: DiffLine[] = []
    let i = 0, j = 0
    while (i < m && j < n) {
      if (A[i] === B[j]) { out.push({ t: 'ctx', s: A[i]! }); i++; j++ }
      else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ t: 'del', s: A[i]! }); i++ }
      else { out.push({ t: 'add', s: B[j]! }); j++ }
    }
    while (i < m) out.push({ t: 'del', s: A[i++]! })
    while (j < n) out.push({ t: 'add', s: B[j++]! })
    return out
  }
  const aiDiff = $derived(aiPending != null ? lineDiff(code, aiPending) : [])
  const aiDiffStat = $derived.by(() => {
    let add = 0, del = 0
    for (const d of aiDiff) { if (d.t === 'add') add++; else if (d.t === 'del') del++ }
    return { add, del }
  })

  async function runAi(instruction: string) {
    if (!apiKey.trim()) { showAi = true; aiError = 'Add your Anthropic API key first.'; return }
    aiBusy = true
    aiError = null
    aiPending = null
    try {
      const system = [
        'You edit a single Svelte 5 component (runes mode) that renders the SvGrid data grid. The component uses `import { SvGrid } from "@svgrid/grid"` and passes `data`, `columns` and props.',
        'Reference of available props / column options:',
        propSummary(),
        'Keep it a valid, self-contained Svelte 5 component. Preserve imports and structure unless the instruction requires changing them.',
        'Return ONLY the complete updated .svelte source. No markdown, no code fences, no explanation.',
      ].join('\n\n')
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          system,
          messages: [
            { role: 'user', content: `Current component:\n\n${code}\n\nInstruction: ${instruction}\n\nReturn the complete updated .svelte source only.` },
          ],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`)
      const text = (json.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
      const next = stripFences(text)
      if (next === code.trim() || !next) { aiError = 'The AI returned no change.'; return }
      aiPending = next
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e)
    } finally {
      aiBusy = false
    }
  }
  function askAi() { if (aiPrompt.trim()) runAi(aiPrompt.trim()) }
  function fixWithAi() {
    showAi = true
    if (!compileErr) return
    runAi(`This Svelte component currently fails with the following error:\n\n${compileErr}\n\nFix the component so it compiles and runs. Return the complete corrected source.`)
  }
  function acceptAi() {
    if (aiPending != null) { code = aiPending; aiPending = null; aiPrompt = ''; toast('Applied AI edit') }
  }
  function rejectAi() { aiPending = null }

  const fileLabel = $derived(demoId ? `${demoId}.svelte` : 'Component.svelte')
</script>

<div class="pg">
  <!-- Top app bar -->
  <header class="pg-bar">
    <div class="pg-bar-l">
      <span class="pg-eyebrow"><span class="pg-spark">✦</span> Playground</span>
      <div class="pg-switch">
        <button class="pg-switch-trigger" onclick={openGallery} title="Browse demos" aria-haspopup="dialog" aria-expanded={galleryOpen}>
          <span class="pg-switch-label">{demoTitle || 'Custom sketch'}</span>
          {#if isCommunity}<span class="pg-switch-badge">Community</span>{/if}
          <svg class="pg-switch-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {#if demoTitle && !isCommunity}
        <a class="pg-back" href={`demos/${demoId}`} onclick={(e) => { e.preventDefault(); router.navigate(`demos/${demoId}`) }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          back to demo
        </a>
      {/if}
    </div>
    <div class="pg-bar-r">
      <button class="pg-btn" onclick={copySource} title="Copy the source">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        <span class="pg-btn-t">Copy</span>
      </button>
      <button class="pg-btn" onclick={copyRunnable} disabled={copyingHtml} title="Copy a single-file Svelte page - it embeds this source, compiles it in the browser, and runs. Paste into a file, save as .html, open.">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        <span class="pg-btn-t">{copyingHtml ? 'Building…' : 'Runnable'}</span>
      </button>
      <button class="pg-btn" onclick={reset} title="Reset to the original demo source">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        <span class="pg-btn-t">Reset</span>
      </button>
      <button class="pg-btn" onclick={download} disabled={downloading} title="Download a runnable npm project (npm install && npm run dev)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
        <span class="pg-btn-t">Download</span>
      </button>
      <button class="pg-btn" onclick={openShare} title="Share this as a community demo - opens a pre-filled GitHub pull request">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98" /><path d="M15.41 6.51l-6.82 3.98" /></svg>
        <span class="pg-btn-t">Share</span>
      </button>
      <span class="pg-div"></span>
      <button class="pg-btn" class:on={showAi} onclick={() => (showAi = !showAi)} title="AI assist (bring your own key)">
        <span class="pg-spark">✦</span><span class="pg-btn-t">AI assist</span>
      </button>
      <button class="pg-btn accent" class:on={refOpen} onclick={() => (refOpen = !refOpen)} title="Property reference">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
        <span class="pg-btn-t">Reference</span>
      </button>
    </div>
  </header>

  {#if galleryOpen}
    <!-- Demo picker gallery: community demos as ranked cards, first-party below -->
    <div class="pg-gallery" role="dialog" aria-modal="true" aria-label="Browse demos">
      <button class="pg-gallery-scrim" aria-label="Close gallery" onclick={() => (galleryOpen = false)}></button>
      <div class="pg-gallery-panel">
        <div class="pg-gallery-head">
          <svg class="pg-gallery-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <!-- svelte-ignore a11y_autofocus -->
          <input class="pg-gallery-search" placeholder="Search demos, authors, tags…" bind:value={gallerySearch} autofocus />
          <button class="pg-gallery-x" onclick={() => (galleryOpen = false)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="pg-gallery-body">
          {#if communitySorted.length}
            <div class="pg-gallery-sec">
              <div class="pg-gallery-sec-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                Community · top rated
              </div>
              <div class="pg-gallery-cards">
                {#each communitySorted as d (d.id)}
                  <div class="pg-gcard" class:active={d.id === demoId}>
                    <button class="pg-gcard-open" onclick={() => pickDemo(d.id)} title={d.title}>
                      <span class="pg-gcard-av">
                        {initials(d.author || d.title)}
                        {#if d.authorGithub}
                          <img class="pg-gcard-img" src={avatarUrl(d.authorGithub, 64)} alt="" loading="lazy" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
                        {/if}
                      </span>
                      <span class="pg-gcard-main">
                        <span class="pg-gcard-title">{d.title}</span>
                        <span class="pg-gcard-by">{d.author ? `by ${d.author}` : 'community'}</span>
                      </span>
                    </button>
                    {#if d.discussion}
                      <button
                        class="pg-gcard-stars"
                        class:reacted={communityReacted[d.id]}
                        onclick={(e) => voteCard(d, e)}
                        title={canVote ? (voteMe?.authenticated ? (communityReacted[d.id] ? 'Remove your upvote' : 'Upvote') : 'Sign in with GitHub to upvote') : 'Upvote on GitHub'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        <span class="pg-gcard-stars-n">{communityStars[d.id] ?? '·'}</span>
                      </button>
                    {:else}
                      <span class="pg-gcard-stars pg-gcard-stars-static" title="No upvote thread yet - added when merged">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        <span class="pg-gcard-stars-n">·</span>
                      </span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          <div class="pg-gallery-sec">
            <div class="pg-gallery-sec-title pg-gallery-sec-title-plain">All demos</div>
            {#each galleryGroups as g (g.category)}
              <div class="pg-gallery-group">
                <div class="pg-gallery-group-name">{g.category}<span class="pg-gallery-group-n">{g.demos.length}</span></div>
                <div class="pg-gallery-list">
                  {#each g.demos as d (d.id)}
                    <button class="pg-grow" class:active={d.id === demoId} onclick={() => pickDemo(d.id)} title={d.blurb}>
                      <span class="pg-grow-title">{d.title}</span>
                      {#if d.pro}<span class="pg-grow-pro">Pro</span>{/if}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
            {#if !galleryGroups.length && !communitySorted.length}
              <p class="pg-gallery-empty">No demos match "{gallerySearch}"</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if shareOpen}
    <!-- Share-as-community dialog: metadata + self-contained check -->
    <div class="pg-share" role="dialog" aria-modal="true" aria-label="Share as a community demo">
      <button class="pg-gallery-scrim" aria-label="Close" onclick={() => (shareOpen = false)}></button>
      <div class="pg-share-panel">
        <div class="pg-share-head">
          <span class="pg-spark">✦</span>
          <span>Share as a community demo</span>
          <button class="pg-gallery-x" onclick={() => (shareOpen = false)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="pg-share-body">
          <p class="pg-share-intro">This opens a GitHub pull request that adds your demo to the community gallery. Set your name in the file's header before submitting if you'd like the credit shown.</p>

          <label class="pg-share-field">
            <span class="pg-share-label">Demo title</span>
            <input class="pg-input pg-share-input" bind:value={shareTitle} placeholder="Release status board" />
          </label>

          <label class="pg-share-field">
            <span class="pg-share-label">Feature tags</span>
            <input class="pg-input pg-share-input" bind:value={shareTags} placeholder="editing, filtering, charts" />
            <span class="pg-share-hint">Comma-separated - shown as chips on your demo.</span>
          </label>

          {#if !shareInlined}
            <div class="pg-share-paste">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              <span>Your code is copied to the clipboard. When GitHub shows <strong>"Enter file contents here"</strong>, press <strong>Ctrl/Cmd+V</strong> to paste it, then Propose changes.</span>
            </div>
          {/if}
        </div>
        <div class="pg-share-foot">
          <button class="pg-btn pg-share-btn" onclick={() => (shareOpen = false)}>Cancel</button>
          <button class="pg-btn accent pg-share-btn" onclick={confirmShare}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98" /><path d="M15.41 6.51l-6.82 3.98" /></svg>
            {shareInlined ? 'Open pull request' : 'Copy code & open GitHub'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if isCommunity}
    <!-- Community demo: attribution + GitHub-native upvote ("star") -->
    <div class="pg-community">
      <span class="pg-community-badge">Community</span>
      {#if currentDemo?.author}
        <span class="pg-community-by">
          by {currentDemo.author}{#if currentDemo?.authorGithub} ·
            <a href={`https://github.com/${currentDemo.authorGithub}`} target="_blank" rel="noopener external">@{currentDemo.authorGithub}</a>{/if}
        </span>
      {/if}
      {#if currentDemo?.tags?.length}
        <span class="pg-community-tags">
          {#each currentDemo.tags as t (t)}<span class="pg-community-tag">{t}</span>{/each}
        </span>
      {/if}
      <span class="pg-community-spacer"></span>
      {#if voteMe?.authenticated}
        <span class="pg-community-who" title={`Signed in as @${voteMe.login}`}>
          {#if voteMe.avatar}<img class="pg-community-avatar" src={voteMe.avatar} alt="" />{/if}
          @{voteMe.login}
        </span>
      {/if}
      {#if currentDemo?.discussion}
        {#if canVote}
          <button
            class="pg-community-upvote"
            class:reacted={displayReacted}
            onclick={vote}
            disabled={voteBusy}
            title={voteMe?.authenticated ? (displayReacted ? 'Remove your upvote' : 'Upvote this demo') : 'Sign in with GitHub to upvote'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={displayReacted ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12" /><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
            {displayReacted ? 'Upvoted' : 'Upvote'}{#if displayCount !== null}<span class="pg-community-count">{displayCount}</span>{/if}
          </button>
        {:else}
          <a class="pg-community-upvote" href={discussionUrl(currentDemo.discussion)} target="_blank" rel="noopener external" title="Upvote this demo on GitHub - adds a 👍 to its discussion">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12" /><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
            Upvote{#if upvotes !== null}<span class="pg-community-count">{upvotes}</span>{/if}
          </a>
        {/if}
      {:else}
        <span class="pg-community-pending" title="A GitHub discussion for upvotes will be linked once this demo is merged">upvotes on GitHub once merged</span>
      {/if}
    </div>
  {/if}

  <!-- Body: editor | preview -->
  <div class="pg-body" class:dragging bind:this={bodyEl} style={`--pg-left: ${editorPct}%`}>
    <!-- Editor pane -->
    <section class="pg-editor-pane">
      <div class="pg-filerow">
        <span class="pg-status" class:ok={!compileErr && ranOnce} class:bad={!!compileErr} class:busy={building}></span>
        <span class="pg-filename">{fileLabel}</span>
        <span class="pg-lang">Svelte</span>
        {#if building}<span class="pg-building">compiling…</span>{/if}
      </div>

      <div class="pg-code-area">
        <div class="pg-gutter" bind:this={gutterEl} aria-hidden="true">
          {#each Array.from({ length: lineCount }) as _, i (i)}<div class:err={compileErrLine === i + 1}>{i + 1}</div>{/each}
        </div>
        <div class="pg-code">
          {#if compileErrLine}
            <div class="pg-errline" bind:this={errLineEl} style={`top: calc(var(--pg-pad-y) + ${compileErrLine - 1} * 1.6 * 12.5px)`} aria-hidden="true"></div>
          {/if}
          <pre class="pg-hl" bind:this={preEl} aria-hidden="true"><code>{@html highlighted}</code></pre>
          <textarea
            class="pg-ta"
            bind:this={taEl}
            bind:value={code}
            onscroll={syncScroll}
            onkeydown={onEditorKeydown}
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            wrap="off"
            aria-label="Component source editor"
          ></textarea>
        </div>
      </div>

      <div class="pg-editor-foot">
        {#if compileErr}
          <span class="pg-foot-err">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
            {compileErrLine ? `Line ${compileErrLine}: ` : ''}{compileErr}
          </span>
          <button class="pg-fix" onclick={fixWithAi} disabled={aiBusy} title="Ask AI to fix this error">
            <span class="pg-spark">✦</span>{aiBusy ? 'Fixing…' : 'Fix with AI'}
          </button>
        {:else if ranOnce}
          <span class="pg-foot-ok">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            Running <span class="pg-foot-muted">- edit the source, it recompiles live</span>
          </span>
        {:else}
          <span class="pg-foot-muted">Compiling the component…</span>
        {/if}
      </div>

      {#if showAi}
        <div class="pg-ai">
          <div class="pg-ai-head">
            <span class="pg-spark">✦</span> AI assist
            <span class="pg-ai-byok">bring your own key</span>
          </div>
          <div class="pg-ai-row">
            <input class="pg-input" type="password" placeholder="Anthropic API key (sk-ant-...)" bind:value={apiKey} />
            <select class="pg-select" bind:value={model} aria-label="Model">
              <option value="claude-sonnet-4-6">Sonnet 4.6</option>
              <option value="claude-opus-4-8">Opus 4.8</option>
              <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
            </select>
          </div>
          <div class="pg-ai-row">
            <input class="pg-input" placeholder="Describe a change: e.g. add a Status column with a coloured badge" bind:value={aiPrompt} onkeydown={(e) => e.key === 'Enter' && askAi()} />
            <button class="pg-run" onclick={askAi} disabled={aiBusy}>
              {#if aiBusy}<span class="pg-spinner"></span>Thinking{:else}Ask AI{/if}
            </button>
          </div>
          <div class="pg-ai-chips">
            {#each STARTER_PROMPTS as sp (sp)}
              <button class="pg-chip" onclick={() => (aiPrompt = sp)} disabled={aiBusy}>{sp}</button>
            {/each}
          </div>
          {#if aiError}<div class="pg-ai-err">{aiError}</div>{/if}
          <p class="pg-ai-note">Your key stays in this browser and is sent directly to Anthropic - nothing is proxied. Changes are shown as a diff to accept or reject.</p>
        </div>
      {/if}
    </section>

    <!-- Draggable splitter (a focusable window-splitter is a valid ARIA widget) -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="pg-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize editor and preview"
      aria-valuemin={SPLIT_MIN}
      aria-valuemax={SPLIT_MAX}
      aria-valuenow={Math.round(editorPct)}
      tabindex="0"
      onpointerdown={startSplit}
      onkeydown={nudgeSplit}
      ondblclick={resetSplit}
      title="Drag to resize - double-click to reset"
    >
      <span class="pg-splitter-grip"></span>
    </div>

    <!-- Preview pane -->
    <section class="pg-preview">
      <div class="pg-frame">
        <div class="pg-frame-bar">
          <span class="pg-dots"><i></i><i></i><i></i></span>
          <span class="pg-frame-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
            Live preview
          </span>
          <span class="pg-frame-meta" class:live={ranOnce && !compileErr}>{building ? 'compiling' : compileErr ? 'error' : ranOnce ? 'live' : '…'}</span>
        </div>
        <div class="pg-frame-body">
          <div class="pg-mount" bind:this={mountEl}></div>
          {#if compileErr && !ranOnce}
            <div class="pg-empty">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
              Couldn't compile this component
            </div>
          {/if}
        </div>
      </div>

      <!-- Console -->
      <div class="pg-console" class:open={consoleOpen}>
        <button class="pg-console-head" onclick={() => (consoleOpen = !consoleOpen)}>
          <svg class="pg-console-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          Console
          {#if logs.length}<span class="pg-console-count" class:err={errorCount > 0}>{logs.length}</span>{/if}
          <span class="pg-console-spacer"></span>
          {#if logs.length}
            <span class="pg-console-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); logs = [] }} onkeydown={(e) => e.key === 'Enter' && (logs = [])}>clear</span>
          {/if}
        </button>
        {#if consoleOpen}
          <div class="pg-console-body">
            {#if logs.length === 0}
              <div class="pg-console-empty">No console output. Your demo's <code>console.log</code> and any runtime errors show up here.</div>
            {:else}
              {#each logs as l, i (i)}
                <div class="pg-console-line pg-log-{l.type}">
                  {#if l.n > 1}<span class="pg-console-n">{l.n}</span>{/if}
                  <span class="pg-console-text">{l.text}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </section>
  </div>

  <!-- AI diff review -->
  {#if aiPending != null}
    <div class="pg-scrim" role="button" tabindex="-1" aria-label="Close diff" onclick={rejectAi} onkeydown={(e) => e.key === 'Enter' && rejectAi()}></div>
    <div class="pg-diff" role="dialog" aria-modal="true" aria-label="Review AI change">
      <div class="pg-diff-head">
        <span class="pg-diff-title"><span class="pg-spark">✦</span> Review AI change</span>
        <span class="pg-diff-stat"><span class="pg-diff-add">+{aiDiffStat.add}</span> <span class="pg-diff-del">-{aiDiffStat.del}</span></span>
        <span class="pg-console-spacer"></span>
        <button class="pg-btn" onclick={rejectAi}>Reject</button>
        <button class="pg-btn accent" onclick={acceptAi}>Accept</button>
      </div>
      <div class="pg-diff-body">
        {#each aiDiff as d, i (i)}
          <div class="pg-diff-line pg-diff-{d.t}"><span class="pg-diff-sign">{d.t === 'add' ? '+' : d.t === 'del' ? '-' : ' '}</span>{d.s || ' '}</div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Reference drawer -->
  {#if refOpen}
    <div class="pg-scrim" role="button" tabindex="-1" aria-label="Close reference" onclick={() => (refOpen = false)} onkeydown={(e) => e.key === 'Enter' && (refOpen = false)}></div>
  {/if}
  <aside class="pg-drawer" class:open={refOpen} aria-hidden={!refOpen}>
    <div class="pg-drawer-head">
      <div class="pg-drawer-title">Properties</div>
      <button class="pg-x" onclick={() => (refOpen = false)} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
    <div class="pg-drawer-tools">
      <div class="pg-searchwrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input class="pg-search" placeholder="Search properties…" bind:value={search} />
      </div>
      <div class="pg-seg">
        {#each [['all', 'All'], ['Grid props', 'Grid'], ['Column options', 'Columns']] as [val, label] (val)}
          <button class="pg-seg-btn" class:active={refFilter === val} onclick={() => (refFilter = val as typeof refFilter)}>{label}</button>
        {/each}
      </div>
    </div>
    <div class="pg-ref-list">
      {#each filteredCatalog as group (group.title)}
        <div class="pg-ref-group">{group.title}<span class="pg-ref-blurb">{group.blurb}</span></div>
        {#each group.entries as e (e.name)}
          <button class="pg-ref-item" onclick={() => copyEntry(e.insert)} title={e.insert}>
            <span class="pg-ref-top">
              <span class="pg-ref-name">{e.name}</span>
              <span class="pg-ref-add">copy</span>
            </span>
            <span class="pg-ref-type">{e.type}</span>
            <span class="pg-ref-desc">{e.description}</span>
          </button>
        {/each}
      {/each}
      {#if filteredCatalog.length === 0}
        <div class="pg-ref-empty">No property matches "{search}".</div>
      {/if}
    </div>
  </aside>

  {#if hint}<div class="pg-hint">{hint}</div>{/if}
</div>

<style>
  .pg {
    --pg-code-bg: #0b1222;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--site-bg);
    color: var(--site-fg);
    overflow: hidden;
  }

  /* ---- Top bar ---- */
  .pg-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    height: 52px; flex-shrink: 0; padding: 0 16px;
    border-bottom: 1px solid var(--site-border); background: var(--site-bg-elev);
  }
  .pg-bar-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .pg-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-size: 13px; letter-spacing: 0.02em; color: var(--site-fg); white-space: nowrap; }
  .pg-spark { color: var(--site-accent); }
  .pg-from { font-size: 12.5px; color: var(--site-muted); white-space: nowrap; }
  .pg-from strong { color: var(--site-fg); font-weight: 600; }
  .pg-back { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--site-accent-2); text-decoration: none; white-space: nowrap; }
  .pg-back:hover { color: var(--site-accent); }
  .pg-bar-r { display: flex; align-items: center; gap: 6px; }
  .pg-div { width: 1px; height: 20px; background: var(--site-border); margin: 0 2px; }

  /* ---- Community demo strip ---- */
  .pg-community {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    height: 38px; flex-shrink: 0; padding: 0 16px;
    border-bottom: 1px solid var(--site-border);
    background: color-mix(in oklab, var(--site-accent) 6%, var(--site-bg-elev));
    font-size: 12.5px; color: var(--site-muted);
  }
  .pg-community-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 999px;
    background: color-mix(in oklab, var(--site-accent) 16%, transparent);
    color: var(--site-accent-2);
  }
  .pg-community-by { color: var(--site-fg); font-weight: 500; }
  .pg-community-by a { color: var(--site-accent-2); text-decoration: none; }
  .pg-community-by a:hover { color: var(--site-accent); text-decoration: underline; }
  .pg-community-tags { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .pg-community-tag {
    font-size: 10.5px; padding: 1px 7px; border-radius: 999px;
    border: 1px solid var(--site-border); color: var(--site-muted);
  }
  .pg-community-spacer { flex: 1; }
  .pg-community-pending { font-size: 11.5px; font-style: italic; opacity: 0.8; }
  .pg-community-upvote {
    display: inline-flex; align-items: center; gap: 6px;
    height: 26px; padding: 0 10px; border-radius: 999px;
    border: 1px solid var(--site-border); background: var(--site-bg);
    color: var(--site-fg); font-size: 12px; font-weight: 600; text-decoration: none;
    cursor: pointer;
    transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
  }
  .pg-community-upvote:hover { border-color: var(--site-accent); color: var(--site-accent); }
  .pg-community-upvote:disabled { opacity: 0.6; cursor: default; }
  .pg-community-upvote.reacted { border-color: var(--site-accent); color: var(--site-accent); background: color-mix(in oklab, var(--site-accent) 12%, transparent); }
  .pg-community-who { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--site-muted); }
  .pg-community-avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
  .pg-community-count {
    font-variant-numeric: tabular-nums; font-weight: 700;
    padding: 0 6px; border-radius: 999px;
    background: color-mix(in oklab, var(--site-accent) 14%, transparent);
    color: var(--site-accent-2);
  }
  .pg-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: 1px solid var(--site-border); border-radius: 8px; background: var(--site-bg); color: var(--site-fg); transition: border-color 120ms ease, background 120ms ease, color 120ms ease; }
  .pg-btn:hover { border-color: var(--site-accent); color: var(--site-accent); }
  .pg-btn.on { background: color-mix(in oklab, var(--site-accent) 14%, transparent); border-color: var(--site-accent); color: var(--site-accent); }
  .pg-btn.accent { background: linear-gradient(135deg, #d4400a, #e8590c); border-color: transparent; color: #fff; }
  .pg-btn.accent:hover { filter: brightness(1.08); color: #fff; }
  .pg-btn.accent.on { filter: brightness(1.1); }
  @media (max-width: 720px) { .pg-btn-t { display: none; } .pg-from { display: none; } }

  /* ---- Body split ---- */
  .pg-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, var(--pg-left, 50%)) auto minmax(0, 1fr); }
  .pg-body.dragging { cursor: col-resize; user-select: none; }
  @media (max-width: 900px) { .pg-body { grid-template-columns: 1fr; grid-template-rows: 1fr 6px 1fr; } }

  .pg-editor-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--pg-code-bg); }

  /* ---- Splitter ---- */
  .pg-splitter { position: relative; width: 7px; cursor: col-resize; background: var(--site-border); touch-action: none; border: 0; padding: 0; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .pg-splitter::before { content: ''; position: absolute; inset: 0 -4px; }
  .pg-splitter:hover, .pg-splitter:focus-visible, .pg-body.dragging .pg-splitter { background: var(--site-accent); outline: none; }
  .pg-splitter-grip { width: 3px; height: 34px; border-radius: 3px; background: color-mix(in oklab, var(--site-muted) 55%, transparent); pointer-events: none; transition: background 0.15s; }
  .pg-splitter:hover .pg-splitter-grip, .pg-splitter:focus-visible .pg-splitter-grip, .pg-body.dragging .pg-splitter-grip { background: color-mix(in oklab, var(--site-accent-fg, #fff) 85%, transparent); }
  @media (max-width: 900px) { .pg-splitter { width: auto; height: 6px; cursor: row-resize; } .pg-splitter-grip { width: 34px; height: 3px; } }

  /* ---- File row ---- */
  .pg-filerow { display: flex; align-items: center; gap: 9px; height: 38px; flex-shrink: 0; padding: 0 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .pg-filename { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; font-weight: 600; color: #cdd6e4; }
  .pg-lang { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #ff7a4d; padding: 2px 6px; border: 1px solid #40301f; border-radius: 4px; background: rgba(255,90,31,0.08); }
  .pg-building { font-size: 11px; color: #8b97ad; margin-left: auto; }
  .pg-status { width: 8px; height: 8px; border-radius: 50%; background: #4a5468; flex-shrink: 0; }
  .pg-status.ok { background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,0.15); }
  .pg-status.bad { background: #f87171; box-shadow: 0 0 0 3px rgba(248,113,113,0.15); }
  .pg-status.busy { background: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,0.15); }

  /* ---- Code editor (highlight overlay + gutter) ---- */
  .pg-code-area {
    flex: 1; min-height: 0; display: flex; position: relative; overflow: hidden;
    --pg-font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    --pg-pad-y: 14px; --pg-pad-x: 14px;
  }
  .pg-gutter { flex-shrink: 0; width: 46px; overflow: hidden; text-align: right; user-select: none; padding: var(--pg-pad-y) 8px 40px 0; font: var(--pg-font); color: #4a5468; background: var(--pg-code-bg); border-right: 1px solid rgba(255,255,255,0.05); }
  .pg-gutter div { height: calc(12.5px * 1.6); }
  .pg-code { position: relative; flex: 1; min-width: 0; }
  .pg-hl, .pg-ta { margin: 0; position: absolute; inset: 0; box-sizing: border-box; padding: var(--pg-pad-y) var(--pg-pad-x) 40px; font: var(--pg-font); white-space: pre; tab-size: 2; overflow: auto; border: 0; }
  .pg-hl { pointer-events: none; color: #cdd6e4; overflow: hidden; }
  .pg-ta { resize: none; background: transparent; color: transparent; caret-color: var(--site-accent); outline: none; scrollbar-width: thin; }
  .pg-ta::selection { background: color-mix(in oklab, var(--site-accent) 40%, transparent); }
  .pg-hl :global(.t-s) { color: #7fd88f; }
  .pg-hl :global(.t-n) { color: #f0a45d; }
  .pg-hl :global(.t-b) { color: #c792ea; }
  .pg-hl :global(.t-w) { color: #ff8b6b; }
  .pg-hl :global(.t-k) { color: #6cb6ff; }
  .pg-hl :global(.t-p) { color: #7c8497; }
  .pg-hl :global(.t-c) { color: #5c6675; font-style: italic; }

  /* ---- Editor footer ---- */
  .pg-editor-foot { flex-shrink: 0; display: flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 14px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.15); color: #8b97ad; overflow: hidden; }
  .pg-foot-err { display: inline-flex; align-items: flex-start; gap: 7px; color: #fca5a5; min-width: 0; overflow: hidden; }
  .pg-foot-err svg { flex-shrink: 0; margin-top: 1px; }
  .pg-foot-ok { display: inline-flex; align-items: center; gap: 7px; color: #6ee7b7; }
  .pg-foot-muted { color: #6b7688; }

  /* ---- AI panel ---- */
  .pg-ai { flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--site-border); background: linear-gradient(color-mix(in oklab, var(--site-accent) 8%, transparent), color-mix(in oklab, var(--site-accent) 8%, transparent)), var(--site-bg-elev); }
  .pg-ai-head { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--site-fg); }
  .pg-ai-byok { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--site-accent-2); padding: 2px 7px; border-radius: 999px; background: color-mix(in oklab, var(--site-accent) 12%, transparent); }
  .pg-ai-row { display: flex; gap: 7px; }
  .pg-input, .pg-select { height: 34px; padding: 0 11px; font-size: 12.5px; border: 1px solid var(--sg-input-border, var(--site-border)); border-radius: 8px; background: var(--sg-input-bg, var(--site-bg)); color: var(--site-fg); }
  .pg-input { flex: 1; min-width: 0; }
  .pg-input:focus, .pg-select:focus { outline: none; border-color: var(--site-accent); box-shadow: 0 0 0 2px color-mix(in oklab, var(--site-accent) 30%, transparent); }
  .pg-run { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 16px; white-space: nowrap; font-size: 12.5px; font-weight: 700; cursor: pointer; border: 0; border-radius: 8px; background: linear-gradient(135deg, #d4400a, #e8590c); color: #fff; }
  .pg-run:hover:not(:disabled) { filter: brightness(1.08); }
  .pg-run:disabled { opacity: 0.7; cursor: default; }
  .pg-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: pg-spin 0.7s linear infinite; }
  @keyframes pg-spin { to { transform: rotate(360deg); } }
  .pg-ai-err { font-size: 12px; color: #dc2626; background: color-mix(in oklab, #dc2626 10%, transparent); border: 1px solid color-mix(in oklab, #dc2626 30%, transparent); border-radius: 7px; padding: 6px 10px; }
  .pg-ai-note { margin: 0; font-size: 11px; color: var(--site-muted); }

  /* ---- Preview ---- */
  .pg-preview { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 20px; overflow: hidden; background-color: var(--site-bg-soft); background-image: radial-gradient(color-mix(in oklab, var(--site-muted) 22%, transparent) 1px, transparent 1px); background-size: 22px 22px; }
  .pg-frame { flex: 1; min-height: 200px; display: flex; flex-direction: column; border: 1px solid var(--site-border); border-radius: 14px; overflow: hidden; background: var(--sg-bg, var(--site-bg)); box-shadow: 0 24px 60px -28px rgba(0,0,0,0.55), 0 2px 8px -4px rgba(0,0,0,0.3); }
  .pg-frame-bar { display: flex; align-items: center; gap: 12px; height: 40px; flex-shrink: 0; padding: 0 14px; border-bottom: 1px solid var(--site-border); background: var(--site-bg-elev); }
  .pg-dots { display: inline-flex; gap: 6px; }
  .pg-dots i { width: 11px; height: 11px; border-radius: 50%; background: var(--site-border); }
  .pg-dots i:nth-child(1) { background: #ff5f57; }
  .pg-dots i:nth-child(2) { background: #febc2e; }
  .pg-dots i:nth-child(3) { background: #28c840; }
  .pg-frame-title { display: inline-flex; align-items: center; gap: 6px; margin: 0 auto; font-size: 11.5px; font-weight: 600; color: var(--site-muted); }
  .pg-frame-meta { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--site-muted); padding: 2px 8px; border-radius: 999px; border: 1px solid var(--site-border); }
  .pg-frame-meta.live { color: #16a34a; border-color: color-mix(in oklab, #16a34a 40%, transparent); background: color-mix(in oklab, #16a34a 12%, transparent); }
  .pg-frame-body { flex: 1; min-height: 0; padding: 12px; position: relative; }
  .pg-mount { height: 100%; min-height: 0; }
  .pg-mount :global(> *) { height: 100%; }
  .pg-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--site-muted); font-size: 13.5px; background: var(--sg-bg, var(--site-bg)); }
  .pg-empty svg { color: color-mix(in oklab, var(--site-muted) 70%, transparent); }

  /* ---- Reference drawer ---- */
  .pg-scrim { position: fixed; inset: 0; z-index: 60; background: rgba(2,6,16,0.5); backdrop-filter: blur(1px); animation: pg-fade 140ms ease; }
  @keyframes pg-fade { from { opacity: 0; } }
  .pg-drawer { position: fixed; top: 0; right: 0; z-index: 61; height: 100vh; width: 380px; max-width: 92vw; display: flex; flex-direction: column; background: var(--site-bg); border-left: 1px solid var(--site-border); box-shadow: -24px 0 60px -30px rgba(0,0,0,0.6); transform: translateX(100%); transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
  .pg-drawer.open { transform: translateX(0); }
  .pg-drawer-head { display: flex; align-items: center; justify-content: space-between; height: 52px; flex-shrink: 0; padding: 0 8px 0 16px; border-bottom: 1px solid var(--site-border); }
  .pg-drawer-title { font-size: 14px; font-weight: 700; }
  .pg-x { display: inline-flex; padding: 8px; border: 0; background: transparent; color: var(--site-muted); cursor: pointer; border-radius: 7px; }
  .pg-x:hover { background: var(--site-bg-soft); color: var(--site-fg); }
  .pg-drawer-tools { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--site-border); }
  .pg-searchwrap { position: relative; display: flex; align-items: center; }
  .pg-searchwrap svg { position: absolute; left: 11px; color: var(--site-muted); pointer-events: none; }
  .pg-search { width: 100%; height: 36px; padding: 0 12px 0 33px; font-size: 13px; border: 1px solid var(--site-border); border-radius: 8px; background: var(--site-bg); color: var(--site-fg); }
  .pg-search:focus { outline: none; border-color: var(--site-accent); box-shadow: 0 0 0 2px color-mix(in oklab, var(--site-accent) 30%, transparent); }
  .pg-seg { display: flex; gap: 3px; padding: 3px; background: var(--site-bg-soft); border: 1px solid var(--site-border); border-radius: 9px; }
  .pg-seg-btn { flex: 1; padding: 5px 0; font-size: 12px; font-weight: 600; cursor: pointer; border: 0; border-radius: 6px; background: transparent; color: var(--site-muted); }
  .pg-seg-btn:hover { color: var(--site-fg); }
  .pg-seg-btn.active { background: var(--site-bg); color: var(--site-accent); box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
  .pg-ref-list { flex: 1; min-height: 0; overflow: auto; }
  .pg-ref-group { display: flex; flex-direction: column; padding: 12px 14px 5px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--site-muted); background: var(--site-bg); position: sticky; top: 0; z-index: 1; }
  .pg-ref-blurb { font-weight: 500; text-transform: none; letter-spacing: 0; color: color-mix(in oklab, var(--site-muted) 80%, transparent); font-size: 11px; margin-top: 2px; }
  .pg-ref-item { display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left; padding: 9px 14px; border: 0; border-top: 1px solid var(--site-border); background: transparent; cursor: pointer; }
  .pg-ref-item:hover { background: color-mix(in oklab, var(--site-accent) 8%, transparent); }
  .pg-ref-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pg-ref-name { font-family: ui-monospace, monospace; font-size: 12.5px; font-weight: 700; color: var(--site-accent-2); }
  .pg-ref-add { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--site-accent); opacity: 0; transition: opacity 120ms ease; }
  .pg-ref-item:hover .pg-ref-add { opacity: 1; }
  .pg-ref-type { font-family: ui-monospace, monospace; font-size: 10.5px; color: color-mix(in oklab, var(--site-muted) 85%, transparent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pg-ref-desc { font-size: 12px; color: var(--site-muted); line-height: 1.4; }
  .pg-ref-empty { padding: 24px; font-size: 12.5px; color: var(--site-muted); text-align: center; }

  /* ---- Toast ---- */
  .pg-hint { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 70; display: inline-flex; align-items: center; padding: 9px 18px; font-size: 13px; font-weight: 600; color: #fff; background: linear-gradient(135deg, #d4400a, #e8590c); border-radius: 999px; box-shadow: 0 12px 30px -8px rgba(212,64,10,0.5); animation: pg-toast 180ms ease; }
  @keyframes pg-toast { from { opacity: 0; transform: translate(-50%, 8px); } }

  /* ---- Demo switcher ---- */
  .pg-switch { position: relative; display: inline-flex; align-items: center; }
  .pg-switch-trigger { display: inline-flex; align-items: center; gap: 7px; height: 30px; max-width: 300px; padding: 0 10px; font-size: 12.5px; font-weight: 600; color: var(--site-fg); background: var(--site-bg); border: 1px solid var(--site-border); border-radius: 8px; cursor: pointer; transition: border-color 120ms ease; }
  .pg-switch-trigger:hover { border-color: var(--site-accent); }
  .pg-switch-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pg-switch-badge { flex-shrink: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; color: #fff; background: linear-gradient(135deg, #10b981, #14b8a6); }
  .pg-switch-caret { flex-shrink: 0; color: var(--site-muted); }

  /* ---- Demo picker gallery ---- */
  .pg-gallery { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-start; justify-content: center; padding: 64px 16px 16px; }
  .pg-gallery-scrim { position: absolute; inset: 0; background: color-mix(in oklab, #000 45%, transparent); border: 0; cursor: default; }
  .pg-gallery-panel { position: relative; width: min(760px, 100%); max-height: calc(100vh - 96px); display: flex; flex-direction: column; background: var(--site-bg-elev); border: 1px solid var(--site-border); border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); overflow: hidden; }
  .pg-gallery-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--site-border); }
  .pg-gallery-search-icon { flex-shrink: 0; color: var(--site-muted); margin-left: 4px; }
  .pg-gallery-search { flex: 1; height: 34px; border: 0; background: transparent; color: var(--site-fg); font-size: 14px; outline: none; }
  .pg-gallery-x { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 0; border-radius: 7px; background: transparent; color: var(--site-muted); cursor: pointer; }
  .pg-gallery-x:hover { background: var(--site-bg); color: var(--site-fg); }
  .pg-gallery-body { overflow-y: auto; padding: 14px; }
  .pg-gallery-sec + .pg-gallery-sec { margin-top: 18px; }
  .pg-gallery-sec-title { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--site-accent-2); margin-bottom: 10px; }
  .pg-gallery-sec-title-plain { color: var(--site-muted); }
  .pg-gallery-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (max-width: 560px) { .pg-gallery-cards { grid-template-columns: 1fr; } }
  .pg-gcard { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--site-bg); border: 1px solid var(--site-border); border-radius: 10px; transition: border-color 120ms ease; }
  .pg-gcard:hover { border-color: var(--site-accent); }
  .pg-gcard.active { border-color: var(--site-accent); box-shadow: 0 0 0 2px color-mix(in oklab, var(--site-accent) 30%, transparent); }
  .pg-gcard-open { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 2px; text-align: left; background: transparent; border: 0; border-radius: 7px; cursor: pointer; }
  .pg-gcard-av { position: relative; flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #10b981, #14b8a6); }
  .pg-gcard-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .pg-gcard-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .pg-gcard-title { font-size: 13px; font-weight: 600; color: var(--site-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pg-gcard-by { font-size: 11px; color: var(--site-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pg-gcard-stars { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: #d97706; padding: 4px 9px; border-radius: 999px; border: 1px solid transparent; background: color-mix(in oklab, #f59e0b 12%, transparent); cursor: pointer; transition: background 120ms ease, border-color 120ms ease; }
  .pg-gcard-stars:hover { border-color: #f59e0b; background: color-mix(in oklab, #f59e0b 20%, transparent); }
  .pg-gcard-stars.reacted { background: color-mix(in oklab, #f59e0b 26%, transparent); border-color: #f59e0b; }
  .pg-gcard-stars-static { cursor: default; }
  .pg-gcard-stars-static:hover { border-color: transparent; background: color-mix(in oklab, #f59e0b 12%, transparent); }
  .pg-gallery-group { margin-bottom: 12px; }
  .pg-gallery-group-name { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--site-muted); margin-bottom: 5px; }
  .pg-gallery-group-n { font-size: 10px; padding: 0 6px; border-radius: 999px; background: var(--site-bg); color: var(--site-muted); }
  .pg-gallery-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
  @media (max-width: 560px) { .pg-gallery-list { grid-template-columns: 1fr; } }
  .pg-grow { display: flex; align-items: center; gap: 6px; padding: 6px 9px; text-align: left; font-size: 12.5px; color: var(--site-fg); background: transparent; border: 1px solid transparent; border-radius: 7px; cursor: pointer; transition: background 120ms ease; }
  .pg-grow:hover { background: var(--site-bg); }
  .pg-grow.active { background: color-mix(in oklab, var(--site-accent) 12%, transparent); border-color: color-mix(in oklab, var(--site-accent) 40%, transparent); }
  .pg-grow-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pg-grow-pro { flex-shrink: 0; margin-left: auto; font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em; padding: 1px 5px; border-radius: 4px; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
  .pg-gallery-empty { padding: 20px; text-align: center; font-size: 13px; color: var(--site-muted); }

  /* ---- Share dialog ---- */
  .pg-share { position: fixed; inset: 0; z-index: 85; display: flex; align-items: flex-start; justify-content: center; padding: 64px 16px 16px; }
  .pg-share-panel { position: relative; width: min(600px, 100%); max-height: calc(100vh - 88px); display: flex; flex-direction: column; background: var(--site-bg-elev); border: 1px solid var(--site-border); border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,0.4); overflow: hidden; }
  .pg-share-head { display: flex; align-items: center; gap: 8px; padding: 16px 18px; font-weight: 700; font-size: 15px; border-bottom: 1px solid var(--site-border); }
  .pg-share-head .pg-gallery-x { margin-left: auto; }
  .pg-share-body { overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .pg-share-intro { font-size: 13.5px; color: var(--site-muted); line-height: 1.55; margin: 0; }
  .pg-share-field { display: flex; flex-direction: column; gap: 6px; }
  .pg-share-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--site-fg); }
  .pg-share-input { flex: none; box-sizing: border-box; width: 100%; height: 30px; font-size: 13px; padding: 0 11px; }
  .pg-share-hint { font-size: 11.5px; color: var(--site-muted); }
  .pg-share-paste { display: flex; gap: 9px; align-items: flex-start; padding: 11px 13px; border-radius: 10px; font-size: 12.5px; line-height: 1.55; color: var(--site-fg); background: color-mix(in oklab, var(--site-accent) 8%, transparent); border: 1px solid color-mix(in oklab, var(--site-accent) 28%, transparent); }
  .pg-share-paste svg { flex-shrink: 0; margin-top: 1px; color: var(--site-accent-2); }
  .pg-share-paste strong { font-weight: 700; }
  .pg-share-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--site-border); background: color-mix(in oklab, var(--site-fg) 2%, var(--site-bg-elev)); }
  .pg-share-btn { height: 38px; padding: 0 16px; }

  /* ---- Fix with AI (error footer) ---- */
  .pg-fix { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; color: #fff; border: 0; border-radius: 6px; background: linear-gradient(135deg, #d4400a, #e8590c); }
  .pg-fix:hover:not(:disabled) { filter: brightness(1.08); }
  .pg-fix:disabled { opacity: 0.6; cursor: default; }

  /* ---- Inline error line ---- */
  .pg-gutter div.err { color: #fca5a5; font-weight: 700; }
  .pg-errline { position: absolute; left: 0; right: 0; height: calc(12.5px * 1.6); background: color-mix(in oklab, #f87171 16%, transparent); border-left: 2px solid #f87171; pointer-events: none; z-index: 0; }

  /* ---- AI starter chips ---- */
  .pg-ai-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pg-chip { padding: 4px 9px; font-size: 11.5px; font-weight: 500; cursor: pointer; color: var(--site-fg); background: var(--site-bg); border: 1px solid var(--site-border); border-radius: 999px; }
  .pg-chip:hover:not(:disabled) { border-color: var(--site-accent); color: var(--site-accent); }
  .pg-chip:disabled { opacity: 0.5; cursor: default; }

  /* ---- Console panel ---- */
  .pg-console { flex-shrink: 0; display: flex; flex-direction: column; border: 1px solid var(--site-border); border-radius: 10px; overflow: hidden; background: var(--sg-bg, var(--site-bg)); }
  .pg-console.open { max-height: 45%; }
  .pg-console-head { display: flex; align-items: center; gap: 8px; width: 100%; height: 34px; padding: 0 12px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--site-muted); background: var(--site-bg-elev); border: 0; }
  .pg-console-head:hover { color: var(--site-fg); }
  .pg-console-caret { transition: transform 140ms ease; flex-shrink: 0; }
  .pg-console.open .pg-console-caret { transform: rotate(90deg); }
  .pg-console-count { min-width: 18px; height: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; border-radius: 999px; background: var(--site-border); color: var(--site-fg); }
  .pg-console-count.err { background: #dc2626; color: #fff; }
  .pg-console-spacer { flex: 1; }
  .pg-console-clear { font-size: 11px; font-weight: 600; color: var(--site-muted); cursor: pointer; }
  .pg-console-clear:hover { color: var(--site-accent); }
  .pg-console-body { flex: 1; min-height: 0; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
  .pg-console-empty { padding: 14px; color: var(--site-muted); font-family: inherit; }
  .pg-console-empty code { background: var(--site-bg-soft); padding: 0 4px; border-radius: 3px; }
  .pg-console-line { display: flex; gap: 8px; padding: 3px 12px; border-top: 1px solid color-mix(in oklab, var(--site-border) 60%, transparent); white-space: pre-wrap; word-break: break-word; }
  .pg-console-line.pg-log-error { background: color-mix(in oklab, #dc2626 8%, transparent); color: #fca5a5; }
  .pg-console-line.pg-log-warn { color: #fbbf24; }
  .pg-console-line.pg-log-info { color: #93c5fd; }
  .pg-console-n { flex-shrink: 0; min-width: 16px; height: 16px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; border-radius: 999px; background: var(--site-border); color: var(--site-fg); }

  /* ---- AI diff review modal ---- */
  .pg-diff { position: fixed; z-index: 61; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 720px; max-width: 92vw; max-height: 82vh; display: flex; flex-direction: column; background: var(--site-bg); border: 1px solid var(--site-border); border-radius: 12px; box-shadow: 0 30px 80px -30px rgba(0,0,0,0.6); overflow: hidden; }
  .pg-diff-head { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--site-border); }
  .pg-diff-title { font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
  .pg-diff-stat { font-family: ui-monospace, monospace; font-size: 12px; }
  .pg-diff-add { color: #16a34a; font-weight: 700; }
  .pg-diff-del { color: #dc2626; font-weight: 700; }
  .pg-diff-body { flex: 1; min-height: 0; overflow: auto; padding: 8px 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; }
  .pg-diff-line { display: flex; gap: 8px; padding: 0 12px; white-space: pre-wrap; word-break: break-word; }
  .pg-diff-line .pg-diff-sign { flex-shrink: 0; width: 8px; color: var(--site-muted); }
  .pg-diff-line.pg-diff-add { background: color-mix(in oklab, #16a34a 12%, transparent); color: #86efac; }
  .pg-diff-line.pg-diff-del { background: color-mix(in oklab, #dc2626 12%, transparent); color: #fca5a5; }
  .pg-diff-line.pg-diff-ctx { color: var(--site-muted); }
</style>
