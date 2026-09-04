# Validation

There is no `validate(value)` callback on `ColumnDef` today. Validation
happens by intercepting committed edits and either accepting or reverting
them.

Live demo - per-column rules with rollback + a recent-rejections panel:

<div data-docs-demo="24-validation" data-height="500"></div>

## Built-in soft validation

`parseEditorValue` already does light validation:

- `number`: rejects non-finite results → returns `null`
- `date` / `datetime`: rejects unparseable strings → returns `null`

The grid writes `null` into the cell when this happens. That is "soft"
validation - the user sees the cell go blank rather than seeing their
input rejected with an explanation.

## Hard validation (reject + revert)

To bounce the user back to the previous value with an explanation,
maintain your own snapshot and revert after the commit:

```svelte
<script lang="ts">
  let api: SvGridApi<typeof features, Person> | null = $state(null)
  let initial = $state<Person[]>([])
  let error = $state<{ row: number; col: string; msg: string } | null>(null)

  function validateRow(row: Person): string | null {
    if (row.age < 0 || row.age > 130) return 'Age must be between 0 and 130.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return 'Invalid email.'
    return null
  }

  $effect(() => {
    if (!api) return
    const snap = api.getData()
    for (let i = 0; i < snap.length; i++) {
      const msg = validateRow(snap[i]!)
      if (msg) {
        // revert by writing back the original
        const original = initial[i]
        if (original) {
          for (const key of Object.keys(original) as Array<keyof Person>) {
            if ((snap[i] as any)[key] !== (original as any)[key]) {
              api!.setCellValue(i, key as string, (original as any)[key])
            }
          }
        }
        error = { row: i, col: '*', msg }
        return
      }
    }
    error = null
    initial = snap.map((r) => ({ ...r }))
  })
</script>

{#if error}
  <p class="text-rose-600">Row {error.row + 1}: {error.msg}</p>
{/if}

<SvGrid {data} {columns} features={features} enableInlineEditing
  onApiReady={(next) => (api = next)} />
```

This polling-based validator works but has obvious limits:

- The validator runs on every reactive tick, not strictly on commit.
- The user briefly sees the invalid value before it reverts.

A per-column `validate(value, row, column)` returning `string | true` is
on the [gap list](../missing-features.md).

## Inline error UI

Render an asterisk / red border via a custom cell renderer that reads
your validation state map. See [Highlighting changes](../cells/highlighting-changes.md)
for the same pattern with a "dirty" indicator - substitute "invalid" for
"dirty".

## Reverting a bad edit

There is no `validate` hook on a column, so validation happens where the edit
lands: check the committed value and put the old one back if it fails. Try an
age of 200 or an email without an at-sign.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))
  let rejected = $state<string[]>([])

  function check(row: Person): string | null {
    if (row.age < 16 || row.age > 100) return 'Age must be between 16 and 100'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return 'That is not an email address'
    return null
  }

  const columns: GridColumns<Person> = [
    { field: 'name',  header: 'Name',  width: 170, editorType: 'text' },
    { field: 'email', header: 'Email', width: 210, editorType: 'text' },
    { field: 'age',   header: 'Age',   width: 90,  editorType: 'number' },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  editable
  onCellValueChange={(e) => {
    const problem = check(e.row)
    if (!problem) return
    // Put it back. The event carries the row object, so this is one assignment.
    (e.row as Record<string, unknown>)[e.columnId] = e.oldValue
    rejected = [problem, ...rejected].slice(0, 4)
  }}
/>

<ul>
  {#each rejected as r}<li>{r}</li>{/each}
</ul>
```

## Marking the row instead of reverting

Reverting is right when the value is unusable. When it is merely wrong,
keeping it and marking the row lets someone fix a form in the order they want
rather than the order the grid demands.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  import type { ConditionalFormat } from '@svgrid/grid'

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))

  const bad = (p: Person) => p.age < 16 || p.age > 100

  const problems = $derived(rows.filter(bad).length)

  const formats = $derived<ConditionalFormat<Person>[]>([
    { type: 'rule', columns: ['age'], when: (ctx) => bad(ctx.row),
      background: '#fee2e2', color: '#991b1b' },
  ])

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180, editorType: 'text' },
    { field: 'age',  header: 'Age',  width: 100, editorType: 'number' },
  ]
</script>

<SvGrid data={rows} {columns} editable conditionalFormats={formats} />

<p aria-live="polite">{problems === 0 ? 'All ages valid.' : problems + ' row(s) out of range.'}</p>
```

## See also

- [Parsing values](./parsing-values.md)
- [Saving values](./saving-values.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
