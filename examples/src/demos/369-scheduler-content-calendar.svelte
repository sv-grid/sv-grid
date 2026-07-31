<script lang="ts">
  /**
   * 369. Content calendar (multi-day campaigns)
   * -------------------------------------------
   * An editorial calendar in Month view: single posts sit on one day, while
   * multi-day campaigns render as ONE continuous bar spanning the days they
   * cover (and wrapping across week rows). Colour-coded by channel; click a
   * piece to edit it, drag to reschedule, or drag an edge to change its run.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Channel = 'Blog' | 'Social' | 'Email' | 'Video'
  type Piece = { id: number; title: string; start: string; end: string; channel: Channel; owner: string; color: string }

  const CHANNEL_COLOR: Record<Channel, string> = {
    Blog: '#4f46e5',
    Social: '#0891b2',
    Email: '#d97706',
    Video: '#dc2626',
  }

  // Anchor on the 1st of the current month so the grid opens full.
  const first = new Date()
  first.setDate(1)
  first.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  // day = day-of-month; a piece runs [day 09:00 .. day+span 18:00].
  const on = (day: number, h = 9) => {
    const d = new Date(first)
    d.setDate(day)
    d.setHours(h, 0, 0, 0)
    return iso(d)
  }
  const piece = (id: number, title: string, day: number, span: number, channel: Channel, owner: string): Piece => ({
    id, title, start: on(day), end: on(day + span, 18), channel, owner, color: CHANNEL_COLOR[channel],
  })

  let seq = 100
  let rows = $state<Piece[]>([
    piece(2, 'Launch teaser', 2, 0, 'Social', 'Mia'),
    piece(3, 'Spring campaign', 4, 4, 'Blog', 'Sam'), // 5-day campaign -> spanning bar
    piece(5, 'Weekly newsletter', 6, 0, 'Email', 'Ada'),
    piece(9, 'Product deep-dive', 9, 2, 'Video', 'Lee'), // 3-day
    piece(12, 'Customer story', 12, 0, 'Blog', 'Mia'),
    piece(14, 'Webinar promo', 14, 3, 'Social', 'Sam'), // 4-day
    piece(16, 'Feature drop', 16, 0, 'Email', 'Ada'),
    piece(20, 'Case study series', 20, 5, 'Blog', 'Lee'), // 6-day, likely wraps a week
    piece(24, 'Q&A livestream', 24, 0, 'Video', 'Mia'),
    piece(27, 'Month recap', 27, 0, 'Email', 'Sam'),
  ])

  const columns: ColumnDef<any, Piece>[] = [
    { field: 'title', header: 'Title', editorType: 'text', width: 220 },
    { field: 'channel', header: 'Channel', editorType: 'list', editorOptions: ['Blog', 'Social', 'Email', 'Video'], width: 120 },
    { field: 'owner', header: 'Owner', editorType: 'text', width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 160 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 160 },
  ]

  let view = $state<'calendar' | 'table'>('calendar')

  function onEventMove(e: SchedulerEventMoveEvent<Piece>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventResize(e: SchedulerEventResizeEvent<Piece>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Piece>) {
    Object.assign(e.row, e.values)
    e.row.color = CHANNEL_COLOR[e.row.channel] ?? e.row.color
  }
  function onEventAdd(start: Date, end: Date) {
    rows = [...rows, { id: ++seq, title: 'New post', start: iso(start), end: iso(end), channel: 'Blog', owner: 'Me', color: CHANNEL_COLOR.Blog }]
  }
  function onEventDelete(row: Piece) {
    rows = rows.filter((r) => r !== row)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      An editorial <strong>Month</strong> calendar. Multi-day campaigns (Spring campaign,
      Case study series) render as one continuous bar across the days they run and wrap
      across weeks. Colour = channel. Double-click a day to add, click to edit, drag an
      edge to change the run.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      <button
        class="px-3 py-1 {view === 'calendar' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'calendar')}>Calendar</button>
      <button
        class="px-3 py-1 {view === 'table' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'calendar'}
      <SvGrid
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start',
          endField: 'end',
          titleField: 'title',
          colorField: 'color',
          views: ['month', 'agenda'],
          initialView: 'month',
          weekStartsOn: 1,
          editable: true,
          drawer: true,
          onEventMove,
          onEventResize,
          onEventCommit,
          onEventAdd,
          onEventDelete,
        }}
      />
    {:else}
      <SvGrid
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        sortable
        enableInlineEditing
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>
</section>
