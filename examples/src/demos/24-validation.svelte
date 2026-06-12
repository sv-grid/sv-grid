<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 24. Validation while editing
   * ----------------------------
   * Per-column validators that run on every commit. Invalid edits are
   * rolled back via api.setCellValue(rowIndex, columnId, oldValue), the
   * cell flashes red briefly, and the rejection is logged in the
   * "Recent rejections" panel.
   *
   * SvGrid v1.0 does not yet have a per-column `validate()` hook (it's on
   * the missing-features list). The pattern below - validate in
   * onCellValueChange + roll back via setCellValue - is the production
   * workaround. The same shape will adapt cleanly when the built-in hook
   * lands.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  let rows = $state<Person[]>(makePeople(60))
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  type Rejection = { ts: number; row: number; field: string; tried: string; reason: string }
  let rejections = $state<Rejection[]>([])
  // Monotonic counter for the keyed each below - Date.now() collides
  // when multiple bad commits land in the same tick.
  let rejectionSeq = 0

  // Persistent invalid-cell markers. Keyed by `${rowIndex}:${columnId}`; the
  // value is the most recent rejection reason for that cell. A red overlay
  // styles every cell whose key is present. An entry clears in two cases:
  //   - the user successfully commits a valid value to the same cell, or
  //   - the user clicks the "Clear invalid marks" button.
  // Toast still flashes briefly so the user sees the rejection happen.
  let invalidCells = $state<Record<string, string>>({})
  let toastReason = $state<string | null>(null)

  type Validator = (value: unknown, row: Person) => string | null

  // YYYY-MM-DD for today, in the user's local timezone. Used as the upper
  // bound for the joinedAt validator. Local-time pieces avoid the
  // "ISO-UTC-rolled-the-day-over" gotcha that bites in any non-UTC zone.
  function localDateOnly(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const today = localDateOnly(new Date())

  // Per-column rules. Return null when valid, a short message when not.
  const validators: Partial<Record<keyof Person, Validator>> = {
    firstName: (v) => (typeof v === 'string' && v.trim().length >= 1
      ? null : 'First name is required'),
    lastName: (v) => (typeof v === 'string' && v.trim().length >= 1
      ? null : 'Last name is required'),
    email: (v) => {
      if (typeof v !== 'string') return 'Email must be text'
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Not a valid email address'
    },
    age: (v) => {
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Age must be a whole number'
      if (n < 18) return 'Minimum age is 18'
      if (n > 99) return 'Maximum age is 99'
      return null
    },
    salary: (v) => {
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n)) return 'Salary must be a number'
      if (n < 0) return 'Salary cannot be negative'
      if (n > 1_000_000) return 'Salary cannot exceed $1,000,000'
      return null
    },
    joinedAt: (v) => {
      // SvGrid's date editor (`editorType: 'date'`) commits the value via
      // parseEditorValue('date', input), which returns a full ISO string
      // ("2024-06-15T00:00:00.000Z"), NOT YYYY-MM-DD. So we parse with
      // `new Date()`, accept anything that yields a real timestamp, then
      // compare on the local-date portion to "today" so a picker click on
      // today's date isn't mis-flagged as future.
      if (v == null || v === '') return 'Joined date is required'
      const d = new Date(String(v))
      if (Number.isNaN(d.getTime())) return 'Not a valid date'
      if (localDateOnly(d) > today) return 'Cannot be in the future'
      return null
    },
  }

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name *', editorType: 'text', width: 130 },
    { field: 'lastName',  header: 'Last name *',  editorType: 'text', width: 130 },
    { field: 'email',     header: 'Email (must be valid)', editorType: 'text', width: 230 },
    { field: 'age',       header: 'Age (18–99)',  editorType: 'number', width: 110 },
    { field: 'salary',    header: 'Salary ($0–$1M)', editorType: 'number', width: 140,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'joinedAt',  header: 'Joined (past dates only)', editorType: 'date', width: 200,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'department', header: 'Department (no validation)', editorType: 'text', width: 180 },
  ]

  function onCellValueChange(e: {
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
    row: Person
  }) {
    const cellKey = `${e.rowIndex}:${e.columnId}`
    const rule = validators[e.columnId as keyof Person]

    if (rule) {
      const error = rule(e.newValue, e.row)
      if (error) {
        // ---- Reject: mark the cell, log the rejection, roll the value
        // back. The red marker now persists until the user successfully
        // overwrites the cell or dismisses the marks.
        rejectionSeq += 1
        rejections = [
          { ts: rejectionSeq, row: e.rowIndex + 1, field: e.columnId, tried: String(e.newValue), reason: error },
          ...rejections,
        ].slice(0, 8)
        invalidCells = { ...invalidCells, [cellKey]: error }
        toastReason = error
        setTimeout(() => {
          if (toastReason === error) toastReason = null
        }, 2400)

        // Defer to next tick so the grid finishes its commit cycle before
        // we overwrite the value - avoids any in-flight render race.
        queueMicrotask(() => api?.setCellValue(e.rowIndex, e.columnId, e.oldValue))
        return
      }
    }

    // ---- Valid commit. If this cell previously had an invalid attempt,
    // clear its mark - the user has now committed a valid replacement.
    if (invalidCells[cellKey]) {
      const next = { ...invalidCells }
      delete next[cellKey]
      invalidCells = next
    }
  }

  function clearRejections() {
    rejections = []
  }
  function clearInvalidMarks() {
    invalidCells = {}
  }

  /** Number of cells currently displaying the invalid marker. */
  const invalidCount = $derived(Object.keys(invalidCells).length)

  // SvGrid's component CSS is loaded with its own scope - we can't
  // bind:class on cells from outside. So we inject a stylesheet node that
  // emits one selector per currently-invalid cell, keyed by the cell's
  // data-svgrid-row + data-col-id attributes. Rebuilt whenever
  // `invalidCells` changes; removed entirely when the map empties.
  // Scoped to .sv-validation-demo so the selector is harmless if SvGrid
  // is mounted elsewhere on the same page.
  $effect(() => {
    const keys = Object.keys(invalidCells)
    if (keys.length === 0) return
    const styleEl = document.createElement('style')
    const rules = keys
      .map((k) => {
        const [rowIndex, columnId] = k.split(':')
        if (!rowIndex || !columnId) return ''
        const selector =
          `.sv-validation-demo .sv-grid-cell[data-svgrid-row="${rowIndex}"]` +
          `[data-col-id="${CSS.escape(columnId)}"]`
        return `${selector} {\n` +
          `  background-color: rgba(220, 38, 38, 0.28) !important;\n` +
          `  box-shadow: inset 0 0 0 2px rgba(248, 113, 113, 0.78) !important;\n` +
          `  color: #fee2e2;\n` +
          `}`
      })
      .filter(Boolean)
      .join('\n')
    styleEl.textContent = rules
    document.head.appendChild(styleEl)
    return () => styleEl.remove()
  })
