<script lang="ts">
  /**
   * 501. Mail client (app template)
   * -------------------------------
   * An Outlook-shaped mail client in one file.
   *
   *   - SvNavPane: favourites, folders and labels over Mail / Calendar modules.
   *   - The message list is a SvGrid: sender avatars, conversation counts, sort
   *     by any header, quick filters, tick rows for bulk actions, hover actions
   *     per row, arrow keys carry the reading pane.
   *   - The reading pane shows the whole conversation, older messages folded,
   *     quoted text hidden until asked for, sanitized HTML bodies.
   *   - The composer (SvRichText) has recipient chips with contact suggestions,
   *     Cc, attachments, a signature and a five second Undo send.
   *   - Mail keeps arriving while the page is open.
   *   - Gmail-style shortcuts: c r a f e # u s j k / and ? for the list.
   *
   * Meeting invites carry Accept / Tentative / Decline; an accepted invite lands
   * on the Calendar module, which is the same SvGrid in scheduler view. Export
   * writes the open folder or the ticked rows to Excel, CSV or PDF.
   *
   * Nav pane, grid, rich text, modal: @svgrid/grid.
   * Scheduler renderer and export: @svgrid/enterprise.
   */
  import { tick, untrack } from 'svelte'
  import {
    SvGrid,
    SvNavPane,
    SvRichText,
    SvModal,
    SvTextInput,
    SvButton,
    SvMenu,
    SvAvatar,
    SvKbd,
    SvToaster,
    toast,
    renderSnippet,
    sanitizeHtml,
    htmlToText,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type NavSection,
    type NavModule,
    type MenuItem,
    type SvGridApi,
    type RichTextTool,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import {
    enableSchedulerView,
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
    type ExportColumn,
    type ExportFormat,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  // ---- Domain ---------------------------------------------------------------
  type FolderId = 'inbox' | 'drafts' | 'sent' | 'archive' | 'junk' | 'trash'
  type LabelId = 'clients' | 'billing' | 'team' | 'travel'
  type Invite = { title: string; start: string; end: string; where: string; response?: 'accepted' | 'tentative' | 'declined' }
  type Attachment = { name: string; size: string }
  type Msg = {
    id: number
    folder: FolderId
    from: string
    email: string
    to: string
    cc?: string
    subject: string
    body: string
    received: string
    unread: boolean
    flagged: boolean
    attachments: Attachment[]
    labels: LabelId[]
    invite?: Invite
    /** Messages that share a thread show as one conversation in the reader. */
    thread?: string
  }
  type Ev = { id: number; title: string; start: string; end: string; allDay?: boolean; cal: 'work' | 'personal'; color: string; fromMsg?: number }

  const ME = { name: 'Robin Hale', email: 'robin@northwind.io', title: 'Head of Customer Engineering, Northwind' }

  const FOLDERS: Record<FolderId, string> = {
    inbox: 'Inbox', drafts: 'Drafts', sent: 'Sent', archive: 'Archive', junk: 'Junk', trash: 'Trash',
  }
  // Category colours carry meaning (which label), so they stay literal.
  const LABELS: Record<LabelId, { name: string; color: string }> = {
    clients: { name: 'Clients', color: '#2563eb' },
    billing: { name: 'Billing', color: '#d97706' },
    team: { name: 'Team', color: '#16a34a' },
    travel: { name: 'Travel', color: '#9333ea' },
  }
  const CAL_COLOR = { work: '#2563eb', personal: '#16a34a', tentative: '#94a3b8' }

  // ---- Dates relative to now, so the seed always reads as "this week" -------
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const ago = (minutes: number) => iso(new Date(Date.now() - minutes * 60_000))
  function day(offset: number, h: number, m = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }
  function shortTime(s: string): string {
    const d = new Date(s)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if ((now.getTime() - d.getTime()) / 86_400_000 < 6) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  const longTime = (s: string) =>
    new Date(s).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const timeRange = (a: string, b: string) =>
    `${longTime(a)} - ${new Date(b).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  const fileSize = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`

  // ---- Seed bodies ----------------------------------------------------------
  // Bodies are ordinary HTML that goes through sanitizeHtml before it renders.
  // The sanitizer keeps class attributes, so the invoice and the build report
  // are styled divs rather than tables (tables are not on its list).
  const p = (...lines: string[]) => lines.map((l) => `<p>${l}</p>`).join('')
  const sig = (name: string, title: string) => `<div class="sig"><p>${name}<br><span>${title}</span></p></div>`
  const quote = (who: string, when: string, html: string) => `<blockquote><p>On ${when}, ${who} wrote:</p>${html}</blockquote>`

  const RENEWAL_1 = p('Hi Robin,', 'Our renewal is up at the end of the quarter. Before procurement starts, could you send a quote for 48 analytics seats and the onboarding package?') + sig('Maya Chen', 'Procurement Lead, Contoso')
  const RENEWAL_2 = p('Hi Maya,', 'Quote coming this week. One change worth knowing about: your team ran onboarding in August, so I will drop that line rather than bill it twice.') + sig(ME.name, ME.title) + quote('Maya Chen', 'Mon', RENEWAL_1)
  const RENEWAL_3 = p('Hi Robin,', 'Attached is the revised quote. We moved the analytics seats to annual billing and dropped the onboarding line, as you suggested.', 'Procurement wants a signed copy by <strong>Friday the 17th</strong> to keep the current rate. Can you confirm the seat count (48) before then?') + sig('Maya Chen', 'Procurement Lead, Contoso') + quote(ME.name, 'Tue', RENEWAL_2)

  const INVOICE = p('Hello,', 'Your invoice is ready. The PDF is attached; a summary follows.') +
    `<div class="receipt"><div class="receipt-head"><strong>Fabrikam, Inc.</strong><span>Invoice INV-20931</span></div>` +
    `<div class="receipt-row"><span>Data platform, 12 months</span><span>USD 9,600.00</span></div>` +
    `<div class="receipt-row"><span>Premium support</span><span>USD 2,400.00</span></div>` +
    `<div class="receipt-row"><span>Usage overage, September</span><span>USD 480.00</span></div>` +
    `<div class="receipt-row receipt-total"><span>Total due on the 15th</span><span>USD 12,480.00</span></div></div>` +
    p('Questions about this invoice go to <a href="mailto:billing@fabrikam.com">billing@fabrikam.com</a>.') + sig('Fabrikam Accounts Receivable', 'Fabrikam, Inc.')

  const BUILD = `<div class="build"><div class="build-head"><span class="build-ok">Passed</span><strong>main</strong><code>a41c9e2</code></div>` +
    `<div class="build-row"><span>Unit tests</span><span>1,912 passed, 3 skipped</span></div>` +
    `<div class="build-row"><span>End-to-end</span><span>214 passed</span></div>` +
    `<div class="build-row"><span>Duration</span><span>6m 41s</span></div></div>` +
    p('The flaky date-range spec that failed #4809 and #4810 passed on retry 1 of 2.', '<a href="https://example.com/builds/4812">View build #4812</a>')

  const NEWSLETTER = `<h2>October meetup: three talks</h2>` +
    p('Runes in a 400-component codebase, testing snippets without a browser, and a live build of an offline-first app.', '<strong>Thursday, doors at 18:30.</strong> Pizza from 19:00, talks at 19:30.', '<a href="https://example.com/rsvp">RSVP</a> - 40 seats left.') +
    `<div class="sig"><p><span>You get this because you joined the Svelte Society list. Unsubscribe any time.</span></p></div>`

  // ---- Seed messages ----------------------------------------------------------
  let seq = 100
  const mk = (m: Omit<Msg, 'id' | 'unread' | 'flagged' | 'attachments' | 'labels' | 'to'> & Partial<Msg>): Msg => ({
    id: ++seq, unread: false, flagged: false, attachments: [], labels: [], to: ME.email, ...m,
  })

  let msgs = $state<Msg[]>([
    mk({ folder: 'inbox', thread: 'renewal', from: 'Maya Chen', email: 'maya.chen@contoso.com', subject: 'Re: Q4 renewal - revised quote', received: ago(14), unread: true, flagged: true, labels: ['clients'],
      attachments: [{ name: 'Contoso-Q4-quote.pdf', size: '182 KB' }], body: RENEWAL_3 }),
    mk({ folder: 'inbox', thread: 'design-review', from: 'Daniel Okoro', email: 'daniel@northwind.io', subject: 'Design review: billing settings', received: ago(41), unread: true, labels: ['team'],
      invite: { title: 'Design review: billing settings', start: day(1, 14), end: day(1, 15), where: 'Room 4B, or the video link in the invite' },
      body: p('Robin,', 'Walking through the new billing settings flow before it goes to the Contoso pilot. Mocks are in the team folder, page 3 onward.', 'Bring opinions on the proration copy - it is the part I am least sure about.') + sig('Daniel Okoro', 'Product Designer, Northwind') }),
    mk({ folder: 'inbox', from: 'Build bot', email: 'builds@northwind.io', subject: 'main is green again (build #4812)', received: ago(72), body: BUILD }),
    mk({ folder: 'inbox', thread: 'onboarding', from: 'Priya Nair', email: 'priya@northwind.io', subject: 'Re: Onboarding checklist for Leo', received: ago(128), unread: true, labels: ['team'],
      body: p('Done with accounts and hardware. Two things left on your side:', '<ul><li>Add Leo to the on-call rotation from the 28th</li><li>Pair him with Owen for the billing service walkthrough</li></ul>') + sig('Priya Nair', 'Engineering Manager, Northwind') }),
    mk({ folder: 'inbox', from: 'Fabrikam Billing', email: 'billing@fabrikam.com', subject: 'Invoice INV-20931 is due on the 15th', received: day(-1, 16, 20), labels: ['billing'],
      attachments: [{ name: 'INV-20931.pdf', size: '64 KB' }], body: INVOICE }),
    mk({ folder: 'inbox', from: 'Sam Ortiz', email: 'sam@northwind.io', subject: 'Offsite: flights booked', received: day(-1, 11, 5), labels: ['travel'],
      attachments: [{ name: 'itinerary-lisbon.pdf', size: '220 KB' }],
      body: p('Flights are booked for everyone. Itinerary attached.', 'Out Tuesday 07:40, back Friday 18:15. If anyone needs a different return, tell me by Wednesday - after that the fare class changes.') + sig('Sam Ortiz', 'Operations, Northwind') }),
    mk({ folder: 'inbox', thread: 'qbr', from: 'Elena Rossi', email: 'elena.rossi@fabrikam.com', subject: 'Fabrikam quarterly business review', received: day(-1, 9, 30), unread: true, labels: ['clients'],
      invite: { title: 'Fabrikam QBR', start: day(3, 10), end: day(3, 11, 30), where: 'Fabrikam HQ, 3rd floor' },
      body: p('Hi Robin,', 'Sending the invite for our quarterly review. On our side: usage trends, the two open support escalations, and the 2027 roadmap preview you promised.') + sig('Elena Rossi', 'VP Operations, Fabrikam') }),
    mk({ folder: 'inbox', from: 'Owen Bradley', email: 'owen@northwind.io', subject: 'Incident review notes - API latency', received: day(-2, 9, 40), flagged: true, labels: ['team'],
      body: p('Notes from Tuesday\'s review:', '<ol><li>p95 latency hit 1.8 s for 22 minutes after the cache node restart</li><li>The alert fired 9 minutes late because the rule used a 15-minute window</li><li>Action: drop the window to 5 minutes and page on two consecutive breaches</li></ol>') + sig('Owen Bradley', 'Site Reliability, Northwind') }),
    mk({ folder: 'inbox', from: 'Northwind Security', email: 'security@northwind.io', subject: 'New sign-in from Lisbon, Portugal', received: day(-2, 22, 13),
      body: p('Your account signed in from a new location: <strong>Lisbon, Portugal</strong> (Chrome on macOS).', 'If this was you, there is nothing to do. If not, reset your password and revoke other sessions from Settings.') }),
    mk({ folder: 'inbox', from: 'Grace Kim', email: 'grace@northwind.io', subject: 'Can we move our 1:1?', received: day(-3, 15, 2), labels: ['team'],
      body: p('Thursday is stacked for me. Friday 10:00 or Monday after standup?', 'G') }),
    mk({ folder: 'inbox', from: 'Maya Chen', email: 'maya.chen@contoso.com', subject: 'Contoso: data export question', received: day(-4, 13, 47), labels: ['clients'],
      body: p('Quick one: can the export keep our column order, or does it always follow the default view? Finance builds a pivot on top of it and the order matters to them.') + sig('Maya Chen', 'Procurement Lead, Contoso') }),
    mk({ folder: 'inbox', from: 'Payroll', email: 'payroll@northwind.io', subject: 'Your September payslip', received: day(-5, 8, 0),
      attachments: [{ name: 'payslip-2026-09.pdf', size: '41 KB' }], body: p('Your payslip for September is attached. The password is your employee number.') }),
    mk({ folder: 'inbox', from: 'Liam Walsh', email: 'liam@wingtiptoys.com', subject: 'Intro: Wingtip Toys x Northwind', received: day(-6, 10, 12), labels: ['clients'],
      body: p('Robin, Grace suggested I reach out. We run 40 stores and our inventory screens are a mess of spreadsheets.', 'Would 30 minutes next week work to see whether your grid fits?') + sig('Liam Walsh', 'Head of Ops, Wingtip Toys') }),
    mk({ folder: 'inbox', from: 'Svelte Society', email: 'hello@sveltesociety.dev', subject: 'October meetup: talks announced', received: day(-8, 18, 30), body: NEWSLETTER }),
    mk({ folder: 'inbox', from: 'Tomas Novak', email: 'tomas@fabrikam.com', subject: 'Contract redlines', received: day(-10, 12, 0), labels: ['clients'],
      attachments: [{ name: 'MSA-v3-redline.docx', size: '96 KB' }, { name: 'DPA-v2.pdf', size: '133 KB' }],
      body: p('Legal\'s redlines are attached. The only open point is the liability cap in 9.2; everything else is wording.') + sig('Tomas Novak', 'Counsel, Fabrikam') }),
    mk({ folder: 'inbox', from: 'Hotel Baixa', email: 'reservations@hotelbaixa.pt', subject: 'Reservation confirmed - Lisbon, 3 nights', received: day(-12, 7, 15), labels: ['travel'],
      body: p('Your reservation is confirmed: 3 nights, superior double, breakfast included.', 'Check-in from 15:00. Confirmation number <strong>HB-77120</strong>.') }),

    mk({ folder: 'drafts', from: ME.name, email: ME.email, to: 'liam@wingtiptoys.com', subject: 'Re: Intro: Wingtip Toys x Northwind', received: ago(9),
      body: p('Hi Liam,', 'Thanks for reaching out. Tuesday or Wednesday afternoon both work; I can show you the inventory screens other retailers built.', '') }),

    mk({ folder: 'sent', thread: 'renewal', from: ME.name, email: ME.email, to: 'maya.chen@contoso.com', subject: 'Re: Q4 renewal', received: day(-1, 10, 4), body: RENEWAL_2 }),
    mk({ folder: 'archive', thread: 'renewal', from: 'Maya Chen', email: 'maya.chen@contoso.com', subject: 'Q4 renewal', received: day(-2, 16, 30), labels: ['clients'], body: RENEWAL_1 }),
    mk({ folder: 'sent', thread: 'onboarding', from: ME.name, email: ME.email, to: 'priya@northwind.io', subject: 'Onboarding checklist for Leo', received: ago(220),
      body: p('Priya, here is the checklist for Leo\'s first week. Can you take accounts and hardware?') + sig(ME.name, ME.title) }),
    mk({ folder: 'sent', thread: 'qbr', from: ME.name, email: ME.email, to: 'elena.rossi@fabrikam.com', subject: 'Agenda for the QBR', received: day(-1, 8, 50),
      body: p('Elena, proposed agenda: usage, escalations, roadmap. 90 minutes should do it.') + sig(ME.name, ME.title) }),
    mk({ folder: 'sent', from: ME.name, email: ME.email, to: 'sam@northwind.io', subject: 'Offsite dates', received: day(-3, 17, 20),
      body: p('Tuesday to Friday works for everyone on my side.') + sig(ME.name, ME.title) }),

    mk({ folder: 'archive', from: 'Owen Bradley', email: 'owen@northwind.io', subject: 'Postmortem template', received: day(-20, 11, 0), labels: ['team'],
      body: p('Template for postmortems going forward: timeline, impact, detection, response, follow-ups. Keep it blameless.') }),
    mk({ folder: 'archive', from: 'Northwind IT', email: 'it@northwind.io', subject: 'Welcome to Northwind', received: day(-40, 9, 0), body: p('Welcome aboard. Your laptop ships Monday.') }),

    mk({ folder: 'junk', from: 'Prize Desk', email: 'winner@prize-desk.biz', subject: 'You have been selected for a free cruise', received: day(-2, 3, 12),
      body: p('Click to claim your prize within 24 hours!') }),

    mk({ folder: 'trash', from: 'Grace Kim', email: 'grace@northwind.io', subject: 'Lunch order', received: day(-6, 11, 30), body: p('Thai or the salad place?') }),
  ])

  // Mail that arrives while the page is open: after 25 s and after 80 s.
  const INCOMING: Array<{ after: number; make: () => Msg }> = [
    { after: 25_000, make: () => mk({ folder: 'inbox', thread: 'design-review', from: 'Daniel Okoro', email: 'daniel@northwind.io', subject: 'Re: Design review: billing settings', received: iso(new Date()), unread: true, labels: ['team'],
      body: p('Adding Grace to tomorrow - she owns the proration copy now, so she should hear the feedback first hand.', 'Nothing else changes.') + sig('Daniel Okoro', 'Product Designer, Northwind') }) },
    { after: 80_000, make: () => mk({ folder: 'inbox', thread: 'renewal', from: 'Maya Chen', email: 'maya.chen@contoso.com', subject: 'Re: Q4 renewal - revised quote', received: iso(new Date()), unread: true, labels: ['clients'],
      body: p('One more thing: legal asked whether the DPA from last year still applies, or if we sign the new version with this renewal.') + sig('Maya Chen', 'Procurement Lead, Contoso') }) },
  ]

  // Monday of this week, for the calendar seed.
  const monday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })()
  function wk(dayIdx: number, h: number, m = 0): string {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayIdx)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }
  let evSeq = 500
  let events = $state<Ev[]>([
    { id: ++evSeq, title: 'Standup', start: wk(0, 9, 30), end: wk(0, 9, 45), cal: 'work', color: CAL_COLOR.work },
    { id: ++evSeq, title: 'Standup', start: wk(2, 9, 30), end: wk(2, 9, 45), cal: 'work', color: CAL_COLOR.work },
    { id: ++evSeq, title: 'Standup', start: wk(4, 9, 30), end: wk(4, 9, 45), cal: 'work', color: CAL_COLOR.work },
    { id: ++evSeq, title: 'Contoso renewal call', start: wk(1, 11), end: wk(1, 11, 45), cal: 'work', color: CAL_COLOR.work },
    { id: ++evSeq, title: 'Roadmap writing (focus)', start: wk(2, 13), end: wk(2, 15, 30), cal: 'work', color: CAL_COLOR.work },
    { id: ++evSeq, title: '1:1 Grace', start: wk(3, 16), end: wk(3, 16, 30), cal: 'work', color: CAL_COLOR.work },
    { id: ++evSeq, title: 'Gym', start: wk(1, 18), end: wk(1, 19), cal: 'personal', color: CAL_COLOR.personal },
    { id: ++evSeq, title: 'Dentist', start: wk(4, 8), end: wk(4, 8, 45), cal: 'personal', color: CAL_COLOR.personal },
  ])

  // ---- Views ----------------------------------------------------------------
  type Quick = 'all' | 'unread' | 'flagged' | 'files'
  let area = $state<'mail' | 'calendar'>('mail')
  let view = $state<string>('inbox')
  let quick = $state<Quick>('all')
  let query = $state('')
  let openId = $state<number | null>(null)
  let selected = $state<number[]>([])
  let compact = $state(false)
  let api = $state<EnterpriseGridApi<typeof features, Msg> | null>(null)

  function inView(m: Msg, v: string): boolean {
    if (v === 'flagged') return m.flagged && m.folder !== 'trash' && m.folder !== 'junk'
    if (v === 'unread') return m.unread && m.folder !== 'trash' && m.folder !== 'junk'
    if (v.startsWith('label:')) return m.labels.includes(v.slice(6) as LabelId) && m.folder !== 'trash'
    return m.folder === v
  }
  function viewName(v: string): string {
    if (v === 'flagged') return 'Flagged'
    if (v === 'unread') return 'Unread'
    if (v.startsWith('label:')) return LABELS[v.slice(6) as LabelId].name
    return FOLDERS[v as FolderId]
  }
  const passesQuick = (m: Msg) =>
    quick === 'all' || (quick === 'unread' ? m.unread : quick === 'flagged' ? m.flagged : m.attachments.length > 0)

  const q = $derived(query.trim().toLowerCase())
  // The open message stays in the list even after it stops matching (opening a
  // mail in Unread marks it read; it should not vanish from under the cursor).
  const matchesQuery = (m: Msg) =>
    q === '' || m.subject.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.to.toLowerCase().includes(q) || preview(m).toLowerCase().includes(q)
  // A folder view drops the open message once it moves out of the folder; a
  // filtered view (Unread, Flagged, a label, a quick filter, a search) keeps it.
  const viewRows = $derived(
    msgs.filter((m) =>
      m.id === openId
        ? (view in FOLDERS ? m.folder === view : m.folder !== 'trash')
        : inView(m, view) && passesQuick(m) && matchesQuery(m),
    ),
  )
  const QUICK_OPTIONS: Array<[Quick, string]> = [['all', 'All'], ['unread', 'Unread'], ['flagged', 'Flagged'], ['files', 'Files']]
  const listSummary = $derived.by(() => {
    const unread = viewRows.filter((m) => m.unread).length
    const parts = [viewRows.length === 1 ? '1 message' : `${viewRows.length} messages`]
    if (unread) parts.push(`${unread} unread`)
    if (selected.length) parts.push(`${selected.length} ticked`)
    return parts.join(', ')
  })
  const openMsg = $derived(openId == null ? null : (msgs.find((m) => m.id === openId) ?? null))
  const isOutbound = (f: FolderId) => f === 'sent' || f === 'drafts'

  // Conversations: every message of a thread outside Trash and Drafts, oldest first.
  const threadSizes = $derived.by(() => {
    const n = new Map<string, number>()
    for (const m of msgs) if (m.thread && m.folder !== 'trash' && m.folder !== 'drafts') n.set(m.thread, (n.get(m.thread) ?? 0) + 1)
    return n
  })
  const conversation = $derived.by(() => {
    const m = openMsg
    if (!m) return []
    if (!m.thread) return [m]
    return msgs.filter((x) => x.thread === m.thread && x.folder !== 'trash' && x.folder !== 'drafts').sort((a, b) => a.received.localeCompare(b.received))
  })
  let expanded = $state<number[]>([])
  let quotedOpen = $state<number[]>([])
  const toggleIn = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const unreadIn = (v: string) => msgs.filter((m) => inView(m, v) && m.unread).length || undefined
  const sections = $derived<NavSection[]>([
    { id: 'fav', label: 'Favorites', items: [
      { id: 'unread', label: 'Unread', icon: iUnread, badge: unreadIn('unread') },
      { id: 'flagged', label: 'Flagged', icon: iFlag, badge: msgs.filter((m) => inView(m, 'flagged')).length || undefined },
    ] },
    { id: 'folders', label: 'Folders', items: [
      { id: 'inbox', label: 'Inbox', icon: iInbox, badge: unreadIn('inbox') },
      { id: 'drafts', label: 'Drafts', icon: iDrafts, badge: msgs.filter((m) => m.folder === 'drafts').length || undefined },
      { id: 'sent', label: 'Sent', icon: iSent },
      { id: 'archive', label: 'Archive', icon: iArchive },
      { id: 'junk', label: 'Junk', icon: iJunk, badge: unreadIn('junk') },
      { id: 'trash', label: 'Trash', icon: iTrash },
    ] },
    { id: 'labels', label: 'Labels', items: [
      { id: 'label:clients', label: 'Clients', icon: lClients },
      { id: 'label:billing', label: 'Billing', icon: lBilling },
      { id: 'label:team', label: 'Team', icon: lTeam },
      { id: 'label:travel', label: 'Travel', icon: lTravel },
    ] },
  ])
  const calSections: NavSection[] = [
    { id: 'cals', label: 'Calendars', items: [
      { id: 'cal:all', label: 'All calendars', icon: iCal },
      { id: 'cal:work', label: 'Work', icon: cWork },
      { id: 'cal:personal', label: 'Personal', icon: cPersonal },
    ] },
  ]
  const modules = $derived<NavModule[]>([
    { id: 'mail', label: 'Mail', icon: iUnread, badge: unreadIn('inbox') },
    { id: 'calendar', label: 'Calendar', icon: iCal },
  ])
  let calView = $state('cal:all')
  let calDate = $state(new Date())
  const calRows = $derived(calView === 'cal:all' ? events : events.filter((e) => `cal:${e.cal}` === calView))

  function go(v: string) {
    view = v
    openId = null
    clearSelection()
  }
  function clearSelection() {
    api?.clearRowSelection()
    selected = []
  }

  // ---- Narrow screens: nav becomes a rail, the reader replaces the list ------
  let narrow = $state(typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches)
  $effect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const on = () => (narrow = mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  })

  // ---- Message actions ------------------------------------------------------
  const previews = new Map<string, string>()
  function preview(m: Msg): string {
    let t = previews.get(m.body)
    if (t == null) {
      // The preview is the new text only: quoted history and signatures are noise.
      // A space between adjacent tags keeps "Passed" and "main" apart when the
      // markup is flattened.
      const fresh = m.body.replace(/<blockquote[\s\S]*?<\/blockquote>/g, '').replace(/<div class="sig">[\s\S]*?<\/div>/g, '').replace(/></g, '> <')
      t = htmlToText(fresh).replace(/\s+/g, ' ').trim().slice(0, 140)
      previews.set(m.body, t)
    }
    return t
  }
  const who = (m: Msg) => (isOutbound(m.folder) ? `To: ${nameOf(m.to.split(',')[0]!.trim())}` : m.from)

  function patch(ids: readonly number[], change: Partial<Msg> | ((m: Msg) => Partial<Msg>)) {
    const set = new Set(ids)
    msgs = msgs.map((m) => (set.has(m.id) ? { ...m, ...(typeof change === 'function' ? change(m) : change) } : m))
  }

  function open(m: Msg) {
    if (m.folder === 'drafts') {
      compose({ id: m.id, to: splitAddresses(m.to), cc: splitAddresses(m.cc ?? ''), subject: m.subject, html: m.body, attachments: m.attachments, thread: m.thread })
      return
    }
    openId = m.id
    expanded = [m.id]
    quotedOpen = []
    readerEl?.scrollTo({ top: 0 })
    const unreadInThread = m.thread ? msgs.filter((x) => x.thread === m.thread && x.unread).map((x) => x.id) : m.unread ? [m.id] : []
    if (unreadInThread.length) patch(unreadInThread, { unread: false })
  }

  // Arrow keys carry the reading pane along with the grid's active row, the
  // way a desktop mail client does. Only while the list holds focus: the grid
  // seeds an active cell at mount, and that must not open (and mark read) a mail.
  let listEl = $state<HTMLElement | null>(null)
  let readerEl = $state<HTMLElement | null>(null)
  function onActiveCellChange(cell: { rowIndex: number }) {
    if (!listEl?.contains(document.activeElement)) return
    const m = api?.getDisplayedRows()[cell.rowIndex]
    if (m && m.folder !== 'drafts' && m.id !== openId) open(m)
  }
  /** j / k: the next or previous row in the order the grid shows them. */
  function step(by: 1 | -1) {
    const rows = api?.getDisplayedRows() ?? viewRows
    const i = rows.findIndex((m) => m.id === openId)
    const next = rows[Math.min(rows.length - 1, Math.max(0, i < 0 ? 0 : i + by))]
    if (next && next.id !== openId) {
      open(next)
      const at = rows.indexOf(next)
      api?.scrollToRow?.(at)
    }
  }

  const EMPTY: Record<string, string> = {
    inbox: 'Inbox zero. Nothing left to read.',
    unread: 'All caught up.',
    flagged: 'No flagged mail. Flag a message to keep it here.',
    drafts: 'No drafts.',
    sent: 'Nothing sent yet.',
    archive: 'Nothing archived.',
    junk: 'No junk. Mail you move to Junk lands here.',
    trash: 'Trash is empty.',
  }
  const QUICK_EMPTY: Record<Quick, string> = { all: '', unread: 'No unread mail here.', flagged: 'Nothing flagged here.', files: 'No mail with attachments here.' }
  const emptyMessage = $derived(
    q ? `No mail in ${viewName(view)} matches "${query.trim()}".`
      : quick !== 'all' ? QUICK_EMPTY[quick]
      : (EMPTY[view] ?? `No mail labelled ${viewName(view)}.`),
  )

  /** What a toolbar action applies to: the ticked rows, else the open message. */
  const targets = $derived(selected.length ? selected : openId != null ? [openId] : [])
  const targetMsgs = $derived(msgs.filter((m) => targets.includes(m.id)))
  const plural = (n: number) => (n === 1 ? '1 message' : `${n} messages`)

  function moveTo(folder: FolderId, ids: readonly number[] = [...targets]) {
    if (!ids.length) return
    const was = new Map(msgs.filter((m) => ids.includes(m.id)).map((m) => [m.id, m.folder]))
    patch(ids, { folder })
    if (openId != null && ids.includes(openId)) openId = null
    clearSelection()
    toast(`${plural(ids.length)} moved to ${FOLDERS[folder]}`, {
      action: { label: 'Undo', onClick: () => patch(ids, (m) => ({ folder: was.get(m.id) ?? m.folder })) },
    })
  }
  function remove(ids: readonly number[] = [...targets]) {
    if (!ids.length) return
    const inTrash = msgs.filter((m) => ids.includes(m.id) && m.folder === 'trash').length === ids.length
    if (!inTrash) return moveTo('trash', ids)
    // Deleting from Trash is for good; the toast keeps the rows (and their
    // places in the list) so Undo can put them back.
    const before = msgs
    msgs = msgs.filter((m) => !ids.includes(m.id))
    if (openId != null && ids.includes(openId)) openId = null
    clearSelection()
    toast(`${plural(ids.length)} deleted for good`, {
      action: {
        label: 'Undo',
        onClick: () => {
          // Keep anything that arrived since, then the old list with current copies.
          const known = new Set(before.map((m) => m.id))
          msgs = [...msgs.filter((x) => !known.has(x.id)), ...before.map((m) => msgs.find((x) => x.id === m.id) ?? m)]
        },
      },
    })
  }
  function toggleRead(ids: readonly number[] = targets) {
    const anyUnread = msgs.some((m) => ids.includes(m.id) && m.unread)
    patch(ids, { unread: !anyUnread })
  }
  function toggleFlag(ids: readonly number[] = targets) {
    const anyUnflagged = msgs.some((m) => ids.includes(m.id) && !m.flagged)
    patch(ids, { flagged: anyUnflagged })
  }

  const moveItems = $derived<MenuItem[]>(
    (['inbox', 'archive', 'junk', 'trash'] as FolderId[])
      .filter((f) => f !== view)
      .map((f) => ({ label: FOLDERS[f], disabled: targets.length === 0, onSelect: () => moveTo(f) })),
  )

  // ---- Export (Enterprise) --------------------------------------------------
  const EXPORT_COLUMNS: ExportColumn<Msg>[] = [
    { field: 'from', header: 'From' },
    { field: 'email', header: 'Address' },
    { field: 'to', header: 'To' },
    { field: 'subject', header: 'Subject' },
    { field: 'received', header: 'Received', format: { type: 'datetime', pattern: 'short' } },
  ]
  async function exportMail(format: ExportFormat, rows: 'displayed' | 'selected') {
    if (!api) return
    const stamp = iso(new Date()).slice(0, 10)
    try {
      await api.exportData({ format, filename: `${viewName(view).toLowerCase()}-${stamp}`, columns: EXPORT_COLUMNS, rows })
      toast.success(`Exported ${rows === 'selected' ? plural(selected.length) : viewName(view)} to ${format.toUpperCase()}`)
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const exportItems = $derived<MenuItem[]>([
    { label: `${viewName(view)} to Excel`, onSelect: () => exportMail('xlsx', 'displayed') },
    { label: `${viewName(view)} to CSV`, onSelect: () => exportMail('csv', 'displayed') },
    { label: `${viewName(view)} to PDF`, onSelect: () => exportMail('pdf', 'displayed') },
    { separator: true },
    { label: selected.length ? `Ticked (${selected.length}) to Excel` : 'Ticked rows to Excel', disabled: selected.length === 0, onSelect: () => exportMail('xlsx', 'selected') },
  ])

  // ---- Keyboard shortcuts -----------------------------------------------------
  // They listen on the app root, not the window, so they never fight the page
  // around the app; the root takes focus when you click anywhere inside it.
  let rootEl = $state<HTMLElement | null>(null)
  let searchEl = $state<HTMLElement | null>(null)
  let helpOpen = $state(false)
  const SHORTCUTS: Array<[string, string]> = [
    ['c', 'New message'], ['r', 'Reply'], ['a', 'Reply all'], ['f', 'Forward'],
    ['e', 'Archive'], ['#', 'Delete'], ['u', 'Mark read or unread'], ['s', 'Flag'],
    ['j', 'Next message'], ['k', 'Previous message'], ['/', 'Search'], ['?', 'This list'],
  ]
  function onRootKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (composeOpen || helpOpen || previewing || e.ctrlKey || e.metaKey || e.altKey) return
    if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
    if (area !== 'mail') return
    const m = openMsg
    const run: Record<string, () => void> = {
      c: () => compose(),
      r: () => m && reply(m),
      a: () => m && reply(m, true),
      f: () => m && forward(m),
      e: () => moveTo('archive'),
      '#': () => remove(),
      Delete: () => remove(),
      u: () => toggleRead(),
      s: () => toggleFlag(),
      j: () => step(1),
      k: () => step(-1),
      '/': () => searchEl?.querySelector('input')?.focus(),
      '?': () => (helpOpen = true),
    }
    const fn = run[e.key]
    if (fn) {
      e.preventDefault()
      fn()
    }
  }

  // ---- Contacts + recipient chips --------------------------------------------
  type Contact = { name: string; email: string }
  const contacts = $derived.by(() => {
    const seen = new Map<string, Contact>()
    for (const m of msgs) if (m.email !== ME.email && !seen.has(m.email)) seen.set(m.email, { name: m.from, email: m.email })
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  })
  const nameOf = (email: string) => contacts.find((c) => c.email === email)?.name ?? email
  const isEmail = (s: string) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(s)
  const splitAddresses = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  type Field = 'to' | 'cc'
  let typing = $state<Record<Field, string>>({ to: '', cc: '' })
  let suggestFor = $state<Field | null>(null)
  let suggestAt = $state(0)
  const suggestions = $derived.by(() => {
    if (!suggestFor) return []
    const t = typing[suggestFor].trim().toLowerCase()
    if (!t) return []
    const taken = new Set([...draft.to, ...draft.cc])
    return contacts.filter((c) => !taken.has(c.email) && (c.name.toLowerCase().includes(t) || c.email.includes(t))).slice(0, 6)
  })
  function addRecipient(field: Field, email: string) {
    if (!email || draft[field].includes(email)) return
    draft[field] = [...draft[field], email]
    typing[field] = ''
    suggestAt = 0
    toError = ''
  }
  function commitTyped(field: Field) {
    const raw = typing[field].trim().replace(/[,;]$/, '')
    if (!raw) return
    const hit = suggestions[suggestAt]
    if (hit && suggestFor === field) addRecipient(field, hit.email)
    else if (isEmail(raw)) addRecipient(field, raw)
  }
  function onRecipientKey(field: Field, e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); suggestAt = (suggestAt + 1) % suggestions.length }
    else if (e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); suggestAt = (suggestAt - 1 + suggestions.length) % suggestions.length }
    else if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') && typing[field].trim()) { e.preventDefault(); commitTyped(field) }
    else if (e.key === 'Backspace' && !typing[field] && draft[field].length) draft[field] = draft[field].slice(0, -1)
    else if (e.key === 'Escape' && suggestFor) { e.stopPropagation(); suggestFor = null }
  }

  // ---- Compose --------------------------------------------------------------
  type Draft = { id?: number; to: string[]; cc: string[]; subject: string; html: string; attachments: Attachment[]; thread?: string }
  const blank = (): Draft => ({ to: [], cc: [], subject: '', html: `<p><br></p><p><br></p>${sig(ME.name, ME.title)}`, attachments: [] })
  let composeOpen = $state(false)
  let showCc = $state(false)
  let draft = $state<Draft>(blank())
  let toError = $state('')
  let fileEl = $state<HTMLInputElement | null>(null)
  const TOOLS: RichTextTool[] = ['bold', 'italic', 'underline', 'strike', '|', 'ul', 'ol', 'quote', '|', 'link', 'clear', '|', 'undo', 'redo']

  function compose(d: Partial<Draft> = {}) {
    draft = { ...blank(), ...d }
    showCc = draft.cc.length > 0
    typing = { to: '', cc: '' }
    toError = ''
    composeOpen = true
  }
  const reSubject = (s: string) => (/^re:/i.test(s) ? s : `Re: ${s.replace(/^(re|fwd):\s*/i, '')}`)
  function reply(m: Msg, all = false) {
    const from = isOutbound(m.folder) ? splitAddresses(m.to) : [m.email]
    const cc = all ? [...splitAddresses(m.to), ...splitAddresses(m.cc ?? '')].filter((a) => a !== ME.email && !from.includes(a)) : []
    compose({
      to: from, cc, subject: reSubject(m.subject), thread: m.thread ?? `t${m.id}`,
      html: `<p><br></p><p><br></p>${sig(ME.name, ME.title)}${quote(`${m.from} &lt;${m.email}&gt;`, longTime(m.received), m.body)}`,
    })
    if (!m.thread) patch([m.id], { thread: `t${m.id}` })
  }
  function forward(m: Msg) {
    compose({
      subject: /^fwd:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject.replace(/^re:\s*/i, '')}`,
      attachments: [...m.attachments],
      html: `<p><br></p><p><br></p>${sig(ME.name, ME.title)}<p>---------- Forwarded message ----------<br>From: ${m.from} &lt;${m.email}&gt;<br>Date: ${longTime(m.received)}<br>Subject: ${m.subject}</p>${m.body}`,
    })
  }
  function onFiles(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = [...(input.files ?? [])]
    draft.attachments = [...draft.attachments, ...files.map((f) => ({ name: f.name, size: fileSize(f.size) }))]
    input.value = ''
  }

  // Undo send: the message waits five seconds in the toast before it goes.
  const pending = new Set<ReturnType<typeof setTimeout>>()
  $effect(() => () => { for (const t of pending) clearTimeout(t) })
  function send() {
    commitTyped('to')
    commitTyped('cc')
    if (!draft.to.length) {
      toError = 'Add at least one recipient'
      return
    }
    const d: Draft = $state.snapshot(draft)
    composeOpen = false
    if (d.id != null) msgs = msgs.filter((m) => m.id !== d.id) // a sent draft leaves Drafts
    const timer = setTimeout(() => {
      pending.delete(timer)
      const sent: Msg = {
        id: ++seq, folder: 'sent', from: ME.name, email: ME.email, to: d.to.join(', '), cc: d.cc.join(', ') || undefined,
        subject: d.subject.trim() || '(no subject)', body: d.html || '<p></p>', received: iso(new Date()),
        unread: false, flagged: false, attachments: d.attachments, labels: [], thread: d.thread,
      }
      msgs = [sent, ...msgs]
      toast.success(`Sent to ${d.to.map(nameOf).join(', ')}`)
    }, 5000)
    pending.add(timer)
    toast('Sending...', {
      duration: 5000,
      action: { label: 'Undo', onClick: () => { clearTimeout(timer); pending.delete(timer); compose({ ...d, id: undefined }) } },
    })
  }
  function onComposeKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }
  function saveDraft() {
    commitTyped('to')
    commitTyped('cc')
    const fields = {
      to: draft.to.join(', '), cc: draft.cc.join(', ') || undefined, subject: draft.subject.trim() || '(no subject)',
      body: draft.html, received: iso(new Date()), attachments: draft.attachments, thread: draft.thread,
    }
    if (draft.id != null && msgs.some((m) => m.id === draft.id)) patch([draft.id], fields)
    else msgs = [{ id: ++seq, folder: 'drafts', from: ME.name, email: ME.email, unread: false, flagged: false, labels: [], ...fields }, ...msgs]
    composeOpen = false
    toast('Draft saved')
  }

  // ---- Incoming mail ------------------------------------------------------------
  $effect(() => {
    const timers = INCOMING.map(({ after, make }) => setTimeout(() => untrack(() => arrive(make())), after))
    return () => timers.forEach(clearTimeout)
  })
  function arrive(m: Msg) {
    msgs = [m, ...msgs]
    toast(m.subject, {
      title: `New mail from ${m.from}`,
      duration: 7000,
      action: { label: 'Open', onClick: () => { area = 'mail'; if (view !== 'inbox') go('inbox'); open(m) } },
    })
  }

  // ---- Attachment preview --------------------------------------------------------
  let previewing = $state<{ att: Attachment; msg: Msg } | null>(null)
  const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

  // Links inside a mail open in a new tab instead of replacing the app.
  function onBodyClick(e: MouseEvent) {
    const a = (e.target as HTMLElement | null)?.closest('a')
    const href = a?.getAttribute('href')
    if (!a || !href) return
    e.preventDefault()
    if (href.startsWith('mailto:')) compose({ to: [href.slice(7)] })
    else window.open(href, '_blank', 'noopener,noreferrer')
  }

  // ---- Invites -> Calendar --------------------------------------------------
  function respond(m: Msg, response: NonNullable<Invite['response']>) {
    const inv = m.invite
    if (!inv) return
    patch([m.id], { invite: { ...inv, response } })
    const rest = events.filter((e) => e.fromMsg !== m.id)
    if (response === 'declined') {
      events = rest
      toast(`Declined. ${m.from.split(' ')[0]} will see your answer.`)
      return
    }
    events = [...rest, { id: ++evSeq, title: inv.title, start: inv.start, end: inv.end, cal: 'work', color: response === 'tentative' ? CAL_COLOR.tentative : CAL_COLOR.work, fromMsg: m.id }]
    toast.success(response === 'accepted' ? `Added to your calendar: ${inv.title}` : `Marked tentative: ${inv.title}`)
  }
  function showInCalendar(inv: Invite) {
    calDate = new Date(inv.start)
    calView = 'cal:all'
    area = 'calendar'
  }

  function onEventMove(e: SchedulerEventMoveEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Ev>) { Object.assign(e.row, e.values) }
  function onEventAdd(start: Date, end: Date) {
    const cal = calView === 'cal:personal' ? 'personal' : 'work'
    events = [...events, { id: ++evSeq, title: 'New event', start: iso(start), end: iso(end), cal, color: CAL_COLOR[cal] }]
  }
  function onEventDelete(row: Ev) { events = events.filter((e) => e.id !== row.id) }

  // ---- Account menu -------------------------------------------------------------
  const accountItems = $derived<MenuItem[]>([
    { label: `${ME.name}  ${ME.email}`, disabled: true },
    { separator: true },
    { label: compact ? 'Comfortable list' : 'Compact list', onSelect: () => (compact = !compact) },
    { label: 'Keyboard shortcuts', shortcut: '?', onSelect: () => (helpOpen = true) },
  ])

  // ---- Grids ----------------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })
  // On a phone the Received column goes and the time moves into the message cell.
  const columns = $derived<ColumnDef<typeof features, Msg>[]>([
    { id: 'flagged', field: 'flagged', header: '', width: 40, cell: (ctx) => renderSnippet(FlagCell, { row: ctx.row.original }) },
    { id: 'from', field: 'from', header: 'From', width: narrow ? 170 : 260, cell: (ctx) => renderSnippet(MessageCell, { row: ctx.row.original }) },
    ...(narrow ? [] : [{ id: 'received', field: 'received', header: 'Received', width: 104, cell: (ctx) => renderSnippet(TimeCell, { row: ctx.row.original }) } satisfies ColumnDef<typeof features, Msg>]),
  ])
  const calColumns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Title' },
    { field: 'start', header: 'Start' },
    { field: 'end', header: 'End' },
  ]
  function onApiReady(a: SvGridApi<typeof features, Msg>) {
    api = installEnterprise(a)
  }
  // Focus the composer where the typing starts: the To field for new mail,
  // the body for a reply that already has its recipients.
  $effect(() => {
    if (!composeOpen) return
    const toFirst = untrack(() => draft.to.length === 0)
    void tick().then(() => {
      const el = toFirst
        ? document.querySelector<HTMLElement>('.mx-form .mx-rcpt input')
        : document.querySelector<HTMLElement>('.mx-form [contenteditable="true"]')
      el?.focus()
    })
  })
</script>

{#snippet ico(d: string, size = 16)}
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
{/snippet}
{#snippet iInbox()}{@render ico('M22 12h-6l-2 3h-4l-2-3H2 M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z')}{/snippet}
{#snippet iDrafts()}{@render ico('M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')}{/snippet}
{#snippet iSent()}{@render ico('M22 2 11 13 M22 2l-7 20-4-9-9-4z')}{/snippet}
{#snippet iArchive()}{@render ico('M3 4h18v4H3z M5 8v12h14V8 M10 12h4')}{/snippet}
{#snippet iJunk()}{@render ico('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M4.9 4.9l14.2 14.2')}{/snippet}
{#snippet iTrash()}{@render ico('M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6')}{/snippet}
{#snippet iFlag()}{@render ico('M4 22V4 M4 4h12l-2 4 2 4H4')}{/snippet}
{#snippet iUnread()}{@render ico('M4 6h16v12H4z M4 7l8 6 8-6')}{/snippet}
{#snippet iCal()}{@render ico('M7 2v3 M17 2v3 M4 5h16v16H4z M4 10h16')}{/snippet}
{#snippet dot(color: string)}<span class="mx-ldot" style:background={color}></span>{/snippet}
{#snippet lClients()}{@render dot(LABELS.clients.color)}{/snippet}
{#snippet lBilling()}{@render dot(LABELS.billing.color)}{/snippet}
{#snippet lTeam()}{@render dot(LABELS.team.color)}{/snippet}
{#snippet lTravel()}{@render dot(LABELS.travel.color)}{/snippet}
{#snippet cWork()}{@render dot(CAL_COLOR.work)}{/snippet}
{#snippet cPersonal()}{@render dot(CAL_COLOR.personal)}{/snippet}

{#snippet FlagCell(props: { row: Msg })}
  <button
    type="button"
    class="mx-flag"
    class:is-on={props.row.flagged}
    aria-label={props.row.flagged ? 'Remove flag' : 'Flag'}
    aria-pressed={props.row.flagged}
    onclick={(e) => { e.stopPropagation(); toggleFlag([props.row.id]) }}
  >{@render ico('M4 22V4 M4 4h12l-2 4 2 4H4', 14)}</button>
{/snippet}
{#snippet MessageCell(props: { row: Msg })}
  {@const m = props.row}
  {@const count = m.thread ? (threadSizes.get(m.thread) ?? 1) : 1}
  <div class="mx-mc" class:is-unread={m.unread} class:is-compact={compact}>
    {#if !compact && !narrow}<span class="mx-mc-av"><SvAvatar name={isOutbound(m.folder) ? nameOf(m.to.split(',')[0]!.trim()) : m.from} size={30} /></span>{/if}
    <div class="mx-mc-txt">
      <div class="mx-mc-l1">
        <span class="mx-mc-from">{who(m)}</span>
        {#if count > 1}<span class="mx-mc-count" title="{count} messages in this conversation">{count}</span>{/if}
        {#if m.attachments.length}<span class="mx-mc-clip" title="{m.attachments.length} attachment(s)">{@render ico('M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7', 13)}</span>{/if}
        {#if narrow}<span class="mx-time mx-mc-when" class:is-unread={m.unread}>{shortTime(m.received)}</span>{/if}
      </div>
      <div class="mx-mc-sub">{#if m.invite}<span class="mx-mc-tag">Invite</span>{/if}{m.subject}</div>
      {#if !compact}<div class="mx-mc-prev">{#each m.labels as l (l)}{@render dot(LABELS[l].color)}{/each}<span>{preview(m)}</span></div>{/if}
    </div>
    {#if !narrow && m.folder !== 'drafts'}
      <!-- Hover actions: one click on the row's own message, nothing ticked needed. -->
      <span class="mx-hover">
        <button type="button" title="Archive (e)" aria-label="Archive" onclick={(e) => { e.stopPropagation(); moveTo('archive', [m.id]) }}>{@render ico('M3 4h18v4H3z M5 8v12h14V8 M10 12h4', 14)}</button>
        <button type="button" title="Delete (#)" aria-label="Delete" onclick={(e) => { e.stopPropagation(); remove([m.id]) }}>{@render ico('M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6', 14)}</button>
        <button type="button" title={m.unread ? 'Mark read (u)' : 'Mark unread (u)'} aria-label={m.unread ? 'Mark read' : 'Mark unread'} onclick={(e) => { e.stopPropagation(); toggleRead([m.id]) }}>{@render ico(m.unread ? 'M4 6h16v12H4z M4 7l8 6 8-6 M9 13l2 2 4-4' : 'M4 6h16v12H4z M4 7l8 6 8-6', 14)}</button>
      </span>
    {/if}
  </div>
{/snippet}
{#snippet TimeCell(props: { row: Msg })}
  <span class="mx-time" class:is-unread={props.row.unread}>{shortTime(props.row.received)}</span>
{/snippet}

{#snippet recipients(field: Field, label: string)}
  <div class="mx-field">
    <span>{label}</span>
    <div class="mx-rcpt" class:is-invalid={field === 'to' && !!toError}>
      {#each draft[field] as email (email)}
        <span class="mx-chip" title={email}>
          <SvAvatar name={nameOf(email)} size={18} />
          <span>{nameOf(email)}</span>
          <button type="button" aria-label="Remove {email}" onclick={() => (draft[field] = draft[field].filter((x) => x !== email))}>{@render ico('M6 6l12 12 M18 6 6 18', 12)}</button>
        </span>
      {/each}
      <input
        type="text"
        aria-label={label}
        autocomplete="off"
        placeholder={draft[field].length ? '' : 'Name or address'}
        bind:value={typing[field]}
        onfocus={() => { suggestFor = field; suggestAt = 0 }}
        oninput={() => { suggestFor = field; suggestAt = 0 }}
        onkeydown={(e) => onRecipientKey(field, e)}
        onblur={() => setTimeout(() => { commitTyped(field); if (suggestFor === field) suggestFor = null }, 120)}
      />
      {#if suggestFor === field && suggestions.length}
        <ul class="mx-suggest" role="listbox" aria-label="Contacts">
          {#each suggestions as c, i (c.email)}
            <li role="option" aria-selected={i === suggestAt}>
              <button type="button" class:is-on={i === suggestAt} onmousedown={(e) => { e.preventDefault(); addRecipient(field, c.email) }}>
                <SvAvatar name={c.name} size={22} />
                <span class="mx-suggest-txt"><strong>{c.name}</strong><span>{c.email}</span></span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    {#if field === 'to' && !showCc}
      <button type="button" class="mx-link" onclick={() => (showCc = true)}>Cc</button>
    {/if}
  </div>
  {#if field === 'to' && toError}<div class="mx-error" role="alert">{toError}</div>{/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="mx" class:rail={narrow} class:reading={narrow && openMsg != null && area === 'mail'} tabindex="-1" bind:this={rootEl} onkeydown={onRootKey}>
  <!-- Navigation pane -->
  <aside class="mx-side">
    <div class="mx-brand">
      <span class="mx-logo">{@render ico('M4 6h16v12H4z M4 7l8 6 8-6', 18)}</span>
      {#if !narrow}<span>Postbox</span>{/if}
    </div>
    {#if area === 'mail'}
      <div class="mx-compose">
        <SvButton variant="primary" size="sm" block={!narrow} ariaLabel="New message" onclick={() => compose()}>
          {#if narrow}{@render ico('M12 5v14 M5 12h14')}{:else}New message{/if}
        </SvButton>
      </div>
      <SvNavPane sections={sections} value={view} onSelect={go} collapsed={narrow} ariaLabel="Mail folders"
        {modules} moduleValue={area} onModuleSelect={(id) => (area = id === 'calendar' ? 'calendar' : 'mail')} />
    {:else}
      <SvNavPane sections={calSections} bind:value={calView} collapsed={narrow} ariaLabel="Calendars"
        {modules} moduleValue={area} onModuleSelect={(id) => (area = id === 'calendar' ? 'calendar' : 'mail')} />
    {/if}
  </aside>

  {#if area === 'mail'}
    <div class="mx-main">
      <!-- Command bar -->
      <div class="mx-bar" role="toolbar" aria-label="Message actions">
        <div class="mx-search" bind:this={searchEl}>
          <SvTextInput bind:value={query} placeholder="Search mail  ( / )" ariaLabel="Search mail" clearable block size="sm" />
        </div>
        <div class="mx-cmds">
          <button type="button" class="mx-cmd" disabled={!openMsg} title="Reply (r)" onclick={() => openMsg && reply(openMsg)}>{@render ico('M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 6 6v5', 15)}<span>Reply</span></button>
          <button type="button" class="mx-cmd" disabled={!openMsg} title="Reply all (a)" onclick={() => openMsg && reply(openMsg, true)}>{@render ico('M7 14 2 9l5-5 M12 14 7 9l5-5 M7 9h7a6 6 0 0 1 6 6v5', 15)}<span>Reply all</span></button>
          <button type="button" class="mx-cmd" disabled={!openMsg} title="Forward (f)" onclick={() => openMsg && forward(openMsg)}>{@render ico('M15 14l5-5-5-5 M20 9H10a6 6 0 0 0-6 6v5', 15)}<span>Forward</span></button>
          <span class="mx-sep" aria-hidden="true"></span>
          <button type="button" class="mx-cmd" disabled={!targets.length || view === 'archive'} title="Archive (e)" onclick={() => moveTo('archive')}>{@render ico('M3 4h18v4H3z M5 8v12h14V8 M10 12h4', 15)}<span>Archive</span></button>
          <button type="button" class="mx-cmd" disabled={!targets.length} title="Delete (#)" onclick={() => remove()}>{@render ico('M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6', 15)}<span>Delete</span></button>
          <button type="button" class="mx-cmd" disabled={!targets.length} title="Mark read or unread (u)" onclick={() => toggleRead()}>{@render ico('M4 6h16v12H4z M4 7l8 6 8-6', 15)}<span>{targetMsgs.some((m) => m.unread) ? 'Mark read' : 'Mark unread'}</span></button>
          <button type="button" class="mx-cmd" disabled={!targets.length} title="Flag (s)" onclick={() => toggleFlag()}>{@render ico('M4 22V4 M4 4h12l-2 4 2 4H4', 15)}<span>Flag</span></button>
          <SvMenu items={moveItems}>
            {#snippet anchor()}<button type="button" class="mx-cmd" disabled={!targets.length}>{@render ico('M3 7h7l2 2h9v10H3z', 15)}<span>Move</span></button>{/snippet}
          </SvMenu>
          <SvMenu items={exportItems}>
            {#snippet anchor()}<button type="button" class="mx-cmd">{@render ico('M12 3v12 M8 11l4 4 4-4 M4 17v3h16v-3', 15)}<span>Export</span></button>{/snippet}
          </SvMenu>
        </div>
        <div class="mx-account">
          <SvMenu items={accountItems}>
            {#snippet anchor()}<button type="button" class="mx-acct" aria-label="Account"><SvAvatar name={ME.name} size="sm" status="online" /></button>{/snippet}
          </SvMenu>
        </div>
      </div>

      <div class="mx-body">
        <!-- Message list -->
        <section class="mx-list" aria-label="{viewName(view)} messages" bind:this={listEl}>
          <header class="mx-list-head">
            <div class="mx-list-title">
              <h2>{q ? `Results in ${viewName(view)}` : viewName(view)}</h2>
              <span class="mx-muted">{listSummary}</span>
            </div>
            <div class="mx-quick" role="group" aria-label="Filter">
              {#each QUICK_OPTIONS as [k, label] (k)}
                <button type="button" class:is-on={quick === k} aria-pressed={quick === k} onclick={() => { quick = k; clearSelection() }}>{label}</button>
              {/each}
            </div>
          </header>
          <div class="mx-list-grid">
            <SvGrid
              data={viewRows}
              {columns}
              {features}
              getRowId={(m) => String(m.id)}
              sortable
              selectionMode="row"
              showRowSelection
              enableCellSelection={false}
              enableRowSummaries={false}
              rowHeight={compact ? 52 : 74}
              fitColumns
              containerHeight="100%"
              initialSorting={[{ id: 'received', desc: true }]}
              {emptyMessage}
              {onActiveCellChange}
              rowClass={({ row }) => ({ 'mx-row-open': row.id === openId, 'mx-row-unread': row.unread })}
              onRowClick={(e) => open(e.row)}
              onRowSelectionChange={(_sel, rows) => (selected = rows.map((r) => r.id))}
              {onApiReady}
            />
          </div>
        </section>

        <!-- Reading pane: the whole conversation -->
        <section class="mx-reader" aria-label="Reading pane" bind:this={readerEl}>
          {#if openMsg}
            {@const head = openMsg}
            <article class="mx-rd">
              {#if narrow}
                <button type="button" class="mx-back" onclick={() => (openId = null)}>{@render ico('M15 18l-6-6 6-6', 15)} {viewName(view)}</button>
              {/if}
              <header class="mx-rd-head">
                <h2>{head.subject.replace(/^(re|fwd):\s*/i, '')}</h2>
                <div class="mx-rd-tags">
                  {#each head.labels as l (l)}<span class="mx-tag">{@render dot(LABELS[l].color)}{LABELS[l].name}</span>{/each}
                  {#if conversation.length > 1}<span class="mx-tag">{conversation.length} messages</span>{/if}
                  {#if head.folder !== 'inbox'}<span class="mx-tag">{FOLDERS[head.folder]}</span>{/if}
                </div>
              </header>

              {#each conversation as m (m.id)}
                {@const isOpen = expanded.includes(m.id) || conversation.length === 1}
                <section class="mx-msg" class:is-open={isOpen}>
                  <button type="button" class="mx-msg-head" aria-expanded={isOpen} disabled={conversation.length === 1} onclick={() => (expanded = toggleIn(expanded, m.id))}>
                    <SvAvatar name={m.from} size={34} />
                    <span class="mx-msg-who">
                      <span><strong>{m.email === ME.email ? `${ME.name} (you)` : m.from}</strong>{#if isOpen}{' '}<span class="mx-muted">&lt;{m.email}&gt;</span>{/if}</span>
                      {#if isOpen}
                        <span class="mx-muted">To: {m.to === ME.email ? 'you' : splitAddresses(m.to).map(nameOf).join(', ')}{#if m.cc} · Cc: {splitAddresses(m.cc).map(nameOf).join(', ')}{/if}</span>
                      {:else}
                        <span class="mx-muted mx-msg-snip">{preview(m)}</span>
                      {/if}
                    </span>
                    <time class="mx-muted mx-msg-when" datetime={m.received}>{isOpen ? longTime(m.received) : shortTime(m.received)}</time>
                  </button>

                  {#if isOpen}
                    {#if m.invite}
                      {@const inv = m.invite}
                      <div class="mx-inv">
                        <div class="mx-inv-ic">{@render ico('M7 2v3 M17 2v3 M4 5h16v16H4z M4 10h16', 20)}</div>
                        <div class="mx-inv-txt">
                          <strong>{inv.title}</strong>
                          <span>{timeRange(inv.start, inv.end)}</span>
                          <span class="mx-muted">{inv.where}</span>
                        </div>
                        <div class="mx-inv-act">
                          {#if inv.response}
                            <span class="mx-inv-state" data-r={inv.response}>{inv.response === 'accepted' ? 'Accepted' : inv.response === 'tentative' ? 'Tentative' : 'Declined'}</span>
                            {#if inv.response !== 'declined'}<SvButton variant="outline" size="sm" onclick={() => showInCalendar(inv)}>View in calendar</SvButton>{/if}
                            <SvButton variant="ghost" size="sm" onclick={() => patch([m.id], { invite: { ...inv, response: undefined } })}>Change</SvButton>
                          {:else}
                            <SvButton variant="primary" size="sm" onclick={() => respond(m, 'accepted')}>Accept</SvButton>
                            <SvButton variant="outline" size="sm" onclick={() => respond(m, 'tentative')}>Tentative</SvButton>
                            <SvButton variant="ghost" size="sm" onclick={() => respond(m, 'declined')}>Decline</SvButton>
                          {/if}
                        </div>
                      </div>
                    {/if}

                    <!-- The body is sanitized: scripts, handlers and javascript: URLs are stripped. -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="mx-rd-body" class:show-quoted={quotedOpen.includes(m.id)} onclick={onBodyClick}>{@html sanitizeHtml(m.body)}</div>
                    {#if m.body.includes('<blockquote')}
                      <button type="button" class="mx-quoted" onclick={() => (quotedOpen = toggleIn(quotedOpen, m.id))} aria-expanded={quotedOpen.includes(m.id)}>
                        {quotedOpen.includes(m.id) ? 'Hide quoted text' : '... Show quoted text'}
                      </button>
                    {/if}

                    {#if m.attachments.length}
                      <div class="mx-att">
                        {#each m.attachments as a (a.name)}
                          <button type="button" class="mx-att-item" onclick={() => (previewing = { att: a, msg: m })}>
                            <span class="mx-att-ext" data-ext={extOf(a.name)}>{extOf(a.name)}</span>
                            <span class="mx-att-txt"><span>{a.name}</span><span class="mx-muted">{a.size}</span></span>
                          </button>
                        {/each}
                      </div>
                    {/if}
                  {/if}
                </section>
              {/each}

              {#if conversation.length}
                {@const last = conversation[conversation.length - 1]!}
                <div class="mx-rd-reply">
                  <SvButton variant="outline" size="sm" onclick={() => reply(last)}>Reply</SvButton>
                  <SvButton variant="outline" size="sm" onclick={() => reply(last, true)}>Reply all</SvButton>
                  <SvButton variant="outline" size="sm" onclick={() => forward(last)}>Forward</SvButton>
                </div>
              {/if}
            </article>
          {:else}
            <div class="mx-empty">
              {@render ico('M4 6h16v12H4z M4 7l8 6 8-6', 36)}
              <strong>Select a message to read</strong>
              <span class="mx-muted">j and k move through the list. Press <SvKbd keys={['?']} size="sm" /> for every shortcut.</span>
            </div>
          {/if}
        </section>
      </div>
    </div>
  {:else}
    <div class="mx-main">
      <div class="mx-cal-head">
        <h2>Calendar</h2>
        <span class="mx-muted">{calRows.length} events. Accepted invites from Mail land here; drag to move, drag an empty slot to add.</span>
      </div>
      <div class="mx-cal">
        <SvGrid
          data={calRows}
          columns={calColumns}
          getRowId={(e) => String(e.id)}
          containerHeight="100%"
          scheduler={{
            startField: 'start', endField: 'end', allDayField: 'allDay', titleField: 'title', colorField: 'color',
            views: ['month', 'week', 'day', 'agenda'], initialView: 'week', weekStartsOn: 1,
            dayStartHour: 7, dayEndHour: 20, slotMinutes: 30,
            date: calDate, onNavigate: (d) => (calDate = d),
            editable: true, tooltip: true,
            onEventMove, onEventResize, onEventCommit, onEventAdd, onEventDelete,
          }}
        />
      </div>
    </div>
  {/if}
</div>

<SvModal bind:open={composeOpen} title={draft.subject.trim() || 'New message'} width={720}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="mx-form" onkeydown={onComposeKey}>
    {@render recipients('to', 'To')}
    {#if showCc}{@render recipients('cc', 'Cc')}{/if}
    <label class="mx-field">
      <span>Subject</span>
      <SvTextInput bind:value={draft.subject} placeholder="Subject" ariaLabel="Subject" block />
    </label>
    <SvRichText bind:value={draft.html} tools={TOOLS} minHeight="220px" placeholder="Write your message..." ariaLabel="Message body" />
    {#if draft.attachments.length}
      <div class="mx-att mx-att-draft">
        {#each draft.attachments as a, i (a.name + i)}
          <span class="mx-att-item">
            <span class="mx-att-ext" data-ext={extOf(a.name)}>{extOf(a.name)}</span>
            <span class="mx-att-txt"><span>{a.name}</span><span class="mx-muted">{a.size}</span></span>
            <button type="button" class="mx-att-x" aria-label="Remove {a.name}" onclick={() => (draft.attachments = draft.attachments.filter((_, j) => j !== i))}>{@render ico('M6 6l12 12 M18 6 6 18', 12)}</button>
          </span>
        {/each}
      </div>
    {/if}
    <input type="file" multiple hidden bind:this={fileEl} onchange={onFiles} />
  </div>
  {#snippet footer()}
    <div class="mx-foot">
      <button type="button" class="mx-cmd" onclick={() => fileEl?.click()}>{@render ico('M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7', 15)}<span>Attach</span></button>
      <span class="mx-muted mx-foot-hint">Ctrl+Enter to send</span>
      <SvButton variant="ghost" size="sm" onclick={() => (composeOpen = false)}>Discard</SvButton>
      <SvButton variant="outline" size="sm" onclick={saveDraft}>Save draft</SvButton>
      <SvButton variant="primary" size="sm" onclick={send}>Send</SvButton>
    </div>
  {/snippet}
</SvModal>

<SvModal open={previewing != null} onClose={() => (previewing = null)} title={previewing?.att.name ?? ''} width={560}>
  {#if previewing}
    {@const pv = previewing}
    <div class="mx-pv">
      <div class="mx-pv-page" data-ext={extOf(pv.att.name)}>
        <span class="mx-att-ext" data-ext={extOf(pv.att.name)}>{extOf(pv.att.name)}</span>
        <strong>{pv.att.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}</strong>
        <span class="mx-pv-line" style:width="86%"></span>
        <span class="mx-pv-line" style:width="72%"></span>
        <span class="mx-pv-line" style:width="90%"></span>
        <span class="mx-pv-line" style:width="64%"></span>
        <span class="mx-pv-line" style:width="80%"></span>
      </div>
      <div class="mx-pv-meta">
        <span>{pv.att.size} · from {pv.msg.from}, {longTime(pv.msg.received)}</span>
        <span class="mx-muted">A sample attachment: in a real app this button streams the file from your mail API.</span>
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <div class="mx-foot">
      <SvButton variant="ghost" size="sm" onclick={() => { if (previewing) forward(previewing.msg); previewing = null }}>Forward</SvButton>
      <SvButton variant="primary" size="sm" disabled>Download</SvButton>
    </div>
  {/snippet}
</SvModal>

<SvModal bind:open={helpOpen} title="Keyboard shortcuts" width={420}>
  <ul class="mx-keys">
    {#each SHORTCUTS as [k, label] (k)}
      <li><SvKbd keys={[k]} size="sm" /><span>{label}</span></li>
    {/each}
  </ul>
</SvModal>

<SvToaster position="bottom-right" />

<style>
  .mx {
    display: grid;
    grid-template-columns: 224px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    flex: 1 1 auto;
    min-height: 640px;
    height: 100%;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    font-size: 13px;
    outline: none;
  }
  .mx.rail { grid-template-columns: 60px minmax(0, 1fr); }
  .mx-muted { color: var(--sg-muted, #64748b); }

  /* ---- Navigation pane */
  .mx-side { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: var(--sg-header-bg, #f8fafc); }
  .mx-side :global(.sv-nav) { width: auto; flex: 1 1 0; min-height: 0; border: 0; border-radius: 0; background: transparent; }
  .mx-brand { display: flex; align-items: center; gap: 9px; height: 50px; padding: 0 16px; font-weight: 650; font-size: 15px; flex: none; }
  .mx.rail .mx-brand { padding: 0; justify-content: center; }
  .mx-logo { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); }
  .mx-compose { padding: 0 12px 8px; flex: none; }
  .mx.rail .mx-compose { padding: 0 10px 8px; display: flex; justify-content: center; }
  .mx :global(.mx-ldot) { display: inline-block; width: 8px; height: 8px; border-radius: 999px; flex: none; }

  /* ---- Main column */
  .mx-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .mx-bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex: none; flex-wrap: wrap; }
  .mx-search { width: 240px; flex: 0 1 240px; }
  .mx-cmds { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; min-width: 0; }
  .mx-account { margin-left: auto; }
  .mx-acct { display: inline-flex; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 999px; }
  .mx-acct:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  .mx-cmd {
    display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 9px;
    border: 0; border-radius: 6px; background: transparent; color: var(--sg-fg, #0f172a);
    font: inherit; font-size: 12.5px; cursor: pointer; white-space: nowrap;
  }
  .mx-cmd:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx-cmd:disabled { opacity: 0.4; cursor: default; }
  .mx-cmd:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 1px; }
  .mx-sep { width: 1px; height: 18px; margin: 0 4px; background: var(--sg-border, #e5e7eb); }

  .mx-body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(340px, 440px) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
  .mx-list { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--sg-border, #e5e7eb); }
  .mx-list-head { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 10px; flex: none; }
  .mx-list-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; }
  .mx-list-head h2 { margin: 0; font-size: 16px; font-weight: 650; white-space: nowrap; }
  .mx-list-title span { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mx-quick { display: flex; gap: 4px; }
  .mx-quick button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--sg-border, #e5e7eb); background: transparent; color: var(--sg-muted, #64748b); cursor: pointer; }
  .mx-quick button:hover { color: var(--sg-fg, #0f172a); }
  .mx-quick button.is-on { background: var(--sg-fg, #0f172a); border-color: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); }
  .mx-list-grid { flex: 1 1 0; min-height: 0; }

  /* Message cells */
  .mx :global(.mx-mc) { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; line-height: 1.3; }
  .mx :global(.mx-mc-av) { flex: none; display: inline-flex; }
  .mx :global(.mx-mc-txt) { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .mx :global(.mx-mc-l1) { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .mx :global(.mx-mc-from) { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mx :global(.mx-mc.is-unread .mx-mc-from),
  .mx :global(.mx-mc.is-unread .mx-mc-sub) { font-weight: 700; }
  .mx :global(.mx-mc-count) { flex: none; font-size: 10.5px; font-weight: 600; min-width: 18px; padding: 0 5px; line-height: 16px; text-align: center; border-radius: 999px; background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-muted, #64748b); }
  .mx :global(.mx-mc-clip) { display: inline-flex; color: var(--sg-muted, #64748b); flex: none; }
  .mx :global(.mx-mc-when) { margin-left: auto; flex: none; padding-left: 6px; }
  .mx :global(.mx-mc-sub) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
  .mx :global(.mx-mc-tag) { font-size: 10.5px; font-weight: 600; padding: 0 5px; margin-right: 6px; border-radius: 4px; border: 1px solid var(--sg-border, #e5e7eb); color: var(--sg-muted, #64748b); }
  .mx :global(.mx-mc-prev) { display: flex; align-items: center; gap: 5px; overflow: hidden; white-space: nowrap; font-size: 12px; color: var(--sg-muted, #64748b); }
  .mx :global(.mx-mc-prev > span:last-child) { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  /* Hover actions sit over the end of the cell on a solid background. */
  .mx :global(.mx-hover) { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; gap: 2px; padding: 2px 2px 2px 14px; opacity: 0; pointer-events: none; background: linear-gradient(to right, transparent, var(--sg-bg, #fff) 14px); transition: opacity 0.12s ease; }
  .mx :global(tr:hover .mx-hover) { opacity: 1; pointer-events: auto; }
  .mx :global(.mx-hover button) { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); cursor: pointer; }
  .mx :global(.mx-hover button:hover) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx :global(.mx-time) { font-size: 12px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .mx :global(.mx-time.is-unread) { color: var(--sg-fg, #0f172a); font-weight: 600; }
  /* A row paints no box-shadow under cells that have their own background,
     so the unread bar goes on the first cell. */
  .mx :global(.mx-row-unread > td:first-child) { box-shadow: inset 3px 0 0 var(--sg-fg, #0f172a); }
  .mx-list-grid :global(.sv-grid-row:not(.sv-grid-empty-row)) { cursor: pointer; }
  .mx-list-grid :global(.sv-grid-empty-cell) { padding: 48px 20px; text-align: center; color: var(--sg-muted, #64748b); font-size: 13px; }
  /* The cells paint their own background, so the open row is tinted per cell. */
  .mx :global(.mx-row-open > td) { background: var(--sg-selection-bg, #eff6ff); }
  /* The tint already marks the clicked row; the active-cell ring stays for
     keyboard moves onto other rows. */
  .mx :global(.mx-row-open .sv-grid-cell-active:not(.sv-grid-cell-editing)) { box-shadow: none; }
  .mx :global(.mx-flag) { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--sg-muted, #94a3b8); cursor: pointer; opacity: 0.55; }
  .mx :global(.mx-flag:hover) { opacity: 1; background: var(--sg-row-hover-bg, #f1f5f9); }
  /* Flag red is a status colour, not chrome. */
  .mx :global(.mx-flag.is-on) { color: #dc2626; opacity: 1; }

  /* ---- Reading pane */
  .mx-reader { min-height: 0; min-width: 0; overflow: auto; }
  .mx-rd { padding: 18px 24px 28px; display: flex; flex-direction: column; gap: 10px; max-width: 840px; }
  .mx-back { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--sg-fg, #0f172a); font: inherit; font-weight: 600; cursor: pointer; padding: 4px 0; }
  .mx-rd-head { padding-bottom: 4px; }
  .mx-rd-head h2 { margin: 0 0 6px; font-size: 19px; font-weight: 650; line-height: 1.3; }
  .mx-rd-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .mx-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--sg-border, #e5e7eb); color: var(--sg-muted, #64748b); }

  .mx-msg { border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; background: var(--sg-bg, #fff); }
  .mx-msg.is-open { padding-bottom: 14px; }
  .mx-msg-head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 10px; }
  .mx-msg-head:disabled { cursor: default; }
  .mx-msg:not(.is-open) .mx-msg-head:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .mx-msg-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .mx-msg-who > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mx-msg-when { font-size: 12px; white-space: nowrap; }
  .mx-msg > :not(.mx-msg-head) { margin-left: 60px; margin-right: 14px; }

  .mx-rd-body { font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
  .mx-rd-body :global(p) { margin: 0 0 10px; }
  .mx-rd-body :global(h2) { margin: 0 0 8px; font-size: 17px; }
  .mx-rd-body :global(ul), .mx-rd-body :global(ol) { margin: 0 0 10px; padding-left: 22px; }
  .mx-rd-body :global(a) { color: var(--sg-accent, #2563eb); }
  .mx-rd-body :global(code) { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; padding: 0 4px; border-radius: 4px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx-rd-body :global(blockquote) { margin: 10px 0 0; padding: 2px 0 2px 12px; border-left: 3px solid var(--sg-border, #e5e7eb); color: var(--sg-muted, #64748b); }
  .mx-rd-body:not(.show-quoted) :global(blockquote) { display: none; }
  .mx-rd-body :global(.sig) { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--sg-border, #e5e7eb); font-size: 12.5px; }
  .mx-rd-body :global(.sig span) { color: var(--sg-muted, #64748b); }
  .mx-rd-body :global(.receipt), .mx-rd-body :global(.build) { margin: 4px 0 12px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; max-width: 460px; }
  .mx-rd-body :global(.receipt-head), .mx-rd-body :global(.build-head) { display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 10px 14px; background: var(--sg-header-bg, #f8fafc); border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .mx-rd-body :global(.build-head) { justify-content: flex-start; }
  .mx-rd-body :global(.receipt-row), .mx-rd-body :global(.build-row) { display: flex; justify-content: space-between; gap: 12px; padding: 7px 14px; font-size: 13px; font-variant-numeric: tabular-nums; }
  .mx-rd-body :global(.receipt-row + .receipt-row), .mx-rd-body :global(.build-row + .build-row) { border-top: 1px solid var(--sg-border, #e5e7eb); }
  .mx-rd-body :global(.receipt-total) { font-weight: 700; background: var(--sg-header-bg, #f8fafc); }
  /* Passed green is a status colour. */
  .mx-rd-body :global(.build-ok) { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; color: #15803d; background: color-mix(in srgb, #16a34a 14%, transparent); }
  .mx-quoted { align-self: flex-start; font: inherit; font-size: 12px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--sg-border, #e5e7eb); background: var(--sg-header-bg, #f8fafc); color: var(--sg-muted, #64748b); cursor: pointer; margin-bottom: 8px; }
  .mx-rd-reply { display: flex; gap: 8px; padding-top: 6px; }

  .mx-inv { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; margin-bottom: 12px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; background: var(--sg-header-bg, #f8fafc); }
  .mx-inv-ic { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 9px; background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e5e7eb); flex: none; }
  .mx-inv-txt { display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0; }
  .mx-inv-act { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .mx-inv-state { font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
  /* Response colours are status, so they stay literal. */
  .mx-inv-state[data-r='accepted'] { color: #15803d; background: color-mix(in srgb, #16a34a 14%, transparent); }
  .mx-inv-state[data-r='tentative'] { color: #b45309; background: color-mix(in srgb, #d97706 14%, transparent); }
  .mx-inv-state[data-r='declined'] { color: #b91c1c; background: color-mix(in srgb, #dc2626 12%, transparent); }

  .mx-att { display: flex; flex-wrap: wrap; gap: 8px; }
  .mx-att-item { position: relative; display: inline-flex; align-items: center; gap: 9px; padding: 7px 12px 7px 7px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; background: var(--sg-bg, #fff); color: inherit; font: inherit; cursor: pointer; text-align: left; }
  button.mx-att-item:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx-att-draft .mx-att-item { cursor: default; padding-right: 30px; }
  .mx-att-x { position: absolute; right: 6px; top: 6px; display: inline-grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 4px; background: none; color: var(--sg-muted, #64748b); cursor: pointer; }
  .mx-att-x:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx-att-ext { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e5e7eb); flex: none; }
  /* File-type colours identify the type, like a file manager does. */
  .mx-att-ext[data-ext='pdf'] { color: #b91c1c; }
  .mx-att-ext[data-ext='docx'], .mx-att-ext[data-ext='doc'] { color: #1d4ed8; }
  .mx-att-ext[data-ext='xlsx'], .mx-att-ext[data-ext='csv'] { color: #15803d; }
  .mx-att-txt { display: flex; flex-direction: column; font-size: 12.5px; }

  .mx-empty { height: 100%; min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--sg-muted, #94a3b8); text-align: center; padding: 24px; }
  .mx-empty strong { color: var(--sg-fg, #0f172a); font-size: 14px; }

  /* ---- Calendar module */
  .mx-cal-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex: none; }
  .mx-cal-head h2 { margin: 0; font-size: 16px; font-weight: 650; }
  .mx-cal-head span { font-size: 12px; }
  .mx-cal { flex: 1 1 0; min-height: 0; padding: 8px; }

  /* ---- Composer */
  .mx-form { display: flex; flex-direction: column; gap: 10px; }
  .mx-field { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
  .mx-field > span { font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  label.mx-field { grid-template-columns: 64px minmax(0, 1fr); }
  .mx-rcpt { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 34px; padding: 3px 6px; border: 1px solid var(--sg-input-border, var(--sg-border, #d1d5db)); border-radius: var(--sg-radius, 6px); background: var(--sg-input-bg, var(--sg-bg, #fff)); }
  .mx-rcpt:focus-within { border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #2563eb) 18%, transparent); }
  .mx-rcpt.is-invalid { border-color: #dc2626; }
  .mx-rcpt input { flex: 1 1 120px; min-width: 80px; border: 0; outline: 0; background: transparent; color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; padding: 4px 2px; }
  .mx-chip { display: inline-flex; align-items: center; gap: 5px; padding: 1px 4px 1px 2px; border-radius: 999px; background: var(--sg-row-hover-bg, #f1f5f9); font-size: 12.5px; }
  .mx-chip button { display: inline-grid; place-items: center; width: 16px; height: 16px; padding: 0; border: 0; border-radius: 999px; background: none; color: var(--sg-muted, #64748b); cursor: pointer; }
  .mx-chip button:hover { background: var(--sg-border, #e5e7eb); color: var(--sg-fg, #0f172a); }
  .mx-suggest { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 5; margin: 0; padding: 4px; list-style: none; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; background: var(--sg-bg, #fff); box-shadow: 0 8px 24px rgb(0 0 0 / 0.12); }
  .mx-suggest button { display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .mx-suggest button.is-on, .mx-suggest button:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx-suggest-txt { display: flex; flex-direction: column; font-size: 12.5px; }
  .mx-suggest-txt span { color: var(--sg-muted, #64748b); font-size: 12px; }
  .mx-link { border: 0; background: none; padding: 4px 6px; font: inherit; font-size: 12.5px; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 5px; }
  .mx-link:hover { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  .mx-error { margin: -4px 0 0 72px; font-size: 12px; color: #dc2626; }
  .mx-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
  .mx-foot-hint { margin-right: auto; font-size: 12px; }

  /* ---- Attachment preview */
  .mx-pv { display: flex; flex-direction: column; gap: 12px; }
  .mx-pv-page { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 26px 30px; min-height: 260px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; background: var(--sg-header-bg, #f8fafc); }
  .mx-pv-page strong { font-size: 15px; text-transform: capitalize; margin-bottom: 6px; }
  .mx-pv-line { display: block; height: 8px; border-radius: 4px; background: var(--sg-border, #e5e7eb); }
  .mx-pv-meta { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; }

  .mx-keys { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
  .mx-keys li { display: flex; align-items: center; gap: 10px; font-size: 13px; }

  /* ---- Narrow: the reader replaces the list while a message is open */
  @media (max-width: 860px) {
    .mx-body { grid-template-columns: minmax(0, 1fr); }
    .mx-list { border-right: 0; }
    .mx-reader { display: none; }
    .mx.reading .mx-list { display: none; }
    .mx.reading .mx-reader { display: block; }
    .mx-search { flex: 1 1 160px; width: auto; }
    .mx-cmd span { display: none; }
    .mx-cmd { padding: 0 7px; }
    .mx-sep { display: none; }
    .mx-account { display: none; }
    .mx-rd { padding: 12px 14px 20px; }
    .mx-msg > :not(.mx-msg-head) { margin-left: 14px; }
  }
  @media (max-width: 639px) {
    .mx-foot-hint { display: none; }
    .mx-keys { grid-template-columns: 1fr; }
  }
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .mx { flex-shrink: 0; min-height: 600px; }
  }
</style>
