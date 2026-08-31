<script lang="ts">
  /**
   * 91. Cell comments + @-mentions
   * ------------------------------
   * Sticky-note conversations attached to any cell. Right-click a
   * cell → "Add comment" opens an editor below the grid; a corner
   * triangle marks cells with active threads. Typing "@" inside the
   * editor opens a fuzzy-search picker over the team list and
   * inserts a chip.
   *
   * Storage is a `commentsAdapter` namespace - the demo wires a local
   * one that mutates an in-memory map, but the contract is the same
   * for a remote adapter (REST / WebSocket).
   *
   * What's worth stealing:
   *
   *   - The "comment indicator" is a CSS triangle pseudo-element
   *     painted via a class added by the cell snippet. No extra
   *     overlay layer.
   *   - The @-mention picker tracks insertion position via the
   *     textarea's selectionStart so chips land where the user is
   *     typing.
   *   - Mentioned users get a notification badge in the team list.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Deal = {
    id: string
    customer: string
    owner: string
    stage: 'discovery' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost'
    amount: number
    closeDate: string
    probability: number
  }

  type TeamMember = { id: string; name: string; initials: string; email: string }

  type Comment = {
    id: string
    cellKey: string                  // `${rowIndex}:${columnId}`
    author: TeamMember
    body: string                      // raw text with @[name](id) chips
    mentions: string[]                // member ids
    createdAt: string
    resolved: boolean
  }

  const TEAM: TeamMember[] = [
    { id: 'u-priya',  name: 'Priya Nair',         initials: 'PN', email: 'priya@example.com' },
    { id: 'u-jordan', name: 'Jordan Wu',          initials: 'JW', email: 'jordan@example.com' },
    { id: 'u-sasha',  name: 'Sasha Park',         initials: 'SP', email: 'sasha@example.com' },
    { id: 'u-casey',  name: 'Casey Singh',        initials: 'CS', email: 'casey@example.com' },
    { id: 'u-drew',   name: 'Drew Olsen',         initials: 'DO', email: 'drew@example.com' },
    { id: 'u-avery',  name: 'Avery Mehta',        initials: 'AM', email: 'avery@example.com' },
  ]
  const me = TEAM[0]!

  let rows = $state<Deal[]>([
    { id: 'D-001', customer: 'Helios Holdings',   owner: 'Sasha Park',    stage: 'proposal',    amount:  320_000, closeDate: '2026-07-15', probability: 70 },
    { id: 'D-002', customer: 'Vertex Partners',   owner: 'Jordan Wu',     stage: 'qualified',   amount:  185_000, closeDate: '2026-08-01', probability: 50 },
    { id: 'D-003', customer: 'Pacific Industries',owner: 'Casey Singh',   stage: 'closed_won',  amount:  620_000, closeDate: '2026-06-04', probability: 100 },
    { id: 'D-004', customer: 'Nordic Capital',    owner: 'Avery Mehta',   stage: 'discovery',   amount:   45_000, closeDate: '2026-09-22', probability: 25 },
    { id: 'D-005', customer: 'Atlas Logistics',   owner: 'Drew Olsen',    stage: 'proposal',    amount:  240_000, closeDate: '2026-07-30', probability: 65 },
    { id: 'D-006', customer: 'Quantum Resources', owner: 'Priya Nair',    stage: 'closed_lost', amount:  180_000, closeDate: '2026-06-01', probability: 0 },
  ])

  // ---- Local comments adapter -------------------------------------------
  // Swap for { add, list, resolve, listAll } against a REST endpoint.
  let comments = $state<Comment[]>([
    {
      id: 'c1', cellKey: '0:amount', author: TEAM[2]!,
      body: 'Quote came in at @[Priya Nair](u-priya) review price. Margin is thin.',
      mentions: ['u-priya'], createdAt: '2026-06-08T09:14:00', resolved: false,
    },
    {
      id: 'c2', cellKey: '0:amount', author: TEAM[0]!,
      body: 'Approved. Move to proposal.',
      mentions: [], createdAt: '2026-06-08T11:02:00', resolved: false,
    },
    {
      id: 'c3', cellKey: '3:probability', author: TEAM[5]!,
      body: 'Champion left last week. @[Jordan Wu](u-jordan) should we downgrade?',
      mentions: ['u-jordan'], createdAt: '2026-06-08T16:40:00', resolved: false,
    },
  ])

  function addComment(cellKey: string, body: string, mentions: string[]) {
    comments = [
      ...comments,
      {
        id: 'c' + Math.random().toString(36).slice(2, 8),
        cellKey, author: me, body, mentions,
        createdAt: new Date().toISOString().slice(0, 19),
        resolved: false,
      },
    ]
  }
  function resolveThread(cellKey: string) {
    comments = comments.map((c) => c.cellKey === cellKey ? { ...c, resolved: true } : c)
  }

  // Per-cell aggregated state
  const commentCellMap = $derived.by(() => {
    const map = new Map<string, Comment[]>()
    for (const c of comments) {
      if (c.resolved) continue
      const list = map.get(c.cellKey) ?? []
      list.push(c)
      map.set(c.cellKey, list)
    }
    return map
  })
  const myMentions = $derived(comments.filter((c) => !c.resolved && c.mentions.includes(me.id)).length)
  const openThreads = $derived(commentCellMap.size)

  // ---- Context menu state -----------------------------------------------
  let ctxMenu = $state<{ x: number; y: number; cellKey: string } | null>(null)
  function openContext(event: MouseEvent) {
    const td = (event.target as HTMLElement | null)?.closest('td.sv-grid-cell') as HTMLElement | null
    if (!td) return
    event.preventDefault()
    const rowIndex = Number(td.dataset.svgridRow)
    const colId = td.dataset.colId ?? ''
    if (!Number.isFinite(rowIndex) || !colId) return
    ctxMenu = {
      x: Math.min(event.clientX, window.innerWidth - 200),
      y: Math.min(event.clientY, window.innerHeight - 130),
      cellKey: `${rowIndex}:${colId}`,
    }
  }
  function closeContext() { ctxMenu = null }
  $effect(() => {
    if (!ctxMenu) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('.cc-ctx')) return
      closeContext()
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContext() })
    return () => document.removeEventListener('click', onDoc)
  })

  // ---- Editor state -----------------------------------------------------
  let editorOpen = $state<{ cellKey: string } | null>(null)
  let editorText = $state('')
  let editorTextarea = $state<HTMLTextAreaElement | null>(null)
  let mentionPicker = $state<{ query: string; from: number } | null>(null)

  function openEditor(cellKey: string) {
    editorOpen = { cellKey }
    editorText = ''
    mentionPicker = null
    closeContext()
    queueMicrotask(() => editorTextarea?.focus())
  }
  function closeEditor() {
    editorOpen = null
    editorText = ''
    mentionPicker = null
  }

  function onEditorInput(e: Event) {
    const ta = e.currentTarget as HTMLTextAreaElement
    editorText = ta.value
    // Detect "@..." prefix at the caret to open the mention picker.
    const caret = ta.selectionStart ?? editorText.length
    const before = editorText.slice(0, caret)
    const m = before.match(/@([A-Za-z]*)$/)
    if (m) {
      mentionPicker = { query: m[1] ?? '', from: caret - (m[1]?.length ?? 0) - 1 }
    } else {
      mentionPicker = null
    }
  }

  const mentionMatches = $derived.by(() => {
    if (!mentionPicker) return []
    const q = mentionPicker.query.toLowerCase()
    return TEAM.filter((m) => m.id !== me.id)
                .filter((m) => m.name.toLowerCase().includes(q))
                .slice(0, 5)
  })

  function pickMention(m: TeamMember) {
    if (!mentionPicker) return
    const before = editorText.slice(0, mentionPicker.from)
    const after = editorText.slice((mentionPicker.from) + 1 + mentionPicker.query.length)
    const inserted = `@[${m.name}](${m.id}) `
    editorText = before + inserted + after
    mentionPicker = null
    queueMicrotask(() => {
      editorTextarea?.focus()
      const pos = (before + inserted).length
      editorTextarea?.setSelectionRange(pos, pos)
    })
  }

  function commitComment() {
    if (!editorOpen) return
    const body = editorText.trim()
    if (!body) return
    const mentionIds = [...body.matchAll(/@\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]!)
    addComment(editorOpen.cellKey, body, [...new Set(mentionIds)])
    closeEditor()
  }

  // ---- Render helpers ----------------------------------------------------
  function renderBody(body: string): string {
    return body.replace(/@\[([^\]]+)\]\(([^)]+)\)/g,
      (_, name) => `<span class="cc-chip">@${escapeHtml(String(name))}</span>`)
  }
  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
  }
  function fmtTime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }
  function avatarHue(id: string): string {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
    return `hsl(${h % 360}deg 55% 50%)`
  }

  // ---- Grid setup --------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  const columns: ColumnDef<typeof features, Deal>[] = [
    { field: 'id',       header: 'Deal',       editorType: 'text',   width: 110, editable: false,
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'id',          text: ctx.row.original.id }) },
    { field: 'customer', header: 'Customer',   editorType: 'text',   width: 200,
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'customer',    text: ctx.row.original.customer }) },
    { field: 'owner',    header: 'Owner',      editorType: 'text',   width: 160,
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'owner',       text: ctx.row.original.owner }) },
    { field: 'stage',    header: 'Stage',      editorType: 'text',   width: 130,
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'stage',       text: ctx.row.original.stage }) },
    { field: 'amount',   header: 'Amount',     editorType: 'number', width: 140, align: 'right',
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'amount',      text: fmtMoney.format(ctx.row.original.amount) }) },
    { field: 'closeDate',header: 'Close date', editorType: 'date',   width: 130,
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'closeDate',   text: ctx.row.original.closeDate }) },
    { field: 'probability', header: 'Win %',  editorType: 'number', width: 110, align: 'right',
      cell: (ctx) => renderSnippet(CommentCell, { rowIndex: ctx.row.index, colId: 'probability', text: ctx.row.original.probability + '%' }) },
  ]
</script>

{#snippet CommentCell(props: { rowIndex: number; colId: string; text: string })}
  {@const key = `${props.rowIndex}:${props.colId}`}
  {@const list = commentCellMap.get(key)}
  {@const hasComments = !!list && list.length > 0}
  <span class={`cc-cell ${hasComments ? 'cc-cell-has-thread' : ''}`}>
    {props.text}
    {#if hasComments}
      <span class="cc-corner" title={`${list.length} comment${list.length === 1 ? '' : 's'}`}></span>
    {/if}
  </span>
{/snippet}

<section class="cc-shell flex flex-col flex-1 min-h-0 gap-3">
  <div class="cc-toolbar shrink-0">
    <div class="cc-acting">
      <span class="cc-avatar" style="background: var(--sg-accent, #6366f1)">{me.initials}</span>
      <span>You are <strong>{me.name}</strong></span>
    </div>
    <div class="cc-stats">
      <span class="cc-stat">Open threads: <strong>{openThreads}</strong></span>
      <span class="cc-stat cc-stat-mention">Your mentions: <strong>{myMentions}</strong></span>
    </div>
    <span class="cc-hint">Right-click any cell to add a comment. Use <kbd>@</kbd> inside the editor to mention a teammate.</span>
  </div>

  <div class="cc-grid-host flex-1 min-h-0" oncontextmenu={openContext} role="presentation">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>

  {#if editorOpen}
    {@const list = commentCellMap.get(editorOpen.cellKey) ?? []}
    <div class="cc-editor shrink-0">
      <header class="cc-editor-head">
        <span>Comment thread · <code>{editorOpen.cellKey}</code></span>
        <div class="cc-editor-actions">
          {#if list.length > 0}
            <button type="button" class="cc-btn cc-btn-ghost" onclick={() => { resolveThread(editorOpen!.cellKey); closeEditor() }}>
              Resolve thread
            </button>
          {/if}
          <button type="button" class="cc-btn cc-btn-ghost" onclick={closeEditor}>Close</button>
        </div>
      </header>
      {#if list.length > 0}
        <div class="cc-thread">
          {#each list as c (c.id)}
            <article class="cc-msg">
              <span class="cc-avatar" style={`background: ${avatarHue(c.author.id)}`}>{c.author.initials}</span>
              <div class="cc-msg-body">
                <header class="cc-msg-head">
                  <strong>{c.author.name}</strong>
                  <time>{fmtTime(c.createdAt)}</time>
                </header>
                <div class="cc-msg-text">{@html renderBody(c.body)}</div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
      <div class="cc-compose">
        <span class="cc-avatar" style="background: var(--sg-accent, #6366f1)">{me.initials}</span>
        <div class="cc-compose-input">
          <textarea
            bind:this={editorTextarea}
            value={editorText}
            placeholder="Add a comment… type @ to mention a teammate"
            oninput={onEditorInput}
            onkeydown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault(); commitComment()
              }
            }}
            rows="2"
          ></textarea>
          {#if mentionPicker}
            <div class="cc-mention-pop" role="listbox">
              {#each mentionMatches as m (m.id)}
                <button type="button" class="cc-mention-item" onclick={() => pickMention(m)}>
                  <span class="cc-avatar cc-avatar-sm" style={`background: ${avatarHue(m.id)}`}>{m.initials}</span>
                  <span>{m.name}</span>
                  <span class="cc-mention-email">{m.email}</span>
                </button>
              {/each}
              {#if mentionMatches.length === 0}
                <div class="cc-mention-empty">No match for "{mentionPicker.query}"</div>
              {/if}
            </div>
          {/if}
        </div>
        <button type="button" class="cc-btn cc-btn-primary" disabled={!editorText.trim()} onclick={commitComment}>
          Comment
        </button>
      </div>
      <p class="cc-shortcut">⌘ + Enter to send · @ to mention</p>
    </div>
  {/if}
</section>

{#if ctxMenu}
  <div class="cc-ctx" style="left: {ctxMenu.x}px; top: {ctxMenu.y}px;" role="menu">
    <button type="button" class="cc-ctx-item" onclick={() => openEditor(ctxMenu!.cellKey)}>
      <span class="cc-ctx-ico">💬</span>
      <span>{commentCellMap.has(ctxMenu.cellKey) ? 'Open comment thread' : 'Add comment'}</span>
    </button>
    {#if commentCellMap.has(ctxMenu.cellKey)}
      <button type="button" class="cc-ctx-item" onclick={() => { resolveThread(ctxMenu!.cellKey); closeContext() }}>
        <span class="cc-ctx-ico">✓</span>
        <span>Resolve thread</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .cc-shell { height: 100%; }

  .cc-toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
  }
  .cc-acting { display: inline-flex; align-items: center; gap: 8px; }
  .cc-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 11px;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.20);
    flex-shrink: 0;
  }
  .cc-avatar-sm { width: 20px; height: 20px; font-size: 9px; }
  .cc-stats { display: inline-flex; align-items: center; gap: 12px; margin-left: auto; }
  .cc-stat { font-size: 12px; color: var(--sg-muted, #64748b); }
  .cc-stat-mention { color: var(--sg-accent, #2563eb); }
  .cc-hint  { font-size: 12px; color: var(--sg-muted, #64748b); flex-basis: 100%; }
  .cc-hint kbd {
    font-family: ui-monospace, Menlo, monospace;
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 3px;
    padding: 0 5px;
    font-size: 11px;
  }

  .cc-grid-host { position: relative; }

  /* Cell with active thread: a small triangle in the corner. */
  :global(.cc-cell) { display: inline-flex; align-items: center; gap: 4px; position: relative; }
  :global(.cc-corner) {
    position: absolute;
    top: -4px; right: -4px;
    width: 0; height: 0;
    border-left: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid var(--sg-accent, #6366f1);
    transform: rotate(45deg);
  }

  /* Comment editor card */
  .cc-editor {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .cc-editor-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--sg-muted, #64748b); }
  .cc-editor-head code { background: var(--sg-header-bg, #f1f5f9); padding: 1px 5px; border-radius: 3px; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
  .cc-editor-actions { display: inline-flex; gap: 6px; }

  .cc-thread { display: flex; flex-direction: column; gap: 6px; }
  .cc-msg { display: flex; gap: 8px; align-items: flex-start; }
  .cc-msg-body { flex: 1; }
  .cc-msg-head { display: flex; gap: 8px; align-items: baseline; }
  .cc-msg-head strong { font-size: 13px; color: var(--sg-fg, #0f172a); }
  .cc-msg-head time { font-size: 11px; color: var(--sg-muted, #94a3b8); }
  .cc-msg-text { font-size: 13px; line-height: 1.45; color: var(--sg-fg, #0f172a); white-space: pre-wrap; }
  :global(.cc-chip) {
    display: inline-block; padding: 0 6px; border-radius: 4px;
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 16%, transparent);
    color: var(--sg-accent, #4338ca);
    font-weight: 600; font-size: 12px;
  }

  .cc-compose { display: flex; align-items: flex-start; gap: 8px; }
  .cc-compose-input { flex: 1; position: relative; }
  .cc-compose-input textarea {
    width: 100%;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px; font-family: inherit;
    resize: vertical;
    outline: none;
  }
  .cc-compose-input textarea:focus {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sg-accent, #2563eb) 22%, transparent);
  }
  .cc-mention-pop {
    position: absolute; left: 0; right: 0; top: 100%; margin-top: 4px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.15);
    overflow: hidden;
    z-index: 5;
  }
  .cc-mention-item {
    display: flex; align-items: center; gap: 8px;
    width: 100%;
    border: 0; background: transparent;
    padding: 6px 10px;
    font-size: 13px; text-align: left; cursor: pointer;
    color: var(--sg-fg, #0f172a);
  }
  .cc-mention-item:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .cc-mention-email { margin-left: auto; font-size: 11px; color: var(--sg-muted, #94a3b8); }
  .cc-mention-empty { padding: 6px 10px; font-size: 12px; color: var(--sg-muted, #64748b); }

  .cc-btn {
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
  }
  .cc-btn:disabled { opacity: 0.5; cursor: default; }
  .cc-btn-ghost   {
    background: transparent; color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .cc-btn-ghost:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .cc-btn-primary {
    background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff);
    border: 1px solid transparent;
  }
  .cc-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }

  .cc-shortcut { margin: 0; font-size: 11px; color: var(--sg-muted, #94a3b8); }

  /* Context menu */
  .cc-ctx {
    position: fixed; z-index: 50;
    min-width: 200px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
    padding: 4px;
  }
  .cc-ctx-item {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 7px 10px;
    border: 0; background: transparent;
    color: var(--sg-fg, #0f172a);
    font-size: 13px; text-align: left; cursor: pointer;
    border-radius: 5px;
  }
  .cc-ctx-item:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.14)); }
  .cc-ctx-ico { width: 18px; text-align: center; font-size: 14px; }
</style>
