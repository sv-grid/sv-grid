/**
 * paginate - the pure page-range algorithm behind <SvPagination>. Given the
 * current page and total page count, returns the sequence of page numbers and
 * ellipsis markers to render (boundary pages + a window of siblings around the
 * current page, with gaps collapsed to an ellipsis). Framework-free + pure so
 * it is unit-tested on its own.
 */
export type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right'

export type PaginationRangeOptions = {
  /** 1-based current page. */
  page: number
  /** Total number of pages. */
  pageCount: number
  /** Pages shown on each side of the current page. Default 1. */
  siblingCount?: number
  /** Pages pinned at each end. Default 1. */
  boundaryCount?: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

/** Build the page/ellipsis sequence (e.g. `[1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 20]`). */
export function paginationRange(options: PaginationRangeOptions): PaginationItem[] {
  const { pageCount } = options
  if (pageCount <= 0) return []
  const siblingCount = Math.max(0, options.siblingCount ?? 1)
  const boundaryCount = Math.max(1, options.boundaryCount ?? 1)
  const page = clamp(options.page, 1, pageCount)

  // If ellipsis could hide at most one page, just show every page.
  if (pageCount <= boundaryCount * 2 + siblingCount * 2 + 3) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const pages = new Set<number>()
  // End boundaries (both ends).
  for (let i = 1; i <= boundaryCount && i <= pageCount; i++) {
    pages.add(i)
    pages.add(pageCount - i + 1)
  }
  // Siblings around the current page.
  for (let i = page - siblingCount; i <= page + siblingCount; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const result: PaginationItem[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev === 2) {
      // Exactly one page in the gap: show it instead of an ellipsis.
      result.push(prev + 1)
    } else if (p - prev > 2) {
      result.push(p <= page ? 'ellipsis-left' : 'ellipsis-right')
    }
    result.push(p)
    prev = p
  }
  return result
}
