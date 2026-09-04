# SvDivider

A theme-driven separator line - horizontal or vertical, solid or dashed, with an
optional centered, start, or end label.

`SvDivider` draws a `role="separator"` rule that consumes the grid's `--sg-border`
token, so it matches every other surface in light and dark. Give it a `label` (or
a `children` snippet) and it splits into a captioned rule - handy for "OR"
dividers between form sections or toolbar groups.

Related: [SvCard](sv-card.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDivider` starter into your app:

<div data-docs-add="add divider"></div>

Prefer to see it first? `npx @svgrid/ui try divider` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvDivider` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvDivider } from '@svgrid/grid'
</script>
```

```ts
import { SvDivider } from '@svgrid/grid'
```

## Example

<div data-docs-demo="339-status-display" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvDivider } from '@svgrid/grid'
</script>

<SvDivider />
<SvDivider label="OR" />
<SvDivider orientation="vertical" />
```

## Props

| Prop          | Type                             | Default      | Description                                                    |
| ------------- | -------------------------------- | ------------ | ------------------------------------------------------------- |
| `orientation` | `horizontal` \| `vertical`       | `horizontal` | Line direction.                                               |
| `label`       | `string`                         | -            | Caption rendered inline in the rule (horizontal only).        |
| `align`       | `start` \| `center` \| `end`     | `center`     | Label position along a horizontal divider.                    |
| `dashed`      | `boolean`                        | `false`      | Dashed line instead of solid.                                 |
| `children`    | `Snippet`                        | -            | Custom label content; overrides `label` when provided.        |

## Examples

### Labeled section break

Split a form into named sections with a start-aligned caption:

```svelte {runnable}
<SvDivider label="Billing address" align="start" />
```

### Vertical rule in a toolbar

Use a `vertical` divider to group buttons in a flex row - it stretches to the row
height on its own:

```svelte {runnable}
<div style="display: flex; align-items: center; gap: 8px">
  <SvButton>Cut</SvButton>
  <SvDivider orientation="vertical" />
  <SvButton>Paste</SvButton>
</div>
```

### Custom label content

Pass a `children` snippet when the label needs an icon or markup rather than plain
text.

### "OR" split between choices

A centered caption between two blocks - the classic sign-in split between a social
button and the email form:

```svelte
<script lang="ts">
  import { SvDivider, SvButton } from '@svgrid/grid'
</script>

<SvButton>Continue with Google</SvButton>
<SvDivider label="OR" />
<EmailSignInForm />
```

Reach for `dashed` when the break should read as lighter than a section rule, e.g.
between optional add-ons in a checkout summary.

**Tip:** a caption is decorative text inside the rule, so keep real section
headings as heading elements and use the divider's label only for short connectors
like "OR" or a group name.

## Accessibility

- Renders `role="separator"`; the vertical form also sets
  `aria-orientation="vertical"` so assistive tech reports the axis.
- The label is decorative text inside the rule - keep meaningful headings as real
  heading elements rather than relying on a divider caption.

## See also

- [SvCard](sv-card.md) - a surface whose sections a divider can break up.
- [Layout overview](layout.md) - the whole layout family at a glance.
