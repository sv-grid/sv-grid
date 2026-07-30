/**
 * Shared context for <SvDockLayout> and its recursive <DockNodeView>. Carries
 * the pane-content snippet and the handful of callbacks the tree view needs, so
 * the recursive renderer reaches them without prop-drilling through every level.
 */
import type { Snippet } from 'svelte'
import type { DockPane, DockTabs, DockZone } from './dock-model'

export type DockContext = {
  /** Renders a pane's content. Called as `{@render pane(dockPane)}`. */
  pane: Snippet<[DockPane]>
  /**
   * Optional stack-header controls for a leaf (maximize / auto-hide / pop-out /
   * float), rendered once per leaf at the right of its tab strip.
   */
  leafActions?: Snippet<[DockTabs]>
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
  /**
   * The leaf the pointer is over while dragging, for the dock guide. `zone` is
   * the guide chip under the pointer (drop docks there) or `null` (over the leaf
   * but off the guide - the drop will float). `centerOnly` shows just the centre
   * chip (floating windows accept tabs only).
   */
  dropTarget: () => { tabsId: string; zone: DockZone | null; centerOnly?: boolean } | null
  /** The live tab-reorder target, for the insertion-line indicator. */
  reorderTarget?: () => { tabsId: string; index: number } | null
  /** Which side of each leaf the tab strip sits on. Default `'top'`. */
  headerPosition?: () => 'top' | 'bottom'
}

export const DOCK_CONTEXT = Symbol('svgrid-dock')
