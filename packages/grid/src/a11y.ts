export type GridSortDirection = 'ascending' | 'descending' | 'none' | 'other'

export type GridColumnA11yInput = {
  sortable?: boolean
  sortDirection?: GridSortDirection
}

export type GridCellA11yInput = {
  colIndex?: number
  rowIndex?: number
  selected?: boolean
  id?: string
}

export function getGridRootA11yProps(input: {
  activeDescendantId?: string | null
  rowCount?: number
  colCount?: number
} = {}) {
  return {
    role: 'grid',
    tabindex: 0,
    ...(input.activeDescendantId
      ? { 'aria-activedescendant': input.activeDescendantId }
      : {}),
    ...(input.rowCount !== undefined ? { 'aria-rowcount': input.rowCount } : {}),
    ...(input.colCount !== undefined ? { 'aria-colcount': input.colCount } : {}),
  } as const
}

export function getGridHeaderA11yProps(input: GridColumnA11yInput = {}) {
  const { sortable = false, sortDirection = 'none' } = input
  return {
    role: 'columnheader',
    ...(sortable ? { 'aria-sort': sortDirection } : {}),
  } as const
}

export function getGridRowA11yProps(rowIndex?: number) {
  return {
    role: 'row',
    ...(rowIndex !== undefined ? { 'aria-rowindex': rowIndex } : {}),
  } as const
}

export function getGridCellA11yProps(input: GridCellA11yInput = {}) {
  const { colIndex, rowIndex, selected = false, id } = input
  return {
    role: 'gridcell',
    ...(id ? { id } : {}),
    ...(colIndex !== undefined ? { 'aria-colindex': colIndex } : {}),
    ...(rowIndex !== undefined ? { 'aria-rowindex': rowIndex } : {}),
    'aria-selected': selected,
  } as const
}

export function getGridCellDomId(baseId: string, rowIndex: number, colIndex: number) {
  return `${baseId}_cell_${rowIndex}_${colIndex}`
}
