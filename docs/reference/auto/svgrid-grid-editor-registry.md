# `@svgrid/grid` · `editor-registry.ts`

Auto-generated. Source: `packages\grid\src\editor-registry.ts`.

### `type CellEditorContext`

Context the grid hands a cell editor when it mounts one for an edit.

Extends {@link EditorInteraction} - the shared commit / cancel / move contract
the `Sv*` editors are written against - and narrows the parts the grid always
supplies, so a registered component and a built-in editor speak the same
language. `onCommitAndMove`, `onRequestClose` and `inCell` come from the
contract and are always populated by the grid.

```ts
export type CellEditorContext<T = unknown> = Required<
  Pick<EditorInteraction<T>, 'onCommit' | 'onCancel' | 'onCommitAndMove' | 'onRequestClose' | 'inCell'>
```

### `type CellEditorRegistration`

How a registered component is mounted and wired for a cell edit. */

```ts
export type CellEditorRegistration = {
  /** The Svelte component to mount in the editing cell. */
  component: Component<any>
  /**
   * Map the editing context to the component's props. Defaults to
   * {@link defaultEditorProps} (value + onChange/onCommit/onCancel).
   */
  props?: (ctx: CellEditorContext) => Record<string, unknown>
  /** Hint that the editor should open its popover immediately on mount. */
  autoOpen?: boolean
}
```

### `function registerCellEditor`

Register a cell editor under `type`. Pass a component (uses the default prop
mapping) or a full {@link CellEditorRegistration} for custom prop mapping.
Re-registering the same type replaces it.

```ts
export function registerCellEditor(
  type: string,
  registration: CellEditorRegistration | Component<any>,
): void {
  registry.set(
    type,
    typeof registration === 'function' ? { component: registration } : registration,
  )
}
```

### `function getCellEditor`

Look up a registered cell editor by type. */

```ts
export function getCellEditor(type: string): CellEditorRegistration | undefined {
  return registry.get(type)
}
```

### `function hasCellEditor`

Whether a custom editor is registered for `type`. */

```ts
export function hasCellEditor(type: string): boolean {
  return registry.has(type)
}
```

### `function unregisterCellEditor`

Remove a registered cell editor. */

```ts
export function unregisterCellEditor(type: string): void {
  registry.delete(type)
}
```

### `function registeredCellEditorTypes`

All registered custom editor type names. */

```ts
export function registeredCellEditorTypes(): string[] {
  return [...registry.keys()]
}
```

### `function defaultEditorProps`

The default context → props mapping used when a registration has no `props`.
Passes the whole {@link EditorInteraction} surface, so an editor written
against the shared contract works when registered with no mapping at all.
Svelte ignores props a component doesn't declare, so the extra keys are inert
for a simple editor that only wants `value` + `onCommit`.

```ts
export function defaultEditorProps(ctx: CellEditorContext): Record<string, unknown> {
  return {
    value: ctx.value,
    onChange: ctx.onChange,
    onCommit: ctx.onCommit,
    onCancel: ctx.onCancel,
    onCommitAndMove: ctx.onCommitAndMove,
    onRequestClose: ctx.onRequestClose,
    inCell: ctx.inCell,
  }
}
```

### `function resolveEditorProps`

Resolve the props to spread onto a registered editor for a given context. */

```ts
export function resolveEditorProps(
  registration: CellEditorRegistration,
  ctx: CellEditorContext,
): Record<string, unknown> {
  return registration.props ? registration.props(ctx) : defaultEditorProps(ctx)
}
```
