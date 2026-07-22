<!-- Documented in: docs/help/cells/conditional-formatting.md -->
<script lang="ts">
  /**
   * 141. Conditional formatting
   * ---------------------------
   * Excel-style, value-driven cell coloring as a declarative engine prop -
   * no per-cell snippet. Four format kinds, scoped to columns:
   *
   *   colorScale  gradient across the column's value range
   *   dataBar     in-cell proportional bar
   *   iconSet     arrows / traffic / triangles by threshold
   *   rule        apply a style when a predicate matches
   *
   * Pass them all in one `conditionalFormats` array; later entries win.
   */
  import {
    SvGrid,
    tableFeatures,
    type ColumnDef,
    type ConditionalFormat,
  } from '@svgrid/grid'

  const features = tableFeatures({})

  type Row = {
    id: number
    rep: string
    region: string
    revenue: number
    growth: number
    score: number
    churn: number
  }

  let seed = 0x51ed
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)

  const REPS = ['Ada L.', 'Grace H.', 'Alan T.', 'Margaret H.', 'Linus T.', 'Donald K.', 'Brian K.', 'Dennis R.', 'Barbara L.', 'Ken T.']
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const rows: Row[] = REPS.map((rep, id) => ({
    id,
    rep,
    region: REGIONS[id % 3]!,
    revenue: Math.round(20_000 + rnd() * 380_000),
    growth: Math.round((rnd() - 0.4) * 60),
    score: Math.round(rnd() * 100),
    churn: Math.round(rnd() * 30),
  }))

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'rep', header: 'Rep', width: 140 },
    { field: 'region', header: 'Region', width: 120 },
    {
      field: 'revenue',
      header: 'Revenue',
      width: 200,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'growth', header: 'Growth %', width: 130, align: 'right' },
    { field: 'score', header: 'Health score', width: 150, align: 'center' },
    { field: 'churn', header: 'Churn %', width: 120, align: 'right' },
  ]

  const conditionalFormats: ConditionalFormat<Row>[] = [
    // Data bar across the revenue range.
    { type: 'dataBar', columns: ['revenue'], color: '#3b82f6' },
    // Arrows by growth threshold (down < 0 <= flat < 10 <= up).
    { type: 'iconSet', columns: ['growth'], set: 'arrows', thresholds: [0, 10] },
    // Red/green diverging on the growth number itself.
    {
      type: 'rule',
      columns: ['growth'],
      when: ({ value }) => Number(value) < 0,
      color: '#dc2626',
      fontWeight: 700,
    },
    // Red -> yellow -> green color scale on the health score.
    { type: 'colorScale', columns: ['score'], min: '#fca5a5', mid: '#fde68a', max: '#86efac', minValue: 0, maxValue: 100 },
    // Highlight high churn rows in red.
    {
      type: 'rule',
      columns: ['churn'],
      when: ({ value }) => Number(value) >= 20,
      background: '#fee2e2',
      color: '#991b1b',
      fontWeight: 700,
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Value-driven cell coloring via <code>conditionalFormats</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Revenue = data bar · Growth = arrows + red for negatives · Health score
      = red/yellow/green scale · Churn &ge; 20% = red highlight. One array, no
      per-cell snippets.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      conditionalFormats={conditionalFormats}
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
