# SvTooltip

A small hover and focus tooltip anchored to its child, portalled to `<body>` so
it is never clipped by a scroll container.

`SvTooltip` wraps any element and shows a short label after a brief delay. It is
positioned by the shared engine, so it takes any `placement` (`top` / `bottom` /
`left` / `right`, each with an optional `-start` / `-end`), flips when there is no
room, and keeps its arrow on the anchor. It opens on pointer-enter and on keyboard
focus, hides on leave, blur, or Escape, and wires itself to the trigger via
`aria-describedby` with `role="tooltip"`. Give several tooltips the same `group`
so scanning between them skips the re-delay, or set `interactive` for a hoverable
tip. It reads its colors from the grid's `--sg-*` tokens, so it matches in light
and dark.

Related: [SvPopover](sv-popover.md) · [SvButton](sv-button.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvTooltip` starter into your app:

<div data-docs-add="add tooltip"></div>

Prefer to see it first? `npx @svgrid/ui try tooltip` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvTooltip` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvTooltip } from '@svgrid/grid'
```

## Example

<div data-docs-demo="288-overlays" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvTooltip, SvButton } from '@svgrid/grid'
</script>

<SvTooltip text="Delete row">
  <SvButton ariaLabel="Delete">🗑</SvButton>
</SvTooltip>
```

## Props

| Prop        | Type                 | Default | Description                                            |
| ----------- | -------------------- | ------- | ---------------------------------------------------- |
| `text`        | `string`    | -       | Tooltip label. An empty string suppresses the tip.   |
| `placement`   | `Placement` | `top`   | Preferred side + alignment; flips when there is no room. |
| `delay`       | `number`    | `300`   | Show delay in milliseconds after pointer-enter/focus. |
| `closeDelay`  | `number`    | `0`     | Hide delay after leave/blur (interactive tips default to `120`). |
| `group`       | `string`    | -       | Delay-group id; grouped tooltips open instantly while the group is warm. |
| `interactive` | `boolean`   | `false` | Let the pointer move onto the tip without closing it. |
| `disabled`    | `boolean`   | `false` | Never show the tooltip while set.                    |
| `children`    | `Snippet`   | -       | The element the tooltip describes.                   |

## Examples

### Icon-only buttons

The most common use: give a wordless control an accessible label the pointer and
keyboard can both reveal. Pair it with an `ariaLabel` on the button so the name
is announced even before the tip appears:

```svelte
<SvTooltip text="Export CSV">
  <SvButton ariaLabel="Export CSV">⬇</SvButton>
</SvTooltip>
```

### Placement and delay

Flip the tip below a control near the top edge, and shorten the delay for dense
toolbars where hover intent is obvious:

```svelte
<SvTooltip text="Filter" placement="bottom" delay={120}>
  <SvButton ariaLabel="Filter">⧩</SvButton>
</SvTooltip>
```

### Delay groups for toolbars

Give every tooltip in a cluster the same `group`. The first one waits the normal
`delay`; while the group stays warm (a member is open, or one just closed) the
rest open instantly, so scanning a row of icon buttons feels immediate:

```svelte
<SvTooltip text="Bold" group="format"><SvButton ariaLabel="Bold">B</SvButton></SvTooltip>
<SvTooltip text="Italic" group="format"><SvButton ariaLabel="Italic">I</SvButton></SvTooltip>
<SvTooltip text="Underline" group="format"><SvButton ariaLabel="Underline">U</SvButton></SvTooltip>
```

### Interactive tips

When the tip holds something to click (a link, a shortcut), set `interactive` so
the pointer can travel onto it without it closing (it gets a short `closeDelay`):

```svelte
<SvTooltip interactive placement="right" text="Opens the full report">
  <SvButton ariaLabel="Report">📊</SvButton>
</SvTooltip>
```

### Conditional tips

Bind `disabled` to a condition to keep the tooltip out of the way when the
control is self-explanatory, without unwrapping the element.

### Reveal truncated text

When a cell or label is clipped with an ellipsis, wrap it so the pointer and
keyboard can read the full value. Pass the same source string as `text`:

```svelte
<SvTooltip text={row.email}>
  <span style="display:inline-block; max-width:160px; overflow:hidden;
               text-overflow:ellipsis; white-space:nowrap">
    {row.email}
  </span>
</SvTooltip>
```

Tip: the tip itself is `pointer-events: none`, so it never sits between the
pointer and the control underneath - hover targets and clicks keep working even
while the tip is up. An empty `text` (or `disabled`) skips it entirely, which is
handy when the value is not actually truncated.

## Accessibility

- The tip is a `role="tooltip"` linked to its anchor through `aria-describedby`,
  so screen readers announce it as a description of the control.
- It opens on `focusin` as well as hover, so keyboard users get the same hint.
- The panel is `pointer-events: none` by default, so it never intercepts clicks;
  Escape dismisses it immediately. `interactive` tips opt into pointer events so
  their content can be hovered and clicked.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvPopover](sv-popover.md) - a larger, interactive anchored panel.
- [SvButton](sv-button.md) - the control tooltips most often describe.
