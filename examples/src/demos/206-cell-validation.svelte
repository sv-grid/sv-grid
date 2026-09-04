<script lang="ts">
  /**
   * 206. Cell validation (declarative `validate` hook)
   * --------------------------------------------------
   * Handsontable-style per-cell validation, built in. Each column gets a
   * `validate(params) => message | true` function. The grid runs it for
   * EVERY rendered cell - including values that are already in the data on
   * load - and paints invalid cells red with the message as a tooltip.
   *
   * Unlike a commit-time validator, this flags bad data the moment the grid
   * mounts (rows 3 and 6 below arrive invalid) and re-checks live as you
   * edit: fix the value and the red clears; break a good one and it lights
   * up. The value is never rolled back - what you see is what's stored.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    salary: number
    email: string
    age: number
  }

  // Two rows (3 and 6) intentionally carry bad data so the highlight shows
  // on load - not just after an edit.
  let data = $state<Person[]>([
    { id: 1, name: 'John Smith',      salary:  85_000, email: 'john@example.com',  age:  35 },
    { id: 2, name: 'Sarah Johnson',   salary:  72_000, email: 'sarah@example.com', age:  28 },
    { id: 3, name: 'Carlos Garcia',   salary:  -5_000, email: 'invalid-email',     age: 150 },
    { id: 4, name: 'Yuki Tanaka',     salary:  92_000, email: 'yuki@example.com',  age:  42 },
    { id: 5, name: 'Emma Wilson',     salary:  78_000, email: 'emma@example.com',  age:  31 },
    { id: 6, name: 'Bad Data',        salary: 999_999, email: 'not-an-email',      age:  -5 },
    { id: 7, name: 'Maria Rodriguez', salary:  67_000, email: 'maria@example.com', age:  26 },
    { id: 8, name: 'James Brown',     salary:  73_000, email: 'james@example.com', age:  39 },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Validators return a message string when invalid, or `true` when valid.
  const validateSalary = (v: unknown): string | true => {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return 'Salary must be a number'
    if (n < 1_000) return 'Salary must be at least $1,000'
    if (n > 200_000) return 'Salary cannot exceed $200,000'
    return true
  }
  const validateEmail = (v: unknown): string | true =>
    typeof v === 'string' && EMAIL_RE.test(v) ? true : 'Not a valid email address'
  const validateAge = (v: unknown): string | true => {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Age must be a whole number'
    if (n < 18) return 'Age must be 18 or older'
    if (n > 99) return 'Age must be 99 or younger'
    return true
  }

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'name', header: 'Name', width: 180, editorType: 'text' },
    {
      field: 'salary', header: 'Salary (1-200k)', width: 170, editorType: 'number',
      align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
      validate: ({ value }) => validateSalary(value),
    },
    {
      field: 'email', header: 'Email', width: 230, editorType: 'text',
      validate: ({ value }) => validateEmail(value),
    },
    {
      field: 'age', header: 'Age (18-99)', width: 130, editorType: 'number', align: 'right',
      validate: ({ value }) => validateAge(value),
    },
  ]

  // Live count of invalid cells, computed from the same rules the grid uses,
  // so the summary badge tracks edits in real time.
  const invalidCount = $derived(
    data.reduce((sum, r) => {
      let n = 0
      if (validateSalary(r.salary) !== true) n += 1
      if (validateEmail(r.email) !== true) n += 1
      if (validateAge(r.age) !== true) n += 1
      return sum + n
    }, 0),
  )
</script>

<section class="cv-shell">
  <header class="cv-head">
    <h1 class="cv-title">Cell validation</h1>
    <p class="cv-sub">
      Each column declares a <code>validate()</code> hook. Invalid cells are
      highlighted <span class="cv-red">red</span> on load - not just after an
      edit - with the reason as a tooltip. Double-click any cell to edit and
      watch the highlight update live.
    </p>
  </header>

  <div class="cv-status" class:is-clean={invalidCount === 0} role="status">
    {#if invalidCount === 0}
      <span class="cv-dot cv-dot-ok" aria-hidden="true"></span>
      All cells valid
    {:else}
      <span class="cv-dot cv-dot-bad" aria-hidden="true"></span>
      {invalidCount} invalid cell{invalidCount === 1 ? '' : 's'} - hover a red cell to see why
    {/if}
  </div>

  <div class="cv-grid-wrap">
    <SvGrid responsive={true}
      columnResize
      data={data}
      columns={columns}
      features={features}
      selectionMode="cell"
      showRowNumbers={true}
      rowNumberWidth={48}
      enableInlineEditing={true}
      enableRowHover={false}
      enableCellSelection={true}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .cv-shell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    color: var(--sg-fg, #0f172a);
  }
  .cv-head { flex-shrink: 0; }
  .cv-title { margin: 0 0 2px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
  .cv-sub { margin: 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 70ch; }
  .cv-sub code {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11.5px;
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 5px;
    border-radius: 4px;
  }
  .cv-red { color: #ef4444; font-weight: 600; }

  .cv-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    background: color-mix(in srgb, #ef4444 10%, transparent);
    color: #b91c1c;
    border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
    flex-shrink: 0;
  }
  .cv-status.is-clean {
    background: color-mix(in srgb, #10b981 10%, transparent);
    color: #047857;
    border-color: color-mix(in srgb, #10b981 30%, transparent);
  }
  .cv-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .cv-dot-ok { background: #10b981; }
  .cv-dot-bad { background: #ef4444; }

  .cv-grid-wrap {
    flex: 1;
    min-height: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0);
  }
</style>
