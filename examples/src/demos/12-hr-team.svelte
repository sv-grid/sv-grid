<script lang="ts">
  /**
   * 12. HR team directory
   * ---------------------
   * A directory of ~80 employees with the columns an HR app actually needs:
   * person (avatar + name), title, level, team, manager, location, start
   * date, tenure, status, comp.
   *
   * Showcases:
   *   - `columnGroupingFeature` with a default group-by ("team")
   *   - `renderSnippet` for the avatar cell and status badge
   *   - A derived `tenure` column (no `field` - `fieldFn`)
   *   - Sort by any column; group rows fold to a summary line
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  type Status = 'Active' | 'On leave' | 'Contractor'
  type Person = {
    id: string
    firstName: string
    lastName: string
    title: string
    level: string
    team: string
    manager: string
    location: string
    startDate: string  // ISO date
    status: Status
    salary: number
    bonusPct: number
  }

  // ------------------------------------------------------------------ data
  const TEAMS = [
    'Engineering', 'Design', 'Product', 'Data', 'Marketing',
    'Sales', 'Support', 'Operations', 'Finance', 'People',
  ] as const
  type Team = typeof TEAMS[number]

  const TITLES: Record<Team, string[]> = {
    Engineering: ['Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Engineering Manager', 'Director of Engineering'],
    Design:      ['Product Designer', 'Senior Designer', 'Design Lead', 'Director of Design'],
    Product:     ['Associate PM', 'Product Manager', 'Senior PM', 'Group PM', 'Director of Product'],
    Data:        ['Data Analyst', 'Data Scientist', 'ML Engineer', 'Analytics Manager'],
    Marketing:   ['Marketing Specialist', 'Growth Manager', 'Brand Lead', 'CMO'],
    Sales:       ['SDR', 'AE', 'Senior AE', 'Sales Manager', 'VP Sales'],
    Support:     ['Support Engineer', 'Senior Support', 'Support Lead'],
    Operations:  ['Ops Analyst', 'Operations Manager', 'COO'],
    Finance:     ['Accountant', 'Finance Analyst', 'Controller', 'CFO'],
    People:      ['HR Generalist', 'Recruiter', 'People Partner', 'CHRO'],
  }

  const LEVELS = ['IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'M2', 'M3', 'M4', 'M5']
  const LOCATIONS = [
    'San Francisco, US', 'New York, US', 'Austin, US', 'London, UK', 'Berlin, DE',
    'Amsterdam, NL', 'Toronto, CA', 'Sydney, AU', 'Tokyo, JP', 'Singapore, SG',
    'Remote - EMEA', 'Remote - Americas',
  ]
  const FIRST_NAMES = [
    'Aiden', 'Bea', 'Cara', 'Dev', 'Elena', 'Felix', 'Grace', 'Hannah', 'Ivan',
    'Jules', 'Kai', 'Lena', 'Marco', 'Nina', 'Omar', 'Priya', 'Quinn', 'Rosa',
    'Sven', 'Tess', 'Uma', 'Victor', 'Wren', 'Xio', 'Yael', 'Zane', 'Anika',
    'Beck', 'Cyrus', 'Dara', 'Eitan', 'Fiona', 'Gus', 'Henri', 'Ines', 'Jonas',
    'Kira', 'Luca', 'Mara', 'Nico', 'Olin', 'Pia', 'Quentin', 'Reyna', 'Sami',
  ]
  const LAST_NAMES = [
    'Ortega', 'Nakamura', 'Schmidt', 'Hassan', 'Petrov', 'Yamada', 'Hughes',
    'Marchetti', 'Anand', 'Lefevre', 'Olsen', 'Carmona', 'Tan', 'Beck',
    'Mustafa', 'Andersson', 'Vogel', 'Romero', 'Kowalski', 'Mendoza',
    'Sokolova', 'Voss', 'Holm', 'Park', 'Khoury', 'Bauer', 'Russo',
  ]

  // Seeded PRNG so the demo is reproducible across reloads.
  let prngState = 0x9E3779B1
  function rand(): number {
    prngState = (prngState * 1664525 + 1013904223) >>> 0
    return prngState / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }
  function range(lo: number, hi: number): number { return lo + Math.floor(rand() * (hi - lo + 1)) }

  function isoDate(daysAgo: number): string {
    const ms = Date.now() - daysAgo * 86_400_000
    return new Date(ms).toISOString().slice(0, 10)
  }

  function makePeople(): Person[] {
    const out: Person[] = []
    // 1. Pick one manager per team first so other rows can reference them.
    const managerByTeam: Record<string, string> = {}
    for (const team of TEAMS) {
      const first = pick(FIRST_NAMES)
      const last = pick(LAST_NAMES)
      const titles = TITLES[team]
      const title = titles[titles.length - 1]! // most senior title for the team's head
      out.push({
        id: `E${(out.length + 1).toString().padStart(3, '0')}`,
        firstName: first,
        lastName: last,
        title,
        level: pick(['M3', 'M4', 'M5']),
        team,
        manager: 'Sasha Lin (CEO)',
        location: pick(LOCATIONS),
        startDate: isoDate(range(1500, 4200)),
        status: 'Active',
        salary: range(180, 360) * 1000,
        bonusPct: range(15, 30),
      })
      managerByTeam[team] = `${first} ${last}`
    }
    // 2. Fill out 6–10 ICs per team reporting to that team's head.
    for (const team of TEAMS) {
      const headcount = range(6, 10)
      const icTitles = TITLES[team].slice(0, -1) // drop the manager title
      for (let i = 0; i < headcount; i += 1) {
        out.push({
          id: `E${(out.length + 1).toString().padStart(3, '0')}`,
          firstName: pick(FIRST_NAMES),
          lastName: pick(LAST_NAMES),
          title: pick(icTitles),
          level: pick(LEVELS.slice(0, 6)), // IC-only levels
          team,
          manager: managerByTeam[team]!,
          location: pick(LOCATIONS),
          startDate: isoDate(range(60, 2400)),
          status: pick<Status>(['Active', 'Active', 'Active', 'Active', 'On leave', 'Contractor']),
          salary: range(85, 220) * 1000,
          bonusPct: range(5, 18),
        })
      }
    }
    return out
  }

  const rows = makePeople()

  // Tenure in years, derived from startDate; used by an `fieldFn` column.
  function tenureYears(p: Person): number {
    const start = new Date(p.startDate).getTime()
    const now = Date.now()
    return Math.round(((now - start) / (365.25 * 86_400_000)) * 10) / 10
  }

  function initials(p: Person): string {
    return `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase()
  }

  // Stable avatar tint per team - keeps the directory feeling like one company
  // not a rainbow soup.
  const TEAM_COLORS: Record<string, string> = {
    Engineering: '#2563eb', Design: '#db2777', Product: '#7c3aed',
    Data: '#0891b2', Marketing: '#db2516', Sales: '#16a34a',
    Support: '#ca8a04', Operations: '#9333ea', Finance: '#0d9488',
    People: '#e11d48',
  }

  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let groupBy = $state<string[]>(['team'])

  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }
</script>

{#snippet PersonCell(props: { row: Person })}
  <span class="hr-person">
    <span class="hr-avatar" style="background:{TEAM_COLORS[props.row.team] ?? '#475569'}">
      {initials(props.row)}
    </span>
    <span class="hr-person-text">
      <span class="hr-name">{props.row.firstName} {props.row.lastName}</span>
      <span class="hr-id">{props.row.id}</span>
    </span>
  </span>
{/snippet}

{#snippet StatusBadge(props: { value: Status })}
  <span class="hr-badge hr-status-{props.value.replace(/\s+/g, '').toLowerCase()}">{props.value}</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Group by:</span>
    <button
      onclick={() => applyGroup([])}
      class="rounded border px-3 py-1 {groupBy.length === 0 ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >None</button>
    <button
      onclick={() => applyGroup(['team'])}
      class="rounded border px-3 py-1 {groupBy.join() === 'team' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >Team</button>
    <button
      onclick={() => applyGroup(['location'])}
      class="rounded border px-3 py-1 {groupBy.join() === 'location' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >Location</button>
    <button
      onclick={() => applyGroup(['status'])}
      class="rounded border px-3 py-1 {groupBy.join() === 'status' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}"
    >Status</button>
    <span class="ml-auto text-slate-500 dark:text-slate-400">{rows.length} employees</span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={[
        {
          id: 'person',
          header: 'Person',
          fieldFn: (row) => `${row.firstName} ${row.lastName}`,
          cell: (ctx) => renderSnippet(PersonCell, { row: ctx.row.original }),
          width: 240,
        },
        { field: 'title',    header: 'Title',    editorType: 'text', width: 200 },
        { field: 'level',    header: 'Level',    editorType: 'text', width: 80 },
        { field: 'team',     header: 'Team',     editorType: 'text', width: 130 },
        { field: 'manager',  header: 'Manager',  editorType: 'text', width: 180 },
        { field: 'location', header: 'Location', editorType: 'text', width: 180 },
        {
          field: 'startDate', header: 'Start date', editorType: 'date', width: 120,
          format: { type: 'date', pattern: 'y-m-d' },
        },
        {
          id: 'tenure', header: 'Tenure', editorType: 'number',
          fieldFn: (row) => tenureYears(row),
          width: 100,
          cell: (ctx) => `${(ctx.getValue() as number).toFixed(1)}y`,
        },
        {
          field: 'status', header: 'Status', editorType: 'text', width: 120,
          cell: (ctx) => renderSnippet(StatusBadge, { value: ctx.row.original.status }),
        },
        {
          field: 'salary', header: 'Salary', editorType: 'number', width: 120,
          format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
        },
        {
          field: 'bonusPct', header: 'Bonus %', editorType: 'number', width: 100,
          cell: (ctx) => `${ctx.row.original.bonusPct}%`,
        },
      ] satisfies ColumnDef<typeof features, Person>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      showRowNumbers={true}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={true}
      rowHeight={44}
      containerHeight="100%"
      onApiReady={(next) => {
        api = next
        next.setGroupBy(groupBy)
        // Expand the first group on mount so the demo lands on data,
        // not on a row of collapsed group headers.
        queueMicrotask(() => next.setRowExpanded(`team:${TEAMS[0]}`, true))
      }}
    />
  </div>
</section>

<style>
  .hr-person {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .hr-avatar {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.5px;
  }
  .hr-person-text {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.15;
    min-width: 0;
  }
  .hr-name { font-weight: 600; }
  .hr-id { font-size: 11px; color: var(--sg-muted, #94a3b8); }
  .hr-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
  }
  .hr-status-active     { background: #dcfce7; color: #166534; }
  .hr-status-onleave    { background: #fef3c7; color: #92400e; }
  .hr-status-contractor { background: #e0e7ff; color: #4338ca; }
  :global([data-theme='dark']) .hr-status-active     { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
  :global([data-theme='dark']) .hr-status-onleave    { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
  :global([data-theme='dark']) .hr-status-contractor { background: rgba(99, 102, 241, 0.18); color: #a5b4fc; }
</style>
