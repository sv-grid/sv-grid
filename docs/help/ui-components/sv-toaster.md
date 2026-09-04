# SvToaster

The host that renders the shared toast queue. Mount it once near your app root;
call `toast()` from anywhere to push a notification.

`SvToaster` is a portalled, `aria-live` container that draws whatever is in the
singleton toast store. You never pass it toasts directly - you call the `toast()`
API (with `.info` / `.success` / `.warning` / `.error` helpers) and the host
renders them, auto-dismisses them on a timer, pauses on hover or focus, and lets
users swipe them away. Colors come from the grid's `--sg-*` tokens.

Related: [SvModal](sv-modal.md) · [SvDrawer](sv-drawer.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvToaster` starter into your app:

<div data-docs-add="add toaster"></div>

Prefer to see it first? `npx @svgrid/ui try toaster` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvToaster` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvToaster } from '@svgrid/grid'
</script>
```

```ts
import { SvToaster } from '@svgrid/grid'
```

## Example

<div data-docs-demo="331-app-overlays" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvToaster, toast } from '@svgrid/grid'
</script>

<!-- Mount once, near the app root -->
<SvToaster position="bottom-right" />

<button onclick={() => toast.success('Saved')}>Save</button>
```

## Props

| Prop       | Type       | Default          | Description                                                        |
| ---------- | ---------- | ---------------- | ----------------------------------------------------------------- |
| `position` | `Position` | `bottom-right`   | Corner/edge the stack anchors to (see below).                    |
| `max`      | `number`   | `5`              | Max toasts shown at once; older ones stay queued in the store.   |

`Position` is one of `top-left`, `top-center`, `top-right`, `bottom-left`,
`bottom-center`, `bottom-right`.

## The `toast()` API

`toast(message, options)` pushes a notification and returns its numeric id. It
carries variant helpers, and companion `dismissToast(id)` and `clearToasts()`
functions.

| Option        | Type                                        | Default | Description                                       |
| ------------- | ------------------------------------------- | ------- | ------------------------------------------------- |
| `variant`     | `info` \| `success` \| `warning` \| `error` | `info`  | Accent color, icon, and live-region politeness.   |
| `duration`    | `number`                                    | `4000`  | Auto-dismiss after N ms; `0` = sticky.            |
| `dismissible` | `boolean`                                   | `true`  | Show the dismiss (x) button.                      |
| `title`       | `string`                                    | -       | Optional bold title above the message.            |
| `action`      | `{ label, onClick?, keepOpen? }`            | -       | Primary action button; dismisses on click unless `keepOpen`. |
| `cancel`      | `{ label, onClick?, keepOpen? }`            | -       | Secondary (cancel) action button.                 |
| `render`      | `Snippet<[Toast]>`                          | -       | Render a fully custom toast body.                 |

Companion functions on `toast`: `toast.promise(...)`, `toast.update(id, patch)`,
`toast.custom(render, options)`, and `toast.dismiss(id)` (also exported as
`updateToast` / `dismissToast` / `clearToasts`).

## Examples

### Variant helpers

Reach for the named helpers instead of passing `variant`; they set the accent,
icon, and screen-reader politeness for you:

```ts
toast.success('Row saved')
toast.error('Could not save', { title: 'Network error' })
```

### Sticky toasts

Set `duration: 0` for a message the user must dismiss themselves - useful for
errors that need action:

```ts
const id = toast.error('Sync failed', { duration: 0 })
// later, once resolved
dismissToast(id)
```

### Promise toasts

`toast.promise` shows a sticky loading toast, then updates that SAME toast in
place to success or error when the promise settles - one line for the whole
lifecycle. It returns the original promise, so you can still await it:

```ts
await toast.promise(api.save(row), {
  loading: 'Saving...',
  success: (saved) => `Saved "${saved.name}"`,
  error: (err) => `Could not save: ${err.message}`,
})
```

### Action buttons

Give a toast an `action` (and optionally a `cancel`) - the classic "Undo" flow.
The button dismisses the toast when clicked unless you set `keepOpen`:

```ts
const removed = deleteRow(row)
toast('Row deleted', {
  action: { label: 'Undo', onClick: () => restore(removed) },
  cancel: { label: 'Dismiss' },
})
```

### Update in place

Hold the id and patch a toast as work progresses, without stacking new ones:

```ts
const id = toast.info('Uploading... 0%', { duration: 0 })
onProgress((pct) => toast.update(id, { message: `Uploading... ${pct}%` }))
onDone(() => toast.update(id, { message: 'Uploaded', variant: 'success', duration: 3000 }))
```

### Custom body

For a richer toast (an avatar, inline controls), pass a `render` snippet - it
receives the `Toast` and replaces the default icon/title/message:

```svelte
<script lang="ts">
  import { toast } from '@svgrid/grid'
  function notify() {
    toast.custom(mention, { duration: 6000 })
  }
</script>

{#snippet mention(t)}
  <img class="avatar" src={user.avatar} alt="" />
  <div><strong>{user.name}</strong> mentioned you</div>
{/snippet}
```

### Position and cap

Anchor the stack where it suits the layout and cap how many show at once; extras
stay queued and appear as room frees:

```svelte {runnable}
<SvToaster position="top-center" max={3} />
```

### Feedback on an async save

The everyday case: confirm a save, or surface the failure. With the host mounted
once, any handler can call `toast()` - no prop threading, no local toast state:

```svelte
<script lang="ts">
  import { SvToaster, SvButton, toast } from '@svgrid/grid'

  async function save(row) {
    try {
      await api.update(row)
      toast.success('Changes saved')
    } catch (err) {
      toast.error('Could not save', { title: 'Network error', duration: 0 })
    }
  }
</script>

<SvToaster position="bottom-right" />
<SvButton onclick={() => save(row)}>Save</SvButton>
```

Errors here are sticky (`duration: 0`) so they wait for the user, while the
success toast auto-dismisses on the default 4s timer. Both are announced to
screen readers - the error assertively, the success politely.

Tip: mount exactly one `<SvToaster>` for the whole app. The queue is a
singleton, so a second host would render the same toasts twice.

## Accessibility

- The container is a `role="region"` labelled "Notifications"; each toast is a
  `status` (polite) or, for errors and warnings, an `alert` (assertive).
- Every toast is also announced through the shared ARIA live region by the store,
  so screen-reader users hear it even though the visual toast is off to the side.
- Hover, focus, or a swipe pauses the auto-dismiss countdown, banking the time
  left so a resume continues rather than restarts.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvModal](sv-modal.md) / [SvDrawer](sv-drawer.md) - dialogs whose actions often fire a toast.
