# Onboarding blocks

Screens for a user's first minutes in your app: a setup wizard, a getting-started
checklist. Each block is one `.svelte` file, the wizard built from `SvStepper`,
`SvTextInput` and `SvTagsInput`, the checklist from `SvCollapsible` and
`SvProgress`, both themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/onboarding"></div>

See them first with `npx @svgrid/ui try blocks/onboarding`. No project needed.

## Setup wizard

Four steps in one card, tracked by an `SvStepper`. Step one takes the workspace
name and a URL slug that follows the name until you edit it (`acme` and
`northwind` are taken). Step two collects teammate emails in an `SvTagsInput`
and flags any entry that is not an address. Step three picks a plan from three
radio cards, and the review step shows everything before Create workspace runs a
`toast.promise`. Next validates the current step; Back and the completed stepper
steps move freely.

<div data-docs-demo="551-block-onboarding-wizard" data-height="560"></div>

`npx @svgrid/ui add onboarding-wizard`

## Progress checklist

A getting-started card with an `SvProgress` bar and an "x of y done" count. Each
task is an `SvCollapsible` with a short description and a button that completes
it; done tasks are struck through with a check and the next open task expands.
At 5 of 5 the card switches to an all-done state, and the close button or
Dismiss checklist hides it behind a "Show it again" link.

<div data-docs-demo="552-block-onboarding-checklist" data-height="540"></div>

`npx @svgrid/ui add onboarding-checklist`

## Saving progress

The checklist core keeps progress in `$state`, so a reload starts over. To keep
it, store the ids of completed tasks on the server, return them from `load`, and
pass them to the core as its `done` option.

Load the saved ids in the page that renders the block:

```ts
// src/routes/welcome/+page.server.ts
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

export const load: PageServerLoad = async ({ locals }) => {
  const done: string[] = await db.onboardingSteps(locals.user.id)
  return { done }
}
```

```svelte
<!-- src/routes/welcome/+page.svelte -->
<script lang="ts">
  import OnboardingChecklist from '$lib/components/ui/onboarding-checklist.svelte'
  let { data } = $props()
</script>

<OnboardingChecklist done={data.done} />
```

In the checklist block, add a `done` prop and hand it to `createChecklist()`
together with an `onComplete` that saves the task. The core reads `done` once,
on mount, and owns the list after that. It marks a task done only when
`onComplete` resolves; a throw leaves the task open with its button ready for
another try.

```ts
let { done = [] }: { done?: string[] } = $props()

const list = createChecklist({
  done,
  onComplete: async (task) => {
    const r = await fetch('/api/onboarding', { method: 'POST', body: JSON.stringify({ id: task.id }) })
    if (!r.ok) { toast.error('Could not save, try again'); throw new Error(r.statusText) }
    toast.success(`${task.title}: done`)
  },
})
```

```ts
// src/routes/api/onboarding/+server.ts
import { json, type RequestHandler } from '@sveltejs/kit'
import { db } from '$lib/server/db'

export const POST: RequestHandler = async ({ request, locals }) => {
  const { id } = await request.json()
  await db.addOnboardingStep(locals.user.id, String(id))
  return json({ ok: true })
}
```

The wizard saves once, at the end. `createWorkspaceWizard()` calls `onCreate`
with `{ name, slug, invites, plan }` from the review step; a throw keeps the
user on Review with everything they entered. Its `taken` option is the list of
slugs the first step rejects. Pass the slugs in use from `load`, and check the
slug again in your API, since the list can be out of date by the time the user
presses Create workspace:

```ts
let { taken = [] }: { taken?: string[] } = $props()

const wizard = createWorkspaceWizard({
  taken,
  onCreate: async (values) => {
    const r = await fetch('/api/workspaces', { method: 'POST', body: JSON.stringify(values) })
    if (!r.ok) throw new Error(r.statusText)
  },
})
```

## Headless

Each block's `<script module>` exports its core: `createWorkspaceWizard()` and
`createChecklist()`. The core holds
the state, validation and async flow with no markup, and the styled component is
one render of it. Take the core alone with
`npx @svgrid/ui add onboarding-checklist --headless` and draw your own list:

```svelte
<script lang="ts">
  import { createChecklist } from './onboarding-checklist.svelte.js'

  const list = createChecklist({
    onComplete: (task) => fetch(`/api/onboarding/${task.id}`, { method: 'POST' }).then(() => {}),
  })
</script>

<p>{list.doneCount} of {list.tasks.length} done</p>
<ul>
  {#each list.tasks as task (task.id)}
    <li>
      <button {...list.triggerProps(task.id)}>{task.title}</button>
      {#if list.isOpen(task.id) && !task.done}
        <p>{task.text}</p>
        <button disabled={list.working === task.id} onclick={() => list.complete(task.id)}>{task.action}</button>
      {/if}
    </li>
  {/each}
</ul>
```

## See also

- [UI blocks overview](./index.md)
- [SvStepper](../ui-components/sv-stepper.md)
- [SvCollapsible](../ui-components/sv-collapsible.md)
