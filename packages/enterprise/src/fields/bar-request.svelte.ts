/**
 * Which view bars are mounted, and a request for one of them to open a
 * panel. The column menu's "Filter by this field" adds a condition and asks
 * the grid's bar to show its Filter panel; without a bar the item is not
 * offered.
 */
export type BarPanel = 'hide' | 'filter' | 'group' | 'sort' | 'color' | 'chart' | 'gantt'

const bars = new WeakSet<object>()
let request = $state.raw<{ ctrl: unknown; panel: BarPanel } | null>(null)

/** A bar mounted over this grid; the returned function unregisters it. */
export function registerBar(ctrl: object): () => void {
  bars.add(ctrl)
  return () => bars.delete(ctrl)
}
export const hasBar = (ctrl: unknown): boolean => !!ctrl && typeof ctrl === 'object' && bars.has(ctrl)

export const getBarRequest = () => request
export function openBarPanel(ctrl: unknown, panel: BarPanel): void {
  request = { ctrl, panel }
}
export function clearBarRequest(): void {
  request = null
}
