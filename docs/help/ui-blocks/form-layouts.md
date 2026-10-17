# Form layouts

Forms and settings pages: a stacked create form, settings split into sections,
a notification matrix, a settings page with a side menu, and a danger zone.
Each block is one `.svelte` file built from `SvTextInput`, `SvTextArea`,
`SvDropDownList`, `SvRadioGroup`, `SvSwitchButton`, `SvSegmented` and
`SvButton`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/form-layouts"></div>

See them first with `npx @svgrid/ui try blocks/form-layouts`. No project needed.

## Stacked form

A "New project" form in one column: name, a description with a character
counter, owner, visibility and a due date picked from a calendar. Create checks
every field and puts the message under the field that failed. A valid submit
shows a toast, lists the project under the form and clears it.

<div data-docs-demo="540-block-form-layouts-stacked" data-height="760"></div>

`npx @svgrid/ui add form-layouts-stacked`

## Two-column form

An account settings page in three sections: Profile, Address and
Notifications. The section title and a short explanation sit on the left, the
fields on the right, and each section is its own form with its own Save
button. Below 760 px the explanation moves above its fields.

<div data-docs-demo="541-block-form-layouts-two-column" data-height="1180"></div>

`npx @svgrid/ui add form-layouts-two-column`

## Notification settings

A table of events by channel with a switch in every cell, and a segmented
control for the digest frequency. Change anything and a save bar appears with
the number of unsaved changes. Discard puts the saved choices back; flipping a
switch back to its saved value also hides the bar.

<div data-docs-demo="542-block-form-layouts-settings" data-height="600"></div>

`npx @svgrid/ui add form-layouts-settings`

## Settings with side nav

Workspace settings with a menu on the left: General, Security, Billing and
Team. Each section is a short form with its own Save, and Team adds invited
members to the list. On a phone the menu becomes a dropdown above the form.

<div data-docs-demo="543-block-form-layouts-settings-nav" data-height="560"></div>

`npx @svgrid/ui add form-layouts-settings-nav`

## Danger zone

The destructive actions of a project, in a panel with a red border. Transfer
ownership needs a new owner and a ticked acknowledgement. Archive asks once in
a popover. Delete opens a dialog whose Delete button stays disabled until you
type the project name, `atlas-web`, exactly.

<div data-docs-demo="544-block-form-layouts-danger-zone" data-height="560"></div>

`npx @svgrid/ui add form-layouts-danger-zone`

## Submitting with a SvelteKit form action

Every input in these blocks has a `name` prop, and an input with a `name`
renders a hidden `<input>` that carries its value: the text for `SvTextInput`
and `SvTextArea`, the option value for `SvDropDownList` and `SvRadioGroup`,
`true` or `false` for `SvSwitchButton`, and for `SvDateTimePicker` the local
day (`2026-10-16`) when it picks a date only, the local time (`14:30`) when it
picks a time only, and an ISO instant when it picks both. A plain
`<form method="POST">` therefore posts them like native fields.

To send the stacked form to a form action, keep its core, `createProjectForm()`,
for the fields and the client-side check, but give the `<form>`
`method="POST"` and `use:enhance` in place of the core's `formProps()` (its
`onsubmit` stops the native post), and show the errors the action returns:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms'
  import { SvTextInput, SvDropDownList, SvDateTimePicker, SvButton, toast } from '@svgrid/grid'
  import { createProjectForm } from './form-layouts-stacked.svelte.js'
  import type { PageProps } from './$types'

  let { form }: PageProps = $props()
  const project = createProjectForm()
  let busy = $state(false)
</script>

<form method="POST" novalidate use:enhance={({ cancel }) => {
  if (!project.validate()) return cancel()
  busy = true
  return async ({ result, update }) => {
    busy = false
    if (result.type === 'success') { toast.success('Project created'); project.reset() }
    await update()
  }
}}>
  <SvTextInput label="Project name" name="name" bind:value={project.name} block required
    error={form?.errors?.name ?? project.errors.name} invalid={!!(form?.errors?.name ?? project.errors.name)} />
  <SvDropDownList label="Owner" name="owner" options={project.owners} value={project.owner} block
    error={form?.errors?.owner ?? project.errors.owner} invalid={!!(form?.errors?.owner ?? project.errors.owner)}
    onChange={(v) => (project.owner = v)} />
  <SvDateTimePicker label="Due date" name="due" formatString="yyyy-MM-dd"
    dropDownDisplayMode="calendar" min={project.minDue} value={project.due} block onChange={(d) => (project.due = d)} />
  <SvButton type="submit" loading={busy}>Create project</SvButton>
</form>
```

```ts
// +page.server.ts
import { fail } from '@sveltejs/kit'
import type { Actions } from './$types'

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData()
    const name = String(data.get('name') ?? '').trim()
    const owner = String(data.get('owner') ?? '')
    const due = String(data.get('due') ?? '') // '2026-10-16' (date-only picker), or ''

    const errors: Record<string, string> = {}
    if (name.length < 3) errors.name = 'Name needs at least 3 characters.'
    if (!owner) errors.owner = 'Pick who owns this project.'
    if (!due) errors.due = 'Set a due date.'
    if (Object.keys(errors).length) return fail(400, { errors })

    await db.projects.insert({ name, owner, due }) // a DATE column, not a timestamp
    return { created: name }
  },
}
```

`fail(400, ...)` comes back as `form` on the page, so the messages land in the
same `error` props the block already uses, next to the core's own
`project.errors`. The values live in the core's `$state`, so they survive the
round trip; `project.reset()` in the `success` branch clears them. The
`project.validate()` call in the enhance callback keeps the instant client-side
check; the server repeats it because a request can skip the browser.

## Headless

Each block is a styled render of the core in its `<script module>`:
`createProjectForm`, `createAccountSettings`, `createNotificationSettings`,
`createWorkspaceSettings` and `createDangerZone`. Data a real app loads (owners,
saved preferences, members) goes in through options, with the sample data as
the default. To draw your own markup, take a core alone with
`npx @svgrid/ui add form-layouts-settings --headless` (it writes
`form-layouts-settings.svelte.ts`) and spread its prop-getters on plain
elements:

```svelte
<script lang="ts">
  import { createNotificationSettings } from './form-layouts-settings.svelte.js'

  const notif = createNotificationSettings({
    onSave: async (prefs) => {
      const r = await fetch('/api/notification-prefs', { method: 'PUT', body: JSON.stringify(prefs) })
      if (!r.ok) throw new Error('Save failed') // keeps the edits and the save bar
    },
  })
</script>

<table>
  <tbody>
    {#each notif.events as e (e.id)}
      <tr>
        <th scope="row">{e.label}</th>
        {#each notif.channels as c (c.id)}
          <td>
            {#if notif.available(e.id, c.id)}
              <button {...notif.switchProps(e.id, c.id)}>{notif.isOn(e.id, c.id) ? 'On' : 'Off'}</button>
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
{#if notif.dirty}
  <p>{notif.changes} unsaved</p>
  <button onclick={notif.discard}>Discard</button>
  <button onclick={notif.save} disabled={notif.busy}>Save</button>
{/if}
```

## See also

- [UI blocks overview](./index.md)
- [SvTextInput](../ui-components/sv-text-input.md)
- [SvSwitchButton](../ui-components/sv-switch-button.md)
- [SvModal](../ui-components/sv-modal.md)
