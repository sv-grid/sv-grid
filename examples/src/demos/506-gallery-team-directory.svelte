<script lang="ts">
  // Gallery rendering is an Enterprise feature - register the renderer.
  import { enableGalleryView } from '@svgrid/enterprise'
  enableGalleryView()
  /**
   * 506. Gallery: team directory
   * ----------------------------
   * A gallery whose cards you draw yourself: `gallery.card` is a snippet that
   * gets each row, so a person shows as a profile card (a banner in their
   * team's color, a portrait, role, location, status, email and message
   * links) rather than the default cover-and-fields layout. The grid still
   * owns the rows: the search box narrows them, the team buttons set a column
   * filter, and Table shows the same people, filtered the same way.
   */
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import { portrait } from '../shared/gallery-art'

  type Person = {
    id: number
    name: string
    role: string
    team: string
    city: string
    email: string
    photo: string
    since: number
    status: 'Available' | 'In a meeting' | 'Away'
  }

  const TEAM_COLOR: Record<string, [string, string]> = {
    Platform: ['#3b5b8a', '#6b8cc0'],
    Design: ['#b5654a', '#e3a07f'],
    Data: ['#2f7f86', '#69b3b5'],
    Product: ['#7b5ea7', '#ad93d4'],
    Customers: ['#6a8f6b', '#a3c09c'],
  }
  const PEOPLE: Array<[string, string, string, string]> = [
    ['Ana Ruiz', 'Engineering lead', 'Platform', 'Lisbon, PT'],
    ['Ben Okafor', 'Frontend engineer', 'Platform', 'Lagos, NG'],
    ['Cleo Park', 'Product designer', 'Design', 'Seoul, KR'],
    ['Dev Shah', 'Data engineer', 'Data', 'Pune, IN'],
    ['Elena Novak', 'Product manager', 'Product', 'Prague, CZ'],
    ['Farah Haddad', 'Design researcher', 'Design', 'Amman, JO'],
    ['Gus Moreau', 'Backend engineer', 'Platform', 'Lyon, FR'],
    ['Hana Sato', 'Analytics lead', 'Data', 'Osaka, JP'],
    ['Ivan Petrov', 'Site reliability', 'Platform', 'Sofia, BG'],
    ['Jade Liu', 'Brand designer', 'Design', 'Taipei, TW'],
    ['Kofi Mensah', 'Support lead', 'Customers', 'Accra, GH'],
    ['Lea Fischer', 'Customer success', 'Customers', 'Berlin, DE'],
    ['Mateo Silva', 'Product analyst', 'Product', 'Bogota, CO'],
    ['Nora Lind', 'Data scientist', 'Data', 'Uppsala, SE'],
  ]
  const STATUS: Person['status'][] = ['Available', 'In a meeting', 'Away']
  const rows: Person[] = PEOPLE.map(([name, role, team, city], i) => ({
    id: i + 1,
    name,
    role,
    team,
    city,
    email: `${name.split(' ')[0]?.toLowerCase()}@example.com`,
    photo: portrait(i + 3),
    since: 2016 + (i % 9),
    status: STATUS[i % 5 === 2 ? 1 : i % 7 === 3 ? 2 : 0]!,
  }))
  const TEAMS = ['All', ...Object.keys(TEAM_COLOR)]

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 170 },
    { field: 'role', header: 'Role', width: 170 },
    { field: 'team', header: 'Team', width: 110 },
    { field: 'city', header: 'Location', width: 130 },
    { field: 'status', header: 'Status', width: 120 },
    { field: 'email', header: 'Email', width: 190 },
    { field: 'since', header: 'Joined', width: 90 },
  ]

  let view = $state<'gallery' | 'table'>('gallery')
  let team = $state('All')
  let api = $state.raw<SvGridApi<any, Person> | null>(null)
  $effect(() => {
    if (!api) return
    if (team === 'All') api.clearFilter('team')
    else api.setFilter('team', { operator: 'equals', value: team })
  })
  const banner = (p: Person) => {
    const [a, b] = TEAM_COLOR[p.team] ?? ['#64748b', '#94a3b8']
    return `linear-gradient(120deg, ${a}, ${b})`
  }
</script>

<section class="dir flex flex-col gap-3 h-full min-h-0">
  <header class="flex flex-wrap items-center gap-3 shrink-0">
    <div class="dir-tabs" role="radiogroup" aria-label="Team">
      {#each TEAMS as t (t)}
        <button type="button" role="radio" aria-checked={team === t} class:is-on={team === t} onclick={() => (team = t)}>{t}</button>
      {/each}
    </div>
    <span class="flex-1"></span>
    <div class="dir-tabs" role="radiogroup" aria-label="View">
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
      gallery={view === 'gallery' ? { card: profile, cardSize: 230, searchPlaceholder: 'Find a person, role or city' } : undefined}
    />
  </div>
</section>

{#snippet profile(p: Person)}
  <article class="pf">
    <div class="pf-banner" style:background={banner(p)}></div>
    <div class="pf-photo-wrap">
      <img class="pf-photo" src={p.photo} alt="" width="76" height="76" />
      <span class="pf-dot" data-status={p.status} title={p.status}></span>
    </div>
    <strong class="pf-name">{p.name}</strong>
    <span class="pf-role">{p.role}</span>
    <div class="pf-meta">
      <span class="pf-team" style:--team={TEAM_COLOR[p.team]?.[0]}>{p.team}</span>
      <span class="pf-city">
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
        {p.city}
      </span>
    </div>
    <div class="pf-actions">
      <a class="pf-btn" href={`mailto:${p.email}`}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
        Email
      </a>
      <span class="pf-btn pf-btn-quiet" title={`Joined ${p.since}`}>Since {p.since}</span>
    </div>
  </article>
{/snippet}

<style>
  .dir { color: var(--sg-fg, #0f172a); }
  .dir-tabs { display: inline-flex; flex-wrap: wrap; padding: 3px; gap: 2px; border-radius: 999px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .dir-tabs button {
    border: 0; border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer;
    background: none; color: var(--sg-muted, #64748b);
  }
  .dir-tabs button.is-on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12); }
  .pf {
    display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden; padding-bottom: 14px;
    border-radius: 14px; background: var(--sg-bg, #fff); border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  }
  .pf-banner { align-self: stretch; height: 64px; }
  .pf-photo-wrap { position: relative; margin-top: -38px; margin-bottom: 8px; }
  .pf-photo { display: block; width: 76px; height: 76px; border-radius: 50%; border: 4px solid var(--sg-bg, #fff); }
  .pf-dot {
    position: absolute; right: 4px; bottom: 4px; width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--sg-bg, #fff); background: #22a06b;
  }
  .pf-dot[data-status='In a meeting'] { background: #e5a000; }
  .pf-dot[data-status='Away'] { background: #9aa4b2; }
  .pf-name { font-size: 15px; line-height: 1.25; padding: 0 12px; }
  .pf-role { font-size: 13px; color: var(--sg-muted, #64748b); margin-top: 2px; padding: 0 12px; }
  .pf-meta { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; margin-top: 10px; padding: 0 12px; }
  .pf-team {
    padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
    color: var(--team); background: color-mix(in srgb, var(--team) 14%, transparent);
  }
  .pf-city { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .pf-actions { display: flex; gap: 8px; margin-top: 14px; }
  .pf-btn {
    display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
    color: var(--sg-fg, #0f172a); text-decoration: none; border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 14%, transparent);
  }
  .pf-btn:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, transparent); }
  .pf-btn-quiet { font-weight: 500; color: var(--sg-muted, #64748b); border-color: transparent; }
</style>
