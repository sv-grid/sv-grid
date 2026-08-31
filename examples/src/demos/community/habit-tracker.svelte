<!--
  title: Habit tracker
  author: SvGrid team
  github: sv-grid
  tags: sparklines, custom cells, progress
  discussion: 0
-->
<script lang="ts">
  /**
   * A weekly habit tracker: a win/loss sparkline of the last 7 days, the current
   * streak, and a progress bar toward each habit's weekly goal. The win/loss
   * sparkline is a first-class column type. Self-contained - only @svgrid/grid.
   */
  import { SvGrid, renderSnippet, tableFeatures, type ColumnDef } from '@svgrid/grid'

  type Habit = { id: number; name: string; week: number[]; streak: number; done: number; goal: number }

  const features = tableFeatures({})

  // week: 1 = done that day, -1 = missed (win/loss sparkline reads the sign).
  const rows: Habit[] = [
    { id: 1, name: 'Morning run',     week: [1, 1, -1, 1, 1, 1, 1],   streak: 4, done: 6, goal: 7 },
    { id: 2, name: 'Read 20 pages',   week: [1, 1, 1, 1, 1, 1, 1],    streak: 12, done: 7, goal: 7 },
    { id: 3, name: 'No sugar',        week: [1, -1, -1, 1, 1, -1, 1], streak: 1, done: 4, goal: 7 },
    { id: 4, name: 'Meditate',        week: [1, 1, 1, -1, 1, 1, 1],   streak: 3, done: 6, goal: 7 },
    { id: 5, name: 'Journal',         week: [-1, 1, 1, 1, 1, 1, -1],  streak: 0, done: 5, goal: 7 },
    { id: 6, name: 'Water 2L',        week: [1, 1, 1, 1, 1, 1, 1],    streak: 21, done: 7, goal: 7 },
  ]

  const columns: ColumnDef<typeof features, Habit>[] = [
    { field: 'name', header: 'Habit', width: 170 },
    { field: 'week', header: 'This week', width: 150, align: 'center', sparkline: { type: 'winloss' } },
    { field: 'streak', header: 'Streak', width: 100, align: 'right', cell: (ctx) => renderSnippet(Streak, { v: Number(ctx.getValue()) }) },
    { id: 'progress', header: 'Weekly goal', field: 'done', width: 200, cell: (ctx) => renderSnippet(Progress, { row: ctx.row.original }) },
  ]
</script>

{#snippet Streak(p: { v: number })}
  <span class="streak {p.v >= 7 ? 'hot' : ''}">{p.v > 0 ? `🔥 ${p.v}` : '—'}</span>
{/snippet}

{#snippet Progress(p: { row: Habit })}
  {@const pct = Math.round((p.row.done / p.row.goal) * 100)}
  <span class="prog">
    <span class="prog-bar"><span class="prog-fill" style={`width:${pct}%`} class:full={pct >= 100}></span></span>
    <span class="prog-n">{p.row.done}/{p.row.goal}</span>
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">
    Win/loss sparkline of the last 7 days, plus streak and weekly progress. A community-contributed demo.
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid data={rows} columns={columns} features={features} showRowNumbers={false} rowHeight={42} containerHeight="100%" fitColumns={true} />
  </div>
</section>

<style>
  .streak { font-weight: 600; font-variant-numeric: tabular-nums; }
  .streak.hot { color: #ea580c; }
  .prog { display: inline-flex; align-items: center; gap: 9px; width: 100%; }
  .prog-bar { flex: 1; height: 8px; border-radius: 999px; background: color-mix(in oklab, var(--sg-muted) 18%, transparent); overflow: hidden; }
  .prog-fill { display: block; height: 100%; border-radius: 999px; background: #6366f1; }
  .prog-fill.full { background: #16a34a; }
  .prog-n { font-size: 11.5px; color: var(--sg-muted); font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
</style>