</script>

<section class="sv-validation-demo flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 shrink-0">
    <p class="text-sm flex-1" style="color: var(--sg-fg);">
      Double-click any cell (or press <kbd>F2</kbd>) to edit. Try an invalid value -
      blank name, malformed email, age 200, future date - the commit is rolled back
      and the cell stays <span style="color: #f87171; font-weight: 600;">red</span>
      until you commit a valid value or dismiss the mark.
    </p>
    {#if invalidCount > 0}
      <button
        type="button"
        class="rej-clear-invalid"
        onclick={clearInvalidMarks}
        aria-label="Clear all invalid markers"
      >
        Clear {invalidCount} invalid mark{invalidCount === 1 ? '' : 's'}
      </button>
    {/if}
  </div>

  <!-- Recent rejections panel - tiny audit log so reviewers see validation
       running across many edits. -->
  <div
    class="shrink-0 rounded-lg border"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <div class="flex items-center justify-between px-3 py-2 border-b"
      style="border-color: var(--sg-border);">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Recent rejections {#if rejections.length}({rejections.length}){/if}
      </p>
      {#if rejections.length}
        <button type="button" class="rej-clear" onclick={clearRejections}>Clear log</button>
      {/if}
    </div>
    <div class="max-h-28 overflow-y-auto px-3 py-2">
      {#if rejections.length === 0}
        <p class="text-xs italic" style="color: var(--sg-muted);">
          No rejected commits yet - every edit so far has passed validation.
        </p>
      {:else}
        <ul class="space-y-1">
          {#each rejections as r (r.ts)}
            <li class="text-xs flex flex-wrap gap-x-2" style="color: var(--sg-fg);">
              <span style="color: #f87171; font-weight: 600;">row {r.row}</span>
              <span style="color: var(--sg-muted);">·</span>
              <code style="color: var(--site-accent-2, #22d3ee);">{r.field}</code>
              <span style="color: var(--sg-muted);">=</span>
              <code style="color: var(--sg-fg);">"{r.tried}"</code>
              <span style="color: var(--sg-muted);">→</span>
              <span>{r.reason}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="flex-1 min-h-0 relative">
    {#if toastReason}
      <!-- Transient toast - fires on the latest rejection then fades after
           ~2.4s. The persistent red cell marker stays until the user
           overwrites or dismisses. -->
      <div
        class="absolute top-2 right-3 z-10 text-xs px-3 py-2 rounded-md shadow-lg flex items-center gap-2"
        style="background: #7f1d1d; color: #fee2e2; border: 1px solid rgba(248,113,113,0.6);"
        role="alert"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {toastReason}
      </div>
    {/if}
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      showRowNumbers={true}
      showPagination={true}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onCellValueChange={onCellValueChange}
    />
  </div>
</section>

<style>
  .rej-clear {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .rej-clear:hover {
    color: var(--sg-fg);
    background: var(--sg-row-hover-bg);
  }

  /* Sticky "dismiss invalid marks" pill - visible only while at least one
   * cell carries the persistent red marker. Red enough to read as
   * destructive, but not as loud as the cell highlighting itself. */
  .rej-clear-invalid {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fee2e2;
    background: #7f1d1d;
    border: 1px solid rgba(248, 113, 113, 0.55);
    cursor: pointer;
    transition: filter 100ms ease;
  }
  .rej-clear-invalid:hover {
    filter: brightness(1.12);
  }
</style>
