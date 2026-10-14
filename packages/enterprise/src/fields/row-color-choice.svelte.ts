/**
 * The status field a grid's rows are colored by when someone picks it from
 * the column menu ("Color rows by this field"): it wins over the `rowColor`
 * prop for that grid, and `onRowColorChange` reports it so the app can keep
 * it. Held per grid, weakly, so a grid that unmounts takes its choice along.
 * A view's colors are a choice too; a view with no color setting clears it.
 */
type Config = { field?: string; target?: 'header' | 'bar' | 'row'; rules?: ReadonlyArray<unknown> }

const choices = new WeakMap<object, Config | null>()
// The WeakMap is not reactive; reading the version makes the rows repaint.
let version = $state(0)

/** The choice made for this grid, `undefined` when none was made (the prop rules). */
export function chosenRowColor(ctrl: object): Config | null | undefined {
  void version
  return choices.has(ctrl) ? choices.get(ctrl) : undefined
}

/** Color this grid's rows by `config` (null: no colors), and tell the app. */
export function chooseRowColor(ctrl: { props: { onRowColorChange?: (c: Config | null) => void } }, config: Config | null): void {
  choices.set(ctrl, config)
  version += 1
  ctrl.props.onRowColorChange?.(config)
}

/**
 * Drop this grid's choice, so the `rowColor` prop rules again; the app hears
 * of it (with the prop's colors) only when a choice was in force.
 */
export function clearRowColorChoice(ctrl: { props: { rowColor?: Config | null; onRowColorChange?: (c: Config | null) => void } }): void {
  if (!choices.has(ctrl)) return
  choices.delete(ctrl)
  version += 1
  ctrl.props.onRowColorChange?.(ctrl.props.rowColor ?? null)
}
