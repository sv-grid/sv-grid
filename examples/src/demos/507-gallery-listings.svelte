<script lang="ts">
  // Gallery rendering is an Enterprise feature - register the renderer.
  import { enableGalleryView } from '@svgrid/enterprise'
  enableGalleryView()
  /**
   * 507. Gallery: real estate listings
   * ----------------------------------
   * The cards are the grid's filtered and sorted rows, so everything the grid
   * does to its rows shows on the wall. The status buttons set a column filter
   * (`api.setFilter`), "Beds" a numeric one, and the sort menu `api.setSort`;
   * the search box is the grid's quick filter. Each listing is drawn by a
   * `card` snippet: the photo with its status, the price, beds, baths and
   * size on one line, the address and the agent. Table shows the same rows.
   */
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import { housePhoto } from '../shared/gallery-art'

  type Listing = {
    id: number
    street: string
    area: string
    photo: string
    status: string
    price: number
    beds: number
    baths: number
    sqft: number
    daysListed: number
    agent: string
  }

  const STREETS = ['Elm Street', 'Oak Avenue', 'Birch Lane', 'Cedar Court', 'Maple Drive', 'Willow Way', 'Harbor Road', 'Hillcrest Place']
  const AREAS = ['Riverside', 'Old Town', 'Hillcrest', 'Harbor', 'Parkview']
  const AGENTS = ['Ana Ruiz', 'Ben Okafor', 'Cleo Park', 'Dev Shah']
  const STATUSES = ['For sale', 'Pending', 'Sold']
  const rows: Listing[] = Array.from({ length: 24 }, (_, i) => {
    const beds = 1 + ((i * 3) % 5)
    return {
      id: i + 1,
      street: `${120 + ((i * 37) % 880)} ${STREETS[i % STREETS.length]}`,
      area: AREAS[(i * 2) % AREAS.length]!,
      photo: housePhoto(i * 11 + 3, beds > 2 ? 2 : 1),
      status: STATUSES[i % 7 === 0 ? 2 : i % 4 === 0 ? 1 : 0]!,
      price: 285000 + beds * 92000 + ((i * 7919) % 90) * 1500,
      beds,
      baths: Math.max(1, beds - (i % 2)),
      sqft: 640 + beds * 360 + ((i * 131) % 220),
      daysListed: 1 + ((i * 13) % 40),
      agent: AGENTS[i % AGENTS.length]!,
    }
  })

  const columns: GridColumns<Listing> = [
    { field: 'street', header: 'Address', width: 200 },
    { field: 'area', header: 'Area', width: 110 },
    { field: 'price', header: 'Price', width: 120, editorType: 'number', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'status', header: 'Status', width: 100 },
    { field: 'beds', header: 'Beds', width: 70, editorType: 'number' },
    { field: 'baths', header: 'Baths', width: 70, editorType: 'number' },
    { field: 'sqft', header: 'Size', width: 100, editorType: 'number', formatter: ({ value }) => `${Number(value).toLocaleString('en-US')} sq ft` },
    { field: 'daysListed', header: 'Days listed', width: 100, editorType: 'number' },
    { field: 'agent', header: 'Agent', width: 120 },
  ]

  let view = $state<'gallery' | 'table'>('gallery')
  let status = $state('All')
  let minBeds = $state(0)
  let sort = $state('price-asc')
  let saved = $state<Record<number, boolean>>({})
  let api = $state.raw<SvGridApi<any, Listing> | null>(null)
  $effect(() => {
    if (!api) return
    if (status === 'All') api.clearFilter('status')
    else api.setFilter('status', { operator: 'equals', value: status })
  })
  $effect(() => {
    if (!api) return
    if (minBeds === 0) api.clearFilter('beds')
    else api.setFilter('beds', { operator: 'greaterThan', value: String(minBeds - 1) })
  })
  $effect(() => {
    if (!api) return
    const [field, dir] = sort.split('-') as [string, 'asc' | 'desc']
    api.setSort(field, dir)
  })
  const price = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
</script>

