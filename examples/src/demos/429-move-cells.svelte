<script lang="ts">
  /**
   * 429. Drag a selected range to move or copy it
   * ---------------------------------------------
   * The spreadsheet gesture: select cells, put the pointer on the range's
   * BORDER (the cursor turns into a move cursor), then drag the block
   * somewhere else and let go.
   *
   *   - Drag        → MOVE. The values land at the drop point and the cells
   *                   they came from go blank.
   *   - Ctrl / Cmd  → COPY. The source keeps its values. The modifier is read
   *                   when you DROP, so you can press or release it mid-drag.
   *   - Ctrl+Z      → walks the whole move back, one cell at a time.
   *
   * Nothing to wire up: it rides on `enableCellSelection`, same as the fill
   * handle. `moveCells={false}` turns it off if a border pointerdown needs to
   * keep starting a fresh selection.
   *
   * The rectangle is moved whole or not at all. Drop it where it would hang
   * off the edge of the grid, or over a read-only column, and nothing happens
   * - better than landing half of it somewhere with no way to tell which half.
   */
  import { SvGrid, tableFeatures, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Row = {
    id: number
    week: string
    mon: number | null
    tue: number | null
    wed: number | null
    thu: number | null
    fri: number | null
  }

  // Long enough to scroll on purpose: drag a block toward the bottom edge and
  // the grid keeps coming, so the destination does not have to be on screen
  // when the drag starts.
  const SEED: Array<[number, number, number]> = [
    [6, 8, 7],
    [5, 9, 8],
    [7, 6, 9],
  ]
  const start = (): Row[] =>
    Array.from({ length: 40 }, (_, i) => {
      const seed = SEED[i]
      return {
        id: i + 1,
        week: `Week ${i + 1}`,
        mon: seed?.[0] ?? null,
        tue: seed?.[1] ?? null,
        wed: seed?.[2] ?? null,
        thu: null,
        fri: null,
      }
    })

  let rows = $state<Row[]>(start())
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let moveCells = $state(true)

  /** Every write the grid reports, newest first, so a drop is visible as a
   *  list of cells and not just a rearranged grid. */
  let log = $state<Array<{ cell: string; from: string; to: string }>>([])

  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '(blank)' : String(v))

  function reset() {
    rows = start()
    log = []
  }

  const features = tableFeatures({})

  const filled = $derived(
    rows.reduce(
      (n, r) =>
        n +
        (['mon', 'tue', 'wed', 'thu', 'fri'] as const).filter((k) => r[k] !== null).length,
      0,
    ),
  )

  const columns: GridColumns<Row> = [
    // Read-only on purpose: try dropping a block onto this column and the
    // whole move is refused rather than half-applied.
    { field: 'week', header: 'Week (read-only)', width: 150, editable: false },
    { field: 'mon', header: 'Mon', width: 90, align: 'right' },
    { field: 'tue', header: 'Tue', width: 90, align: 'right' },
    { field: 'wed', header: 'Wed', width: 90, align: 'right' },
    { field: 'thu', header: 'Thu', width: 90, align: 'right' },
    { field: 'fri', header: 'Fri', width: 90, align: 'right' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="kpi-strip shrink-0">
    <div class="kpi">
      <div class="kpi-label">Cells with a value</div>
      <div class="kpi-value">{filled}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Writes in the last drop</div>
      <div class="kpi-value">{log.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">moveCells</div>
      <label class="toggle">
        <input type="checkbox" bind:checked={moveCells} />
        <span>{moveCells ? 'on - border drags the range' : 'off - border starts a selection'}</span>
      </label>
    </div>
    <div class="kpi">
      <div class="kpi-label">Undo</div>
      <div class="btn-row">
        <button class="reset-btn" onclick={() => api?.undo()}>Ctrl+Z</button>
        <button class="reset-btn" onclick={reset}>Reset</button>
      </div>
    </div>
  </div>

  <div class="caption shrink-0">
    <strong>Try it:</strong> drag across <em>Mon-Wed</em> on the first three rows to select a 3x3
    block, move the pointer onto the block's edge until the cursor changes, then drag it down to the
    empty weeks. Hold <kbd>Ctrl</kbd> (<kbd>Cmd</kbd>) as you release to copy instead of move. Keep
    dragging past the bottom edge and the grid scrolls to follow, so the destination does not have
    to be on screen when you start.
  </div>

  <div class="flex-1 min-h-0 grid-and-log">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      {moveCells}
      filterMode="none"
      selectionMode="cell"
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
      onCellValueChange={(e) => {
        log = [
          { cell: `row ${e.rowIndex + 1} · ${e.columnId}`, from: show(e.oldValue), to: show(e.newValue) },
          ...log,
        ].slice(0, 40)
      }}
    />

    <aside class="log">
      <div class="log-head">onCellValueChange</div>
      {#if log.length === 0}
        <p class="log-empty">Drop a range to see every write the grid reports.</p>
      {:else}
        <ul>
          {#each log as entry, i (i)}
            <li>
              <span class="log-cell">{entry.cell}</span>
              <span class="log-from">{entry.from}</span>
              <span class="log-arrow">→</span>
              <span class="log-to">{entry.to}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  </div>
</section>

<style>
  .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
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
  .toggle { display: flex; align-items: center; gap: 8px; font-size: 12px;
            color: var(--sg-fg, #0f172a); cursor: pointer; }
  .btn-row { display: flex; gap: 6px; }
  .reset-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .reset-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }

  .caption {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .caption strong { color: var(--sg-accent, #6366f1); }
  .caption kbd {
    border: 1px solid var(--sg-border, #cbd5e1); border-bottom-width: 2px;
    border-radius: 4px; padding: 0 5px; font-size: 11px; font-family: inherit;
    background: var(--sg-bg, #fff);
  }

  .grid-and-log { display: grid; grid-template-columns: 1fr 260px; gap: 10px; min-height: 0; }
  .log {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow: auto;
  }
  .log-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
              color: var(--sg-muted, #64748b); }
  .log-empty { font-size: 12px; color: var(--sg-muted, #64748b); margin: 0; }
  .log ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .log li { display: grid; grid-template-columns: 1fr auto auto auto; gap: 5px;
            align-items: baseline; font-size: 11.5px; }
  .log-cell { color: var(--sg-muted, #64748b); }
  .log-from { color: var(--sg-fg, #0f172a); opacity: 0.6; }
  .log-arrow { color: var(--sg-muted, #94a3b8); }
  .log-to { color: var(--sg-accent, #6366f1); font-weight: 600; }

  @media (max-width: 720px) {
    .kpi-strip { grid-template-columns: repeat(2, 1fr); }
    .grid-and-log { grid-template-columns: 1fr; }
  }
</style>
