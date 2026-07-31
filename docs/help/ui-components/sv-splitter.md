# SvSplitter

Two resizable panes divided by a draggable WAI-ARIA separator, with pointer drag
and arrow-key resize.

`SvSplitter` renders a `start` and an `end` snippet on either side of a gutter you
can drag or resize with the keyboard. It is controlled through `fraction` (the
first pane's share of the container, 0..1) and `onChange`. The clamp, keyboard,
ARIA, and RTL logic live in a headless `createSplitter` core; the component owns
only the container measurement. Nest splitters for IDE- or dashboard-style layouts.

Related: [SvTabs](sv-tabs.md) · [SvScrollArea](sv-scroll-area.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSplitter` starter into your app:

<div data-docs-add="add splitter"></div>

Or install the package and import it directly. `SvSplitter` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvSplitter } from '@svgrid/grid'
```

## Example

<div data-docs-demo="286-splitter" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvSplitter } from '@svgrid/grid'
  let fraction = $state(0.3)
</script>

<div style="height: 320px">
  <SvSplitter {fraction} onChange={(f) => (fraction = f)} ariaLabel="Sidebar width">
    {#snippet start()}<nav>…tree…</nav>{/snippet}
    {#snippet end()}<main>…content…</main>{/snippet}
  </SvSplitter>
</div>
```

## Props

| Prop          | Type                                    | Default      | Description                                                     |
| ------------- | --------------------------------------- | ------------ | -------------------------------------------------------------- |
| `fraction`    | `number`                                | `0.5`        | First pane size as a fraction of the container (bindable).     |
| `onChange`    | `(fraction: number) => void`            | -            | Fired as the separator moves.                                  |
| `orientation` | `SplitterOrientation` (`horizontal` \| `vertical`) | `horizontal` | `horizontal` = left/right panes; `vertical` = top/bottom.      |
| `min`         | `number`                                | `0.1`        | Minimum fraction for the first pane.                           |
| `max`         | `number`                                | `0.9`        | Maximum fraction for the first pane.                           |
| `step`        | `number`                                | `0.02`       | Keyboard resize step as a fraction (2%).                       |
| `disabled`    | `boolean`                               | `false`      | Locks the separator.                                           |
| `dir`         | `EditorDir` (`ltr` \| `rtl` \| `auto`)  | -            | Text direction. `rtl` flips the horizontal drag direction.     |
| `ariaLabel`   | `string`                                | -            | Accessible name for the separator.                            |
| `start`       | `Snippet`                               | -            | Content of the first pane.                                     |
| `end`         | `Snippet`                               | -            | Content of the second pane.                                   |

### SplitterOrientation

```ts
type SplitterOrientation = 'horizontal' | 'vertical'
```

## Examples

### Bounded sidebar

Constrain the drag range so a sidebar cannot be collapsed away or dragged too
wide:

```svelte
<SvSplitter {fraction} min={0.15} max={0.4}
  onChange={(f) => (fraction = f)} ariaLabel="Sidebar" />
```

### Nested (IDE layout)

Put a `vertical` splitter inside one pane of a `horizontal` one for an editor plus
a stacked panel and terminal. Each splitter targets its own separator, so a nested
splitter of the opposite orientation sizes correctly.

### Resizable master / detail

A record list on the left and the selected record on the right, with a divider the
user can drag. Keep `fraction` in `$state` and let each pane scroll on its own:

```svelte
<script lang="ts">
  import { SvSplitter, SvScrollArea } from '@svgrid/grid'
  let split = $state(0.32)
  let selected = $state(rows[0])
</script>

<div style="height: 420px">
  <SvSplitter fraction={split} min={0.2} max={0.5}
    onChange={(f) => (split = f)} ariaLabel="List width">
    {#snippet start()}
      <SvScrollArea height="100%">
        {#each rows as row}
          <button onclick={() => (selected = row)}>{row.name}</button>
        {/each}
      </SvScrollArea>
    {/snippet}
    {#snippet end()}
      <SvScrollArea height="100%"><RecordDetail record={selected} /></SvScrollArea>
    {/snippet}
  </SvSplitter>
</div>
```

**Tip:** the separator is keyboard-resizable - arrow keys move it by `step`
(default 2%) and `Home` / `End` jump to `min` / `max` - so users who cannot drag
can still size the panes.

## Accessibility

- The gutter has `role="separator"` with `aria-orientation`, `aria-valuemin` /
  `aria-valuemax` / `aria-valuenow`, and a focusable tabindex.
- Arrow keys resize by `step`; `Home` / `End` jump to the `min` / `max` bounds.
- Pointer drags use pointer capture so a fast drag outside the element keeps
  tracking; `disabled` blocks both pointer and keyboard resize.

## See also

- [SvTabs](sv-tabs.md) - swap panels within one pane instead of showing both.
- [SvScrollArea](sv-scroll-area.md) - themed scrollbars for content inside a pane.
- [Layout overview](layout.md) - the whole layout family at a glance.
