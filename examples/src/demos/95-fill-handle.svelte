<script lang="ts">
  /**
   * 95. Excel-style fill handle
   * ---------------------------
   * The grid ships with a corner fill handle on the active cell-range -
   * the same green square Excel and Google Sheets render. Drag it over
   * neighbouring cells to extend the range; the engine auto-detects what
   * to do:
   *
   *   - 1 source cell        → copy that value
   *   - Numeric progression  → continue the series (10, 20 → 30, 40, 50)
   *   - Date / day sequence  → next dates / weekdays
   *   - Otherwise            → repeat the source values cyclically
   *
   * No prop wiring is required - just `enableCellSelection`. This demo
   * walks through every case with explicit "do this then drag the handle"
   * captions so evaluators see the feature exists.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'

  type Row = {
    id: number
    case: string
    seed1: number | string | null
    seed2: number | string | null
    c3: number | string | null
    c4: number | string | null
    c5: number | string | null
    c6: number | string | null
    c7: number | string | null
    c8: number | string | null
    c9: number | string | null
    c10: number | string | null
  }

  const blanks = (n: number) => new Array(n).fill(null) as null[]
  const start = (): Row[] => [
    { id: 1, case: 'Single cell - copy mode',         seed1: 42,           seed2: null,        c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
    { id: 2, case: 'Numeric series (+10)',             seed1: 10,           seed2: 20,          c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
    { id: 3, case: 'Numeric series (×ratio 1.5)',      seed1: 100,          seed2: 150,         c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
    { id: 4, case: 'Reverse fill (drag LEFT)',         seed1: null,         seed2: null,        c3: null, c4: null, c5: null, c6: 25,   c7: 50,   c8: 75,   c9: 100,  c10: 125 },
    { id: 5, case: 'Weekdays sequence',                seed1: 'Mon',        seed2: 'Tue',       c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
    { id: 6, case: 'Date series (ISO)',                seed1: '2026-01-01', seed2: '2026-01-02', c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
    { id: 7, case: 'Repeat text (copy mode)',          seed1: 'TODO',       seed2: null,        c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
    { id: 8, case: 'Cycle pattern (A, B → A B A B …)', seed1: 'A',          seed2: 'B',         c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null },
  ]

  let rows = $state<Row[]>(start())
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  function reset() { rows = start(); detectedCase = '' }

  // Simple heuristic for the side-panel detector. The grid does the real
  // work; this is purely for the explainer panel to tell evaluators which
  // pattern they just triggered.
  let detectedCase = $state('')
  function detect(rowIndex: number) {
    const r = rows[rowIndex]
    if (!r) return
    const filled = (['seed1', 'seed2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'] as (keyof Row)[])
      .map((k) => r[k])
      .filter((v) => v !== null)
    const seeds = filled.slice(0, 2)
    if (seeds.length === 1) { detectedCase = 'copy mode (1 source cell)'; return }
    const [a, b] = seeds as [unknown, unknown]
    if (typeof a === 'number' && typeof b === 'number') {
      const diff = b - a
      detectedCase = `numeric series · step ${diff}`
      return
    }
    if (typeof a === 'string' && typeof b === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(a)) { detectedCase = 'date series · +1 day'; return }
      detectedCase = 'text series'
      return
    }
    detectedCase = 'cycle / repeat'
  }

  const features = tableFeatures({ rowSortingFeature })

  // ---- KPI strip ---------------------------------------------------------
  const filledCells = $derived.by(() => {
    let n = 0
    for (const r of rows) {
      for (const k of ['seed1', 'seed2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'] as (keyof Row)[]) {
        if (r[k] !== null && r[k] !== '') n++
      }
    }
    return n
  })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'case',   header: 'Try this case',         width: 240, editable: false },
    { field: 'seed1',  header: 'Source 1',              width: 90,  align: 'right' },
    { field: 'seed2',  header: 'Source 2',              width: 90,  align: 'right' },
    { field: 'c3',     header: '→',                     width: 70,  align: 'right' },
    { field: 'c4',     header: '→',                     width: 70,  align: 'right' },
    { field: 'c5',     header: '→',                     width: 70,  align: 'right' },
    { field: 'c6',     header: '→ / ← (case 4)',        width: 100, align: 'right' },
    { field: 'c7',     header: '→',                     width: 70,  align: 'right' },
    { field: 'c8',     header: '→',                     width: 70,  align: 'right' },
    { field: 'c9',     header: '→',                     width: 70,  align: 'right' },
    { field: 'c10',    header: '→',                     width: 70,  align: 'right' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="kpi-strip shrink-0">
    <div class="kpi">
      <div class="kpi-label">Filled cells</div>
      <div class="kpi-value">{filledCells}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Last detected pattern</div>
      <div class="kpi-value sm">{detectedCase || '-'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Reset</div>
      <button class="reset-btn" onclick={reset}>Clear all → seeds only</button>
    </div>
  </div>

  <div class="caption shrink-0">
    <strong>How to use:</strong> click any seed cell, hover the bottom-right corner until the cursor turns into a crosshair, then drag across empty cells. The grid auto-detects copy vs series vs cycle and fills the target range.
    <button class="hint-btn" onclick={() => detect(api?.getSelected()[0]?.[0] ?? -1)}>Detect pattern in current row</button>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={42}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .kpi-strip { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 10px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 14px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
               color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--sg-fg, #0f172a);
               font-variant-numeric: tabular-nums; }
  .kpi-value.sm { font-size: 14px; color: #6366f1; }
  .reset-btn {
    align-self: flex-start;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .reset-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }

  .caption {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(168,85,247,0.03));
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .caption strong { color: #6366f1; }
  .hint-btn {
    margin-left: auto;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff; border: 0; border-radius: 6px;
    padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .hint-btn:hover { filter: brightness(1.1); }
</style>
