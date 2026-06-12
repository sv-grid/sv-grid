# Full-row editing

"Full-row editing" means the user opens an entire row for edit (every
editable cell becomes an editor simultaneously) and commits all changes
at once.
<div data-docs-demo="40-forms-master-detail" data-height="540"></div>

## Status

This is **not** built in. SvGrid edits one cell at a time.

## Workaround - overlay form

Trigger an edit form from a row action and write changes back via
`api.setCellValue` for each field:

```svelte
<script lang="ts">
  let editing = $state<Person | null>(null)

  function commit(updated: Person) {
    if (!api || !editing) return
    const idx = api.getData().findIndex((r) => r.id === editing!.id)
    if (idx === -1) return
    for (const key of Object.keys(updated) as Array<keyof Person>) {
      api.setCellValue(idx, key, updated[key])
    }
    editing = null
  }
</script>

{#if editing}
  <dialog open>
    <!-- a regular form bound to a copy of `editing` -->
  </dialog>
{/if}

<SvGrid {data} {columns} features={features}
  enableInlineEditing={false}
  onApiReady={(next) => (api = next)} />
```

This is often *better UX* than full-row editing for keyboard-heavy users -
the form can have proper field labels and a save button.

## Tracked at

[Missing features](../missing-features.md) - full-row editing as a built-
in mode.

## See also

- [Provided editors](./provided-editors.md)
- [Saving values](./saving-values.md)
