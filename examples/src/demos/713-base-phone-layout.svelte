<script lang="ts">
  /**
   * 713. SvGrid Base: phone layout
   * ------------------------------
   * The same base at three widths. Narrower than 600px (the base's own
   * width, not the window's; `phoneLayout` changes it), a grid view shows
   * each record as a card: its name and the next four fields the view shows,
   * in the view's filter and sort. A tap opens the record, and "+" adds one.
   * The view bar keeps its icons, the tab bar its tabs, and on a phone the
   * opened record fills the screen.
   *
   * Kanban, calendar, gallery and form views are already made of cards and
   * work as they are; the field visits below have a board by status.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'
  import { housePhoto } from '../shared/gallery-art'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const STATUS = [
    { value: 'Scheduled', color: '#2d7ff9' },
    { value: 'On site', color: '#fcb400' },
    { value: 'Needs parts', color: '#f82b60' },
    { value: 'Done', color: '#20c933' },
  ]
  const JOB = [
    { value: 'Boiler service', color: '#ff6f2c' },
    { value: 'Leak', color: '#2d7ff9' },
    { value: 'Install', color: '#8b46ff' },
    { value: 'Inspection', color: '#20c933' },
  ]
  const VISITS: Array<[string, string, string, string, string, number, number]> = [
    ['14 Harbour Lane', 'Boiler service', 'On site', 'u2', 'Pressure drops overnight; customer home after 2pm.', 0, 1],
    ['9 Mill Street, flat 3', 'Leak', 'Scheduled', 'u4', 'Water under the kitchen sink. Key with the neighbour at no. 11.', 0, 2],
    ['221 Quarry Road', 'Install', 'Needs parts', 'u2', 'Wrong valve delivered; new one ordered for Thursday.', 1, 1],
    ['3 Orchard Close', 'Inspection', 'Scheduled', 'u5', 'Annual gas safety check for the landlord.', 1, 2],
    ['58 Station Approach', 'Boiler service', 'Scheduled', 'u4', 'Error code F28 on the display.', 2, 1],
    ['7 Willow Court', 'Leak', 'Done', 'u5', 'Replaced the compression fitting under the bath.', -1, 2],
    ['102 Bridge Road', 'Install', 'Scheduled', 'u2', 'New radiator in the back bedroom, customer supplies it.', 3, 1],
    ['16 Kiln Yard', 'Inspection', 'Done', 'u4', 'Passed. Certificate emailed.', -2, 2],
  ]
  let tables = $state.raw<BaseTable[]>([
    {
      id: 'phone-visits',
      name: 'Visits',
      primaryField: 'address',
      data: VISITS.map(([address, job, status, tech, notes, when, floors], i) => ({
        id: `v${i + 1}`,
        address,
        job,
        status,
        tech,
        date: day(when),
        notes,
        photos: [{ id: `p${i + 1}`, name: 'front.svg', url: housePhoto(i + 2, floors === 2 ? 2 : 1), type: 'image/svg+xml' }],
      })),
      columns: [
        { field: 'address', header: 'Address', width: 220, fieldType: 'text' },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'date', header: 'Visit', width: 140, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'tech', header: 'Technician', width: 160, fieldType: 'user' },
        { field: 'job', header: 'Job', width: 140, fieldType: 'singleSelect', fieldProps: { options: JOB } },
        { field: 'notes', header: 'Notes', width: 300, fieldType: 'longText' },
        { field: 'photos', header: 'Photos', width: 140, fieldType: 'attachment' },
      ],
      views: [
        {
          id: 'today',
          name: 'Upcoming visits',
          type: 'grid',
          color: { mode: 'field', field: 'status' },
          state: {
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'isNot', value: 'Done' }] },
            sorting: [{ id: 'date', desc: false }],
          },
        },
        { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
        { id: 'all', name: 'All visits', type: 'grid' },
      ],
      props: { rowAdder: { label: 'Add visit', defaults: () => ({ status: 'Scheduled', date: day(1) }) } },
    },
  ])

  const WIDTHS = [
    { id: 'phone', label: 'Phone', width: 390 },
    { id: 'tablet', label: 'Tablet', width: 768 },
    { id: 'desktop', label: 'Desktop', width: 0 },
  ]
  let size = $state('phone')
  const width = $derived(WIDTHS.find((w) => w.id === size)?.width ?? 0)
</script>

<section class="base-demo">
  <div class="base-demo-bar">
    <div class="base-demo-seg" role="radiogroup" aria-label="Screen width">
      {#each WIDTHS as w (w.id)}
        <button type="button" role="radio" aria-checked={size === w.id} class:is-on={size === w.id} onclick={() => (size = w.id)}>{w.label}{w.width ? ` (${w.width}px)` : ''}</button>
      {/each}
    </div>
    <span class="base-demo-tip">{width && width < 600 ? 'Records as cards: tap one to open it, + adds a visit.' : 'Wider than 600px: the grid.'}</span>
  </div>
  <div class="base-demo-stage" class:is-device={width > 0}>
    <div class="base-demo-device" style:width={width ? `${width}px` : '100%'}>
      <SvBase
        bind:tables
        editable
        sortable
        expandRows
        showRowNumbers={width === 0}
        rowNumberWidth={64}
        showRowSelection={false}
        rowHeight={40}
        containerHeight="100%"
        fieldMenu
      />
    </div>
  </div>
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 640px; height: 100%; gap: 10px; }
  .base-demo-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .base-demo-seg { display: inline-flex; padding: 2px; border-radius: var(--sg-radius, 6px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); }
  .base-demo-seg button {
    height: 28px; padding: 0 10px; border: 0; border-radius: calc(var(--sg-radius, 6px) - 2px); background: none;
    color: var(--sg-muted, #64748b); font: inherit; font-size: 13px; cursor: pointer;
  }
  .base-demo-seg button.is-on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 0 0 1px var(--sg-border, #e2e8f0); }
  .base-demo-tip { font-size: 13px; color: var(--sg-muted, #64748b); }
  .base-demo-stage { flex: 1; min-height: 0; display: flex; justify-content: center; }
  .base-demo-stage.is-device { padding: 8px 0; background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); border-radius: var(--sg-radius-lg, 10px); }
  .base-demo-device { max-width: 100%; height: 100%; min-height: 560px; }
  .is-device .base-demo-device { max-height: 760px; box-shadow: 0 0 0 8px var(--sg-fg, #0f172a); border-radius: 18px; overflow: hidden; }
</style>
