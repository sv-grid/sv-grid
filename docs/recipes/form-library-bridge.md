# Form library bridge

> Drive grid edits from a form library - Felte, Superforms, Formsnap,
> or a plain `<form>`. `api.setCellValue` is the single write surface;
> any UI that funnels through it stays consistent with inline editing.

## When

You want the same row to be editable two ways:

- **Inline** via the grid's built-in editors (commit on blur)
- **Drawer / modal** via a form library with its own validation

Both writers must update the SAME underlying data so users can edit
either way and not lose work. Common in admin tools, CRMs, and audit
queues where some fields are best inline (status pill) and others need
a real form (long-text + validation + dependent dropdowns).

## The pattern

```
┌──────────────────┐         setCellValue(idx, field, v)         ┌──────────┐
│  Inline editor   │ ──────────────────────────────────────────► │  data[]  │
└──────────────────┘                                             │  $state  │
                                                                 │          │
┌──────────────────┐         setCellValue(idx, field, v)         │          │
│  Drawer <form>   │ ──────────────────────────────────────────► │          │
└──────────────────┘                                             └──────────┘
```

Same write path. Same dirty tracking (count `onCellValueChange`
events). Whatever lives in `data[]` is the truth.

## Wire-up

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type SvGridApi } from 'sv-grid-community'

  type Employee = { id: string; name: string; email: string; team: 'Eng' | 'Sales' | 'Ops'; salary: number; remote: boolean }
  let employees = $state<Employee[]>([/* ... */])

  const features = tableFeatures({ rowSortingFeature })
  const columns = [
    { field: 'id',     header: 'ID',     editable: false },
    { field: 'name',   header: 'Name',   editorType: 'text' },
    { field: 'email',  header: 'Email',  editorType: 'text' },
    { field: 'team',   header: 'Team',   editorType: 'select',
      editorOptions: ['Eng', 'Sales', 'Ops'].map((v) => ({ value: v })) },
    { field: 'salary', header: 'Salary', editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'remote', header: 'Remote', editorType: 'checkbox' },
  ] as const

  let api = $state<SvGridApi<typeof features, Employee> | null>(null)
  let selectedId = $state<string>('E001')
  const selected = $derived(employees.find((e) => e.id === selectedId) ?? null)

  // Draft state for the drawer form
  type FormDraft = Omit<Employee, 'id'>
  let draft = $state<FormDraft | null>(null)
  let errors = $state<Partial<Record<keyof FormDraft, string>>>({})

  $effect(() => {
    if (selected) draft = { ...selected }
    else          draft = null
    errors = {}
  })

  function validate(d: FormDraft): Partial<Record<keyof FormDraft, string>> {
    const out: Partial<Record<keyof FormDraft, string>> = {}
    if (d.name.trim().length < 2) out.name = 'Name must be at least 2 characters'
    if (!/^\S+@\S+\.\S+$/.test(d.email)) out.email = 'Looks unlike an email'
    if (d.salary < 0 || d.salary > 10_000_000) out.salary = 'Salary out of range'
    return out
  }

  function isDirty(): boolean {
    if (!selected || !draft) return false
    return (Object.keys(draft) as Array<keyof FormDraft>)
      .some((k) => draft![k] !== selected[k])
  }

  function submit() {
    if (!api || !selected || !draft) return
    const e = validate(draft)
    errors = e
    if (Object.keys(e).length > 0) return
    // setCellValue takes a rowIndex (number), not an id.
    // In a real app, memoise this lookup.
    const rowIndex = employees.findIndex((emp) => emp.id === selected.id)
    if (rowIndex < 0) return
    for (const k of Object.keys(draft) as Array<keyof FormDraft>) {
      if (draft[k] !== selected[k]) {
        api.setCellValue(rowIndex, k as string, draft[k] as unknown)
      }
    }
  }

  // Dirty-state count: increment on every cell change from EITHER UI.
  let dirtyCount = $state(0)
  function onCellChanged() { dirtyCount += 1 }
</script>

<SvGrid
  data={employees}
  {columns}
  {features}
  enableInlineEditing
  getRowId={(r) => r.id}
  onApiReady={(a) => (api = a)}
  onCellValueChange={onCellChanged}
/>

{#if draft}
  <form onsubmit={(e) => { e.preventDefault(); submit() }}>
    <label>Name <input type="text" bind:value={draft.name} /></label>
    {#if errors.name}<em>{errors.name}</em>{/if}
    <label>Email <input type="email" bind:value={draft.email} /></label>
    {#if errors.email}<em>{errors.email}</em>{/if}
    <label>Salary <input type="number" bind:value={draft.salary} /></label>
    <button type="submit" disabled={!isDirty()}>Save → setCellValue</button>
  </form>
{/if}
```

## Plugging Felte / Superforms

Same pattern with the library's idiomatic surface:

- **Felte**: bind the form to `draft`; the library handles validation.
  In `onSubmit`, call `api.setCellValue` for each changed key.
- **Superforms**: pass `selected` as the initial form data; on submit,
  the validated `form.data` becomes the source of `setCellValue` calls.
- **Formsnap**: a Superforms shape with built-in field components.
  Same `onSubmit` plumbing.

The library doesn't care which form library renders the inputs - the
contract is just "after validation, call `api.setCellValue` per dirty
field".

## Tracking "dirty" across both UIs

Two valid strategies:

1. **Event count** (shown above) - simplest. Reset to 0 after a save.
2. **Snapshot diff** - keep an initial copy of the data array;
   `JSON.stringify(initial) !== JSON.stringify(api.getData())` is dirty.
   More accurate, more expensive.

Most apps want #1.

## See also

- [Side-drawer edit demo (97)](https://svgrid.com/#/demos/97-side-drawer-edit) - the slide-in pattern used as the form host
- [Submit-time validation recipe](./submit-time-validation.md) - similar bulk-commit-then-validate pattern
- [Undo / redo for grid edits](./undo-redo-edits.md) - layer history on top of the same `setCellValue` calls
- [`SvGridApi.setCellValue`](../reference/SvGridApi.md#setcellvalue)
