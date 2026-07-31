<script lang="ts">
  /**
   * SvPagination - a standalone pager (page numbers with ellipsis + prev/next
   * and optional first/last). Pairs with the grid or any paged list. Controlled
   * via `page` + `onChange`; the page-range math lives in the pure `paginate`
   * helper. Parity: Smart pager.
   *
   * ```svelte
   * <SvPagination page={p} pageCount={20} onChange={(n) => (p = n)} />
   * ```
   */
  import { createPagination } from './createPagination'

  type Props = {
    /** 1-based current page. */
    page: number
    pageCount: number
    onChange?: (page: number) => void
    siblingCount?: number
    boundaryCount?: number
    showFirstLast?: boolean
    showPrevNext?: boolean
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    ariaLabel?: string
  }

  let {
    page,
    pageCount,
    onChange,
    siblingCount = 1,
    boundaryCount = 1,
    showFirstLast = false,
    showPrevNext = true,
    size = 'md',
    disabled = false,
    ariaLabel = 'Pagination',
  }: Props = $props()

  // Page-range math + navigation live in the shared headless core.
  const pg = createPagination({
    page: () => page,
    pageCount: () => pageCount,
    onChange,
    siblingCount: () => siblingCount,
    boundaryCount: () => boundaryCount,
    disabled: () => disabled,
  })
</script>

<nav class="sv-pg sv-pg--{size}" {...pg.navProps(ariaLabel)}>
  <ul class="sv-pg__list">
    {#if showFirstLast}
      <li><button type="button" class="sv-pg__btn" {...pg.firstProps()}>&laquo;</button></li>
    {/if}
    {#if showPrevNext}
      <li><button type="button" class="sv-pg__btn" {...pg.prevProps()}>&lsaquo;</button></li>
    {/if}
    {#each pg.items as it, i (typeof it === 'number' ? `p${it}` : `${it}-${i}`)}
      {#if it === 'ellipsis-left' || it === 'ellipsis-right'}
        <li><span class="sv-pg__ellipsis" aria-hidden="true">&hellip;</span></li>
      {:else}
        <li>
          <button
            type="button"
            class="sv-pg__btn"
            class:is-active={pg.isActive(it)}
            {...pg.pageButtonProps(it)}
          >{it}</button>
        </li>
      {/if}
    {/each}
    {#if showPrevNext}
      <li><button type="button" class="sv-pg__btn" {...pg.nextProps()}>&rsaquo;</button></li>
    {/if}
    {#if showFirstLast}
      <li><button type="button" class="sv-pg__btn" {...pg.lastProps()}>&raquo;</button></li>
    {/if}
  </ul>
</nav>

<style>
  .sv-pg { --_accent: var(--sg-accent, #2563eb); }
  .sv-pg__list { display: flex; align-items: center; gap: 4px; list-style: none; margin: 0; padding: 0; }
  .sv-pg__btn {
    display: inline-grid; place-items: center; box-sizing: border-box;
    min-width: 32px; height: 32px; padding: 0 7px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 8px);
    font: inherit; font-size: 13px; cursor: pointer; transition: background 0.12s, border-color 0.12s;
  }
  .sv-pg--sm .sv-pg__btn { min-width: 28px; height: 28px; font-size: 12px; }
  .sv-pg--lg .sv-pg__btn { min-width: 38px; height: 38px; font-size: 14px; }
  .sv-pg__btn:hover:not(:disabled):not(.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); border-color: color-mix(in srgb, var(--_accent) 40%, var(--sg-border, #cbd5e1)); }
  .sv-pg__btn:focus-visible { outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 30%, transparent); }
  .sv-pg__btn.is-active { background: var(--_accent); border-color: var(--_accent); color: var(--sg-on-accent, #fff); font-weight: 650; }
  .sv-pg__btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .sv-pg__ellipsis { display: inline-grid; place-items: center; min-width: 32px; height: 32px; color: var(--sg-muted, #64748b); }
</style>
