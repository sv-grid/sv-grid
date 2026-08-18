/**
 * editor-registry - the extension point that opens up the grid's cell editors.
 *
 * Historically SvGrid rendered cell editors through a fixed `{#if editorType ===
 * ...}` chain over a closed `CellEditorType` union. This registry lets any
 * component - a built-in `Sv*` editor or one you author - be mounted for a
 * column by name, wired to one uniform in-cell contract (change / commit /
 * cancel). Register once at module load:
 *
 * ```ts
 * import { registerCellEditor } from '@svgrid/grid'
 * import StarRating from './StarRating.svelte'
 * registerCellEditor('stars', StarRating)
 * // then: columns = [{ field: 'score', editorType: 'stars' }]
 * ```
 *
 * The registered component receives the {@link CellEditorContext} as props
 * (value + onChange/onCommit/onCancel), or a custom mapping via `props`.
 * Framework-light: this file only holds the Map + helpers; the grid does the
 * mounting.
 */
import type { Component } from 'svelte'
import type { EditorInteraction } from './editor-contract'

/**
 * Context the grid hands a cell editor when it mounts one for an edit.
 *
 * Extends {@link EditorInteraction} - the shared commit / cancel / move contract
 * the `Sv*` editors are written against - and narrows the parts the grid always
 * supplies, so a registered component and a built-in editor speak the same
 * language. `onCommitAndMove`, `onRequestClose` and `inCell` come from the
 * contract and are always populated by the grid.
 */
export type CellEditorContext<T = unknown> = Required<
  Pick<EditorInteraction<T>, 'onCommit' | 'onCancel' | 'onCommitAndMove' | 'onRequestClose' | 'inCell'>
> & {
  /** The value currently being edited. */
  value: T
  /** Id of the row being edited. */
  rowId: string
  /** Id of the column being edited. */
  columnId: string
  /** Update the in-progress value WITHOUT ending the edit. */
  onChange: (value: T) => void
}

/** How a registered component is mounted and wired for a cell edit. */
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

const registry = new Map<string, CellEditorRegistration>()

/**
 * Register a cell editor under `type`. Pass a component (uses the default prop
 * mapping) or a full {@link CellEditorRegistration} for custom prop mapping.
 * Re-registering the same type replaces it.
 */
export function registerCellEditor(
  type: string,
  registration: CellEditorRegistration | Component<any>,
): void {
  registry.set(
    type,
    typeof registration === 'function' ? { component: registration } : registration,
  )
}

/** Look up a registered cell editor by type. */
export function getCellEditor(type: string): CellEditorRegistration | undefined {
  return registry.get(type)
}

/** Whether a custom editor is registered for `type`. */
export function hasCellEditor(type: string): boolean {
  return registry.has(type)
}

/** Remove a registered cell editor. */
export function unregisterCellEditor(type: string): void {
  registry.delete(type)
}

/** All registered custom editor type names. */
export function registeredCellEditorTypes(): string[] {
  return [...registry.keys()]
}

/**
 * The default context → props mapping used when a registration has no `props`.
 * Passes the whole {@link EditorInteraction} surface, so an editor written
 * against the shared contract works when registered with no mapping at all.
 * Svelte ignores props a component doesn't declare, so the extra keys are inert
 * for a simple editor that only wants `value` + `onCommit`.
 */
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

/** Resolve the props to spread onto a registered editor for a given context. */
export function resolveEditorProps(
  registration: CellEditorRegistration,
  ctx: CellEditorContext,
): Record<string, unknown> {
  return registration.props ? registration.props(ctx) : defaultEditorProps(ctx)
}
