<script lang="ts">
  /**
   * 508. Gallery: cards from field types
   * ------------------------------------
   * With the fields module on (`@svgrid/enterprise/fields`), a gallery card
   * draws each field the way its cell does: a single select as a colored
   * pill, a multiple select as pills, a rating as stars, a person with an
   * avatar, a currency number with its symbol. The cover is the first image
   * of an attachment field. Each field's type icon sits beside its name.
   * Clicking a card picks it (`onCardClick`).
   */
  import { enableGalleryView } from '@svgrid/enterprise'
  import { enableFields, setFieldUsers, type Attachment } from '@svgrid/enterprise/fields'
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { editorialArt } from '../shared/gallery-art'

  enableGalleryView()
  enableFields()

  setFieldUsers([
    { id: 'u1', name: 'Ana Ruiz' },
    { id: 'u2', name: 'Ben Okafor' },
    { id: 'u3', name: 'Cleo Park' },
  ])

  // Campaign artwork drawn here (an editorial SVG per idea), so the demo needs no image host.
  const artwork = (i: number, name: string): Attachment => ({
    id: `art-${i}`,
    name: `${name.toLowerCase().replace(/\s+/g, '-')}.svg`,
    type: 'image/svg+xml',
    url: editorialArt(i + 1),
  })

  const STAGE = [
    { value: 'Concept', color: '#8b46ff' },
    { value: 'In review', color: '#fcb400' },
    { value: 'Approved', color: '#20c933' },
  ]
  const CHANNELS = [
    { value: 'Web', color: '#2d7ff9' },
    { value: 'Social', color: '#ff08c2' },
    { value: 'Print', color: '#ff6f2c' },
  ]
  const IDEAS = ['Autumn launch', 'Studio tour', 'Field notes', 'Night market', 'Coastline', 'Paper goods', 'Open house', 'Winter sale', 'Makers week']
  const rows = IDEAS.map((name, i) => ({
    id: i + 1,
    name,
    images: [artwork(i, name)],
    stage: STAGE[i % 3]!.value,
    channels: [CHANNELS[i % 3]!.value, ...(i % 2 ? [CHANNELS[(i + 1) % 3]!.value] : [])],
    owner: ['u1', 'u2', 'u3'][i % 3],
    score: 2 + (i % 4),
    budget: 1200 + i * 450,
  }))

  type Idea = (typeof rows)[number]
  const columns: GridColumns<Idea> = [
    { field: 'name', header: 'Idea', width: 180, fieldType: 'text' },
    { field: 'images', header: 'Images', width: 140, fieldType: 'attachment' },
    { field: 'stage', header: 'Stage', width: 120, fieldType: 'singleSelect', fieldProps: { options: STAGE } },
    { field: 'channels', header: 'Channels', width: 170, fieldType: 'multiSelect', fieldProps: { options: CHANNELS } },
    { field: 'owner', header: 'Owner', width: 140, fieldType: 'user' },
    { field: 'score', header: 'Score', width: 120, fieldType: 'rating', fieldProps: { max: 5, color: '#fcb400' } },
    { field: 'budget', header: 'Budget', width: 110, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0 } },
  ]

  let view = $state<'gallery' | 'table'>('gallery')
  let picked = $state('')
  const getRowId = (r: { id: number }) => String(r.id)
  const pick = (r: { name: string }) => (picked = r.name)
</script>

<section class="flex flex-col gap-3 h-full min-h-0">
  <div class="flex flex-wrap items-center gap-3 shrink-0">
    <p class="ft-note text-sm m-0 flex-1 min-w-[240px]">
      {picked ? `Picked: ${picked}` : 'Field types draw on the cards as in the cells. Click a card to pick it.'}
    </p>
    <div class="ft-switch inline-flex rounded-md overflow-hidden text-sm" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked={view === 'gallery'} class="px-3 py-1 {view === 'gallery' ? 'ft-on' : ''}" onclick={() => (view = 'gallery')}>Gallery</button>
      <button type="button" role="radio" aria-checked={view === 'table'} class="px-3 py-1 {view === 'table' ? 'ft-on' : ''}" onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      {columns}
      {getRowId}
      sortable
      containerHeight="100%"
      gallery={view === 'gallery'
        ? { coverField: 'images', titleField: 'name', onCardClick: pick, searchPlaceholder: 'Search ideas...' }
        : undefined}
    />
  </div>
</section>

<style>
  .ft-note { color: var(--sg-muted, #64748b); }
  .ft-switch { border: 1px solid var(--sg-border, #cbd5e1); background: none; color: var(--sg-fg, #0f172a); }
  .ft-on { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a); font-weight: 600; }
</style>
