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

## See also

- [Parsing values](./parsing-values.md)
- [Saving values](./saving-values.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
