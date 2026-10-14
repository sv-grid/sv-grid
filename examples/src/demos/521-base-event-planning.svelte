<script lang="ts">
  /**
   * 521. SvGrid Base: event planning
   * --------------------------------
   * A year of events as a ready-to-use base with three tables: Events,
   * Attendees and the Checklist that gets each event done. An event has a
   * date, a venue, a status, a budget and a capacity; it counts who
   * registered and works out the seats left (a formula). Attendees have a
   * ticket type and check in on the day. Checklist items belong to an event
   * and have an owner and a due date.
   *
   * Views: the events calendar, the planning board by status, the guest
   * list grouped by event, tickets by type as a donut, and the RSVP form.
   *
   * Automations ("3 automations" in the view bar of Events and Attendees):
   *  - an event that turns Confirmed gets its checklist: three items
   *    created in the Checklist table and linked back to it;
   *  - an event with no seats left turns red and raises a notice;
   *  - someone who RSVPs with the form is told they are in.
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

  const STATUS = [
    { value: 'Idea', color: '#94a3b8' },
    { value: 'Planning', color: '#fcb400' },
    { value: 'Confirmed', color: '#2d7ff9' },
    { value: 'Done', color: '#20c933' },
  ]
  const TICKETS = [
    { value: 'General', color: '#2d7ff9' },
    { value: 'VIP', color: '#8b46ff' },
    { value: 'Speaker', color: '#ff6f2c' },
    { value: 'Press', color: '#20d9d2' },
  ]
  const TEAMS = [
    { value: 'Venue', color: '#2d7ff9' },
    { value: 'Catering', color: '#20c933' },
    { value: 'Marketing', color: '#ff6f2c' },
  ]

  const events = [
    { id: 'e1', event: 'Customer summit', date: day(12), venue: 'Harbor Hall, Lisbon', status: 'Confirmed', budget: 42000, capacity: 6, owner: 'u1' },
    { id: 'e2', event: 'Partner dinner', date: day(5), venue: 'Casa Azul, Porto', status: 'Confirmed', budget: 6500, capacity: 4, owner: 'u2' },
    { id: 'e3', event: 'Product launch webinar', date: day(26), venue: 'Online', status: 'Planning', budget: 3000, capacity: 500, owner: 'u3' },
    { id: 'e4', event: 'Design meetup', date: day(40), venue: 'The Foundry, Berlin', status: 'Idea', budget: 1200, capacity: 60, owner: 'u4' },
    { id: 'e5', event: 'Team offsite', date: day(-9), venue: 'Lake house, Sintra', status: 'Done', budget: 15800, capacity: 25, owner: 'u1' },
  ]
  const PEOPLE: Array<[string, string, string, string, string, boolean]> = [
    ['Maria Anders', 'maria@northwind.example', 'Northwind', 'e1', 'VIP', false],
    ['Ken Sato', 'ken@contoso.example', 'Contoso', 'e1', 'General', false],
    ['Rita Gomez', 'rita@fabrikam.example', 'Fabrikam', 'e1', 'Speaker', false],
    ['Tom Wood', 'tom@tailspin.example', 'Tailspin', 'e1', 'General', false],
    ['Lee Wong', 'lee@adatum.example', 'Adatum', 'e1', 'Press', false],
    ['Omar Haddad', 'omar@litware.example', 'Litware', 'e2', 'VIP', false],
    ['Eva Novak', 'eva@proseware.example', 'Proseware', 'e2', 'VIP', false],
    ['Sam Reyes', 'sam@woodgrove.example', 'Woodgrove', 'e2', 'General', false],
    ['Ines Costa', 'ines@lucerne.example', 'Lucerne', 'e3', 'General', false],
    ['Jon Berg', 'jon@fourthcoffee.example', 'Fourth Coffee', 'e3', 'Speaker', false],
    ['Ana Lima', 'ana@relecloud.example', 'Relecloud', 'e5', 'General', true],
    ['Ravi Iyer', 'ravi@wingtip.example', 'Wingtip', 'e5', 'General', true],
  ]
  let nextAttendee = PEOPLE.length + 1
  const attendees = PEOPLE.map(([name, email, company, event, ticket, checkedIn], i) => ({ id: `a${i + 1}`, name, email, company, event: [event], ticket, checkedIn }))
  const checklist = [
    { id: 'c1', item: 'Sign the venue contract', event: ['e1'], team: 'Venue', due: day(-2), done: true },
    { id: 'c2', item: 'Order catering for 120', event: ['e1'], team: 'Catering', due: day(6), done: false },
    { id: 'c3', item: 'Send the agenda to attendees', event: ['e1'], team: 'Marketing', due: day(8), done: false },
    { id: 'c4', item: 'Book a private room', event: ['e2'], team: 'Venue', due: day(1), done: true },
    { id: 'c5', item: 'Set up the webinar page', event: ['e3'], team: 'Marketing', due: day(14), done: false },
  ]
  const withLinks = events.map((e) => ({
    ...e,
    attendees: attendees.filter((a) => a.event[0] === e.id).map((a) => a.id),
    checklist: checklist.filter((c) => c.event[0] === e.id).map((c) => c.id),
  }))

  const statusIs = (value: string) => ({ kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }] })

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'events-events',
      name: 'Events',
      primaryField: 'event',
      data: withLinks,
      columns: [
        { field: 'event', header: 'Event', width: 220, fieldType: 'text' },
        { field: 'date', header: 'Date', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'venue', header: 'Venue', width: 200, fieldType: 'text' },
        { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
        { field: 'budget', header: 'Budget', width: 120, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } },
        { field: 'capacity', header: 'Capacity', width: 110, fieldType: 'number', fieldProps: { format: 'integer' } },
        { field: 'attendees', header: 'Attendees', width: 240, fieldType: 'link', fieldProps: { table: 'events-attendees', multiple: true, inverse: 'event' } },
        { field: 'registered', header: 'Registered', width: 120, fieldType: 'count', fieldProps: { linkField: 'attendees' } },
        { field: 'left', header: 'Seats left', width: 120, fieldType: 'formula', fieldProps: { formula: '{Capacity} - {Registered}', result: 'number', precision: 0 } },
        { field: 'checklist', header: 'Checklist', width: 240, fieldType: 'link', fieldProps: { table: 'events-checklist', multiple: true, inverse: 'event' } },
      ],
      views: [
        { id: 'calendar', name: 'Calendar', type: 'calendar', dateField: 'date', color: { mode: 'field', field: 'status' } },
        { id: 'board', name: 'Planning board', type: 'kanban', stackBy: 'status' },
        { id: 'all', name: 'All events', type: 'grid', color: { mode: 'field', field: 'status' }, state: { sorting: [{ id: 'date', desc: false }] } },
      ],
      automations: [
        {
          id: 'confirmed',
          name: 'Confirmed event gets its checklist',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: statusIs('Confirmed'),
          actions: [
            { type: 'createRecord', table: 'events-checklist', values: { item: 'Sign the venue contract', team: 'Venue', due: 'today+3' }, linkField: 'event' },
            { type: 'createRecord', table: 'events-checklist', values: { item: 'Book catering', team: 'Catering', due: 'today+7' }, linkField: 'event' },
            { type: 'createRecord', table: 'events-checklist', values: { item: 'Announce {Event}', team: 'Marketing', due: 'today+2' }, linkField: 'event' },
            { type: 'notify', message: '{Event} is confirmed: its checklist is ready', severity: 'success' },
          ],
        },
        {
          id: 'full',
          name: 'Sold out',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'left', kind: 'number', op: 'lte', value: 0 }] },
          actions: [
            { type: 'highlight', fields: ['left', 'registered'], background: '#fee2e2', color: '#991b1b' },
            { type: 'notify', message: '{Event} is full ({Registered} of {Capacity})', severity: 'warning' },
          ],
        },
      ],
      props: { rowAdder: { label: 'Add event', defaults: () => ({ status: 'Idea', attendees: [], checklist: [] }) } },
    },
    {
      id: 'events-attendees',
      name: 'Attendees',
      primaryField: 'name',
      data: attendees,
      columns: [
        { field: 'name', header: 'Name', width: 190, fieldType: 'text' },
        { field: 'event', header: 'Event', width: 200, fieldType: 'link', fieldProps: { table: 'events-events', multiple: false, inverse: 'attendees' } },
        { field: 'ticket', header: 'Ticket', width: 120, fieldType: 'singleSelect', fieldProps: { options: TICKETS } },
        { field: 'email', header: 'Email', width: 230, fieldType: 'email' },
        { field: 'company', header: 'Company', width: 160, fieldType: 'text' },
        { field: 'checkedIn', header: 'Checked in', width: 110, fieldType: 'checkbox', fieldProps: { color: '#20c933' } },
      ],
      views: [
        { id: 'guests', name: 'Guest list', type: 'grid', state: { grouping: ['event'] } },
        { id: 'tickets', name: 'Tickets by type', type: 'chart', chart: { kind: 'donut', x: 'ticket' } },
        { id: 'rsvp', name: 'RSVP', type: 'form', formFields: ['name', 'email', 'company', 'event', 'ticket'], formTitle: 'Save your seat', formDescription: 'Pick the event and the ticket. We send the details by email.' },
      ],
      automations: [
        {
          id: 'rsvp',
          name: 'Welcome a guest',
          enabled: true,
          trigger: { type: 'formSubmitted', view: 'rsvp' },
          actions: [{ type: 'notify', message: '{Name} is in for {Event}', severity: 'success' }],
        },
      ],
      props: { rowAdder: { label: 'Add attendee', defaults: () => ({ id: `a${nextAttendee++}`, ticket: 'General', checkedIn: false }) } },
    },
    {
      id: 'events-checklist',
      name: 'Checklist',
      primaryField: 'item',
      data: checklist,
      columns: [
        { field: 'item', header: 'Item', width: 260, fieldType: 'text' },
        { field: 'event', header: 'Event', width: 200, fieldType: 'link', fieldProps: { table: 'events-events', multiple: false, inverse: 'checklist' } },
        { field: 'team', header: 'Team', width: 130, fieldType: 'singleSelect', fieldProps: { options: TEAMS } },
        { field: 'due', header: 'Due', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'done', header: 'Done', width: 80, fieldType: 'checkbox', fieldProps: { color: '#20c933' } },
      ],
      views: [
        { id: 'open', name: 'To do', type: 'grid', state: { grouping: ['event'], sorting: [{ id: 'due', desc: false }] } },
        { id: 'teams', name: 'By team', type: 'kanban', stackBy: 'team' },
      ],
      props: { rowAdder: { label: 'Add item', defaults: () => ({ done: false }) } },
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
    summary
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
