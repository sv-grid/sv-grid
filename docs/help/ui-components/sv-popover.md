# SvPopover

A floating panel anchored to a trigger, portalled to `<body>` so it escapes any
`overflow:hidden` ancestor.

`SvPopover` wraps an anchor snippet and reveals a panel next to it on click,
hover, or under your own control. It flips above the trigger when there is no
room below, closes on outside-click and Escape through the shared dismissable
layer stack, and animates in. Every color comes from the grid's `--sg-*` tokens,
so it matches the rest of the kit in light and dark.

Related: [SvTooltip](sv-tooltip.md) · [SvMenu](sv-menu.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvPopover` starter into your app:

<div data-docs-add="add popover"></div>

Prefer to see it first? `npx @svgrid/ui try popover` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvPopover` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvPopover } from '@svgrid/grid'
```

## Example

<div data-docs-demo="288-overlays" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvPopover, SvButton } from '@svgrid/grid'
</script>

<SvPopover>
  {#snippet anchor()}<SvButton>Open</SvButton>{/snippet}
  <p>Panel content, portalled out of any scroll container.</p>
</SvPopover>
```

## Props

| Prop                  | Type                              | Default   | Description                                                            |
| --------------------- | --------------------------------- | --------- | -------------------------------------------------------------------- |
| `open`                | `boolean`                         | `false`   | Controlled, bindable open state.                                     |
| `onOpenChange`        | `(open: boolean) => void`         | -         | Fires whenever the open state changes.                              |
| `trigger`             | `click` \| `hover` \| `manual`    | `click`   | How the anchor opens the panel. `manual` = only `open` drives it.   |
| `estimatedHeight`     | `number`                          | `220`     | Estimated panel height used for the flip-above decision.            |
| `minWidth`            | `number`                          | -         | Force a minimum panel width; otherwise it hugs its content.        |
| `closeOnOutsideClick` | `boolean`                         | `true`    | Close when a click lands outside the anchor and panel.             |
| `ariaLabel`           | `string`                          | -         | Accessible name for the `role="dialog"` panel.                     |
| `anchor`              | `Snippet`                         | -         | The trigger element(s) that open the panel.                        |
| `children`            | `Snippet`                         | -         | Panel content.                                                     |

## Examples

### Hover cards

Set `trigger="hover"` to reveal the panel on pointer-enter with a short close
delay, so moving between the anchor and panel keeps it open:

```svelte
<SvPopover trigger="hover">
  {#snippet anchor()}<a href="/u/ada">@ada</a>{/snippet}
  <strong>Ada Lovelace</strong>
  <p>Analyst, first programmer.</p>
</SvPopover>
```

### Controlled open

With `trigger="manual"` the panel only follows `open`, so you can drive it from
elsewhere and react through `onOpenChange`:

```svelte
<script lang="ts">
  let open = $state(false)
</script>

<SvButton onclick={() => (open = true)}>Show details</SvButton>
<SvPopover bind:open trigger="manual" onOpenChange={(o) => console.log(o)}>
  {#snippet anchor()}<span></span>{/snippet}
  <p>Opened programmatically.</p>
</SvPopover>
```

### Fixed-width menus

Pass `minWidth` when you want the panel to match the anchor width instead of
shrinking to its content, which reads better for select-like lists.

### Anchored filter panel

A popover is the natural home for a small form that acts on the surface behind
it - a column filter, a quick-add, a settings cluster. Bind `open` so an action
inside the panel can close it once applied:

```svelte
<script lang="ts">
  import { SvPopover, SvButton, SvNumberInput } from '@svgrid/grid'
  let open = $state(false)
  let min = $state(0)
  function apply() {
    // ...filter the grid by `min`
    open = false
  }
</script>

<SvPopover bind:open minWidth={220} ariaLabel="Price filter">
  {#snippet anchor()}<SvButton>Price</SvButton>{/snippet}
  <SvNumberInput label="Min price" bind:value={min} />
  <div style="display:flex; justify-content:flex-end; margin-top:10px">
    <SvButton variant="primary" onclick={apply}>Apply</SvButton>
  </div>
</SvPopover>
```

Tip: the panel flips above the trigger automatically when there is not enough
room below. If your content is much taller than the `220` default, pass a truer
`estimatedHeight` so the flip decision is made against the real size.

## Accessibility

- The panel is a `role="dialog"`; give it an `ariaLabel` when there is no visible
  heading inside.
- Escape and outside-click dismissal run through the shared layer stack, so a
  popover nested in a dialog closes top-first.
- Clicking the anchor toggles rather than dismiss-then-reopen, because the
  trigger is part of the tracked layer.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvTooltip](sv-tooltip.md) - a smaller hover/focus tip on the same positioning core.
- [SvMenu](sv-menu.md) - an anchored dropdown of actionable items.
