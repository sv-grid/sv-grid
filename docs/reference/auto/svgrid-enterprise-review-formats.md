# `@svgrid/enterprise` · `review/formats.ts`

Auto-generated. Source: `packages\enterprise\src\review\formats.ts`.

### `const PENDING_BG`

Theme it with `--sg-review-pending-bg`. The default is a light amber wash
from `--sg-warning`, kept apart from the accent, which themes use for
selection and focus.

```ts
export const PENDING_BG = 'var(--sg-review-pending-bg, color-mix(in srgb, var(--sg-warning, #d97706) 13%, transparent))'
```

### `const PENDING_ICON`

Drawn before the value, so a pending cell is never marked by colour alone.

```ts
export const PENDING_ICON = '•'
```

### `const CONFLICT_BG`

A cell two sources disagree on: a red wash (`--sg-review-conflict-bg`) and
a "!" before the value, so the grid shows where the panel's conflicts are.

```ts
export const CONFLICT_BG = 'var(--sg-review-conflict-bg, color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent))'
```

### `const CONFLICT_ICON`

Drawn before the value of a cell two sources disagree on.

```ts
export const CONFLICT_ICON = '!'
```

### `function pendingFormats`

`conditionalFormats` rules that tint the cells of the given proposals, one
rule per field, scoped to that field's columns. `review.formats` is built
from it.

```ts
export function pendingFormats<TData>(
  pending: ReadonlyArray<Proposal>,
  rowId: (row: TData, index: number) => string,
  columns: ReadonlyArray<{ id: string; field?: string }>,
  look: { background: string; icon: string } = { background: PENDING_BG, icon: PENDING_ICON },
): ConditionalFormat<any>[] {
  const rowsByField = new Map<string, Set<string>>()
  for (const p of pending) {
    let ids = rowsByField.get(p.field)
    if (!ids) rowsByField.set(p.field, (ids = new Set()))
    ids.add(p.rowId)
  }
  const out: ConditionalFormat<any>[] = []
  for (const [field, ids] of rowsByField) {
    const cols = columns.filter((c) => (c.field ?? c.id) === field).map((c) => c.id)
    out.push({
      type: 'rule',
      columns: cols.length ? cols : [field],
      when: ({ row }: { row: TData }) => ids.has(String(rowId(row, 0))),
      background: look.background,
      icon: look.icon,
    })
  }
  return out
}
```
