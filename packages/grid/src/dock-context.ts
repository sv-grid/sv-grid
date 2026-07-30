/**
 * Shared context for <SvDockLayout> and its recursive <DockNodeView>. Carries
 * the pane-content snippet and the handful of callbacks the tree view needs, so
 * the recursive renderer reaches them without prop-drilling through every level.
 */
import type { Snippet } from 'svelte'
import type { DockPane, DockZone } from './dock-model'

export type DockContext = {
  /** Renders a pane's content. Called as `{@render pane(dockPane)}`. */
  pane: Snippet<[DockPane]>
  /** Optional per-pane header actions (float / auto-hide), rendered into tabs. */
  paneActions?: Snippet<[DockPane]>
  /** Make tab `index` active in the given leaf. */
  activate: (tabsId: string, index: number) => void
  /** Close (remove) a pane. */
  close: (paneId: string) => void
  /** Start dragging a pane's tab to re-dock it. */
  beginDrag: (event: PointerEvent, paneId: string, tabsId: string) => void
  /** Commit new size weights for a group after a splitter drag. */
  resize: (groupId: string, sizes: number[]) => void
  /** Minimum pane size (px) along the split axis. */
  minSize: () => number
  /** The live drop target while dragging, for the zone highlight. */
  dropTarget: () => { tabsId: string; zone: DockZone } | null
}

export const DOCK_CONTEXT = Symbol('svgrid-dock')
