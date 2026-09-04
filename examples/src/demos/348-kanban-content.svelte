<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 348. Content calendar (media cards + channel swimlanes)
   * -------------------------------------------------------
   * An editorial pipeline: stage lanes crossed with a swimlane per channel.
   * Rich cards carry a cover glyph, author and target date. Drag a piece down
   * the pipeline, or across a band to move it to another channel; double-click
   * to edit.
   */
  import { SvGrid, SvAvatar, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent, type BoardCardCommitEvent } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')

  type Piece = {
    id: number
    title: string
    stage: string
    channel: string
    author: string
    date: string
    cover: string
  }

  let rows = $state<Piece[]>([
    { id: 1, title: 'Svelte 5 runes deep-dive', stage: 'draft', channel: 'Blog', author: 'Sam Rivera', date: '2026-08-04', cover: '📝' },
    { id: 2, title: 'Board mode launch thread', stage: 'idea', channel: 'Social', author: 'Lee Park', date: '2026-08-01', cover: '🧵' },
    { id: 3, title: 'Grid vs the field', stage: 'review', channel: 'Blog', author: 'Ada Cole', date: '2026-07-30', cover: '📊' },
    { id: 4, title: 'Release notes 1.3', stage: 'scheduled', channel: 'Email', author: 'Sam Rivera', date: '2026-07-29', cover: '✉️' },
    { id: 5, title: 'Kanban in 60 seconds', stage: 'idea', channel: 'Video', author: 'Lee Park', date: '2026-08-12', cover: '🎬' },
    { id: 6, title: 'Virtualization explained', stage: 'draft', channel: 'Blog', author: 'Ada Cole', date: '2026-08-09', cover: '⚡' },
    { id: 7, title: 'Customer spotlight', stage: 'published', channel: 'Email', author: 'Sam Rivera', date: '2026-07-15', cover: '🌟' },
    { id: 8, title: 'Weekly tips', stage: 'scheduled', channel: 'Social', author: 'Lee Park', date: '2026-07-31', cover: '💡' },
  ])

  const columns: ColumnDef<any, Piece>[] = [
    { field: 'title', header: 'Title', editorType: 'text' },
    { field: 'author', header: 'Author', editorType: 'text' },
    { field: 'date', header: 'Target date', editorType: 'text' },
    { field: 'channel', header: 'Channel' },
    { field: 'stage', header: 'Stage' },
  ]

  const lanes = [
    { id: 'idea', title: 'Idea' },
    { id: 'draft', title: 'Draft', color: '#3b82f6' },
    { id: 'review', title: 'Review', color: '#f59e0b' },
    { id: 'scheduled', title: 'Scheduled', color: '#8b5cf6' },
    { id: 'published', title: 'Published', color: '#22c55e' },
  ]

  function onCardMove(e: BoardCardMoveEvent<Piece>) {
    e.row.stage = e.toLane
    if (e.toSwimlane != null) e.row.channel = e.toSwimlane
  }
  function onCardCommit(e: BoardCardCommitEvent<Piece>) {
    Object.assign(e.row, e.values)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm demo-note">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Pipeline stages as lanes, a
      swimlane per channel. Drag a piece to the next stage, or across a band to re-channel it.
    </div>
    <div class="view-toggle inline-flex rounded-md overflow-hidden text-sm shrink-0">
      <button class="px-3 py-1 {view === 'board' ? 'is-on' : ''}"
        onclick={() => (view = 'board')}>Board</button>
      <button class="px-3 py-1 {view === 'table' ? 'is-on' : ''}"
        onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'board'}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        board={{
          groupBy: 'stage',
          lanes,
          swimlaneBy: 'channel',
        collapsibleSwimlanes: true,
          editable: true,
          laneSummary: (list) => `${list.length}`,
          onCardMove,
          onCardCommit,
          card: pieceCard,
        }}
      />
    {:else}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        getRowId={(r) => String(r.id)}
        sortable
        filterable
        enableInlineEditing
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="text-sm demo-note shrink-0">
    {rows.length} pieces · {rows.filter((p) => p.stage === 'published').length} published
  </footer>
</section>

{#snippet pieceCard(p: Piece)}
  <div class="flex gap-2.5">
    <span class="text-xl leading-none shrink-0" aria-hidden="true">{p.cover}</span>
    <div class="flex flex-col gap-1 min-w-0">
      <div class="font-semibold text-[0.8rem] leading-snug">{p.title}</div>
      <div class="flex items-center justify-between gap-2 text-[0.72rem] card-meta">
        <span class="inline-flex items-center gap-1.5 min-w-0">
          <SvAvatar name={p.author} size={16} />
          <span class="truncate">{p.author.split(' ')[0]}</span>
        </span>
        <span class="shrink-0">{p.date}</span>
      </div>
    </div>
  </div>
{/snippet}

<style>
  .demo-note { color: var(--sg-muted, #475569); }
  .card-meta { color: var(--sg-muted, #64748b); }

  .view-toggle { border: 1px solid var(--sg-border, #cbd5e1); }
  .view-toggle button {
    background: transparent;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .view-toggle button.is-on {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #fff);
  }
</style>
