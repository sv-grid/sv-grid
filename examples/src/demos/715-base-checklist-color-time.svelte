<script lang="ts">
  /**
   * 715. SvGrid Base: checklist, color and time of day fields
   * ----------------------------------------------------------
   * Three field types on a table of conference sessions.
   *
   * Prep is a checklist: the cell shows how many items are done and a bar.
   * Click it to tick, add, rename, drag or delete items. It sorts by the
   * share done, and the second view filters for sessions not complete yet.
   *
   * Track is a color: a swatch and the hex code. The editor offers the 40
   * option colors and a box for a hex code; a paste reads #rgb, #rrggbb,
   * rgb() or a CSS name such as "navy".
   *
   * Starts and Ends are times of day with no date, stored as 'HH:MM'. Starts
   * shows a 12-hour clock, Ends a 24-hour one. Type "9:30 am", "14:05" or
   * "2pm"; Up and Down in the editor move by 15 minutes.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const steps = (done: number, ...names: string[]) => names.map((text, i) => ({ id: `s${i}`, text, done: i < done }))
  const SESSIONS: Array<[string, string, string, string, string, ReturnType<typeof steps>]> = [
    ['Opening keynote', '#2d7ff9', '09:00', '09:45', 'u1', steps(4, 'Slides final', 'Speaker briefed', 'Mic check', 'Livestream link')],
    ['Runes in practice', '#20c933', '10:00', '10:40', 'u3', steps(2, 'Slides final', 'Demo repo tagged', 'Mic check')],
    ['Grids at a million rows', '#8b46ff', '10:00', '10:40', 'u4', steps(1, 'Slides final', 'Benchmark rerun', 'Laptop on venue wifi', 'Mic check')],
    ['Lunch', '#fcb400', '12:00', '13:00', 'u6', steps(1, 'Dietary list sent', 'Count confirmed')],
    ['Forms without a library', '#20c933', '13:15', '13:55', 'u2', steps(0, 'Slides final', 'Mic check')],
    ['Accessible tables', '#ff6f2c', '14:00', '14:40', 'u5', steps(3, 'Slides final', 'Screen reader demo', 'Captions file')],
    ['Shipping a design system', '#8b46ff', '15:30', '16:10', 'u7', steps(1, 'Slides final', 'Figma file shared', 'Mic check')],
    ['Closing panel', '#2d7ff9', '16:30', '17:15', 'u8', steps(0, 'Panelists confirmed', 'Questions collected', 'Mic check')],
  ]
  const data = SESSIONS.map(([session, track, starts, ends, host, prep], i) => ({ id: `e${i + 1}`, session, track, starts, ends, host, prep }))

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'conf-sessions',
      name: 'Sessions',
      primaryField: 'session',
      data,
      columns: [
        { field: 'session', header: 'Session', width: 240, fieldType: 'text' },
        { field: 'track', header: 'Track', width: 130, fieldType: 'color' },
        { field: 'starts', header: 'Starts', width: 110, fieldType: 'timeOfDay', fieldProps: { timeFormat: '12hour' } },
        { field: 'ends', header: 'Ends', width: 100, fieldType: 'timeOfDay', fieldProps: { timeFormat: '24hour' } },
        { field: 'prep', header: 'Prep', width: 170, fieldType: 'checklist' },
        { field: 'host', header: 'Host', width: 160, fieldType: 'user' },
      ],
      views: [
        { id: 'agenda', name: 'Agenda', type: 'grid', state: { sorting: [{ id: 'starts', desc: false }] } },
        {
          id: 'open-prep',
          name: 'Prep not done',
          type: 'grid',
          state: {
            sorting: [{ id: 'prep', desc: false }],
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'prep', kind: 'checklist', op: 'notAllDone' }] },
          },
        },
      ],
      props: { rowAdder: { label: 'Add session' } },
    },
  ])
</script>

<section class="base-demo">
  <p class="base-demo-tip">
    Click a Prep cell to tick or add items, double-click a Track to pick a color, or select a Starts cell and type <kbd>2pm</kbd>.
    Copy a Prep cell and paste it into another: it copies as <code>[x] item [ ] item</code>.
  </p>
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    columnAdder
    fieldMenu
  />
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .base-demo-tip kbd,
  .base-demo-tip code {
    padding: 1px 5px; font: inherit; font-size: 12px; border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); color: var(--sg-fg, #0f172a);
  }
</style>
