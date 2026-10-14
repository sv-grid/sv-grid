/**
 * Sorts and groups share the grid's sort state: a grouped field's direction
 * is a sort entry ahead of the sorts the user picked, so the groups come in
 * that order. These read the two apart and write them back together.
 */
export type SortRule = { id: string; desc: boolean }

/** The grid's sorting and grouping, read so a `$derived` follows them. */
export function sortState(ctrl: any): { sorting: SortRule[]; grouping: string[] } {
  void ctrl.gridStateVersion
  const s = ctrl.grid?.getState?.() ?? {}
  return { sorting: [...(s.sorting ?? [])], grouping: [...(s.grouping ?? [])] }
}

/** The user's sorts: every sort entry that is not a group's direction. */
export const userSorts = (ctrl: any): SortRule[] => {
  const { sorting, grouping } = sortState(ctrl)
  return sorting.filter((s) => !grouping.includes(s.id))
}

/** Each grouped field with its direction (ascending when it has no entry). */
export const groupRules = (ctrl: any): SortRule[] => {
  const { sorting, grouping } = sortState(ctrl)
  return grouping.map((id) => ({ id, desc: !!sorting.find((s) => s.id === id)?.desc }))
}

/** Write groups and sorts back as one sort state (groups first) and the grouping. */
export function writeSortState(api: any, groups: SortRule[], sorts: SortRule[]): void {
  const grouped = groups.map((g) => g.id)
  api.setState({
    sorting: [...groups, ...sorts.filter((s) => !grouped.includes(s.id))],
    grouping: grouped,
  })
}
