<script lang="ts">
  /**
   * 524. SvGrid Base: employee onboarding
   * -------------------------------------
   * New hires, the teams they join and the checklist that gets them ready,
   * as a ready-to-use base with three tables. A person has a photo, a role,
   * a department, a manager, a start date and a status; their checklist
   * items each have an owner (IT, HR or the manager) and a due date.
   * Departments list their people and count them.
   *
   * Views: the people board by status, a photo directory, start dates on a
   * calendar, the directory grouped by department, and the "Add a new hire"
   * form.
   *
   * Automations ("3 automations" in the view bar of People):
   *  - a new hire, from "+ Add row" or the form, gets a checklist: three
   *    items created in the Checklist table and linked back to them;
   *  - someone starting within a week who is not active yet has their start
   *    date colored;
   *  - "Activate" in the Ready column marks them Active.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type Attachment, type BaseTable } from '@svgrid/enterprise/base'
  import { portrait } from '../shared/gallery-art'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const STATUS = [
    { value: 'Offer signed', color: '#8b46ff' },
    { value: 'Onboarding', color: '#fcb400' },
    { value: 'Active', color: '#20c933' },
  ]
  const OWNERS = [
    { value: 'IT', color: '#2d7ff9' },
    { value: 'HR', color: '#ff08c2' },
    { value: 'Manager', color: '#ff6f2c' },
  ]
  const departments = [
    { id: 'd1', department: 'Engineering', head: 'u2' },
    { id: 'd2', department: 'Design', head: 'u1' },
    { id: 'd3', department: 'Sales', head: 'u4' },
  ]
  // [name, role, department, start (days from today), manager, status]
  const HIRES: Array<[string, string, string, number, string, string]> = [
    ['Priya Nair', 'Frontend engineer', 'd1', 4, 'u2', 'Onboarding'],
    ['Lucas Moreau', 'Product designer', 'd2', 11, 'u1', 'Offer signed'],
    ['Aiko Tanaka', 'Account executive', 'd3', -20, 'u4', 'Active'],
    ['Diego Alvarez', 'Backend engineer', 'd1', 2, 'u2', 'Onboarding'],
    ['Nora Lindqvist', 'Sales engineer', 'd3', 25, 'u4', 'Offer signed'],
    ['Samuel Okoye', 'Data engineer', 'd1', -45, 'u3', 'Active'],
  ]
  const photo = (i: number): Attachment[] => [{ id: `p${i}`, name: `photo-${i}.svg`, type: 'image/svg+xml', url: portrait(i + 11) }]
  let nextId = HIRES.length + 1
  const people = HIRES.map(([name, role, department, start, manager, status], i) => ({
    id: `h${i + 1}`,
    name,
    photo: photo(i),
    role,
    department: [department],
    start: day(start),
    manager,
    status,
    email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
  }))
  const ITEMS: Array<[string, string, string, number, boolean]> = [
    ['Laptop and accounts for Priya', 'h1', 'IT', 2, true],
    ['Contract and payroll for Priya', 'h1', 'HR', 1, true],
    ['First-week plan for Priya', 'h1', 'Manager', 3, false],
    ['Laptop and accounts for Diego', 'h4', 'IT', 1, false],
    ['Contract and payroll for Diego', 'h4', 'HR', -1, true],
    ['Laptop and accounts for Lucas', 'h2', 'IT', 9, false],
  ]
  const checklist = ITEMS.map(([item, person, owner, due, done], i) => ({ id: `c${i + 1}`, item, person: [person], owner, due: day(due), done }))
  const withLinks = people.map((p) => ({ ...p, checklist: checklist.filter((c) => c.person[0] === p.id).map((c) => c.id) }))
  const depts = departments.map((d) => ({ ...d, people: people.filter((p) => p.department[0] === d.id).map((p) => p.id) }))

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'onb-people',
      name: 'People',
      primaryField: 'name',
      data: withLinks,
      columns: [
        { field: 'name', header: 'Name', width: 190, fieldType: 'text' },
        { field: 'photo', header: 'Photo', width: 90, fieldType: 'attachment', fieldProps: { accept: 'image/*', maxFiles: 1 } },
        { field: 'status', header: 'Status', width: 140, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'ready', header: 'Ready', width: 104, fieldType: 'button', fieldProps: { label: 'Activate', color: '#20c933' } },
        { field: 'role', header: 'Role', width: 180, fieldType: 'text' },
        { field: 'department', header: 'Department', width: 150, fieldType: 'link', fieldProps: { table: 'onb-departments', multiple: false, inverse: 'people' } },
        { field: 'start', header: 'Start date', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'manager', header: 'Manager', width: 160, fieldType: 'user' },
        { field: 'email', header: 'Email', width: 200, fieldType: 'email' },
        { field: 'checklist', header: 'Checklist', width: 280, fieldType: 'link', fieldProps: { table: 'onb-checklist', multiple: true, inverse: 'person' } },
        { field: 'items', header: 'Items', width: 90, fieldType: 'count', fieldProps: { linkField: 'checklist' } },
      ],
      views: [
        { id: 'board', name: 'Pipeline', type: 'kanban', stackBy: 'status' },
        { id: 'directory', name: 'Photo directory', type: 'gallery', coverField: 'photo' },
        { id: 'starts', name: 'Start dates', type: 'calendar', dateField: 'start', color: { mode: 'field', field: 'status' } },
        { id: 'by-team', name: 'By department', type: 'grid', state: { grouping: ['department'] } },
        { id: 'hire', name: 'Add a new hire', type: 'form', formFields: ['name', 'role', 'department', 'start', 'manager', 'email', 'photo'], formTitle: 'Add a new hire', formDescription: 'Their checklist is made for IT, HR and their manager as soon as you submit.' },
      ],
      automations: [
        {
          id: 'checklist',
          name: 'New hire gets a checklist',
          enabled: true,
          trigger: { type: 'recordCreated' },
          actions: [
            { type: 'updateRecord', values: { status: 'Offer signed' } },
            { type: 'createRecord', table: 'onb-checklist', values: { item: 'Laptop and accounts for {Name}', owner: 'IT', due: 'today+5' }, linkField: 'person' },
            { type: 'createRecord', table: 'onb-checklist', values: { item: 'Contract and payroll for {Name}', owner: 'HR', due: 'today+3' }, linkField: 'person' },
            { type: 'createRecord', table: 'onb-checklist', values: { item: 'First-week plan for {Name}', owner: 'Manager', due: 'today+7' }, linkField: 'person' },
            { type: 'notify', message: 'Checklist ready for {Name}', severity: 'success' },
          ],
        },
        {
          id: 'soon',
          name: 'Starting this week',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: {
            kind: 'fieldFilter',
            conjunction: 'and',
            conditions: [
              { column: 'start', kind: 'date', op: 'isWithin', value: { span: 'nextWeek' } },
              { column: 'status', kind: 'select', op: 'isNot', value: 'Active' },
            ],
          },
          actions: [{ type: 'highlight', fields: ['start'], background: '#fef3c7', color: '#92400e' }],
        },
        {
          id: 'activate',
          name: 'Activate',
          enabled: true,
          trigger: { type: 'button', field: 'ready' },
          actions: [{ type: 'updateRecord', values: { status: 'Active' } }, { type: 'notify', message: 'Welcome aboard, {Name}', severity: 'success' }],
        },
      ],
      props: { rowAdder: { label: 'Add person', defaults: () => ({ id: `h${nextId++}`, photo: [], checklist: [] }) } },
    },
    {
      id: 'onb-checklist',
      name: 'Checklist',
      primaryField: 'item',
      data: checklist,
      columns: [
        { field: 'item', header: 'Item', width: 280, fieldType: 'text' },
        { field: 'person', header: 'Person', width: 180, fieldType: 'link', fieldProps: { table: 'onb-people', multiple: false, inverse: 'checklist' } },
        { field: 'owner', header: 'Owner', width: 120, fieldType: 'singleSelect', fieldProps: { options: OWNERS } },
        { field: 'due', header: 'Due', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'done', header: 'Done', width: 80, fieldType: 'checkbox', fieldProps: { color: '#20c933' } },
      ],
      views: [
        { id: 'open', name: 'By person', type: 'grid', state: { grouping: ['person'], sorting: [{ id: 'due', desc: false }] } },
        { id: 'owners', name: 'By owner', type: 'kanban', stackBy: 'owner' },
      ],
      props: { rowAdder: { label: 'Add item', defaults: () => ({ done: false }) } },
    },
    {
      id: 'onb-departments',
      name: 'Departments',
      primaryField: 'department',
      data: depts,
      columns: [
        { field: 'department', header: 'Department', width: 180, fieldType: 'text' },
        { field: 'head', header: 'Head', width: 160, fieldType: 'user' },
        { field: 'people', header: 'People', width: 340, fieldType: 'link', fieldProps: { table: 'onb-people', multiple: true, inverse: 'department' } },
        { field: 'headcount', header: 'Headcount', width: 120, fieldType: 'count', fieldProps: { linkField: 'people' } },
      ],
      views: [{ id: 'all', name: 'All departments', type: 'grid' }],
      props: { rowAdder: { label: 'Add department' } },
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
    rowHeight={44}
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