<section class="ls flex flex-col gap-3 h-full min-h-0">
  <header class="flex flex-wrap items-center gap-3 shrink-0">
    <div class="ls-tabs" role="radiogroup" aria-label="Status">
      {#each ['All', ...STATUSES] as s (s)}
        <button type="button" role="radio" aria-checked={status === s} class:is-on={status === s} onclick={() => (status = s)}>{s}</button>
      {/each}
    </div>
    <select class="ls-select" aria-label="Bedrooms" bind:value={minBeds}>
      <option value={0}>Any beds</option>
      <option value={2}>2+ beds</option>
      <option value={3}>3+ beds</option>
      <option value={4}>4+ beds</option>
    </select>
    <select class="ls-select" aria-label="Sort" bind:value={sort}>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
      <option value="sqft-desc">Largest first</option>
      <option value="daysListed-asc">Newest listings</option>
    </select>
    <span class="flex-1"></span>
    <div class="ls-tabs" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked={view === 'gallery'} class:is-on={view === 'gallery'} onclick={() => (view = 'gallery')}>Gallery</button>
      <button type="button" role="radio" aria-checked={view === 'table'} class:is-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      {columns}
      getRowId={(r) => String(r.id)}
      sortable
      filterable
      containerHeight="100%"
      onApiReady={(a) => (api = a)}
      gallery={view === 'gallery' ? { card: listing, cardSize: 280, searchPlaceholder: 'Search by street, area or agent', emptyText: 'No listings match' } : undefined}
    />
  </div>
</section>

{#snippet listing(l: Listing)}
  <article class="lc">
    <div class="lc-media">
      <img src={l.photo} alt="" loading="lazy" decoding="async" />
      <span class="lc-status" data-status={l.status}><i></i>{l.status}</span>
      <button
        type="button"
        class="lc-save"
        class:is-on={saved[l.id]}
        aria-pressed={!!saved[l.id]}
        aria-label={saved[l.id] ? 'Saved' : 'Save listing'}
        onclick={() => (saved = { ...saved, [l.id]: !saved[l.id] })}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={saved[l.id] ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
      </button>
      {#if l.daysListed <= 3 && l.status === 'For sale'}<span class="lc-new">New</span>{/if}
    </div>
    <div class="lc-body">
      <strong class="lc-price">{price(l.price)}</strong>
      <span class="lc-facts"><b>{l.beds}</b> bd <i></i> <b>{l.baths}</b> ba <i></i> <b>{l.sqft.toLocaleString('en-US')}</b> sq ft</span>
      <span class="lc-addr">{l.street}, {l.area}</span>
      <span class="lc-agent">Listed by {l.agent} · {l.daysListed} {l.daysListed === 1 ? 'day' : 'days'} ago</span>
    </div>
  </article>
{/snippet}

<style>
  .ls { color: var(--sg-fg, #0f172a); }
  .ls-tabs { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .ls-tabs button {
    border: 0; border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer;
    background: none; color: var(--sg-muted, #64748b);
  }
  .ls-tabs button.is-on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12); }
  .ls-select {
    height: 32px; padding: 0 10px; border-radius: 999px; font: inherit; font-size: 13px;
    border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 12%, transparent); background: var(--sg-bg, #fff); color: inherit;
  }
  .lc {
    overflow: hidden; border-radius: 14px; background: var(--sg-bg, #fff);
    border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent);
    transition: box-shadow 0.18s ease, transform 0.18s ease;
  }
  .lc:hover { transform: translateY(-2px); box-shadow: 0 16px 32px -16px rgba(15, 23, 42, 0.4); }
  .lc-media { position: relative; aspect-ratio: 4 / 3; overflow: hidden; }
  .lc-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.45s ease; }
  .lc:hover .lc-media img { transform: scale(1.04); }
  .lc-status {
    position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
    border-radius: 999px; font-size: 11.5px; font-weight: 600; background: rgba(255, 255, 255, 0.94); color: #1f2937;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  .lc-status i { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; }
  .lc-status[data-status='Pending'] i { background: #d97706; }
  .lc-status[data-status='Sold'] i { background: #dc2626; }
  .lc-new {
    position: absolute; bottom: 10px; left: 10px; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase; background: #1f2937; color: #fff;
  }
  .lc-save {
    position: absolute; top: 8px; right: 8px; display: inline-flex; padding: 7px; border: 0; border-radius: 999px; cursor: pointer;
    background: rgba(255, 255, 255, 0.92); color: #1f2937; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  .lc-save.is-on { color: #dc2626; }
  .lc-body { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px 14px; }
  .lc-price { font-size: 20px; letter-spacing: -0.01em; }
  .lc-facts { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .lc-facts b { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .lc-facts i { width: 1px; height: 12px; margin: 0 4px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 18%, transparent); }
  .lc-addr { font-size: 13.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lc-agent { font-size: 12px; color: var(--sg-muted, #64748b); }
</style>
