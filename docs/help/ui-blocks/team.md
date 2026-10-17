# Team blocks

The people section of an about or careers page. The block is one `.svelte`
file built from `SvAvatar`, `SvSegmented`, `SvBadge` and `SvButton`, themed
from the `--sg-*` tokens. Avatars are initials on a color picked from the
name, so there are no photos to host until you add them.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/team"></div>

See them first with `npx @svgrid/ui try blocks/team`. No project needed.

## Team grid

A card per person with an `SvAvatar`, name, role, a short bio, an email link,
a profile link where the person has one, and their department. The
`SvSegmented` filter above the grid narrows it to Engineering, Product or
Customer, and the dashed "We're hiring" card at the end lists the open roles
for the same filter, or says there are none and offers Send an application.
The icon links are labelled "Email Grace Liu" and "Grace Liu's profile". Cards
fill as many 200 px columns as fit, down to one on a phone, where the filter
stretches to the full width.

<div data-docs-demo="649-block-team-grid" data-height="1300"></div>

`npx @svgrid/ui add team-grid`

## Your people and open roles

The block's `<script module>` exports `createTeamGrid()`. It takes:

- `members`: `{ id, name, role, dept, bio, email, profile? }[]`
- `departments`: `{ value, label }[]` for the filter; All is added in front
- `roles`: `{ id, title, dept, location }[]` for the hiring card
- `onContact(member, kind)`: when set, the email and profile links call it
  instead of navigating (`kind` is `'email'` or `'profile'`)
- `onCareers(dept)`: the hiring card's button, with the selected department
  (`'all'` for All)

Leave any of them out and the sample Fieldline data is used. Keep the team in
a JSON file or a table, and read open roles from your applicant tracking
system so the hiring card never lists a filled job:

```ts
// src/routes/about/+page.server.ts
import team from '$lib/content/team.json'
import { env } from '$env/dynamic/private'

export const load = async ({ fetch }) => {
  const res = await fetch(`${env.ATS_URL}/jobs?status=open`)
  const jobs: { id: string; title: string; team: string; location: string }[] = res.ok ? await res.json() : []
  return {
    members: team,
    roles: jobs.map((j) => ({ id: j.id, title: j.title, dept: j.team, location: j.location })),
  }
}
```

Pass them through the block's instance script. Without `onContact` the email
link is a plain `mailto:` and the profile link goes to `profile`:

```svelte
<!-- src/lib/components/ui/team-grid.svelte, instance script -->
<script lang="ts">
  import { SvAvatar, SvSegmented, SvBadge, SvButton, SvToaster } from '@svgrid/grid'
  import { goto } from '$app/navigation'

  let { members, roles }: { members?: TeamMember[]; roles?: OpenRole[] } = $props()
  const team = createTeamGrid({
    members,
    roles,
    onCareers: (dept) => goto(dept === 'all' ? '/careers' : `/careers?team=${dept}`),
  })
</script>
```

```svelte
<!-- src/routes/about/+page.svelte -->
<script lang="ts">
  import TeamGrid from '$lib/components/ui/team-grid.svelte'

  let { data } = $props()
</script>

<TeamGrid members={data.members} roles={data.roles} />
```

The heading's "Ten people across three time zones" line is sample copy in the
markup; change it with your own numbers.

## Headless

The block is a styled render of the core in its `<script module>`. To draw
your own markup, take the core alone with `npx @svgrid/ui add team-grid
--headless` (it writes `team-grid.svelte.ts`):

```svelte
<script lang="ts">
  import { createTeamGrid } from './team-grid.svelte.js'

  let { data } = $props()
  const team = createTeamGrid({ members: data.members, roles: data.roles })
</script>

<select bind:value={team.dept} aria-label="Department">
  {#each team.options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
</select>

<ul>
  {#each team.shown as m (m.id)}
    <li>
      <strong>{m.name}</strong> {m.role}
      <a {...team.contactProps(m, 'email')}>Email</a>
    </li>
  {/each}
</ul>
<p>{team.hiringText}</p>
<button onclick={team.careers}>Open roles</button>
```

`shown` and `openRoles` are derived from `dept`, `deptLabel(value)` turns a
department value into its label, and `contactProps` sets the `href` and an
`aria-label` that names the person.

## See also

- [UI blocks overview](./index.md)
- [SvAvatar](../ui-components/sv-avatar.md)
- [SvSegmented](../ui-components/sv-segmented.md)
