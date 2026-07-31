/**
 * createPagination - the HEADLESS core behind <SvPagination>: the page/ellipsis
 * sequence (via the pure `paginationRange`) plus navigation (first/prev/next/last
 * with clamping) and prop-getters you spread onto your own markup. Pure getters,
 * no runes - so it is directly unit-testable and framework-free.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createPagination } from '@svgrid/grid'
 *   const pg = createPagination({ page: () => page, pageCount: () => 20, onChange: (p) => (page = p) })
 * </script>
 * <nav {...pg.navProps()}>
 *   <button {...pg.prevProps()}>‹</button>
 *   {#each pg.items as it}
 *     {#if typeof it === 'number'}<button {...pg.pageButtonProps(it)}>{it}</button>{:else}…{/if}
 *   {/each}
 *   <button {...pg.nextProps()}>›</button>
 * </nav>
 * ```
 */
import { paginationRange, type PaginationItem } from './paginate'

export type PaginationConfig = {
  /** 1-based current page. */
  page: () => number
  pageCount: () => number
  onChange?: (page: number) => void
  siblingCount?: () => number
  boundaryCount?: () => number
  disabled?: () => boolean
}

export function createPagination(config: PaginationConfig) {
  const page = () => config.page()
  const pageCount = () => config.pageCount()
  const disabled = () => config.disabled?.() ?? false

  function go(p: number) {
    if (disabled()) return
    const next = Math.min(Math.max(p, 1), pageCount())
    if (next !== page()) config.onChange?.(next)
  }
  const first = () => go(1)
  const prev = () => go(page() - 1)
  const next = () => go(page() + 1)
  const last = () => go(pageCount())
  const canPrev = () => !disabled() && page() > 1
  const canNext = () => !disabled() && page() < pageCount()

  return {
    /** The page/ellipsis sequence to render, recomputed from the live inputs. */
    get items(): PaginationItem[] {
      return paginationRange({
        page: page(),
        pageCount: pageCount(),
        siblingCount: config.siblingCount?.() ?? 1,
        boundaryCount: config.boundaryCount?.() ?? 1,
      })
    },
    go,
    first,
    prev,
    next,
    last,
    canPrev,
    canNext,
    isActive: (p: number) => p === page(),
    /** Spread onto the `<nav>` wrapper. */
    navProps: (ariaLabel = 'Pagination') => ({ 'aria-label': ariaLabel }),
    /** Spread onto a numbered page button. */
    pageButtonProps: (p: number) => ({
      'aria-current': (p === page() ? 'page' : undefined) as 'page' | undefined,
      'aria-label': `Page ${p}`,
      disabled: disabled(),
      onclick: () => go(p),
    }),
    firstProps: () => ({ 'aria-label': 'First page', disabled: !canPrev(), onclick: first }),
    prevProps: () => ({ 'aria-label': 'Previous page', disabled: !canPrev(), onclick: prev }),
    nextProps: () => ({ 'aria-label': 'Next page', disabled: !canNext(), onclick: next }),
    lastProps: () => ({ 'aria-label': 'Last page', disabled: !canNext(), onclick: last }),
  }
}

export type Pagination = ReturnType<typeof createPagination>
