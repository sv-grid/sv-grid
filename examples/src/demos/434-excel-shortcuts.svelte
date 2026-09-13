<script lang="ts">
  /**
   * 434. Excel keyboard shortcuts
   * ------------------------------
   * The muscle memory a spreadsheet user arrives with, on a plain <SvGrid>.
   * One call turns it on:
   *
   *   import { enableSheet } from '@svgrid/enterprise'
   *   enableSheet()
   *
   * Navigation
   *   Ctrl+Arrow        jump to the edge of the data region. Not "move a long
   *                     way" - it is a run-boundary search, so from a filled
   *                     cell it runs to the last filled cell before the next
   *                     blank, and from the edge of a block it hops the gap to
   *                     the next block. Leave a gap in a column and try it
   *                     both ways.
   *   Ctrl+Shift+Arrow  the same jump, extending the selection.
   *   Ctrl+A            select the current region; press it again to take the
   *                     whole sheet.
   *   Ctrl+Space        select the column.   Shift+Space  select the row.
   *
   * Fill and entry
   *   Ctrl+D            fill down. With a range selected it copies the top row
   *                     into the rest; with one cell it pulls from the cell
   *                     above, which is what makes it useful while typing.
   *   Ctrl+R            fill right, same two behaviours.
   *   Ctrl+;            stamp today's date.  Ctrl+Shift+;  stamp the time.
   *   Ctrl+'            copy the cell above VERBATIM. When the formula engine
   *                     lands this is how you get an unshifted copy to edit.
   *   Ctrl+Z            one press per action, not per cell - a fill down 30
   *                     rows walks back in one.
   *
   * The grid still owns Ctrl+C / X / V, Ctrl+F and the arrow keys. A command
   * only takes a key when it has something to do: Ctrl+D on the top row with
   * nothing above it declines, and the key falls through.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
  } from '@svgrid/grid'
  import { enableSheet } from '@svgrid/enterprise'

  enableSheet()

  type Row = {
    id: number
    task: string
    owner: string
    q1: number | null
    q2: number | null
    q3: number | null
    q4: number | null
    due: string
  }

  // Deliberately gappy. A dense block would make Ctrl+Arrow look like
  // Ctrl+Home, and the run-boundary behaviour is the whole point.
  const SEED: Array<[string, string, Array<number | null>]> = [
    ['Design review', 'Ada', [12, 14, null, null]],
    ['Prototype', 'Ada', [8, 11, 9, null]],
    ['User testing', 'Lin', [null, 6, 7, 5]],
    ['', '', [null, null, null, null]],
    ['Rollout plan', 'Kai', [4, 4, null, null]],
    ['Migration', 'Kai', [9, 12, 15, null]],
    ['', '', [null, null, null, null]],
    ['Docs', 'Lin', [3, null, null, null]],
    ['Training', 'Ada', [null, null, 6, 8]],
  ]

  const start = (): Row[] =>
    SEED.map(([task, owner, q], i) => ({
      id: i + 1,
      task,
      owner,
      q1: q[0] ?? null,
      q2: q[1] ?? null,
      q3: q[2] ?? null,
      q4: q[3] ?? null,
      due: '',
    }))

  let rows = $state<Row[]>(start())

  const features = tableFeatures({ rowSortingFeature })

  const columns: GridColumns<Row> = [
    { id: 'task', field: 'task', header: 'Task', width: 180 },
    { id: 'owner', field: 'owner', header: 'Owner', width: 100 },
    { id: 'q1', field: 'q1', header: 'Q1', width: 80, editorType: 'number' },
    { id: 'q2', field: 'q2', header: 'Q2', width: 80, editorType: 'number' },
    { id: 'q3', field: 'q3', header: 'Q3', width: 80, editorType: 'number' },
    { id: 'q4', field: 'q4', header: 'Q4', width: 80, editorType: 'number' },
    { id: 'due', field: 'due', header: 'Due', width: 130 },
  ]

  const CHEATSHEET: Array<[string, string]> = [
    ['Ctrl + Arrow', 'Jump to the edge of the data region'],
    ['Ctrl + Shift + Arrow', 'Extend the selection to that edge'],
    ['Ctrl + A', 'Select the current region, then the sheet'],
    ['Ctrl + Space', 'Select the column'],
    ['Shift + Space', 'Select the row'],
    ['Ctrl + D', 'Fill down'],
    ['Ctrl + R', 'Fill right'],
    ['Ctrl + ;', "Stamp today's date"],
    ['Ctrl + Shift + ;', 'Stamp the current time'],
    ["Ctrl + '", 'Copy the cell above, unchanged'],
    ['Ctrl + Z', 'Undo the whole action, not one cell'],
  ]
</script>

<section class="wrap">
  <div class="grid">
    <SvGrid
      data={rows}
      {columns}
      {features}
      selectionMode="cell"
      enableCellSelection={true}
      enableInlineEditing={true}
      statusBar={true}
      filterMode="none"
      containerHeight={380}
    />
  </div>

  <aside class="keys">
    <h3>Try these</h3>
    <dl>
      {#each CHEATSHEET as [combo, what] (combo)}
        <div class="row">
          <dt><kbd>{combo}</kbd></dt>
          <dd>{what}</dd>
        </div>
      {/each}
    </dl>
    <p class="note">
      Click a cell in Q1 first. The blank rows are there on purpose: Ctrl+Down
      runs to the bottom of a block, then hops the gap on the next press.
    </p>
    <button type="button" onclick={() => (rows = start())}>Reset the data</button>
  </aside>
</section>

<style>
  .wrap {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .grid {
    flex: 1 1 480px;
    min-width: 0;
  }
  .keys {
    flex: 0 1 300px;
    min-width: 0;
    font-size: 13px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-color-muted, #64748b);
  }
  dl {
    margin: 0;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 3px 0;
    border-bottom: 1px solid var(--sg-color-border, #e2e8f0);
  }
  dt {
    flex: 0 0 auto;
  }
  dd {
    margin: 0;
    color: var(--sg-color-muted, #64748b);
  }
  kbd {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    white-space: nowrap;
  }
  .note {
    color: var(--sg-color-muted, #64748b);
    line-height: 1.5;
  }
  button {
    margin-top: 4px;
    font: inherit;
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid var(--sg-color-border, #cbd5e1);
    background: var(--sg-color-surface, #fff);
    cursor: pointer;
  }
</style>
