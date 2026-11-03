<script lang="ts">
  /**
   * 710. SvGrid Base: personal views, locked views, protected fields
   * ----------------------------------------------------------------
   * What a team needs once several people share a base:
   *
   *  - A personal view (`personal: userId`) is listed only for the person it
   *    belongs to, under "My views". "Create" in the views menu has a
   *    "Personal view: only I see it" box. Switch "Signed in as" below: Ana
   *    and Ben each see their own.
   *  - A locked view (`locked: true`) keeps its filter, sorts, groups, hidden
   *    fields and colors as saved. Its settings buttons are off and the bar
   *    says who locked it; records can still be edited. A sort from a column
   *    header lasts until the view is shown again, and the bar offers Reset.
   *    The lock button in the views menu locks or unlocks a view; `lockViews`
   *    says who may (here Ana and Ben, not Cleo).
   *  - A protected field (`fieldProps.editors`) takes edits from the people
   *    listed only. Priority here is Ana's and Ben's to set: signed in as
   *    Cleo, its header shows a lock and its cells and the record view are
   *    read-only. Edit field > Who can edit its values sets the list.
   *
   * `onTablesChange` hands the views back with every change, so the app
   * stores them with the table, the personal ones with their owner.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, setCurrentUser, type BaseTable } from '@svgrid/enterprise/base'
  import { PEOPLE, usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STATUS = [
    { value: 'Todo', color: '#94a3b8' },
    { value: 'In progress', color: '#2d7ff9' },
    { value: 'In review', color: '#8b46ff' },
    { value: 'Done', color: '#20c933' },
  ]
  const PRIORITY = [
    { value: 'High', color: '#f82b60' },
    { value: 'Medium', color: '#fcb400' },
    { value: 'Low', color: '#94a3b8' },
  ]
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const TASKS: Array<[string, string, string, string, number]> = [
    ['Quarterly board deck', 'u2', 'In progress', 'High', 3],
    ['Hiring plan for Q1', 'u2', 'Todo', 'High', 9],
    ['Refresh the onboarding emails', 'u1', 'In review', 'Medium', 1],
    ['Fix the invoice PDF footer', 'u1', 'In progress', 'High', 2],
    ['Update the pricing FAQ', 'u1', 'Todo', 'Low', 12],
    ['Customer advisory board invites', 'u3', 'Todo', 'Medium', 6],
    ['Close the September books', 'u4', 'Done', 'High', -4],
    ['Vendor security review', 'u3', 'In progress', 'Medium', 5],
    ['Plan the team offsite', 'u2', 'Todo', 'Low', 20],
    ['Renew the SOC 2 report', 'u4', 'In review', 'High', 4],
  ]
  const ana = PEOPLE[0]!.id
  const ben = PEOPLE[1]!.id
  let tables = $state.raw<BaseTable[]>([
    {
      id: 'views-tasks',
      name: 'Team tasks',
      primaryField: 'task',
      data: TASKS.map(([task, owner, status, priority, due], i) => ({ id: `t${i + 1}`, task, owner, status, priority, due: day(due) })),
      columns: [
        { field: 'task', header: 'Task', width: 280, fieldType: 'text' },
        { field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'priority', header: 'Priority', width: 140, fieldType: 'singleSelect', fieldProps: { options: PRIORITY, editors: [ana, ben] } },
        { field: 'due', header: 'Due', width: 140, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
      ],
      views: [
        { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
        {
          id: 'leadership',
          name: 'Leadership report',
          type: 'grid',
          locked: true,
          lockedBy: ben,
          color: { mode: 'field', field: 'priority' },
          state: {
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'priority', kind: 'select', op: 'is', value: 'High' }] },
            grouping: ['status'],
            sorting: [{ id: 'due', desc: false }],
          },
        },
        { id: 'board', name: 'Status board', type: 'kanban', stackBy: 'status' },
        {
          id: 'ana-mine',
          name: 'My open tasks',
          type: 'grid',
          personal: ana,
          state: {
            advancedFilter: {
              kind: 'fieldFilter',
              conjunction: 'and',
              conditions: [
                { column: 'owner', kind: 'select', op: 'is', value: '@me' },
                { column: 'status', kind: 'select', op: 'isNot', value: 'Done' },
              ],
            },
            sorting: [{ id: 'due', desc: false }],
          },
        },
        {
          id: 'ben-hiring',
          name: 'Ben: by due date',
          type: 'grid',
          personal: ben,
          state: { sorting: [{ id: 'due', desc: false }], hiddenColumns: ['priority'] },
        },
      ],
    },
  ])

  // Who is signed in: whose personal views show, and whether they may lock views.
  const SIGNED_IN = PEOPLE.slice(0, 3)
  let who = $state(ana)
  const canLock = $derived(who === ana || who === ben)
  function signIn(id: string) {
    who = id
    setCurrentUser(PEOPLE.find((p) => p.id === id) ?? null)
  }
  const views = $derived(tables[0]?.views ?? [])
  const mine = $derived(views.filter((v) => v.personal === who).length)
</script>

<section class="base-demo">
  <div class="base-demo-bar">
    <span class="base-demo-label">Signed in as</span>
    <div class="base-demo-seg" role="radiogroup" aria-label="Signed in as">
      {#each SIGNED_IN as p (p.id)}
        <button type="button" role="radio" aria-checked={who === p.id} class:is-on={who === p.id} onclick={() => signIn(p.id)}>{p.name}</button>
      {/each}
    </div>
    <span class="base-demo-tip">
      {mine ? `${mine} personal ${mine === 1 ? 'view' : 'views'} under My views` : 'No personal views yet'}; {canLock ? 'may lock and unlock views' : 'cannot lock or unlock views'}; {canLock ? 'can set Priority' : 'sees Priority read-only'}. Open "Leadership report" to see a locked view.
    </span>
  </div>
  {#key who}
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
      lockViews={canLock}
    />
  {/key}
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .base-demo-label { font-size: 13px; color: var(--sg-muted, #64748b); }
  .base-demo-seg { display: inline-flex; padding: 2px; border-radius: var(--sg-radius, 6px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); }
  .base-demo-seg button {
    height: 28px; padding: 0 10px; border: 0; border-radius: calc(var(--sg-radius, 6px) - 2px); background: none;
    color: var(--sg-muted, #64748b); font: inherit; font-size: 13px; cursor: pointer;
  }
  .base-demo-seg button.is-on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 0 0 1px var(--sg-border, #e2e8f0); }
  .base-demo-tip { font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
