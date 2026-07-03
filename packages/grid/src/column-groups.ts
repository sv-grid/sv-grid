// Collapsible column groups (AG-Grid `columnGroupShow`). A column group can
// carry a collapse toggle: its child columns tagged `columnGroupShow: 'open'`
// show only when the group is expanded, `'closed'` show only when collapsed,
// and untagged children always show.
//
// This module derives, from the user's column tree, the pure metadata the
// controller needs: which groups are collapsible, their default state, and each
// controlled leaf's group + show-mode. The controller turns that into a hidden
// map (merged into column visibility) AND feeds the same hidden set into the
// group-header colspan/width math, so headers stay aligned with the leaves.

export type ColumnGroupShow = "open" | "closed";

export type ColumnGroupMeta = {
  /** Group ids that render a collapse toggle. */
  collapsibleGroupIds: Set<string>;
  /** Group id -> whether it starts expanded (openByDefault). */
  defaultOpen: Map<string, boolean>;
  /** Leaf column id -> the group controlling it + its show mode. */
  leafControl: Map<string, { groupId: string; show: ColumnGroupShow }>;
};

// Mirror the id resolution used by the group-header derivation so group ids and
// leaf ids line up across both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idOf(def: any, parentId: string | undefined, ix: number): string {
  return def.id ?? def.field ?? `${parentId ?? "col"}_d_${ix}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeColumnGroupMeta(columns: ReadonlyArray<any>): ColumnGroupMeta {
  const collapsibleGroupIds = new Set<string>();
  const defaultOpen = new Map<string, boolean>();
  const leafControl = new Map<string, { groupId: string; show: ColumnGroupShow }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(defs: ReadonlyArray<any>, parentId: string | undefined, controllingGroup: string | undefined) {
    defs.forEach((def, ix) => {
      const id = idOf(def, parentId, ix);
      if (def.columns?.length) {
        // A group is collapsible when any DIRECT child declares columnGroupShow.
        const collapsible = def.columns.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.columnGroupShow === "open" || c.columnGroupShow === "closed",
        );
        if (collapsible) {
          collapsibleGroupIds.add(id);
          defaultOpen.set(id, def.openByDefault === true);
        }
        walk(def.columns, id, collapsible ? id : controllingGroup);
      } else {
        const show = def.columnGroupShow;
        if ((show === "open" || show === "closed") && controllingGroup) {
          leafControl.set(id, { groupId: controllingGroup, show });
        }
      }
    });
  }

  walk(columns, undefined, undefined);
  return { collapsibleGroupIds, defaultOpen, leafControl };
}

/**
 * Which leaf ids are hidden right now, given the set of collapsed group ids.
 * `'open'` leaves hide while their group is collapsed; `'closed'` leaves hide
 * while it is expanded.
 */
export function hiddenLeavesForCollapse(
  meta: ColumnGroupMeta,
  collapsed: ReadonlySet<string>,
): Record<string, boolean> {
  const hidden: Record<string, boolean> = {};
  for (const [leafId, ctrl] of meta.leafControl) {
    const isCollapsed = collapsed.has(ctrl.groupId);
    const hide = ctrl.show === "open" ? isCollapsed : !isCollapsed;
    if (hide) hidden[leafId] = true;
  }
  return hidden;
}
