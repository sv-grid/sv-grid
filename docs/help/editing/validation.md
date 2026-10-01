# Validation

A column's `validate` hook flags a bad value: the cell turns red and the
message becomes its tooltip. On its own it does not refuse anything, so
a form can be filled in any order and fixed afterwards; `rejectInvalid`
on the same column turns the flag into a refusal, and an edit the rule
fails against is never written. Rules that need more than one row, or
that should be logged, run in `onCellValueChange` instead.

## Flag with `validate`

`validate` runs for every rendered cell, not only on edit, so bad data
already in the source is red on load, and it re-runs as the user types.
It receives `{ value, row, rowIndex, column }` and returns `null`,
`undefined` or `true` for a valid value, `false` for invalid without a
message, or a string that becomes the tooltip. Salary, email and age
below each carry a rule; try a salary of 500 or an age of 12.

<div data-docs-demo="206-cell-validation" data-height="460"></div>

```svelte
const columns: GridColumns<Person> = [
  { field: 'salary', header: 'Salary', editorType: 'number',
    validate: ({ value }) => (Number(value) < 1000 ? 'Salary must be at least $1,000' : null) },
  { field: 'email', header: 'Email', editorType: 'text',
    validate: ({ value }) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : 'Not a valid email address') },
]
```

A rule can read the row, so a column can be checked against another:
`({ value, row }) => (value > row.budget ? 'Over budget' : null)`.

## Refuse with `rejectInvalid`

`rejectInvalid: true` makes the same rule a veto. The value is checked
after `valueParser` has run, so the rule sees what would be stored; when
it fails, the editor closes, the cell keeps its old value, no undo step
is recorded and `onCellValueChange` does not fire. The red highlight
still shows while the value is typed, so the user sees why before Enter
puts the old value back. Type an age of 200 or an email without an
at-sign:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; email: string; age: number }

  let rows = $state<Person[]>([
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   age: 36 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', age: 45 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', age: 54 },
  ])

  const columns: GridColumns<Person> = [
    { field: 'name',  header: 'Name',  width: 170, editorType: 'text' },
    { field: 'email', header: 'Email', width: 210, editorType: 'text', rejectInvalid: true,
      validate: ({ value }) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : 'That is not an email address') },
    { field: 'age',   header: 'Age',   width: 90,  editorType: 'number', rejectInvalid: true,
      validate: ({ value }) => (Number(value) < 16 || Number(value) > 100 ? 'Age must be between 16 and 100' : null) },
  ]
</script>

<SvGrid data={rows} {columns} editable containerHeight={200} />
```

The inline editor, a commit to a selected range and a full-row edit all
go through the check. Paste does not open an editor and is not checked;
a pasted block that must be clean is checked in `onCellValueChange`, as
below.

## Built-in soft validation

`parseEditorValue` already does light validation before either hook runs:

- `number`: rejects non-finite results and stores `null`
- `date` / `datetime`: rejects unparseable strings and stores `null`

The cell goes blank rather than red. A `validate` rule that treats `null`
as invalid turns that into a message.

## Rules over the whole row, and a log of rejections

When the rule needs to see the row after the edit, or the app wants a
record of what was refused, check the committed value in
`onCellValueChange` and put the old one back. The event carries the row
object, so the revert is one assignment. Try an age of 200 or an email
without an at-sign:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; email: string; age: number }

  let rows = $state<Person[]>([
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   age: 36 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', age: 45 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', age: 54 },
  ])
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
    (e.row as Record<string, unknown>)[e.columnId] = e.oldValue
    rejected = [problem, ...rejected].slice(0, 4)
  }}
/>

<ul>
  {#each rejected as r}<li>{r}</li>{/each}
</ul>
```

The same pattern with a rollback through `api.setCellValue`, a red flash
and a "Recent rejections" panel:

<div data-docs-demo="24-validation" data-height="500"></div>

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

<!-- tutorial:learn-4-editing -->
<figure class="docs-tutorial" id="tutorial-learn-4-editing" data-docs-tutorial="learn-4-editing">
<video class="docs-tutorial-video" src="/tutorials/learn-4-editing.mp4" poster="/tutorials/learn-4-editing.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Learn SvGrid 4: editing rows, and validating them, 91 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/learn-4-editing.vtt" default>Your browser does not play embedded video. <a href="/tutorials/learn-4-editing.mp4">Download the MP4</a>.</video>
<figcaption><strong>Learn SvGrid 4: editing rows, and validating them</strong> (91 s, silent). <a href="https://www.youtube.com/watch?v=4CMH4FKGZB4" rel="noopener">Watch with narration on YouTube</a></figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>A table people can only read is half a feature. This lesson makes it editable, and then makes it refuse the edits that should not happen.</p>
<p>The same reactive rows as before. Three people, three fields.</p>
<p>Each column picks its editor. Text for a name, number for an age. The editor is chosen per column, so the user gets the right control instead of a text box for everything.</p>
<p>Then validate. It runs as the cell is edited and returns a message when the value is wrong. Pair it with rejectInvalid and the edit is refused outright rather than written and cleaned up later.</p>
<p>Double-click a cell to edit it, type, and press Enter to commit. That is the whole gesture, and it is the one spreadsheet users already know.</p>
<p>Now an email that is not one. Validate runs as you type, and hovering the cell tells the user what is wrong. Press Enter and rejectInvalid refuses the commit outright: the value is still the old one. Your row object is never touched by something you would have to clean up later.</p>
<p>Undo with control zed, save in batches through the grid API, or hand every commit to your server. The editing pages in the docs cover each of those. Lesson five is selection, and doing something with the rows the user picked.</p>
<p>The file is on the page below and you can edit it there too. See you in lesson five.</p>
</details>
</figure>
<!-- /tutorial:learn-4-editing -->

## See also

- [Parsing values](./parsing-values.md)
- [Saving values](./saving-values.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
