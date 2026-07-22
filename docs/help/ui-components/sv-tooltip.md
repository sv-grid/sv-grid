# SvTooltip

A small hover and focus tooltip anchored to its child, portalled to `<body>` so
it is never clipped by a scroll container.

`SvTooltip` wraps any element and shows a short label after a brief delay. It
opens on pointer-enter and on keyboard focus, hides on leave, blur, or Escape,
and wires itself to the trigger via `aria-describedby` with `role="tooltip"`. It
reads its colors from the grid's `--sg-*` tokens, so it matches in light and dark.

<div data-docs-demo="288-overlays" data-height="440"></div>

## Basic usage

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
| `text`      | `string`             | -       | Tooltip label. An empty string suppresses the tip.   |
| `placement` | `top` \| `bottom`    | `top`   | Side of the anchor the tip and its arrow sit on.     |
| `delay`     | `number`             | `300`   | Show delay in milliseconds after pointer-enter/focus. |
| `disabled`  | `boolean`            | `false` | Never show the tooltip while set.                    |
| `children`  | `Snippet`            | -       | The element the tooltip describes.                   |

## Patterns

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
- The panel is `pointer-events: none`, so it never intercepts clicks; Escape
  dismisses it immediately.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvPopover](sv-popover.md) - a larger, interactive anchored panel.
- [SvButton](sv-button.md) - the control tooltips most often describe.
