<script lang="ts">
  /**
   * Product filter bar - a faceted search/filter composed from the SvGrid UI kit:
   * SvAutoComplete (search), SvButtonGroup (category), SvTagsInput (tags),
   * SvSlider (price range), SvSwitchButton (in stock) and SvDropDownList (sort),
   * filtering a live product list. Every control is a SvGrid cell editor too.
   */
  import { SvAutoComplete, SvButtonGroup, SvTagsInput, SvSlider, SvSwitchButton, SvDropDownList } from '@svgrid/grid'
  import type { ButtonGroupItem } from '@svgrid/grid'

  type Product = { name: string; category: string; price: number; tags: string[]; inStock: boolean }
  const products: Product[] = [
    { name: 'Aeron Chair', category: 'Furniture', price: 1200, tags: ['ergonomic', 'premium'], inStock: true },
    { name: 'Standing Desk', category: 'Furniture', price: 640, tags: ['ergonomic'], inStock: true },
    { name: 'Mechanical Keyboard', category: 'Electronics', price: 150, tags: ['rgb', 'premium'], inStock: true },
    { name: 'Wireless Mouse', category: 'Electronics', price: 45, tags: ['wireless'], inStock: false },
    { name: '4K Monitor', category: 'Electronics', price: 520, tags: ['4k', 'premium'], inStock: true },
    { name: 'Desk Lamp', category: 'Home', price: 60, tags: ['led'], inStock: true },
    { name: 'Noise-cancelling Headphones', category: 'Electronics', price: 320, tags: ['wireless', 'premium'], inStock: false },
    { name: 'Coffee Mug', category: 'Home', price: 18, tags: [], inStock: true },
    { name: 'Bookshelf', category: 'Furniture', price: 220, tags: [], inStock: true },
  ]

  const categories: ButtonGroupItem[] = [
    { value: 'all', label: 'All' }, { value: 'Electronics', label: 'Electronics' },
    { value: 'Furniture', label: 'Furniture' }, { value: 'Home', label: 'Home' },
  ]
  const sorts = [
    { value: 'price-asc', label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
    { value: 'name', label: 'Name (A-Z)' },
  ]
  const allTags = [...new Set(products.flatMap((p) => p.tags))]

  let search = $state('')
  let category = $state('all')
  let tags = $state<string[]>([])
  let price = $state<[number, number]>([0, 1200])
  let inStockOnly = $state(false)
  let sort = $state<string>('price-asc')

  const results = $derived(
    products
      .filter((p) => (category === 'all' || p.category === category))
      .filter((p) => (!search || p.name.toLowerCase().includes(search.toLowerCase())))
      .filter((p) => (tags.length === 0 || tags.every((t) => p.tags.includes(t))))
      .filter((p) => p.price >= price[0] && p.price <= price[1])
      .filter((p) => (!inStockOnly || p.inStock))
      .sort((a, b) =>
        sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : a.name.localeCompare(b.name),
      ),
  )
</script>

<div class="fb">
  <header>
    <h2>Products</h2>
    <p>A faceted filter bar built only from <code>@svgrid/grid</code> UI components.</p>
  </header>

  <div class="bar">
    <label class="f grow"><span>Search</span>
      <SvAutoComplete value={search} suggestions={products.map((p) => p.name)} onChange={(v) => (search = v)} placeholder="Search products…" />
    </label>
    <label class="f"><span>Sort</span>
      <SvDropDownList options={sorts} value={sort} onChange={(v) => (sort = String(v))} />
    </label>
  </div>

  <div class="bar">
    <div class="f"><span>Category</span>
      <SvButtonGroup items={categories} value={category} mode="single" onChange={(v) => (category = v as string)} />
    </div>
    <label class="f grow"><span>Tags</span>
      <SvTagsInput value={tags} onChange={(t) => (tags = t.filter((x) => allTags.includes(x)))} placeholder={`Try: ${allTags.slice(0, 3).join(', ')}`} />
    </label>
  </div>

  <div class="bar">
    <label class="f grow"><span>Price ${price[0]} - ${price[1]}</span>
      <SvSlider value={price} range min={0} max={1200} step={20} onChange={(v) => (price = v as [number, number])} />
    </label>
    <label class="switch"><SvSwitchButton checked={inStockOnly} onChange={(v) => (inStockOnly = v)} ariaLabel="In stock only" /> In stock only</label>
  </div>

  <p class="count"><strong>{results.length}</strong> of {products.length} products</p>
  <ul class="list">
    {#each results as p (p.name)}
      <li class:oos={!p.inStock}>
        <span class="nm">{p.name}</span>
        <span class="cat">{p.category}</span>
        <span class="tg">{#each p.tags as t (t)}<em>{t}</em>{/each}</span>
        <span class="pr">${p.price}</span>
        {#if !p.inStock}<span class="badge">Out of stock</span>{/if}
      </li>
    {:else}
      <li class="empty">No products match these filters.</li>
    {/each}
  </ul>
</div>

<style>
  .fb { padding: 22px; max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .bar { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
  .f { display: flex; flex-direction: column; gap: 6px; }
  .f.grow { flex: 1; min-width: 200px; }
  .f > span { font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .switch { display: flex; align-items: center; gap: 8px; font-size: 13px; white-space: nowrap; padding-bottom: 6px; }
  .count { margin: 6px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; overflow: hidden; }
  .list li { display: grid; grid-template-columns: 1.6fr 1fr 1.4fr auto; gap: 12px; align-items: center; padding: 11px 16px; border-bottom: 1px solid var(--sg-border, #f1f5f9); font-size: 13.5px; }
  .list li:last-child { border-bottom: 0; }
  .list li.oos { opacity: 0.6; }
  .nm { font-weight: 600; }
  .cat { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .tg { display: flex; gap: 4px; flex-wrap: wrap; }
  .tg em { font-style: normal; font-size: 11px; background: var(--sg-row-hover-bg, #eef2ff); color: var(--sg-accent, #6366f1); padding: 1px 7px; border-radius: 999px; }
  .pr { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .badge { grid-column: 1 / -1; font-size: 11px; color: #b45309; }
  .empty { justify-content: center; color: var(--sg-muted, #94a3b8); text-align: center; }
</style>
