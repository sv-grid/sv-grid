<script lang="ts" module>
  /**
   * Sidebar filters block - a product list with a filter sidebar. SvCheckBox
   * groups for category and brand show how many products each option leaves,
   * a range SvSlider sets the price band, an SvRadioGroup sets the minimum
   * rating, and Reset brings every product back. The list beside it filters
   * live with a count. On phones the sidebar moves into an SvDrawer opened by
   * a Filters SvButton that shows the active count. SvBadge, SvEmptyState,
   * SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createSidebarFilters() below owns the filter state, the filtered
   * rows, the facet counts and the active count with no markup. The component
   * under it is one styled render of that core; import createSidebarFilters
   * from this file (or `npx @svgrid/ui add filter-panels-sidebar --headless`
   * for the core alone) to draw your own.
   */
  export type Product = { name: string; category: string; brand: string; price: number; rating: number }
  export type FacetGroup = 'category' | 'brand'
  export type RatingOption = { value: number; label: string }
  export type SidebarFiltersOptions = {
    products?: Product[]
    categories?: string[]
    brands?: string[]
    /** Slider bounds; the full band counts as "no price filter". */
    priceRange?: [number, number]
    ratings?: RatingOption[]
    initial?: { categories?: string[]; brands?: string[]; price?: [number, number]; minRating?: number }
    /** Called after reset() clears every filter. */
    onReset?: () => void
  }

  const SAMPLE: Product[] = [
    { name: 'Ridge 38L daypack', category: 'Packs', brand: 'Fieldline', price: 149, rating: 4.7 },
    { name: 'Summit 55L trekking pack', category: 'Packs', brand: 'Northwind', price: 239, rating: 4.4 },
    { name: 'Commuter sling 9L', category: 'Packs', brand: 'Lumen', price: 59, rating: 3.9 },
    { name: 'Two-person trail tent', category: 'Tents', brand: 'Fieldline', price: 329, rating: 4.6 },
    { name: 'Ultralight solo shelter', category: 'Tents', brand: 'Ridgeback', price: 412, rating: 4.8 },
    { name: 'Family dome, 4 person', category: 'Tents', brand: 'Northwind', price: 289, rating: 4.1 },
    { name: 'Storm shell jacket', category: 'Jackets', brand: 'Ridgeback', price: 269, rating: 4.5 },
    { name: 'Packable down hoodie', category: 'Jackets', brand: 'Lumen', price: 189, rating: 4.3 },
    { name: 'Wind shirt', category: 'Jackets', brand: 'Fieldline', price: 89, rating: 3.6 },
    { name: 'Approach shoe', category: 'Footwear', brand: 'Ridgeback', price: 139, rating: 4.2 },
    { name: 'Waterproof mid boot', category: 'Footwear', brand: 'Northwind', price: 199, rating: 4.7 },
    { name: 'Trail runner', category: 'Footwear', brand: 'Lumen', price: 129, rating: 3.8 },
  ]
  const RATINGS: RatingOption[] = [
    { value: 0, label: 'Any rating' },
    { value: 4.5, label: '4.5 and up' },
    { value: 4, label: '4.0 and up' },
    { value: 3.5, label: '3.5 and up' },
  ]

  export function createSidebarFilters(opts: SidebarFiltersOptions = {}) {
    const products = opts.products ?? SAMPLE
    const categoryList = opts.categories ?? ['Packs', 'Tents', 'Jackets', 'Footwear']
    const brandList = opts.brands ?? ['Fieldline', 'Northwind', 'Ridgeback', 'Lumen']
    const bounds: [number, number] = opts.priceRange ?? [0, 450]
    const ratings = opts.ratings ?? RATINGS

    let categories = $state<string[]>(opts.initial?.categories ?? ['Packs', 'Tents'])
    let brands = $state<string[]>(opts.initial?.brands ?? [])
    let price = $state<[number, number]>(opts.initial?.price ?? [...bounds])
    let minRating = $state<number>(opts.initial?.minRating ?? 0)
    let drawerOpen = $state(false)

    const matches = (p: Product, skip: FacetGroup | null = null) =>
      (skip === 'category' || !categories.length || categories.includes(p.category)) &&
      (skip === 'brand' || !brands.length || brands.includes(p.brand)) &&
      p.price >= price[0] && p.price <= price[1] && p.rating >= minRating

    const results = $derived(products.filter((p) => matches(p)))
    const activeCount = $derived(
      categories.length + brands.length + (price[0] !== bounds[0] || price[1] !== bounds[1] ? 1 : 0) + (minRating ? 1 : 0),
    )

    // Facet counts ignore their own group, so each number is what ticking that box would add.
    const countFor = (group: FacetGroup, value: string) =>
      products.filter((p) => matches(p, group) && (group === 'category' ? p.category : p.brand) === value).length
    const isChecked = (group: FacetGroup, value: string) => (group === 'category' ? categories : brands).includes(value)
    function toggle(group: FacetGroup, value: string, on: boolean) {
      const next = (list: string[]) => (on ? [...list.filter((x) => x !== value), value] : list.filter((x) => x !== value))
      if (group === 'category') categories = next(categories)
      else brands = next(brands)
    }
    function setPrice(v: number | [number, number]) {
      if (Array.isArray(v)) price = [v[0], v[1]]
    }
    function reset() {
      categories = []; brands = []; price = [...bounds]; minRating = 0
      opts.onReset?.()
    }

    return {
      categoryList, brandList, bounds, ratings,
      get total() { return products.length },
      get results() { return results },
      get activeCount() { return activeCount },
      get categories() { return categories },
      set categories(v: string[]) { categories = v },
      get brands() { return brands },
      set brands(v: string[]) { brands = v },
      get price() { return price },
      set price(v: [number, number]) { setPrice(v) },
      get minRating() { return minRating },
      set minRating(v: number) { minRating = Number(v) },
      /** The phone drawer's open state. */
      get drawerOpen() { return drawerOpen },
      set drawerOpen(v: boolean) { drawerOpen = v },
      /** True when the price band reaches the top bound (render it as "450+"). */
      get priceOpenEnded() { return price[1] === bounds[1] },
      countFor,
      isChecked,
      toggle,
      setPrice,
      reset,
      /** Spread on a native <input type="checkbox"> for one facet option. */
      optionProps: (group: FacetGroup, value: string) => ({
        type: 'checkbox' as const,
        name: group,
        value,
        checked: isChecked(group, value),
        onchange: (e: Event) => toggle(group, value, (e.currentTarget as HTMLInputElement).checked),
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCheckBox, SvSlider, SvRadioGroup, SvButton, SvBadge, SvDrawer, SvEmptyState,
    SvToaster, toast,
  } from '@svgrid/grid'

  const f = createSidebarFilters({ onReset: () => toast('Filters reset') })
  const usd = (n: number) => `$${n}`
</script>

<div class="sv-facets">
  <aside class="sv-facets-side" aria-label="Product filters">{@render filters(true)}</aside>

  <main class="sv-facets-results">
    <header class="sv-facets-head">
      <div>
        <h2>Hiking gear</h2>
        <p class="sv-facets-muted" aria-live="polite">{f.results.length} of {f.total} products</p>
      </div>
      <span class="sv-facets-filters-btn">
        <SvButton variant="outline" onclick={() => (f.drawerOpen = true)}>
          Filters{#if f.activeCount}<span class="sv-facets-count-pill">{f.activeCount}</span>{/if}
        </SvButton>
      </span>
    </header>

    {#if f.results.length}
      <ul class="sv-facets-cards">
        {#each f.results as p (p.name)}
          <li class="sv-facets-product">
            <div class="sv-facets-thumb" data-cat={p.category} aria-hidden="true"></div>
            <div class="sv-facets-info">
              <span class="sv-facets-brand">{p.brand}</span>
              <strong>{p.name}</strong>
              <div class="sv-facets-row">
                <span class="sv-facets-price">{usd(p.price)}</span>
                <span class="sv-facets-rating"><span aria-hidden="true">★</span> {p.rating.toFixed(1)}</span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="sv-facets-empty">
        <SvEmptyState title="No products match" description="Widen the price range or untick a brand.">
          <SvButton onclick={f.reset}>Reset filters</SvButton>
        </SvEmptyState>
      </div>
    {/if}
  </main>
</div>

<SvDrawer bind:open={f.drawerOpen} side="left" size="320px" title="Filters">
  {@render filters(false)}
  {#snippet footer()}
    <div class="sv-facets-drawer-actions">
      <SvButton variant="ghost" onclick={f.reset}>Reset</SvButton>
      <SvButton onclick={() => (f.drawerOpen = false)}>Show {f.results.length} results</SvButton>
    </div>
  {/snippet}
</SvDrawer>

<SvToaster position="bottom-right" />

{#snippet filters(withHead: boolean)}
  <div class="sv-facets-filters">
    {#if withHead}
      <div class="sv-facets-filters-head">
        <span class="sv-facets-title">Filters</span>
        {#if f.activeCount}<SvBadge size="sm" variant="accent" pill>{f.activeCount} active</SvBadge>{/if}
        <button type="button" class="sv-facets-link" onclick={f.reset} disabled={!f.activeCount}>Reset</button>
      </div>
    {/if}
    <fieldset>
      <legend>Category</legend>
      {#each f.categoryList as c (c)}
        <SvCheckBox checked={f.isChecked('category', c)} onChange={(on) => f.toggle('category', c, on)}>
          <span class="sv-facets-opt">{c}<span class="sv-facets-n">{f.countFor('category', c)}</span></span>
        </SvCheckBox>
      {/each}
    </fieldset>
    <fieldset>
      <legend>Brand</legend>
      {#each f.brandList as b (b)}
        <SvCheckBox checked={f.isChecked('brand', b)} onChange={(on) => f.toggle('brand', b, on)}>
          <span class="sv-facets-opt">{b}<span class="sv-facets-n">{f.countFor('brand', b)}</span></span>
        </SvCheckBox>
      {/each}
    </fieldset>
    <div class="sv-facets-group">
      <SvSlider label="Price" range value={f.price} onChange={f.setPrice} min={f.bounds[0]} max={f.bounds[1]} step={10}
        formatValue={usd} block />
      <p class="sv-facets-range-text">{usd(f.price[0])} to {usd(f.price[1])}{f.priceOpenEnded ? '+' : ''}</p>
    </div>
    <SvRadioGroup label="Rating" options={f.ratings} value={f.minRating} onChange={(v) => (f.minRating = Number(v))} />
  </div>
{/snippet}

<style>
  .sv-facets {
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 24px;
    display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 28px; align-items: start;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-facets-filters { display: flex; flex-direction: column; gap: 20px; }
  .sv-facets-filters-head { display: flex; align-items: center; gap: 8px; }
  .sv-facets-title { font-size: 14px; font-weight: 650; }
  .sv-facets-link {
    margin-left: auto; background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px;
    color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
  }
  .sv-facets-link:hover { color: var(--sg-accent, #4f46e5); }
  .sv-facets-link:disabled { color: var(--sg-muted, #64748b); text-decoration: none; cursor: default; }
  fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  legend { padding: 0; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-facets-opt { display: inline-flex; align-items: center; gap: 8px; }
  .sv-facets-n {
    font-size: 11.5px; padding: 0 6px; border-radius: 999px; font-variant-numeric: tabular-nums;
    color: var(--sg-muted, #64748b); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff));
  }
  .sv-facets-group { display: flex; flex-direction: column; gap: 4px; }
  .sv-facets-range-text { margin: 0; font-size: 12.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }

  .sv-facets-results { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .sv-facets-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-facets-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-facets-filters-btn { display: none; }
  .sv-facets-count-pill {
    margin-left: 6px; min-width: 18px; padding: 0 5px; border-radius: 999px; font-size: 11.5px; line-height: 18px;
    background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff);
  }
  .sv-facets-cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
  .sv-facets-product { border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); overflow: hidden; }
  .sv-facets-thumb { height: 96px; background: linear-gradient(135deg, color-mix(in srgb, var(--sg-fg, #0f172a) 10%, var(--sg-bg, #fff)), color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff))); }
  .sv-facets-thumb[data-cat='Tents'] { background: linear-gradient(160deg, color-mix(in srgb, var(--sg-success, #16a34a) 18%, var(--sg-bg, #fff)), color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff))); }
  .sv-facets-thumb[data-cat='Jackets'] { background: linear-gradient(160deg, color-mix(in srgb, var(--sg-info, #0284c7) 18%, var(--sg-bg, #fff)), color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff))); }
  .sv-facets-thumb[data-cat='Footwear'] { background: linear-gradient(160deg, color-mix(in srgb, var(--sg-warning, #d97706) 18%, var(--sg-bg, #fff)), color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff))); }
  .sv-facets-info { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px 12px; }
  .sv-facets-brand { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .sv-facets-info strong { font-size: 13.5px; font-weight: 600; }
  .sv-facets-row { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 13px; }
  .sv-facets-price { font-weight: 600; font-variant-numeric: tabular-nums; }
  .sv-facets-rating { color: var(--sg-muted, #64748b); }
  .sv-facets-rating span { color: var(--sg-warning, #d97706); }
  .sv-facets-empty { border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); padding: 24px 0; }
  .sv-facets-drawer-actions { display: flex; justify-content: space-between; gap: 8px; width: 100%; }

  @media (max-width: 720px) {
    .sv-facets { grid-template-columns: minmax(0, 1fr); padding: 18px 16px; min-height: 0; }
    .sv-facets-head, .sv-facets-row { flex-wrap: wrap; }
    .sv-facets-side { display: none; }
    .sv-facets-filters-btn { display: inline-flex; }
    .sv-facets-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .sv-facets-thumb { height: 72px; }
  }
</style>
