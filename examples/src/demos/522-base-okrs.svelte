<script lang="ts">
  /**
   * 522. SvGrid Base: OKRs
   * ----------------------
   * Objectives and key results as a ready-to-use base. An objective has a
   * quarter, an owner and its key results; its progress is the average of
   * theirs (a rollup). A key result measures something from a start value
   * to a target; its progress is a formula over Start, Current and Target,
   * and its confidence says whether it will get there.
   *
   * Views: key results grouped by objective, the confidence board, progress
   * by objective as a chart, and the weekly check-in grid.
   *
   * Automations ("2 automations" in the view bar of Key results):
   *  - a key result that falls Off track turns red and raises a notice;
   *  - one that reaches its target is marked Achieved and celebrated.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const QUARTERS = [
    { value: 'Q3', color: '#94a3b8' },
    { value: 'Q4', color: '#2d7ff9' },
    { value: 'Q1 next year', color: '#8b46ff' },
  ]
  const CONFIDENCE = [
    { value: 'On track', color: '#20c933' },
    { value: 'At risk', color: '#fcb400' },
    { value: 'Off track', color: '#f82b60' },
    { value: 'Achieved', color: '#2d7ff9' },
  ]

  const objectives = [
    { id: 'o1', objective: 'Make onboarding effortless', quarter: 'Q4', owner: 'u1' },
    { id: 'o2', objective: 'Grow revenue from existing customers', quarter: 'Q4', owner: 'u2' },
    { id: 'o3', objective: 'Ship a faster product', quarter: 'Q4', owner: 'u3' },
    { id: 'o4', objective: 'Build a team people want to join', quarter: 'Q3', owner: 'u4' },
  ]
  // [key result, objective, start, current, target, unit, confidence, updated (days ago)]
  const KRS: Array<[string, string, number, number, number, string, string, number]> = [
    ['Time to first value under 10 minutes', 'o1', 34, 18, 10, 'minutes', 'On track', 2],
    ['Activation rate to 60%', 'o1', 41, 47, 60, '%', 'At risk', 4],
    ['Support tickets per new account to 0.5', 'o1', 1.8, 1.6, 0.5, 'tickets', 'Off track', 6],
    ['Net revenue retention to 115%', 'o2', 104, 109, 115, '%', 'On track', 1],
    ['Upgrade 40 accounts to the annual plan', 'o2', 0, 26, 40, 'accounts', 'On track', 3],
    ['Page load (p75) under 1.2 s', 'o3', 2.4, 1.5, 1.2, 'seconds', 'At risk', 2],
    ['Crash-free sessions to 99.8%', 'o3', 99.1, 99.8, 99.8, '%', 'Achieved', 5],
    ['Hire 6 engineers', 'o4', 0, 5, 6, 'people', 'On track', 9],
    ['Engagement score to 80', 'o4', 71, 74, 80, 'points', 'At risk', 12],
  ]
  const keyResults = KRS.map(([kr, objective, start, current, target, unit, confidence, updated], i) => ({
    id: `k${i + 1}`,
    kr,
    objective: [objective],
    start,
    current,
    target,
    unit,
    confidence,
    updated: day(-updated),
  }))
  const withLinks = objectives.map((o) => ({ ...o, krs: keyResults.filter((k) => k.objective[0] === o.id).map((k) => k.id) }))

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'okr-krs',
      name: 'Key results',
      primaryField: 'kr',
      data: keyResults,
      columns: [
        { field: 'kr', header: 'Key result', width: 300, fieldType: 'text' },
        { field: 'objective', header: 'Objective', width: 240, fieldType: 'link', fieldProps: { table: 'okr-objectives', multiple: false, inverse: 'krs' } },
        { field: 'progress', header: 'Progress', width: 160, fieldType: 'formula', fieldProps: { formula: 'MAX(0, MIN(1, ({Current} - {Start}) / ({Target} - {Start})))', result: 'percent', precision: 0 } },
        { field: 'confidence', header: 'Confidence', width: 130, fieldType: 'singleSelect', fieldProps: { options: CONFIDENCE } },
        { field: 'start', header: 'Start', width: 90, fieldType: 'number', fieldProps: { format: 'decimal', precision: 1 } },
        { field: 'current', header: 'Current', width: 100, fieldType: 'number', fieldProps: { format: 'decimal', precision: 1 } },
        { field: 'target', header: 'Target', width: 90, fieldType: 'number', fieldProps: { format: 'decimal', precision: 1 } },
        { field: 'unit', header: 'Unit', width: 100, fieldType: 'text' },
        { field: 'updated', header: 'Checked in', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
      ],
      views: [
        { id: 'by-objective', name: 'By objective', type: 'grid', color: { mode: 'field', field: 'confidence' }, state: { grouping: ['objective'] } },
        { id: 'board', name: 'Confidence', type: 'kanban', stackBy: 'confidence' },
        { id: 'checkin', name: 'Weekly check-in', type: 'grid', state: { hiddenColumns: ['objective', 'start', 'unit'], sorting: [{ id: 'updated', desc: false }] } },
      ],
      automations: [
        {
          id: 'off-track',
          name: 'Off track',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'confidence', kind: 'select', op: 'is', value: 'Off track' }] },
          actions: [
            { type: 'highlight', background: '#fee2e2', color: '#991b1b' },
            { type: 'notify', message: '{Key result} is off track ({Objective})', severity: 'error' },
          ],
        },
        {
          id: 'achieved',
          name: 'Target reached',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'progress', kind: 'number', op: 'gte', value: 1 }] },
          actions: [
            { type: 'updateRecord', values: { confidence: 'Achieved', updated: 'today' } },
            { type: 'notify', message: 'Achieved: {Key result}', severity: 'success' },
          ],
        },
      ],
      props: { rowAdder: { label: 'Add key result', defaults: () => ({ start: 0, current: 0, target: 1, confidence: 'On track', updated: day(0) }) } },
    },
    {
      id: 'okr-objectives',
      name: 'Objectives',
      primaryField: 'objective',
      data: withLinks,
      columns: [
        { field: 'objective', header: 'Objective', width: 300, fieldType: 'text' },
        { field: 'quarter', header: 'Quarter', width: 130, fieldType: 'singleSelect', fieldProps: { options: QUARTERS } },
        { field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { field: 'krs', header: 'Key results', width: 320, fieldType: 'link', fieldProps: { table: 'okr-krs', multiple: true, inverse: 'objective' } },
        { field: 'progress', header: 'Progress', width: 140, fieldType: 'rollup', fieldProps: { linkField: 'krs', field: 'progress', aggregation: 'AVERAGE' } },
      ],
      views: [
        { id: 'all', name: 'All objectives', type: 'grid', state: { grouping: ['quarter'] } },
        { id: 'chart', name: 'Progress by objective', type: 'chart', chart: { kind: 'barH', x: 'objective', y: 'progress', aggregation: 'avg' } },
      ],
      props: { rowAdder: { label: 'Add objective', defaults: () => ({ quarter: 'Q4', krs: [] }) } },
    },
  ])
</script>

<section class="base-demo">
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    pinSplitter
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
