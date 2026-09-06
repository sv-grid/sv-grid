<!-- Documented in: docs/help/pivot.md -->
<script lang="ts">
  /**
   * 360. Pivot mode grid (Enterprise) - <SvPivotDesigner panelPosition="right">
   * ---------------------------------------------------------------------------
   * The classic "enterprise data grid" experience, built entirely on the
   * shipped `<SvPivotDesigner>` component - no bespoke panel. Three designer
   * features drive the AG-Grid-style look:
   *
   *   - `panelPosition="right"` docks the field picker + Column/Row/Values
   *     wells as a vertical tool panel on the right of the grid.
   *   - `pivotMode` (bindable) + `flatColumns` add the PIVOT MODE toggle:
   *     OFF shows the flat participant grid (column groups, flags, stars,
   *     inline filter row); ON shows the live pivot.
   *   - `decorateColumns` heat-tints the value cells low -> high.
   *
   * The layout is pre-seeded (Language -> Country rows x Game columns, avg
   * measures) so flipping Pivot Mode on immediately yields a real cross-tab.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type GridColumns,
  } from '@svgrid/grid'
  import {
    SvPivotDesigner,
    setLicenseKey,
    type PivotField,
    type PivotLayout,
    type PivotRow,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Domain ----------------------------------------------------------
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const
  type Month = typeof MONTHS[number]

  type Participant = {
    id: number
    name: string
    language: string
    country: string
    game: string
    bought: boolean
    bankBalance: number
    rating: number
    totalWinnings: number
  } & Record<Month, number>

  const PLACES: Array<{ country: string; flag: string; language: string }> = [
    { country: 'Ireland',  flag: '🇮🇪', language: 'English' },
    { country: 'Sweden',   flag: '🇸🇪', language: 'Swedish' },
    { country: 'Uruguay',  flag: '🇺🇾', language: 'Spanish' },
    { country: 'France',   flag: '🇫🇷', language: 'French' },
    { country: 'Portugal', flag: '🇵🇹', language: 'Portuguese' },
    { country: 'Colombia', flag: '🇨🇴', language: 'Spanish' },
    { country: 'Malta',    flag: '🇲🇹', language: 'Maltese' },
    { country: 'Germany',  flag: '🇩🇪', language: 'German' },
    { country: 'Japan',    flag: '🇯🇵', language: 'Japanese' },
    { country: 'Spain',    flag: '🇪🇸', language: 'Spanish' },
    { country: 'Brazil',   flag: '🇧🇷', language: 'Portuguese' },
    { country: 'USA',      flag: '🇺🇸', language: 'English' },
  ]
  const FLAG = new Map(PLACES.map((p) => [p.country, p.flag]))
  const GAMES = ['Chess', 'Bul', 'Rithmomachy', 'Kalah', 'Game of the Generals', 'Hare and Hounds', 'Sugoroku', "Nine Men's Morris", 'Blockade', 'Go', 'Draughts', 'Backgammon']
  const FIRST = ['Tony', 'Andrew', 'Kevin', 'Bricker', 'Harper', 'Noel', 'Sophie', 'Isabelle', 'Emily', 'Oliver', 'Mia', 'Lucas', 'Ava', 'Ethan', 'Grace', 'Leo']
  const LAST = ['Smith', 'Connell', 'Flanagan', 'McGee', 'Thornton', 'Lopes', 'Beckham', 'Black', 'Braxton', 'Hughes', 'Nguyen', 'Rossi', 'Kane', 'Webb', 'Frost', 'Reed']

  let prng = 0x1a2b3c4d >>> 0
  const rnd = () => { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xffffffff }
  const pick = <U,>(arr: readonly U[]): U => arr[Math.floor(rnd() * arr.length)]!

  function seed(): Participant[] {
    const out: Participant[] = []
    for (let id = 1; id <= 1000; id += 1) {
      const place = pick(PLACES)
      const row = {
        id,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        language: place.language,
        country: place.country,
        game: pick(GAMES),
        bought: rnd() > 0.45,
        bankBalance: Math.round(1000 + rnd() * 98_000),
        rating: Math.floor(rnd() * 6),
        totalWinnings: Math.round(400_000 + rnd() * 500_000),
      } as Participant
      for (const m of MONTHS) row[m] = Math.round(5_000 + rnd() * 85_000)
      out.push(row)
    }
    return out
  }
  const rows = seed()

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const ratingFmt = { type: 'number', options: { minimumFractionDigits: 1, maximumFractionDigits: 1 } } as const

  // ---- Fields for the designer's picker + wells ------------------------
  const fields: PivotField<Participant>[] = [
    { field: 'name',          label: 'Name',           kind: 'dimension', group: 'Participant' },
    { field: 'language',      label: 'Language',       kind: 'dimension', group: 'Participant' },
    { field: 'country',       label: 'Country',        kind: 'dimension', group: 'Participant' },
    { field: 'game',          label: 'Game Name',      kind: 'dimension', group: 'Game of Choice' },
    { field: 'bought',        label: 'Bought',         kind: 'dimension', group: 'Game of Choice' },
    { field: 'bankBalance',   label: 'Bank Balance',   kind: 'measure',   group: 'Performance', defaultAgg: 'avg', format: money },
    { field: 'rating',        label: 'Rating',         kind: 'measure',   group: 'Performance', defaultAgg: 'avg', format: ratingFmt },
    { field: 'totalWinnings', label: 'Total Winnings', kind: 'measure',   group: 'Winnings',    defaultAgg: 'sum', format: money },
    ...MONTHS.map((m): PivotField<Participant> => ({
      field: m, label: m[0]!.toUpperCase() + m.slice(1), kind: 'measure', group: 'Monthly Breakdown', defaultAgg: 'sum', format: money,
    })),
  ]

  // Pre-seeded so Pivot Mode ON is instantly a real cross-tab. language ->
  // country is a genuine 1-to-many fan-out, so the row groups expand.
  let layout = $state<PivotLayout>({
    rows: ['language', 'country'],
    cols: ['game'],
    values: [
      { field: 'bankBalance', agg: 'avg', label: 'Bank Balance', format: money },
      { field: 'rating', agg: 'avg', label: 'Rating', format: ratingFmt },
    ],
    filters: [],
  })
  let pivotMode = $state(false)

  // ---- Flat (pivot-off) columns: AG-style groups + custom cells --------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const flatColumns: GridColumns<Participant> = [
    {
      id: 'g-participant', header: 'Participant', columns: [
        { field: 'name', header: 'Name', width: 150 },
        { field: 'language', header: 'Language', width: 120 },
        { field: 'country', header: 'Country', width: 140, cell: (ctx) => renderSnippet(CountryCell, { value: String(ctx.getValue()) }) },
      ],
    } as ColumnDef<typeof features, Participant>,
    {
      id: 'g-game', header: 'Game of Choice', columns: [
        { field: 'game', header: 'Game Name', width: 170 },
        { field: 'bought', header: 'Bought', width: 90, align: 'center', cell: (ctx) => renderSnippet(BoughtCell, { on: Boolean(ctx.getValue()) }) },
      ],
    } as ColumnDef<typeof features, Participant>,
    {
      id: 'g-performance', header: 'Performance', columns: [
        { field: 'bankBalance', header: 'Bank Balance', width: 150, align: 'right', format: money },
        { field: 'rating', header: 'Rating', width: 120, cell: (ctx) => renderSnippet(RatingCell, { n: Number(ctx.getValue()) }) },
      ],
    } as ColumnDef<typeof features, Participant>,
    { field: 'totalWinnings', header: 'Total Winnings', width: 150, align: 'right', format: money },
    {
      id: 'g-months', header: 'Monthly Breakdown',
      columns: MONTHS.map((m): ColumnDef<typeof features, Participant> => ({
        field: m, header: m[0]!.toUpperCase() + m.slice(1), width: 100, align: 'right', format: money,
      })),
    } as ColumnDef<typeof features, Participant>,
  ]

  // ---- Heatmap: per-measure range over the current pivot leaves --------
  let pivotRows = $state<PivotRow[]>([])
  const measureRanges = $derived.by(() => {
    const ranges: Record<string, { lo: number; hi: number }> = {}
    for (const r of pivotRows) {
      if (r.__pivotKind !== 'leaf') continue
      for (const [k, v] of Object.entries(r)) {
        const m = k.match(/__m(\d+)$/)
        if (!m) continue
        const n = Number(v)
        if (!Number.isFinite(n)) continue
        const cur = ranges[m[1]!] ?? { lo: Infinity, hi: -Infinity }
        if (n < cur.lo) cur.lo = n
        if (n > cur.hi) cur.hi = n
        ranges[m[1]!] = cur
      }
    }
    return ranges
  })
  function heatClass(colId: string, value: unknown): string {
    const m = colId.match(/__m(\d+)$/)
    if (!m) return ''
    const range = measureRanges[m[1]!]
    if (!range || range.lo === range.hi) return ''
    const n = Number(value)
    if (!Number.isFinite(n)) return ''
    const t = (n - range.lo) / (range.hi - range.lo)
    if (t < 0.2) return 'heat-1'
    if (t < 0.4) return 'heat-2'
    if (t < 0.6) return 'heat-3'
    if (t < 0.8) return 'heat-4'
    return 'heat-5'
  }
  // Right-align + heat-tint the value LEAF columns (nested under group cols).
  function decorate(cols: GridColumns<PivotRow>): GridColumns<PivotRow> {
    return cols.map((c) => {
      const kids = (c as { columns?: GridColumns<PivotRow> }).columns
      if (kids?.length) return { ...c, columns: decorate(kids) } as ColumnDef<typeof features, PivotRow>
      const colId = c.id ?? ''
      if (!/__m\d+$/.test(colId)) return c
      return {
        ...c,
        align: 'right' as const,
        cellClass: (ctx: { row: { original: PivotRow }; getValue: () => unknown }) => {
          const k = ctx.row.original.__pivotKind
          if (k === 'grandTotal') return 'pm-grand'
          if (k !== 'leaf') return ''
          return `pm-leaf ${heatClass(colId, ctx.getValue())}`
        },
      } as ColumnDef<typeof features, PivotRow>
    })
  }
</script>

{#snippet CountryCell(props: { value: string })}
  <span class="pm-country"><span class="pm-flag">{FLAG.get(props.value) ?? '🏳️'}</span>{props.value}</span>
{/snippet}
{#snippet BoughtCell(props: { on: boolean })}
  <input type="checkbox" checked={props.on} disabled class="pm-check" aria-label={props.on ? 'bought' : 'not bought'} />
{/snippet}
{#snippet RatingCell(props: { n: number })}
  <span class="pm-stars" aria-label={`${props.n} of 5`}>{'★'.repeat(props.n)}<span class="pm-stars-empty">{'★'.repeat(5 - props.n)}</span></span>
{/snippet}

<section class="pm flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      &lt;SvPivotDesigner panelPosition="right"&gt; — enterprise pivot panel
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Flip <strong>Pivot Mode</strong> in the right panel: OFF shows the flat participant grid
      (column groups, flags, ratings, inline filter row); ON pivots
      <strong>Language → Country</strong> down the side and <strong>Game</strong> across the top,
      heat-tinted low → high. The right panel has <strong>Columns</strong> (a column-group tree with
      visibility checkboxes) and <strong>Filters</strong> tabs (Add Filter → pick a column → tick which
      values pass). Drag fields between the Columns / Rows / Values wells to re-pivot, or
      <strong>right-click</strong> a field, a chip, or the grid for a context menu.
    </p>
  </div>

  <div class="pm-host flex-1 min-h-0">
    <SvPivotDesigner
      data={rows}
      {fields}
      bind:layout
      bind:pivotMode
      {flatColumns}
      panelPosition="right"
      showToolbar={false}
      showFiltersWell={false}
      gridFitColumns={false}
      columnTree
      toolTabs
      expandable
      decorateColumns={(cols) => decorate(cols)}
      onPivot={(r) => (pivotRows = r)}
    />
  </div>
</section>

<style>
  .pm-host :global(.pm-country) { display: inline-flex; align-items: center; gap: 7px; }
  .pm-host :global(.pm-flag) { font-size: 14px; line-height: 1; }
  .pm-host :global(.pm-check) { accent-color: var(--sg-accent, #4338ca); width: 15px; height: 15px; }
  .pm-host :global(.pm-stars) { color: #f59e0b; letter-spacing: 1px; font-size: 13px; }
  .pm-host :global(.pm-stars-empty) { color: var(--sg-border, #cbd5e1); }

  /* Heat tinting on pivot value leaf cells */
  .pm-host :global(td.pm-leaf.heat-1) { background: rgba(239,68,68,0.16); color: #b91c1c; }
  .pm-host :global(td.pm-leaf.heat-2) { background: rgba(239,68,68,0.06); }
  .pm-host :global(td.pm-leaf.heat-3) { background: transparent; }
  .pm-host :global(td.pm-leaf.heat-4) { background: rgba(16,185,129,0.07); }
  .pm-host :global(td.pm-leaf.heat-5) { background: rgba(16,185,129,0.20); color: #047857; font-weight: 600; }
  :global([data-theme="dark"]) .pm-host :global(td.pm-leaf.heat-1) { background: rgba(239,68,68,0.28); color: #fecaca; }
  :global([data-theme="dark"]) .pm-host :global(td.pm-leaf.heat-2) { background: rgba(239,68,68,0.14); }
  :global([data-theme="dark"]) .pm-host :global(td.pm-leaf.heat-4) { background: rgba(16,185,129,0.16); }
  :global([data-theme="dark"]) .pm-host :global(td.pm-leaf.heat-5) { background: rgba(16,185,129,0.34); color: #a7f3d0; }
</style>
