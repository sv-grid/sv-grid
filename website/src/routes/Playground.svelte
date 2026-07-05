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
  import { findDemo } from '../lib/demos'
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

  const demoPath = $derived(demoId ? `examples/src/demos/${demoId}.svelte` : 'examples/src/demos/_playground.svelte')

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
  let building = $state(false)
  let ranOnce = $state(false)

  async function build(srcRaw: string) {
    const src = srcRaw.replace(/^﻿/, '')
    if (!src.trim() || !mountEl) return
    building = true
    try {
      const { Component, css } = await compileComponent(src, demoPath)
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.dataset.playground = ''; document.head.appendChild(styleEl) }
      styleEl.textContent = css
      if (instance) { try { unmount(instance) } catch { /* ignore */ } instance = null }
      mountEl.innerHTML = ''
      instance = mount(Component, { target: mountEl })
      compileErr = null
      ranOnce = true
    } catch (e) {
      compileErr = e instanceof Error ? e.message : String(e)
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
  function syncScroll() {
    if (!taEl) return
    if (preEl) { preEl.scrollTop = taEl.scrollTop; preEl.scrollLeft = taEl.scrollLeft }
    if (gutterEl) gutterEl.scrollTop = taEl.scrollTop
  }

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

  $effect(() => {
    // Load the stored key once, then keep it in sync.
    try {
      const k = localStorage.getItem(KEY_STORE) ?? ''
      if (k && !apiKey) { apiKey = k; showAi = true }
    } catch { /* storage blocked */ }
  })
  $effect(() => {
    try { if (apiKey) localStorage.setItem(KEY_STORE, apiKey) } catch { /* ignore */ }
  })
  $effect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && refOpen) refOpen = false }
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

  async function askAi() {
    if (!apiKey.trim()) { aiError = 'Add your Anthropic API key first.'; return }
    if (!aiPrompt.trim()) return
    aiBusy = true
    aiError = null
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
            { role: 'user', content: `Current component:\n\n${code}\n\nInstruction: ${aiPrompt}\n\nReturn the complete updated .svelte source only.` },
          ],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`)
      const text = (json.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
      code = stripFences(text)
      aiPrompt = ''
      toast('Applied AI edit')
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e)
    } finally {
      aiBusy = false
    }
  }

  const fileLabel = $derived(demoId ? `${demoId}.svelte` : 'Component.svelte')
</script>

<div class="pg">
  <!-- Top app bar -->
  <header class="pg-bar">
    <div class="pg-bar-l">
      <span class="pg-eyebrow"><span class="pg-spark">✦</span> Playground</span>
      {#if demoTitle}
        <span class="pg-from">editing <strong>{demoTitle}</strong></span>
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

  <!-- Body: editor | preview -->
  <div class="pg-body">
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
          {#each Array.from({ length: lineCount }) as _, i (i)}<div>{i + 1}</div>{/each}
        </div>
        <div class="pg-code">
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
            {compileErr}
          </span>
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
          {#if aiError}<div class="pg-ai-err">{aiError}</div>{/if}
          <p class="pg-ai-note">Your key stays in this browser and is sent directly to Anthropic - nothing is proxied.</p>
        </div>
      {/if}
    </section>

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
    </section>
  </div>

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
  .pg-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: 1px solid var(--site-border); border-radius: 8px; background: var(--site-bg); color: var(--site-fg); transition: border-color 120ms ease, background 120ms ease, color 120ms ease; }
  .pg-btn:hover { border-color: var(--site-accent); color: var(--site-accent); }
  .pg-btn.on { background: color-mix(in oklab, var(--site-accent) 14%, transparent); border-color: var(--site-accent); color: var(--site-accent); }
  .pg-btn.accent { background: linear-gradient(135deg, #d4400a, #e8590c); border-color: transparent; color: #fff; }
  .pg-btn.accent:hover { filter: brightness(1.08); color: #fff; }
  .pg-btn.accent.on { filter: brightness(1.1); }
  @media (max-width: 720px) { .pg-btn-t { display: none; } .pg-from { display: none; } }

  /* ---- Body split ---- */
  .pg-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  @media (max-width: 900px) { .pg-body { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; } }

  .pg-editor-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--site-border); background: var(--pg-code-bg); }
  @media (max-width: 900px) { .pg-editor-pane { border-right: 0; border-bottom: 1px solid var(--site-border); } }

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
  .pg-preview { min-width: 0; min-height: 0; padding: 20px; overflow: auto; background-color: var(--site-bg-soft); background-image: radial-gradient(color-mix(in oklab, var(--site-muted) 22%, transparent) 1px, transparent 1px); background-size: 22px 22px; }
  .pg-frame { height: 100%; min-height: 320px; display: flex; flex-direction: column; border: 1px solid var(--site-border); border-radius: 14px; overflow: hidden; background: var(--sg-bg, var(--site-bg)); box-shadow: 0 24px 60px -28px rgba(0,0,0,0.55), 0 2px 8px -4px rgba(0,0,0,0.3); }
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
</style>
