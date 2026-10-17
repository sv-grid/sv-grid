<script lang="ts" module>
  /**
   * Team grid block - the people behind the product: a card per team member
   * with an SvAvatar (initials), name, role, a two-line bio and email and
   * profile links labelled with the person's name. An SvSegmented filter
   * narrows the grid to one department, and the "We're hiring" card at the
   * end lists that department's open roles with an SvButton to the careers
   * page. Uses SvBadge, SvToaster and toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createTeamGrid() below owns the people, the department filter,
   * the matching open roles and the contact link wiring with no markup. The
   * component under it is one styled render of that core; import
   * createTeamGrid from this file (or `npx @svgrid/ui add team-grid
   * --headless` for the core alone) to draw your own.
   */
  export type TeamMember = { id: string; name: string; role: string; dept: string; bio: string; email: string; profile?: string }
  export type OpenRole = { id: string; title: string; dept: string; location: string }
  export type TeamDepartment = { value: string; label: string }
  export type TeamGridOptions = {
    members?: TeamMember[]
    /** Filter options; 'all' is added in front. */
    departments?: TeamDepartment[]
    roles?: OpenRole[]
    /** Called instead of following a contact link (analytics, a contact modal). */
    onContact?: (member: TeamMember, kind: 'email' | 'profile') => void
    onCareers?: (dept: string) => void
  }

  const MEMBERS: TeamMember[] = [
    { id: 'hp', name: 'Hana Petrova', role: 'Co-founder, CEO', dept: 'product', bio: 'Ran night dispatch at a 300-truck carrier before starting Fieldline in 2021.', email: 'hana@fieldline.example', profile: '/team/hana' },
    { id: 'tf', name: 'Tomas Ferreira', role: 'Co-founder, CTO', dept: 'engineering', bio: 'Wrote the first sync engine. Still reviews every schema migration.', email: 'tomas@fieldline.example', profile: '/team/tomas' },
    { id: 'im', name: 'Ines Moreau', role: 'Staff engineer, Connectors', dept: 'engineering', bio: 'Owns the 40 connectors and the Postgres and Snowflake on-call rota.', email: 'ines@fieldline.example' },
    { id: 'km', name: 'Kwame Mensah', role: 'Backend engineer', dept: 'engineering', bio: 'Rebuilt the row diffing that halved sync times last spring.', email: 'kwame@fieldline.example' },
    { id: 'ys', name: 'Yuki Sato', role: 'Frontend engineer', dept: 'engineering', bio: 'Builds the table editor and its keyboard shortcuts.', email: 'yuki@fieldline.example' },
    { id: 'lb', name: 'Leo Brandt', role: 'Product designer', dept: 'product', bio: 'Designs alerts and approvals. Five years as a dispatcher before that.', email: 'leo@fieldline.example', profile: '/team/leo' },
    { id: 'sa', name: 'Sofia Alvarez', role: 'Product manager, Billing', dept: 'product', bio: 'Owns plans, invoices and the row counter that drives both.', email: 'sofia@fieldline.example' },
    { id: 'gl', name: 'Grace Liu', role: 'Head of support', dept: 'customer', bio: 'Answers the first ticket of every new workspace herself.', email: 'grace@fieldline.example', profile: '/team/grace' },
    { id: 'oh', name: 'Omar Haddad', role: 'Solutions engineer', dept: 'customer', bio: 'Sets up SSO and the first five connectors for Enterprise teams.', email: 'omar@fieldline.example' },
    { id: 'nk', name: 'Nadia Kowalski', role: 'Customer success, EMEA', dept: 'customer', bio: 'Covers EU workspaces from Lisbon, in their working hours.', email: 'nadia@fieldline.example' },
  ]
  const DEPTS: TeamDepartment[] = [
    { value: 'engineering', label: 'Engineering' },
    { value: 'product', label: 'Product' },
    { value: 'customer', label: 'Customer' },
  ]
  const ROLES: OpenRole[] = [
    { id: 'r1', title: 'Senior backend engineer', dept: 'engineering', location: 'Remote, EU' },
    { id: 'r2', title: 'Site reliability engineer', dept: 'engineering', location: 'Remote, US' },
    { id: 'r3', title: 'Support engineer, APAC', dept: 'customer', location: 'Sydney' },
  ]

  export function createTeamGrid(opts: TeamGridOptions = {}) {
    const members = opts.members ?? MEMBERS
    const depts = opts.departments ?? DEPTS
    const roles = opts.roles ?? ROLES
    let dept = $state('all')

    const shown = $derived(dept === 'all' ? members : members.filter((m) => m.dept === dept))
    const openRoles = $derived(dept === 'all' ? roles : roles.filter((r) => r.dept === dept))
    const deptLabel = $derived(depts.find((d) => d.value === dept)?.label ?? '')

    return {
      /** SvSegmented options: All plus each department. */
      options: [{ value: 'all', label: 'All' }, ...depts],
      get dept() { return dept },
      set dept(v: string) { dept = v },
      get shown() { return shown },
      get openRoles() { return openRoles },
      /** The hiring card's line for the current filter. */
      get hiringText() {
        const n = openRoles.length
        const where = dept === 'all' ? 'across the team' : `in ${deptLabel}`
        return n ? `${n} open role${n === 1 ? '' : 's'} ${where}.` : `No open roles ${where} right now. Open applications are read every week.`
      },
      deptLabel: (value: string) => depts.find((d) => d.value === value)?.label ?? value,
      careers: () => opts.onCareers?.(dept),
      /** Spread on a contact <a>; the label names the person. */
      contactProps: (m: TeamMember, kind: 'email' | 'profile') => ({
        href: kind === 'email' ? `mailto:${m.email}` : m.profile,
        'aria-label': kind === 'email' ? `Email ${m.name}` : `${m.name}'s profile`,
        onclick: (e: MouseEvent) => {
          if (!opts.onContact) return
          e.preventDefault()
          opts.onContact(m, kind)
        },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvSegmented, SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const team = createTeamGrid({
    onContact: (m, kind) => toast(kind === 'email' ? `Writing to ${m.email}` : `Opening ${m.name}'s profile`),
    onCareers: (d) => toast(d === 'all' ? 'Opening all open roles' : `Opening ${team.deptLabel(d)} roles`),
  })
</script>

<section class="sv-team" aria-labelledby="sv-team-title">
  <header class="sv-team-head">
    <div>
      <h2 id="sv-team-title">The people who build Fieldline</h2>
      <p>Ten people across three time zones. Most of us worked in operations before we wrote software for it.</p>
    </div>
    <SvSegmented options={team.options} bind:value={team.dept} ariaLabel="Filter by department" />
  </header>

  <p class="sv-team-sr" aria-live="polite">{team.shown.length} people shown</p>
  <ul class="sv-team-grid">
    {#each team.shown as m (m.id)}
      <li class="sv-team-member">
        <SvAvatar name={m.name} size={56} />
        <h3>{m.name}</h3>
        <p class="sv-team-role">{m.role}</p>
        <p class="sv-team-bio">{m.bio}</p>
        <div class="sv-team-links">
          <a class="sv-team-link" {...team.contactProps(m, 'email')}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="2" /><path d="M3 6l7 5 7-5" /></svg>
          </a>
          {#if m.profile}
            <a class="sv-team-link" {...team.contactProps(m, 'profile')}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3.5" /><path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /></svg>
            </a>
          {/if}
          <span class="sv-team-dept">{team.deptLabel(m.dept)}</span>
        </div>
      </li>
    {/each}
    <li class="sv-team-hiring">
      <SvBadge variant="accent">We're hiring</SvBadge>
      <h3>Work on Fieldline</h3>
      <p>{team.hiringText}</p>
      {#if team.openRoles.length}
        <ul class="sv-team-roles">
          {#each team.openRoles as r (r.id)}
            <li><strong>{r.title}</strong><span>{r.location}</span></li>
          {/each}
        </ul>
      {/if}
      <SvButton variant="primary" size="sm" onclick={team.careers}>{team.openRoles.length ? 'See open roles' : 'Send an application'}</SvButton>
    </li>
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-team {
    position: relative; width: 100%; box-sizing: border-box; padding: 48px 40px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-team-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px 32px; flex-wrap: wrap; margin-bottom: 28px; }
  .sv-team-head > div { max-width: 560px; }
  .sv-team-head h2 { margin: 0 0 6px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
  .sv-team-head p { margin: 0; color: var(--sg-muted, #64748b); font-size: 15px; line-height: 1.55; }
  .sv-team-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .sv-team-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .sv-team-member, .sv-team-hiring {
    display: flex; flex-direction: column; align-items: flex-start; padding: 20px; box-sizing: border-box;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); background: var(--sg-bg, #fff);
  }
  .sv-team-member h3, .sv-team-hiring h3 { margin: 14px 0 2px; font-size: 15.5px; font-weight: 650; }
  .sv-team-role { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-team-bio { flex: 1; margin: 10px 0 14px; font-size: 13.5px; line-height: 1.5; }
  .sv-team-links { display: flex; align-items: center; gap: 4px; width: 100%; }
  .sv-team-link {
    display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--sg-radius, 8px);
    color: var(--sg-muted, #64748b); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-team-link:hover { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-team-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-team-link svg { display: block; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .sv-team-dept { margin-left: auto; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-team-hiring {
    border-style: dashed;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
  }
  .sv-team-hiring > p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-team-roles { list-style: none; margin: 0 0 16px; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 8px; }
  .sv-team-roles li { display: flex; flex-direction: column; font-size: 13px; line-height: 1.4; }
  .sv-team-roles strong { font-weight: 600; }
  .sv-team-roles span { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .sv-team-hiring :global(.sv-btn) { margin-top: auto; }

  @media (max-width: 640px) {
    .sv-team { padding: 32px 16px; }
    .sv-team-head h2 { font-size: 22px; }
    .sv-team-head :global(.sv-field) { width: 100%; }
    .sv-team-head :global(.sv-seg) { display: flex; width: 100%; }
  }
</style>
