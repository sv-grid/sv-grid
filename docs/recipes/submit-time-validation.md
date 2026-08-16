# Submit-time validation with error summary

Different from per-keystroke validation. The user edits freely; on
**Submit**, a row-level validator runs and highlights every invalid
cell with an aria-live summary panel.

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
</script>

<button onclick={submit}>Submit</button>

{#if errors.length > 0}
  <div role="alert" aria-live="polite">
    <p>Fix {errors.length} issue{errors.length === 1 ? '' : 's'}:</p>
    <ul>{#each errors as e (`${e.rowId}-${e.field}`)}<li><code>{e.rowId}</code> · <strong>{e.field}</strong>: {e.message}</li>{/each}</ul>
  </div>
{/if}

<SvGrid {data} {columns} features={features}
  cellClass={(ctx) => errorsByRow().get(ctx.row.original.id)?.has(ctx.column.id) ? 'cell-invalid' : ''}
/>
```

```css
:global(td.cell-invalid) {
  background: rgba(244, 63, 94, 0.12);
  box-shadow: inset 0 0 0 1px #f43f5e;
}
```

Live in [demo 71 (Submit-time validation)](https://svgrid.com/demos/71-submit-validation/).

## See also

- [Validation while editing](../help/editing/validation.md) - per-keystroke variant
- [Demo 24 (Validation)](https://svgrid.com/demos/24-validation/) - rejecting bad values inline
