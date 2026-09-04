# SvEmptyState

A centered placeholder for empty lists, no-results screens, and blank panels: an
icon or illustration, a title, a description, and an action slot.

`SvEmptyState` turns a dead-end into a next step. Instead of a bare "no data",
it shows what is missing and offers the button that fixes it - a new record, a
cleared filter, a first import. It is theme-driven, and a `compact` mode fits it
inside small panels and empty dropdowns.

Related: [SvSkeleton](sv-skeleton.md) · [SvAlert](sv-alert.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvEmptyState` starter into your app:

<div data-docs-add="add empty-state"></div>

Prefer to see it first? `npx @svgrid/ui try empty-state` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvEmptyState` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvEmptyState, SvGrid } from '@svgrid/grid'
</script>
```

```ts
import { SvEmptyState } from '@svgrid/grid'
```

## Example

<div data-docs-demo="339-status-display" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvEmptyState, SvButton } from '@svgrid/grid'
</script>

<SvEmptyState title="No orders yet" description="Create your first order to get going.">
  <SvButton variant="primary">New order</SvButton>
</SvEmptyState>
```

## Props

| Prop          | Type      | Default | Description                                                    |
| ------------- | --------- | ------- | ------------------------------------------------------------- |
| `title`       | `string`  | -       | Short headline for the empty screen.                          |
| `description` | `string`  | -       | Supporting line under the title (wraps to ~42 characters).    |
| `compact`     | `boolean` | `false` | Tighter padding for small panels and empty dropdowns.         |
| `icon`        | `Snippet` | -       | Custom icon or illustration, overriding the default glyph.    |
| `children`    | `Snippet` | -       | Action buttons or links rendered below the description.       |

## Examples

### No results vs no data

Distinguish an empty dataset from a filter that matched nothing, and offer the
matching action:

```svelte
{#if rows.length === 0 && !hasFilter}
  <SvEmptyState title="No customers yet" description="Add your first customer.">
    <SvButton variant="primary">Add customer</SvButton>
  </SvEmptyState>
{:else if rows.length === 0}
  <SvEmptyState title="No matches" description="Try widening your filters.">
    <SvButton variant="ghost" onclick={clearFilters}>Clear filters</SvButton>
  </SvEmptyState>
{/if}
```

### Custom illustration

Swap the default glyph for a brand illustration through the `icon` snippet:

```svelte {runnable}
<SvEmptyState title="Inbox zero" description="You are all caught up.">
  {#snippet icon()}<img src="/illustrations/inbox.svg" alt="" width="64" />{/snippet}
</SvEmptyState>
```

### Compact panels

Use `compact` when the empty state lives inside a card, sidebar, or dropdown:

```svelte {runnable}
<SvEmptyState compact title="No tags" description="Type to create one." />
```

### Empty grid with a call-to-action

Swap the whole grid for an empty state when there are no rows, and pair it with
the button that creates the first record:

```svelte
<script lang="ts">
  import { SvGrid, SvEmptyState, SvButton } from '@svgrid/grid'
  let projects = $state<Project[]>([])
</script>

{#if projects.length === 0}
  <SvEmptyState
    title="No projects yet"
    description="Spin up your first project to start tracking work."
  >
    <SvButton variant="primary" onclick={createProject}>New project</SvButton>
    <SvButton variant="ghost" onclick={importProjects}>Import</SvButton>
  </SvEmptyState>
{:else}
  <SvGrid {columns} data={projects} />
{/if}
```

> Tip: `children` is a flex row with a gap, so two buttons - a primary action
> and a secondary link - line up side by side without extra wrappers.

## Accessibility

- The icon slot is decorative (`aria-hidden`); the title and description carry
  the message.
- Provide a real action in `children` so keyboard users can move forward from
  the empty screen.
- Keep the title terse and the description actionable - it is often the only
  guidance on the screen.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvSkeleton](sv-skeleton.md) - what to show while the data is still loading.
- [SvAlert](sv-alert.md) - inline messaging when there is content to keep.
