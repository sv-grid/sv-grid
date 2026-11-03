<script lang="ts">
  /**
   * 712. SvGrid Base: @mentions and notifications
   * ---------------------------------------------
   * A content review base: articles, their writer and editor, and the
   * discussion on each one. Open a record (the expand button on a row, or a
   * notification) and type `@` in the comment box: the people of the base are
   * listed, narrowed as you type; Up, Down and Enter pick one. The comment
   * keeps the mention as `@[Name](userId)`, so it is drawn as a chip with the
   * person's current name.
   *
   * The comment store's `onMention` hook runs once per comment that mentions
   * someone, with the comment, the people, the record and the grid api. Here
   * it fills an inbox per person and shows a toast where an app would send an
   * email or a chat message. Switch "Signed in as" to read someone else's
   * inbox; the comments you write are then theirs.
   */
  import { SvToaster, toast } from '@svgrid/grid'
  import {
    SvBase,
    enableBase,
    getCurrentUser,
    getFieldUsers,
    mentionIds,
    mentionText,
    mentionToken,
    openRecord,
    setCurrentUser,
    setRecordComments,
    type BaseTable,
    type FieldUser,
    type MentionEvent,
    type RecordComment,
    type RecordCommentStore,
  } from '@svgrid/enterprise/base'
  import { PEOPLE, usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const TABLE = 'review-articles'
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const STATUS = [
    { value: 'Draft', color: '#94a3b8' },
    { value: 'In review', color: '#2d7ff9' },
    { value: 'Changes requested', color: '#fcb400' },
    { value: 'Approved', color: '#20c933' },
    { value: 'Published', color: '#8b46ff' },
  ]

  const articles = [
    { id: 'a1', title: 'Pricing page rewrite', status: 'In review', writer: 'u2', editor: 'u3', due: day(2), words: 1200 },
    { id: 'a2', title: 'Release notes: November', status: 'Draft', writer: 'u6', editor: 'u1', due: day(5), words: 650 },
    { id: 'a3', title: 'How we cut page load in half', status: 'Changes requested', writer: 'u4', editor: 'u5', due: day(1), words: 1800 },
    { id: 'a4', title: 'Customer story: a logistics team', status: 'Approved', writer: 'u7', editor: 'u3', due: day(-1), words: 1400 },
    { id: 'a5', title: 'Getting started guide', status: 'In review', writer: 'u5', editor: 'u8', due: day(3), words: 2300 },
    { id: 'a6', title: 'Security FAQ', status: 'Published', writer: 'u8', editor: 'u1', due: day(-6), words: 900 },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: TABLE,
      name: 'Articles',
      primaryField: 'title',
      data: articles,
      columns: [
        { field: 'title', header: 'Article', width: 280, fieldType: 'text' },
        { field: 'status', header: 'Status', width: 170, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'writer', header: 'Writer', width: 150, fieldType: 'user' },
        { field: 'editor', header: 'Editor', width: 150, fieldType: 'user' },
        { field: 'due', header: 'Due', width: 130, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'words', header: 'Words', width: 100, fieldType: 'number', fieldProps: { format: 'integer' } },
      ],
      views: [
        { id: 'all', name: 'All articles', type: 'grid' },
        { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
      ],
      props: { rowAdder: { label: 'Add article', defaults: () => ({ status: 'Draft', due: day(7) }) } },
    },
  ])

  // ---- Notifications ---------------------------------------------------------
  type Note = { id: string; to: string; from?: string; rowId: string; record: string; text: string; at: number; read: boolean }

  const person = (id: string | undefined) => getFieldUsers().find((u) => u.id === id)
  const nameOf = (id: string | undefined) => person(id)?.name ?? 'Someone'
  const titleOf = (rowId: string) => String(articles.find((a) => a.id === rowId)?.title ?? 'a record')
  // The comment as an email would carry it: each mention as @Name.
  const plain = (text: string) => mentionText(text, (id) => person(id)?.name)

  /** What the hook sends: one notification per person mentioned, except the author. */
  const notesFor = (comment: RecordComment, mentioned: ReadonlyArray<FieldUser>, record: string): Note[] =>
    mentioned
      .filter((p) => p.id !== comment.by)
      .map((p) => ({ id: `${comment.id}-${p.id}`, to: p.id, from: comment.by, rowId: comment.rowId, record, text: comment.text, at: comment.at, read: false }))

  // ---- Comments: kept in this page, seeded with a discussion -----------------
  const at = (minutesAgo: number) => Date.now() - minutesAgo * 60_000
  const who = (id: string) => PEOPLE.find((p) => p.id === id)!
  const m = (id: string) => mentionToken(who(id))
  const SEED: RecordComment[] = [
    { id: 's1', rowId: 'a1', tableId: TABLE, by: 'u2', at: at(190), text: `${m('u3')} can you check the plan table against the billing export before Friday?` },
    { id: 's2', rowId: 'a1', tableId: TABLE, by: 'u3', at: at(120), text: `Numbers match. ${m('u1')} the annual discount line needs legal to sign off.` },
    { id: 's3', rowId: 'a1', tableId: TABLE, by: 'u1', at: at(45), text: `Sent to legal. ${m('u2')} hold the publish until they reply.` },
    { id: 's4', rowId: 'a3', tableId: TABLE, by: 'u5', at: at(300), text: `The chart in the second section has no units. ${m('u4')} can you add them?` },
    { id: 's5', rowId: 'a3', tableId: TABLE, by: 'u4', at: at(80), text: `Added. ${m('u5')} ${m('u1')} ready for another pass.` },
    { id: 's6', rowId: 'a5', tableId: TABLE, by: 'u8', at: at(30), text: `Screenshots still show the old theme. ${m('u5')} I can retake them tomorrow.` },
  ].map((c) => ({ ...c, mentions: mentionIds(c.text) }))

  // By table and record. Other bases on the page keep theirs here too.
  const keyOf = (rowId: string, tableId?: string) => `${tableId ?? ''}/${rowId}`
  const seeded: Record<string, RecordComment[]> = {}
  for (const c of SEED) (seeded[keyOf(c.rowId, c.tableId)] ??= []).push(c)
  let comments = $state.raw(seeded)

  // What the seeded comments sent, newest first; the older ones already read.
  let notes = $state<Note[]>(
    SEED.flatMap((c) => notesFor(c, (c.mentions ?? []).map(who), titleOf(c.rowId)))
      .map((n) => ({ ...n, read: n.at < at(100) }))
      .sort((a, b) => b.at - a.at),
  )
  let api = $state<unknown>(null)

  const store: RecordCommentStore = {
    list: (rowId, _api, { tableId }) => comments[keyOf(rowId, tableId)] ?? [],
    add: (rowId, comment, _api, { tableId }) => {
      comments = { ...comments, [keyOf(rowId, tableId)]: [...(comments[keyOf(rowId, tableId)] ?? []), comment] }
    },
    // Once per comment that mentions someone. An app would send the emails here.
    onMention: (e: MentionEvent) => {
      if (e.tableId !== TABLE) return
      const fresh = notesFor(e.comment, e.mentioned, String(e.record?.title ?? titleOf(e.rowId)))
      notes = [...fresh, ...notes]
      for (const n of fresh) {
        const to = person(n.to)
        toast.info(`Emailed ${to?.name ?? 'Someone'}${to?.email ? ` (${to.email})` : ''}: mentioned on "${n.record}"`)
      }
    },
  }
  $effect(() => {
    setRecordComments(store)
    return () => setRecordComments(null)
  })

  // ---- Signed in as ----------------------------------------------------------
  const me = $derived(getCurrentUser())
  const inbox = $derived(notes.filter((n) => n.to === me?.id))
  const unread = $derived(inbox.filter((n) => !n.read).length)

  function signIn(id: string) {
    setCurrentUser(PEOPLE.find((p) => p.id === id) ?? null)
  }
  function show(n: Note) {
    notes = notes.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    if (api) openRecord({ api, rowId: n.rowId, focus: 'comment' })
  }
  const onApiReady = (a: unknown) => (api = a)
  const markAllRead = () => (notes = notes.map((n) => (n.to === me?.id ? { ...n, read: true } : n)))
  const when = (t: number) => {
    const min = Math.round((Date.now() - t) / 60_000)
    return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`
  }
</script>

<section class="mentions-demo">
  <div class="mentions-base">
    <SvBase
      bind:tables
      editable
      sortable
      showRowNumbers
      expandRows
      rowNumberWidth={64}
      showRowSelection={false}
      rowHeight={40}
      containerHeight="100%"
      {onApiReady}
    />
  </div>
  <aside class="mentions-inbox" aria-label="Notifications">
    <label class="mentions-who">
      <span>Signed in as</span>
      <select value={me?.id ?? ''} onchange={(e) => signIn(e.currentTarget.value)}>
        {#each PEOPLE as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
    <div class="mentions-head">
      <h3>Notifications</h3>
      {#if unread}<span class="mentions-count" aria-label={`${unread} unread`}>{unread}</span>{/if}
      <button type="button" class="mentions-link" disabled={!unread} onclick={markAllRead}>Mark all read</button>
    </div>
    <ul class="mentions-list">
      {#each inbox as n (n.id)}
        <li>
          <button type="button" class="mentions-note" class:is-unread={!n.read} onclick={() => show(n)}>
            <span class="mentions-line"><strong>{nameOf(n.from)}</strong> mentioned you on <strong>{n.record}</strong></span>
            <span class="mentions-text">{plain(n.text)}</span>
            <span class="mentions-meta">{when(n.at)} - emailed to {me?.email}</span>
          </button>
        </li>
      {:else}
        <li class="mentions-empty">Nothing for {me?.name ?? 'you'} yet. Mention them in a comment.</li>
      {/each}
    </ul>
  </aside>
  <SvToaster />
</section>

<style>
  .mentions-demo { display: flex; gap: 12px; flex: 1; min-height: 480px; height: 100%; }
  .mentions-base { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .mentions-inbox {
    display: flex; flex-direction: column; gap: 10px; width: 300px; flex: none; padding: 12px; overflow: auto;
    color: var(--sg-fg); background: var(--sg-bg); border: 1px solid var(--sg-border); border-radius: var(--sg-radius, 6px);
  }
  .mentions-who { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--sg-muted); }
  .mentions-who select {
    height: 32px; padding: 0 8px; font: inherit; font-size: 13px; color: var(--sg-fg); background: var(--sg-bg);
    border: 1px solid var(--sg-border); border-radius: var(--sg-radius, 6px);
  }
  .mentions-head { display: flex; align-items: center; gap: 8px; }
  .mentions-head h3 { margin: 0; font-size: 14px; }
  .mentions-count {
    min-width: 20px; padding: 0 6px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 20px; text-align: center;
    color: var(--sg-bg); background: var(--sg-fg);
  }
  .mentions-link { margin-inline-start: auto; padding: 0; border: 0; background: none; font: inherit; font-size: 12px; color: var(--sg-fg); text-decoration: underline; cursor: pointer; }
  .mentions-link:disabled { color: var(--sg-muted); text-decoration: none; cursor: default; }
  .mentions-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .mentions-note {
    display: flex; flex-direction: column; gap: 3px; width: 100%; padding: 8px 10px; text-align: start; font: inherit; font-size: 12px;
    color: var(--sg-fg); background: var(--sg-bg); border: 1px solid var(--sg-border); border-radius: var(--sg-radius, 6px); cursor: pointer;
  }
  .mentions-note.is-unread { border-inline-start: 3px solid var(--sg-fg); background: color-mix(in srgb, var(--sg-fg) 4%, var(--sg-bg)); }
  .mentions-note:hover { border-color: var(--sg-muted); }
  .mentions-text { color: var(--sg-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; }
  .mentions-meta { font-size: 11px; color: var(--sg-muted); }
  .mentions-empty { font-size: 12px; color: var(--sg-muted); }
  @media (max-width: 760px) {
    .mentions-demo { flex-direction: column; }
    .mentions-inbox { width: auto; }
  }
</style>
