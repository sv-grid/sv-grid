# `@svgrid/enterprise` · `review/ghost.ts`

Auto-generated. Source: `packages\enterprise\src\review\ghost.ts`.

### `function canGhost`

Whether wrapping this column's `cell` keeps the rest of its cells as they
were. `columns` is every leaf column, which a field type's fill may read.

```ts
export function canGhost(raw: any, sample?: unknown, columns: ReadonlyArray<any> = []): boolean {
  if (!raw || raw.columns?.length) return false
  const ext = getGridExtension()
  // The grid draws a field type's own cell when the module has one for it;
  // otherwise the column draws as an ordinary one.
  if (raw.fieldType && raw.cell == null && ext?.cell && ext.hasCell?.(raw) !== false) return false
  const def = raw.fieldType && ext?.column ? ext.column(raw, columns) : raw
  const field = def.field ?? def.id
  if (!field || def.sparkline) return false
  if (raw.cell != null) return true
  if (def.editorType === 'checkbox' || def.editorType === 'list' || def.editorType === 'chips') return false
  if (def.cellDataType === 'boolean' || typeof sample === 'boolean') return false
  return true
}
```
