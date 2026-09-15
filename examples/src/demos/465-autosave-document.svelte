<script lang="ts">
  /**
   * 465. Autosave: a document that survives a reload
   * -------------------------------------------------
   * What makes a sheet a document rather than a grid: everything the user
   * does lands in one object that can be saved and put back. The project
   * tracker here keeps itself in localStorage:
   *
   *   onChange     fires once per tick with every kind of change since the
   *                last call (cells, formats, sizes, hidden lines, comments,
   *                rules, merges, filter, protection, structure); the demo
   *                debounces it and writes sheet.getState() as JSON.
   *   reload       on the next visit the document is built from the saved
   *                JSON with createSheetDocument({ state }) and handed to
   *                <SvSheet document={doc}>, so it opens exactly as it was
   *                left: the same comments, the same rules, the same merged
   *                title, the same frozen row and hidden column.
   *   reset        setState() puts the shipped document back in place; the
   *                grid's history is cleared, since none of it applies.
   *
   * The state is plain JSON (the size shows in the bar), so the same call
   * works against a server, a file or a database. In Node, with no
   * component at all, createSheetDocument({ state }) rebuilds the workbook.
   *
   * Try: add a comment (Shift+F2), bold a row, hide column F, type a task,
   * then reload the page. Everything is back. Reset returns the shipped
   * document and forgets what was saved.
   */
  import { SvSheet, createWorkbook, createSheetDocument, type SheetState, type SheetChangeReason, type CellFormatEntry } from '@svgrid/enterprise'

  const KEY = 'svgrid-demo-465'

  // ---- the shipped document -----------------------------------------------
  const TASKS: ReadonlyArray<readonly [string, string, string, string, number]> = [
    ['Migrate billing to the new API', 'Ana',   'In progress', '2026-09-19', 0.6],
    ['Quarterly security review',      'Ben',   'Done',        '2026-09-05', 1],
    ['Onboarding guide rewrite',       'Chloe', 'In progress', '2026-09-26', 0.3],
    ['Mobile layout for the grid',     'Dev',   'Not started', '2026-10-10', 0],
    ['Load test the export service',   'Ben',   'Blocked',     '2026-09-12', 0.4],
    ['Customer advisory call',         'Ana',   'Done',        '2026-09-08', 1],
    ['Pricing page A/B test',          'Chloe', 'Not started', '2026-10-03', 0],
  ]
  const LAST = TASKS.length + 2          // the title takes row 1, the header row 2
  const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done']
  const TODAY = '2026-09-15'

  function shipped(): SheetState {
    const cells = [
      ['Q3 delivery tracker'],
      ['Task', 'Owner', 'Status', 'Due', 'Progress', 'Days left'],
      ...TASKS.map(([task, owner, status, due, progress], i) => {
        const r = i + 3
        return [task, owner, status, due, String(progress), `=IF(C${r}="Done","",DAYS(D${r},"${TODAY}"))`]
      }),
      [],
      ['Done', `=COUNTIF(C3:C${LAST},"Done")&" of "&COUNTA(A3:A${LAST})`],
      ['Overall', `=AVERAGE(E3:E${LAST})`],
    ]
    const wb = createWorkbook([{ name: 'Tracker', cells }])
    const doc = createSheetDocument({ workbook: wb })
    const s = doc.get('Tracker')
    s.merges = [[0, 0, 0, 5]]
    s.freeze = { rows: 2, cols: 0 }
    s.notes = { r6: { C: 'Waiting on the vendor for a staging environment. Chased on the 12th.' } }
    s.validation = [
      { id: 'status', rects: [[2, 2, LAST - 1, 2]], allow: 'list', value1: STATUSES.join(','), ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop', title: 'Status', message: 'Pick a status from the list.' } },
      { id: 'progress', rects: [[2, 4, LAST - 1, 4]], allow: 'decimal', operator: 'between', value1: '0', value2: '1', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop', title: 'Progress', message: 'A share from 0 to 1 (type 0.5 or 50%).' } },
    ]
    s.conditionalFormats = [
      { id: 'late', rects: [[2, 5, LAST - 1, 5]], kind: 'cellIs', operator: 'less', value1: '0', style: { fill: '#FFC7CE', color: '#9C0006' } },
      { id: 'soon', rects: [[2, 5, LAST - 1, 5]], kind: 'cellIs', operator: 'lessOrEqual', value1: '7', style: { fill: '#FFEB9C', color: '#9C5700' } },
      { id: 'blocked', rects: [[2, 2, LAST - 1, 2]], kind: 'text', match: 'contains', value: 'Blocked', style: { fill: '#FFC7CE', color: '#9C0006' } },
      { id: 'done', rects: [[2, 2, LAST - 1, 2]], kind: 'text', match: 'contains', value: 'Done', style: { fill: '#C6EFCE', color: '#006100' } },
      { id: 'progress', rects: [[2, 4, LAST - 1, 4]], kind: 'dataBar', color: '#63BE7B' },
    ]
    const lookup = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => 'ABCDEF'[i] ?? null }
    const set = (rect: readonly [number, number, number, number], entry: CellFormatEntry) => s.formats.set([rect], entry, lookup)
    set([0, 0, 0, 0], { bold: true, fontSize: 16, align: 'center', fill: '#1e293b', color: '#f8fafc' })
    set([1, 0, 1, 5], { bold: true, fill: '#e2e8f0', color: '#0f172a' })
    set([2, 4, LAST - 1, 4], { numFmt: '0%' })
    set([LAST + 1, 0, LAST + 2, 0], { bold: true })
    set([LAST + 2, 1, LAST + 2, 1], { numFmt: '0%' })
    s.widths = { A: 250, C: 110, D: 100 }
    return doc.getState()
  }
  const initial = shipped()

  // ---- what was saved, or the shipped document ------------------------------
  function load(): SheetState | null {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as SheetState) : null
    } catch { return null }
  }
  const saved = load()
  const doc = createSheetDocument({ state: saved ?? initial })

  let sheet = $state<SvSheet>()
  let savedAt = $state<number | null>(saved ? Date.now() : null)
  let bytes = $state(saved ? new Blob([JSON.stringify(saved)]).size : 0)
  let restored = $state(saved !== null)
  let lastReasons = $state<string>('')
  let timer: ReturnType<typeof setTimeout> | undefined

  // Once per tick with every reason; the write itself waits for a pause.
  function onChange(reasons: ReadonlyArray<SheetChangeReason>) {
    // A restore (Reset here, setState anywhere) is not an edit to save.
    if (reasons.every((r) => r.kind === 'restore')) return
    lastReasons = [...new Set(reasons.map((r) => r.kind))].join(', ')
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!sheet) return
      const json = JSON.stringify(sheet.getState())
      try { localStorage.setItem(KEY, json) } catch { /* storage full or blocked: the sheet still works */ }
      bytes = json.length
      savedAt = Date.now()
    }, 400)
  }

  function reset() {
    clearTimeout(timer)
    try { localStorage.removeItem(KEY) } catch { /* nothing to forget */ }
    sheet?.setState(initial)
    savedAt = null
    bytes = 0
    restored = false
    lastReasons = ''
  }

  // A clock for the "saved N s ago" label.
  let now = $state(Date.now())
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(id)
  })
  const ago = $derived(savedAt === null ? 'not saved yet' : now - savedAt < 2000 ? 'saved just now' : `saved ${Math.round((now - savedAt) / 1000)}s ago`)
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <div class="bar">
    <span class="dot" class:on={savedAt !== null}></span>
    <span class="status">{ago}{bytes ? `, ${(bytes / 1024).toFixed(1)} KB in localStorage` : ''}</span>
    {#if restored}<span class="pill">restored from the last visit</span>{/if}
    {#if lastReasons}<span class="reasons">last change: {lastReasons}</span>{/if}
    <span class="grow"></span>
    <button type="button" class="btn" onclick={() => location.reload()}>Reload the page</button>
    <button type="button" class="btn" onclick={reset}>Reset to the shipped document</button>
  </div>
  <SvSheet bind:this={sheet} document={doc} {onChange} height="100%" rows={16} columns={8} />
  <p class="note shrink-0">
    Every edit is saved after a 400ms pause, comments, rules, merges,
    hidden columns and all. Change something, then <strong>Reload the
    page</strong>: the sheet opens as you left it. <strong>Reset</strong>
    puts the shipped document back and forgets the save.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sg-muted, #94a3b8); }
  .dot.on { background: var(--sg-success, #16a34a); }
  .status { font-variant-numeric: tabular-nums; }
  .pill {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #6366f1);
  }
  .reasons { color: var(--sg-muted, #64748b); }
  .grow { flex: 1 1 auto; }
  .btn {
    padding: 4px 10px;
    font: inherit;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 4px;
    cursor: pointer;
  }
  .btn:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
</style>
