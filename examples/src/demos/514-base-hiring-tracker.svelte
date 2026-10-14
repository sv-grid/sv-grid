<script lang="ts">
  /**
   * 514. SvGrid Base: hiring tracker
   * --------------------------------
   * A recruiting team's pipeline as a ready-to-use base with two tables.
   * Candidates have a photo, the role they applied for, the stage, the
   * recruiter, a rating, the interview date, the salary ask, a resume and
   * notes. Roles are the open positions: the team, the hiring manager, the
   * headcount, and the candidates for each, linked both ways.
   *
   * The Candidates views: the hiring pipeline as a Kanban, every candidate in
   * a grid colored by stage, a gallery of faces, the interview calendar, and
   * the application form a candidate fills in. Open a candidate (Space, or a
   * card) to read the notes and leave a comment for the panel.
   */
  import { SvBase, enableBase, type Attachment, type BaseTable } from '@svgrid/enterprise/base'
  import { portrait } from '../shared/gallery-art'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  type Candidate = {
    id: number
    name: string
    photo: Attachment[]
    role: string[]
    stage: string
    recruiter: string
    rating: number
    interview: string
    salary: number
    email: string
    resume: Attachment[]
    source: string
    notes: string
  }

  const ROLES = [
    ['Frontend engineer', 'Engineering', 'u1', 2],
    ['Backend engineer', 'Engineering', 'u2', 2],
    ['Product designer', 'Design', 'u3', 1],
    ['Data analyst', 'Data', 'u4', 1],
    ['Support lead', 'Support', 'u7', 1],
  ] as const
  const TEAMS = [
    { value: 'Engineering', color: '#2d7ff9' },
    { value: 'Design', color: '#ff08c2' },
    { value: 'Data', color: '#20c933' },
    { value: 'Support', color: '#ff6f2c' },
  ]
  const STAGES = [
    { value: 'Applied', color: '#94a3b8' },
    { value: 'Phone screen', color: '#18bfff' },
    { value: 'Onsite', color: '#2d7ff9' },
    { value: 'Offer', color: '#fcb400' },
    { value: 'Hired', color: '#20c933' },
    { value: 'Rejected', color: '#f82b60' },
  ]
  const SOURCES = [
    { value: 'Referral', color: '#8b46ff' },
    { value: 'Careers page', color: '#2d7ff9' },
    { value: 'LinkedIn', color: '#18bfff' },
    { value: 'Agency', color: '#ff6f2c' },
  ]
  const NAMES = [
    'Amara Nwosu', 'Lucas Ferreira', 'Mei Tanaka', 'Omar Haddad', 'Sofia Rossi', 'Jonas Berg', 'Priya Nair', 'Tom Walsh',
    'Lena Vogel', 'Ravi Kumar', 'Chloe Martin', 'Diego Alvarez', 'Ines Costa', 'Kai Yamamoto', 'Nadia Petrova', 'Sam Okoro',
    'Zoe Laurent', 'Hugo Silva',
  ]
  const day = (n: number) => new Date(Date.UTC(2026, 9, 12 + n)).toISOString().slice(0, 10)
  let nextId = NAMES.length + 1
  const candidates: Candidate[] = NAMES.map((name, i) => {
    const stage = STAGES[[0, 1, 2, 3, 4, 1, 2, 0, 5, 2, 1, 3, 0, 2, 1, 5, 0, 2][i]!]!.value
    const slug = name.toLowerCase().replace(/\s+/g, '.')
    return {
      id: i + 1,
      name,
      photo: [{ id: `p${i}`, name: `${slug}.svg`, type: 'image/svg+xml', url: portrait(i + 11) }],
      role: [`r${(i % ROLES.length) + 1}`],
      stage,
      recruiter: ['u5', 'u6', 'u8'][i % 3]!,
      rating: stage === 'Applied' ? 0 : 2 + ((i * 3) % 4),
      interview: stage === 'Applied' || stage === 'Rejected' ? '' : day((i * 2) % 18),
      salary: 82000 + ((i * 7919) % 40) * 1500,
      email: `${slug}@example.com`,
      resume: [{ id: `cv${i}`, name: `${slug}-resume.pdf`, type: 'application/pdf', url: `https://example.com/cv/${slug}.pdf` }],
      source: SOURCES[i % SOURCES.length]!.value,
      notes: stage === 'Applied' ? '' : 'Strong portfolio. Ask about the migration project in the next round.',
    }
  })
  const roles = ROLES.map(([name, team, manager, headcount], i) => ({
    id: `r${i + 1}`,
    name,
    team,
    manager,
    headcount,
    status: i === 4 ? 'On hold' : 'Open',
    candidates: candidates.filter((c) => c.role[0] === `r${i + 1}`).map((c) => String(c.id)),
  }))

  const candidateColumns: any[] = [
    { field: 'name', header: 'Candidate', width: 200, fieldType: 'text' },
    { field: 'photo', header: 'Photo', width: 90, fieldType: 'attachment', fieldProps: { accept: 'image/*', maxFiles: 1 } },
    { field: 'role', header: 'Role', width: 180, fieldType: 'link', fieldProps: { table: 'hiring-roles', multiple: false, inverse: 'candidates' } },
    { field: 'stage', header: 'Stage', width: 140, fieldType: 'singleSelect', fieldProps: { options: STAGES } },
    { field: 'recruiter', header: 'Recruiter', width: 160, fieldType: 'user' },
    { field: 'rating', header: 'Rating', width: 130, fieldType: 'rating', fieldProps: { max: 5, color: '#fcb400' } },
    { field: 'interview', header: 'Interview', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'salary', header: 'Salary ask', width: 130, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'avg' } },
    { field: 'email', header: 'Email', width: 220, fieldType: 'email' },
    { field: 'resume', header: 'Resume', width: 200, fieldType: 'attachment' },
    { field: 'source', header: 'Source', width: 130, fieldType: 'singleSelect', fieldProps: { options: SOURCES } },
    { field: 'notes', header: 'Notes', width: 260, fieldType: 'longText' },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'hiring-candidates',
      name: 'Candidates',
      primaryField: 'name',
      data: candidates,
      columns: candidateColumns,
      views: [
        { id: 'pipeline', name: 'Hiring pipeline', type: 'kanban', stackBy: 'stage' },
        { id: 'all', name: 'All candidates', type: 'grid', color: { mode: 'field', field: 'stage' }, state: { sorting: [{ id: 'rating', desc: true }] } },
        { id: 'faces', name: 'Faces', type: 'gallery', coverField: 'photo' },
        { id: 'interviews', name: 'Interviews', type: 'calendar', dateField: 'interview', color: { mode: 'field', field: 'stage' } },
        { id: 'funnel', name: 'Candidates by stage', type: 'chart', chart: { kind: 'donut', x: 'stage' } },
        { id: 'apply', name: 'Apply', type: 'form', formFields: ['name', 'email', 'role', 'resume', 'notes'], formTitle: 'Join the team', formDescription: 'Tell us a little about yourself. We reply to every application within a week.' },
      ],
      props: { rowAdder: { label: 'Add candidate', defaults: () => ({ id: nextId++, name: '', stage: 'Applied', photo: [], resume: [], rating: 0 }) } },
    },
    {
      id: 'hiring-roles',
      name: 'Roles',
      primaryField: 'name',
      data: roles,
      columns: [
        { field: 'name', header: 'Role', width: 200, fieldType: 'text' },
        { field: 'team', header: 'Team', width: 140, fieldType: 'singleSelect', fieldProps: { options: TEAMS } },
        { field: 'manager', header: 'Hiring manager', width: 190, fieldType: 'user' },
        { field: 'headcount', header: 'Headcount', width: 132, fieldType: 'number', fieldProps: { format: 'integer', summary: 'sum' } },
        { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Open', color: '#20c933' }, { value: 'On hold', color: '#fcb400' }, { value: 'Filled', color: '#94a3b8' }] } },
        { field: 'candidates', header: 'Candidates', width: 320, fieldType: 'link', fieldProps: { table: 'hiring-candidates', multiple: true, inverse: 'role' } },
        { field: 'candidateCount', header: 'In the pipeline', width: 140, fieldType: 'count', fieldProps: { linkField: 'candidates' } },
      ],
      views: [
        { id: 'roles', name: 'Open roles', type: 'grid', color: { mode: 'field', field: 'team' } },
        { id: 'by-team', name: 'By team', type: 'kanban', stackBy: 'team' },
      ],
      props: { rowAdder: { label: 'Add role' } },
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
    rowHeight={44}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
