# Submit-time validation with error summary

Different from per-keystroke validation. The user edits freely; on
**Submit**, a row-level validator runs and highlights every invalid
cell with an aria-live summary panel.

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 130, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 80,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<script lang="ts">
  type Lead = { id: string; company: string; email: string; phone: string }
  type Issue = { rowId: string; field: keyof Lead; message: string }
  let rows = $state<Lead[]>([...])
  let errors = $state<Issue[]>([])
  let submitted = $state<string | null>(null)

  function validate(r: Lead): Issue[] {
    const out: Issue[] = []
    if (!r.company.trim())                                     out.push({ rowId: r.id, field: 'company', message: 'Required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))           out.push({ rowId: r.id, field: 'email',   message: 'Malformed' })
    if (r.phone.replace(/\D/g, '').length < 7)                 out.push({ rowId: r.id, field: 'phone',   message: '7+ digits' })
    return out
  }

  function submit() {
    errors = rows.flatMap(validate)
    if (errors.length === 0) submitted = `Submitted ${rows.length} leads`
  }

  const errorsByRow = $derived(() => {
    const m = new Map<string, Set<string>>()
    for (const e of errors) {
      if (!m.has(e.rowId)) m.set(e.rowId, new Set())
      m.get(e.rowId)!.add(e.field as string)
    }
    return m
  })

  // `cellClass` is a COLUMN key - there is no grid-wide version - so the
  // highlight is mapped onto every column.
  const highlight = (ctx) =>
    errorsByRow().get(ctx.row.original.id)?.has(ctx.column.id) ? 'cell-invalid' : ''

  const columns = $derived(
    ['company', 'email', 'phone'].map((field) => ({
      field,
      header: field[0].toUpperCase() + field.slice(1),
      editable: true,
      cellClass: highlight,
    })),
  )
</script>

<button onclick={submit}>Submit</button>

{#if errors.length > 0}
  <div role="alert" aria-live="polite">
    <p>Fix {errors.length} issue{errors.length === 1 ? '' : 's'}:</p>
    <ul>{#each errors as e (`${e.rowId}-${e.field}`)}<li><code>{e.rowId}</code> · <strong>{e.field}</strong>: {e.message}</li>{/each}</ul>
  </div>
{/if}

<SvGrid {data} {columns} {features} />
```

```css
:global(td.cell-invalid) {
  background: rgba(244, 63, 94, 0.12);
  box-shadow: inset 0 0 0 1px #f43f5e;
}
```

Live in [demo 71 (Submit-time validation)](https://svgrid.com/demos/71-submit-validation/).

## Try it

The user edits freely; nothing complains until Submit. A `rule` conditional
format paints the offending cells, so the highlight is driven by the same
predicate as the summary rather than a second copy of it.

```svelte {runnable}
<script lang="ts">
  import type { ConditionalFormat } from '@svgrid/grid'

  let submitted = $state(false)

  const invalid = (p: Person) => p.age < 18 || p.age > 70

  const problems = $derived(submitted ? rows.filter(invalid) : [])

  const formats = $derived<ConditionalFormat<Person>[]>(
    submitted
      ? [{ type: 'rule', columns: ['age'], when: (ctx) => invalid(ctx.row), background: '#fee2e2', color: '#991b1b' }]
      : [],
  )
</script>

<button type="button" onclick={() => (submitted = true)}>Submit</button>

<SvGrid data={rows} {columns} editable conditionalFormats={formats} />

{#if submitted}
  <p aria-live="polite">
    {problems.length === 0
      ? 'All rows valid.'
      : problems.length + ' row(s) need an age between 18 and 70.'}
  </p>
{/if}
```

## See also

- [Validation while editing](../help/editing/validation.md) - per-keystroke variant
- [Demo 24 (Validation)](https://svgrid.com/demos/24-validation/) - rejecting bad values inline
