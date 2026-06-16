<script lang="ts">
  /**
   * 66. Custom cell editors - Feature health board
   * ----------------------------------------------
   * A product team's quarterly feature-health review. Three hand-rolled
   * editors live inside snippet cells:
   *
   *   - Color picker - the feature's swimlane / theme color
   *   - 5-star rating - customer satisfaction this quarter
   *   - Mood feedback - internal team sentiment
   *
   * Snippet columns set `editable: false` so the grid does not start an
   * editor on click - the snippet's own controls handle writes through
   * `api.setCellValue`. Inner click handlers stop propagation so the
   * grid's cell-click handler does not fight the snippet input.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'

  type Mood = 'love' | 'happy' | 'neutral' | 'concerned' | 'critical' | null
  type Status = 'shipped' | 'in_progress' | 'planned' | 'at_risk'

  type Feature = {
    id: string
    title: string
    area: string
    /** Swimlane / theme color for the feature card. */
    color: string
    /** Customer satisfaction this quarter (0-5). */
    csat: number
    /** Internal team sentiment. */
    mood: Mood
    /** % of quarterly OKR this feature contributes. */
    okrWeight: number
    /** Last review date (ISO). */
    lastReviewed: string
    /** Status badge. */
    status: Status
  }

  let rows = $state<Feature[]>([
    { id: 'f01', title: 'Excel-style filters',     area: 'Grid core',  color: '#6366f1', csat: 5, mood: 'love',      okrWeight: 18, lastReviewed: '2026-05-12', status: 'shipped'     },
    { id: 'f02', title: 'Server-side data adapter',area: 'Data',       color: '#16a34a', csat: 4, mood: 'happy',     okrWeight: 14, lastReviewed: '2026-05-09', status: 'shipped'     },
    { id: 'f03', title: 'Pivot table designer',    area: 'Pro',        color: '#a855f7', csat: 4, mood: 'happy',     okrWeight: 12, lastReviewed: '2026-04-28', status: 'shipped'     },
    { id: 'f04', title: 'AI Smart Paste',          area: 'AI',         color: '#0ea5e9', csat: 5, mood: 'love',      okrWeight: 10, lastReviewed: '2026-05-20', status: 'shipped'     },
    { id: 'f05', title: 'CSV / xlsx import',       area: 'Pro',        color: '#f59e0b', csat: 3, mood: 'neutral',   okrWeight: 8,  lastReviewed: '2026-05-02', status: 'in_progress' },
    { id: 'f06', title: 'Mobile gesture edits',    area: 'UX',         color: '#ec4899', csat: 2, mood: 'concerned', okrWeight: 6,  lastReviewed: '2026-04-15', status: 'at_risk'     },
    { id: 'f07', title: 'Realtime stream backplane', area: 'Data',     color: '#10b981', csat: 4, mood: 'happy',     okrWeight: 9,  lastReviewed: '2026-05-18', status: 'in_progress' },
    { id: 'f08', title: 'Accessibility audit pass',area: 'Compliance', color: '#0284c7', csat: 5, mood: 'love',      okrWeight: 7,  lastReviewed: '2026-05-22', status: 'shipped'     },
    { id: 'f09', title: 'PDF / Print export',      area: 'Pro',        color: '#dc2626', csat: 3, mood: 'neutral',   okrWeight: 5,  lastReviewed: '2026-04-30', status: 'planned'     },
    { id: 'f10', title: 'GraphQL adapter',         area: 'Data',       color: '#7c3aed', csat: 1, mood: 'critical',  okrWeight: 4,  lastReviewed: '2026-03-28', status: 'at_risk'     },
    { id: 'f11', title: 'Theming studio',          area: 'UX',         color: '#0891b2', csat: 5, mood: 'love',      okrWeight: 4,  lastReviewed: '2026-05-25', status: 'shipped'     },
    { id: 'f12', title: 'Permissions + audit log', area: 'Compliance', color: '#475569', csat: 4, mood: 'happy',     okrWeight: 3,  lastReviewed: '2026-05-08', status: 'shipped'     },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Feature> | null>(null)

  const MOODS: { id: NonNullable<Mood>; glyph: string; label: string }[] = [
    { id: 'love',      glyph: '😍', label: 'Team loves it' },
    { id: 'happy',     glyph: '😊', label: 'Happy with it' },
    { id: 'neutral',   glyph: '😐', label: 'Neutral' },
    { id: 'concerned', glyph: '😟', label: 'Concerned' },
    { id: 'critical',  glyph: '😠', label: 'Critical issues' },
  ]
  const STATUS_LABEL: Record<Status, string> = {
    shipped: 'Shipped', in_progress: 'In progress', planned: 'Planned', at_risk: 'At risk',
  }
  const STATUS_OPTIONS: { value: Status; label: string }[] = [
    { value: 'shipped',     label: 'Shipped' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'planned',     label: 'Planned' },
    { value: 'at_risk',     label: 'At risk' },
  ]
  const MOOD_OPTIONS = MOODS.map((m) => ({ value: m.id, label: `${m.glyph} ${m.label}` }))

  // ---- KPI derivations ---------------------------------------------------
  const avgCsat   = $derived(rows.reduce((a, r) => a + r.csat, 0) / rows.length)
  const lovedN    = $derived(rows.filter((r) => r.mood === 'love').length)
  const atRiskN   = $derived(rows.filter((r) => r.status === 'at_risk').length)
  const shippedN  = $derived(rows.filter((r) => r.status === 'shipped').length)
  const fmtNum    = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

  // ---- Columns ----------------------------------------------------------
  // Every column is editable. Built-in editor types match the cell shape;
  // cell snippets render the polished read-only display.
  const columns: ColumnDef<typeof features, Feature>[] = [
    { field: 'title', header: 'Feature', editorType: 'text', width: 220 },
    { field: 'area',  header: 'Area',    editorType: 'text', width: 130 },
    { field: 'color', header: 'Swimlane',
      editorType: 'color', width: 140,
      cell: (ctx) => renderSnippet(ColorCell, { row: ctx.row.original }) },
    { field: 'csat', header: 'CSAT',
      editorType: 'rating', width: 150,
      cell: (ctx) => renderSnippet(RatingCell, { row: ctx.row.original }) },
    { field: 'mood', header: 'Team sentiment',
      editorType: 'list', editorOptions: MOOD_OPTIONS, width: 200,
      cell: (ctx) => renderSnippet(MoodCell, { row: ctx.row.original }) },
    { field: 'okrWeight', header: 'OKR weight %', editorType: 'number', width: 130,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'lastReviewed', header: 'Last review', editorType: 'date', width: 130,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'status', header: 'Status',
      editorType: 'list', editorOptions: STATUS_OPTIONS, width: 150,
      cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
  ]
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet ColorCell(props: { row: Feature })}
  <span class="ce-color">
    <span class="ce-color-chip" style={`background: ${props.row.color}`}></span>
    <code class="ce-color-hex">{props.row.color}</code>
  </span>
{/snippet}

{#snippet RatingCell(props: { row: Feature })}
  <span class="ce-stars" aria-label={`${props.row.csat} of 5`}>
    {#each [1,2,3,4,5] as n (n)}
      <span class={`ce-star ${props.row.csat >= n ? 'ce-star-on' : ''}`} aria-hidden="true">★</span>
    {/each}
  </span>
{/snippet}

{#snippet MoodCell(props: { row: Feature })}
  {@const m = MOODS.find((x) => x.id === props.row.mood)}
  <span class="ce-mood-display" title={m?.label ?? 'Not set'}>
    {#if m}
      <span class="ce-mood-glyph">{m.glyph}</span>
      <span class="ce-mood-text">{m.label}</span>
    {:else}
      <span class="ce-mood-empty">Not set</span>
    {/if}
  </span>
{/snippet}

{#snippet StatusCell(props: { row: Feature })}
  <span class={`ce-status ce-status-${props.row.status}`}>{STATUS_LABEL[props.row.status]}</span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="ce-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="ce-kpi-strip shrink-0">
    <div class="ce-kpi">
      <div class="ce-kpi-label">Avg CSAT</div>
      <div class="ce-kpi-value tabular-nums">{fmtNum.format(avgCsat)}<span class="ce-kpi-unit"> / 5</span></div>
      <div class="ce-kpi-foot">{rows.length} features reviewed</div>
    </div>
    <div class="ce-kpi">
      <div class="ce-kpi-label">Loved by team</div>
      <div class="ce-kpi-value tabular-nums">{lovedN}</div>
      <div class="ce-kpi-foot">😍 sentiment</div>
    </div>
    <div class="ce-kpi ce-kpi-good">
      <div class="ce-kpi-label">Shipped</div>
      <div class="ce-kpi-value tabular-nums">{shippedN}</div>
      <div class="ce-kpi-foot">this quarter</div>
    </div>
    <div class="ce-kpi ce-kpi-warn">
      <div class="ce-kpi-label">At risk</div>
      <div class="ce-kpi-value tabular-nums">{atRiskN}</div>
      <div class="ce-kpi-foot">need a retro</div>
    </div>
  </div>

  <p class="ce-intro shrink-0">
    Quarterly feature-health review. The <strong>Swimlane</strong>, <strong>CSAT</strong>, and <strong>Team sentiment</strong>
    columns use custom snippet editors - click the swatch, stars, or emoji directly. Writes flow through
    <code>api.setCellValue</code>, so dirty tracking and external observers see every change. Built-in text / number / date
    columns are double-click-to-edit as usual.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .ce-shell { height: 100%; }

  /* KPI strip */
  .ce-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .ce-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .ce-kpi-good { border-left: 3px solid #10b981; }
  .ce-kpi-warn { border-left: 3px solid #f59e0b; }
  .ce-kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .ce-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); }
  .ce-kpi-unit  { font-size: 12px; font-weight: 500; color: var(--sg-muted, #94a3b8); }
  .ce-kpi-foot  { font-size: 11px; color: var(--sg-muted, #94a3b8); }

  /* Intro band */
  .ce-intro {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
    line-height: 1.5;
    margin: 0;
  }
  .ce-intro code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11.5px;
  }

  /* Color cell (read-only display; editor handles edit mode) */
  :global(.ce-color) {
    display: inline-flex; align-items: center; gap: 8px;
  }
  :global(.ce-color-chip) {
    width: 22px; height: 22px; border-radius: 6px;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18);
  }
  :global(.ce-color-hex) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }

  /* Stars (read-only display) */
  :global(.ce-stars) { display: inline-flex; gap: 2px; }
  :global(.ce-star)  {
    color: #cbd5e1; font-size: 18px; line-height: 1;
  }
  :global(.ce-star-on) { color: #f59e0b; }

  /* Mood (read-only display) */
  :global(.ce-mood-display) {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; color: var(--sg-fg, #0f172a);
  }
  :global(.ce-mood-glyph) { font-size: 16px; line-height: 1; }
  :global(.ce-mood-text)  { color: var(--sg-muted, #64748b); }
  :global(.ce-mood-empty) {
    font-size: 11px; color: var(--sg-muted, #94a3b8); font-style: italic;
  }

  /* Status pills */
  :global(.ce-status) {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  :global(.ce-status-shipped)     { background: #dcfce7; color: #166534; }
  :global(.ce-status-in_progress) { background: #dbeafe; color: #1e3a8a; }
  :global(.ce-status-planned)     { background: #f1f5f9; color: #334155; }
  :global(.ce-status-at_risk)     { background: #fee2e2; color: #991b1b; box-shadow: inset 0 0 0 1px #dc2626; }
  :global([data-theme='dark'] .ce-status-shipped)     { background: rgba(34,197,94,0.18); color: #4ade80; }
  :global([data-theme='dark'] .ce-status-in_progress) { background: rgba(59,130,246,0.20); color: #93c5fd; }
  :global([data-theme='dark'] .ce-status-planned)     { background: rgba(148,163,184,0.18); color: #cbd5e1; }
  :global([data-theme='dark'] .ce-status-at_risk)     { background: rgba(239,68,68,0.22); color: #fca5a5; box-shadow: inset 0 0 0 1px #ef4444; }
</style>
