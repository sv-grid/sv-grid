# SvResult

A full result page: a centred icon, title, description, and actions for the
outcome of a flow - success, error, warning, info, or not-found. The
whole-screen counterpart to a toast.

`SvResult` gives a route or panel a clear terminal state: "Payment complete",
"Something went wrong", "404 - page not found". It ships a built-in icon per
status (overridable) and slots for actions and extra content, and themes from the
shared `--sg-*` tokens.

Related: [SvEmptyState](sv-empty-state.md) · [SvAlert](sv-alert.md) · [SvLoadingOverlay](sv-loading-overlay.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvResult` starter into your app:

<div data-docs-add="add result"></div>

Prefer to see it first? `npx @svgrid/ui try result` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvResult` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvResult } from '@svgrid/grid'
</script>
```

```ts
import { SvResult } from '@svgrid/grid'
```

## Example

<div data-docs-demo="409-layout-feedback" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvResult, SvButton } from '@svgrid/grid'
</script>

<SvResult
  status="success"
  title="Payment complete"
  description="Your receipt is on its way to ada@example.com."
>
  {#snippet actions()}
    <SvButton variant="primary">Back to dashboard</SvButton>
    <SvButton variant="ghost">View receipt</SvButton>
  {/snippet}
</SvResult>
```

## Props

| Prop          | Type                                                        | Default | Description                                              |
| ------------- | ---------------------------------------------------------- | ------- | ------------------------------------------------------- |
| `status`      | `success` \| `error` \| `warning` \| `info` \| `notfound`  | `info`  | Picks the built-in icon and accent colour.              |
| `title`       | `string`                                                   | -       | The headline (required).                                |
| `description` | `string`                                                   | -       | Supporting line under the title.                        |
| `icon`        | `Snippet`                                                  | -       | Replace the built-in status icon.                       |
| `actions`     | `Snippet`                                                  | -       | Buttons row under the description (call to action).     |
| `children`    | `Snippet`                                                  | -       | Extra content below the actions (details, links).       |

## Accessibility

- The container is `role="status"` so the outcome is announced when it renders.
- The status icon is `aria-hidden` - the meaning comes from the `title` /
  `description` text, not colour or icon alone.

## The five statuses

`status` picks the icon and tone. `actions` is the part people forget: an error
screen with no way forward is a dead end, and the retry button belongs here
rather than somewhere else on the page.

```svelte {runnable}
<script lang="ts">
  import { SvResult, SvButton } from '@svgrid/grid'

  let attempts = $state(0)
</script>

<SvResult
  status="error"
  title="Could not load the report"
  description="The server did not respond in time."
>
  {#snippet actions()}
    <SvButton variant="primary" onclick={() => (attempts += 1)}>
      Retry{attempts ? ' (' + attempts + ')' : ''}
    </SvButton>
  {/snippet}
</SvResult>

<SvResult status="notfound" title="No such report" description="It may have been deleted." />
```

## See also

- [SvEmptyState](sv-empty-state.md) - for "nothing here yet" rather than an outcome.
- [SvAlert](sv-alert.md) - an inline status banner within a page.
- [SvToaster](sv-toaster.md) - transient, non-blocking status messages.
