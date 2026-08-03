# SvAlert

An inline, persistent contextual message - info, success, warning, danger, or
neutral - with an icon, optional title, dismiss button, and trailing actions.

`SvAlert` stays in the layout, unlike a floating toast: use it for form-level
validation summaries, banner notices, and "here is what happened" panels. Colors
come from the grid's `--sg-*` semantic tokens, and the variant sets both the
accent and the ARIA role so urgent messages announce themselves.

Related: [SvBadge](sv-badge.md) · [SvEmptyState](sv-empty-state.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvAlert` starter into your app:

<div data-docs-add="add alert"></div>

Prefer to see it first? `npx @svgrid/ui try alert` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvAlert` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvAlert } from '@svgrid/grid'
```

## Example

<div data-docs-demo="339-status-display" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvAlert, SvButton } from '@svgrid/grid'
</script>

<SvAlert variant="success" title="Saved">Your changes are live.</SvAlert>

<SvAlert variant="danger" title="Payment failed" dismissible>
  We could not charge your card.
  {#snippet actions()}<SvButton size="sm" variant="danger">Retry</SvButton>{/snippet}
</SvAlert>
```

## Props

| Prop          | Type                                                        | Default | Description                                                          |
| ------------- | ---------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `variant`     | `info` \| `success` \| `warning` \| `danger` \| `neutral` | `info`  | Semantic color, icon, and ARIA role.                                |
| `title`       | `string`                                                   | -       | Bold heading above the message.                                     |
| `dismissible` | `boolean`                                                  | `false` | Shows a close (x) button that hides the alert.                      |
| `onDismiss`   | `() => void`                                               | -       | Called when the alert is dismissed.                                 |
| `hideIcon`    | `boolean`                                                  | `false` | Hides the leading status icon.                                      |
| `soft`        | `boolean`                                                  | `false` | Softer, borderless tint instead of the bordered card.              |
| `children`    | `Snippet`                                                  | -       | The message body.                                                   |
| `actions`     | `Snippet`                                                  | -       | Trailing action buttons or links.                                  |
| `icon`        | `Snippet`                                                  | -       | Custom leading icon, overriding the default glyph.                 |

## Examples

### Dismissible banners

Give `dismissible` and react to `onDismiss` to persist the dismissal:

```svelte
<SvAlert variant="info" dismissible onDismiss={() => (seen = true)}>
  New: keyboard shortcuts are here.
</SvAlert>
```

### Alerts with actions

The `actions` snippet renders a button row below the message - ideal for
retry / undo / view-details flows:

```svelte
<SvAlert variant="warning" title="Unsaved changes">
  You have edits that are not saved.
  {#snippet actions()}
    <SvButton size="sm">Save</SvButton>
    <SvButton size="sm" variant="ghost">Discard</SvButton>
  {/snippet}
</SvAlert>
```

### Soft inline notes

`soft` drops the border for a lighter tint that sits inside cards and forms:

```svelte
<SvAlert variant="neutral" soft hideIcon>Read-only while syncing.</SvAlert>
```

### Form validation summary

Show a single danger alert above a form when submission fails, listing the
fields that need attention:

```svelte
<script lang="ts">
  import { SvAlert } from '@svgrid/grid'
  let errors = $state<string[]>([])
</script>

{#if errors.length}
  <SvAlert variant="danger" title="Please fix {errors.length} field(s)">
    <ul style="margin:4px 0 0; padding-inline-start:18px;">
      {#each errors as e (e)}<li>{e}</li>{/each}
    </ul>
  </SvAlert>
{/if}
```

The `danger` variant sets `role="alert"`, so the summary is announced the moment
it appears after a failed submit.

### Dismissible session banner

Combine `dismissible`, `onDismiss`, and an `actions` snippet for a one-time
notice the user can act on or clear:

```svelte
<script lang="ts">
  import { SvAlert, SvButton } from '@svgrid/grid'
  let dismissed = $state(localStorage.getItem('trial-seen') === '1')
</script>

{#if !dismissed}
  <SvAlert
    variant="info"
    title="Trial ends in 5 days"
    dismissible
    onDismiss={() => localStorage.setItem('trial-seen', '1')}
  >
    Upgrade to keep your data-app running past the trial.
    {#snippet actions()}<SvButton size="sm" variant="primary">Upgrade</SvButton>{/snippet}
  </SvAlert>
{/if}
```

## Accessibility

- `danger` and `warning` alerts use `role="alert"` so screen readers announce
  them immediately; other variants use the quieter `role="status"`.
- The leading icon is decorative (`aria-hidden`); meaning lives in the text.
- The dismiss button is a real `<button>` with `aria-label="Dismiss"`.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvBadge](sv-badge.md) - a compact status pill when a full message is too much.
- [SvEmptyState](sv-empty-state.md) - centered guidance for blank screens.
