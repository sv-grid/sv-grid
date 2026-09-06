<script lang="ts">
  /**
   * Mirrors examples/react/editing/App.tsx.
   *
   * `cellvaluechange` fires once per committed edit. The React version writes
   * the change back with setState; here it is an assignment, but the event and
   * its detail are identical.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns, type Person } from '../data'

  type CellChange = { rowIndex: number; columnId: string; newValue: unknown }

  let rows = $state<Person[]>(people)
  let log = $state<string[]>([])

  const editableColumns = columns.map((c) =>
    c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c,
  )
</script>

<div class="mirror">
  <p class="mirror-note">
    Double-click a Name or Amount cell. Last edits: {log.slice(-3).join(' · ') || 'none yet'}
  </p>
  <div class="mirror-grid">
    <GridBody
      emit={(name: string, detail: unknown) => {
        if (name !== 'cellvaluechange') return
        const e = detail as CellChange
        rows = rows.map((row, i) => (i === e.rowIndex ? { ...row, [e.columnId]: e.newValue } : row))
        log = [...log, `${e.columnId} = ${String(e.newValue)}`]
      }}
      data={rows}
      columns={editableColumns}
      sortable
      filterable
      editable
    />
  </div>
</div>

<style>
  .mirror {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    /* min-width, not just min-height: this is a flex item, and a flex item's
       automatic minimum size is its MIN-CONTENT width, which for a grid is the
       sum of its column widths. Without this it can never be laid out narrower
       than its widest possible self. */
    min-width: 0;
  }
  .mirror-note {
    margin: 0;
    font-size: 13px;
    color: var(--sg-muted);
  }
  .mirror-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
