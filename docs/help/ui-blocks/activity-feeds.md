# Activity feed blocks

Screens that show what happened and who did it: a project timeline, a
notification panel, a comment thread and an audit log. Each block is one
`.svelte` file built from `SvTimeline`, `SvPopover`, `SvSegmented`,
`SvAvatar`, `SvTextArea` and `SvDropDownList`, themed from the `--sg-*` tokens.
Relative times come from `Intl.RelativeTimeFormat`, measured from one `now`
read when the block mounts.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/activity-feeds"></div>

See them first with `npx @svgrid/ui try blocks/activity-feeds`. No project needed.

## Activity timeline

A project feed grouped under Today, Yesterday and dated day headings. Each day
is an `SvTimeline` whose marker colour and glyph mark the event type (commit,
comment, deploy, status change); the `item` snippet shows the actor, what they
did, a detail line and the relative time. Load more shows the button's loading
state and appends two pages of older events, then says there is nothing older.

<div data-docs-demo="570-block-activity-feeds-timeline" data-height="640"></div>

`npx @svgrid/ui add activity-feeds-timeline`

## Notification list

An app bar with a bell and an unread count. The bell opens the panel in an
`SvPopover`; below 560 px the same panel renders inline under the bar instead.
Clicking a notification marks it read, the All / Unread `SvSegmented` filters
the list, Mark all as read clears every dot, and the archive button removes an
item with an Undo toast. Archive everything to see the empty state.

<div data-docs-demo="571-block-activity-feeds-notifications" data-height="560"></div>

`npx @svgrid/ui add activity-feeds-notifications`

## Comment feed

A thread under an RFC: `SvAvatar`, name, relative time and body per comment,
with Like and Reply. Replies nest one level; Reply on a nested comment answers
in the same thread and prefills an @mention. Reply opens an inline
`SvTextArea` under the comment, and the composer at the bottom rejects empty or
too-short text, shows a loading Post button and appends the comment. Ctrl+Enter
posts from either composer, Escape closes a reply.

<div data-docs-demo="572-block-activity-feeds-comments" data-height="640"></div>

`npx @svgrid/ui add activity-feeds-comments`

## Audit log

A compact log grouped by day: time, actor, an action badge, target and source
IP. Two `SvDropDownList` filters narrow it by actor and action, with Clear
filters and an empty state when nothing matches. Updated rows expand into a
field-by-field before and after diff. Below 720 px each row stacks onto three
lines.

<div data-docs-demo="573-block-activity-feeds-audit-log" data-height="760"></div>

`npx @svgrid/ui add activity-feeds-audit-log`

## Loading the feed and streaming new events

Each block's core takes its data as an option, with the sample data as the
default: `createActivityTimeline({ events })`, `createNotifications({ notes })`,
`createComments({ thread })` and `createAuditLog({ entries })`. In SvelteKit,
load the first page in `+page.server.ts` and pass it in; `listActivity` here
stands for your own query:

```ts
// src/routes/projects/[id]/activity/+page.server.ts
import { listActivity } from '$lib/server/activity'

export const load = async ({ params }) => ({
  events: await listActivity(params.id, { limit: 20 }),
})
```

For live events, serve a stream from a `+server.ts` endpoint. `subscribe` is
your pub/sub hook (a Postgres `LISTEN`, Redis channel or in-process emitter)
and returns an unsubscribe function:

```ts
// src/routes/api/activity/stream/+server.ts
import { subscribe } from '$lib/server/activity'

export const GET = () => {
  const enc = new TextEncoder()
  let stop = () => {}
  const body = new ReadableStream({
    start(controller) {
      stop = subscribe((event) => controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`)))
    },
    cancel() { stop() },
  })
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  })
}
```

In the timeline block, pass the loaded data to the core and open an
`EventSource` in an `$effect`. The function the effect returns runs when the
component unmounts, so the connection closes when the user leaves the page.
`loadOlder` replaces the block's timer: it gets the oldest `at` you hold as a
cursor and returns the page before it, with `done: true` on the last one:

```svelte
<script lang="ts">
  import { createActivityTimeline } from './activity-feeds-timeline.svelte.js'

  let { data } = $props()
  const feed = createActivityTimeline({
    events: data.events,
    loadOlder: async (before: number) => {
      const r = await fetch(`/api/activity?before=${before}`)
      const events = await r.json()
      return { events, done: events.length < 20 }
    },
  })

  $effect(() => {
    const source = new EventSource('/api/activity/stream')
    source.onmessage = (e) => { feed.events = [JSON.parse(e.data), ...feed.events] }
    return () => source.close()
  })
</script>
```

The core sorts and groups `events` itself, so a new event lands at the top of
Today. An event stamped after the core's `now` reads as "now". The
notification and comment blocks take live items the same way: assign
`inbox.notes` or push onto `discussion.thread`.

## Headless

Each block is a styled render of the core in its `<script module>`:
`createActivityTimeline()`, `createNotifications()`, `createComments()` and
`createAuditLog()`. Outcomes leave the core through callbacks (`onArchive`,
`onPost`, `onExport`), so the toasts stay in the styled file. Take one alone
with `npx @svgrid/ui add activity-feeds-notifications --headless` (it writes
`activity-feeds-notifications.svelte.ts`) and spread its prop-getters on plain
elements:

```svelte
<script lang="ts">
  import { createNotifications } from './activity-feeds-notifications.svelte.js'

  const inbox = createNotifications({
    onArchive: (note, undo) => {
      if (!confirm(`Archived "${note.target}". Keep it archived?`)) undo()
    },
  })
</script>

<button {...inbox.bellProps()}>Notifications ({inbox.unread})</button>
{#if inbox.open}
  <section aria-label="Notifications">
    <button type="button" disabled={!inbox.unread} onclick={inbox.markAll}>Mark all as read</button>
    <ul>
      {#each inbox.shown as n (n.id)}
        <li>
          <button {...inbox.itemProps(n)}>
            {n.read ? '' : '* '}{n.from} {n.text} {n.target}, {inbox.relative(n.at)}
          </button>
          <button {...inbox.archiveProps(n)}>Archive</button>
        </li>
      {/each}
    </ul>
  </section>
{/if}
```

## See also

- [UI blocks overview](./index.md)
- [SvTimeline](../ui-components/sv-timeline.md)
- [SvPopover](../ui-components/sv-popover.md)
