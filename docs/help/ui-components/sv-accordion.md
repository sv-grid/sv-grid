# SvAccordion

A WAI-ARIA accordion of collapsible sections, with single- or multiple-expand
and roving header focus.

`SvAccordion` stacks labelled sections whose bodies are rendered through a `panel`
snippet. It is controlled - you own the open ids via `expanded` and `onChange` -
and every color comes from the grid's `--sg-*` tokens so it matches the rest of
the kit in light and dark. The expand logic, keyboard handling, and ARIA wiring
live in a headless `createAccordion` core; this component is one styled renderer.

Related: [SvTabs](sv-tabs.md) · [SvSplitter](sv-splitter.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvAccordion` starter into your app:

<div data-docs-add="add accordion"></div>

Prefer to see it first? `npx @svgrid/ui try accordion` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvAccordion` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvAccordion } from '@svgrid/grid'
```

## Example

<div data-docs-demo="285-accordion" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvAccordion, type AccordionItem } from '@svgrid/grid'
  const items: AccordionItem[] = [
    { id: 'ship', label: 'Shipping' },
    { id: 'pay', label: 'Payment' },
    { id: 'gift', label: 'Gift options', disabled: true },
  ]
  let expanded = $state(['ship'])
</script>

<SvAccordion {items} {expanded} onChange={(ids) => (expanded = ids)}>
  {#snippet panel(item)}
    <p>Details for {item.label}.</p>
  {/snippet}
</SvAccordion>
```

## Props

| Prop         | Type                                    | Default    | Description                                                  |
| ------------ | --------------------------------------- | ---------- | ----------------------------------------------------------- |
| `items`      | `ReadonlyArray<AccordionItem>`          | -          | The section items. See [AccordionItem](#accordionitem).     |
| `expanded`   | `string[]`                              | `[]`       | Expanded item ids (bindable). Controlled via `onChange`.    |
| `onChange`   | `(expandedIds: string[]) => void`       | -          | Fired when the set of open sections changes.                |
| `expandMode` | `AccordionExpandMode` (`single` \| `multiple`) | `single`   | `single` keeps at most one open; `multiple` allows any.     |
| `disabled`   | `boolean`                               | `false`    | Disables the whole accordion.                               |
| `dir`        | `EditorDir` (`ltr` \| `rtl` \| `auto`)  | -          | Text direction. `rtl` mirrors layout and the chevron.       |
| `panel`      | `Snippet<[AccordionItem]>`              | -          | Renders a section body; receives the item.                  |

### AccordionItem

```ts
type AccordionItem = { id: string; label: string; disabled?: boolean }
type AccordionExpandMode = 'single' | 'multiple'
```

## Examples

### Multiple open sections

Set `expandMode="multiple"` for a settings-style list where several panels can be
open at once:

```svelte
<SvAccordion {items} {expanded} expandMode="multiple"
  onChange={(ids) => (expanded = ids)}>
  {#snippet panel(item)}<Section id={item.id} />{/snippet}
</SvAccordion>
```

### FAQ list

The default `single` mode gives a classic FAQ where opening one answer collapses
the last - keep `expanded` in `$state` and mirror it in `onChange`.

### Filter sidebar

Group a long filter set into collapsible sections that can stay open together with
`expandMode="multiple"`, and seed which groups start open:

```svelte
<script lang="ts">
  import { SvAccordion, type AccordionItem } from '@svgrid/grid'
  const groups: AccordionItem[] = [
    { id: 'price', label: 'Price' },
    { id: 'brand', label: 'Brand' },
    { id: 'rating', label: 'Rating' },
  ]
  let expanded = $state(['price', 'brand'])
</script>

<SvAccordion items={groups} {expanded} expandMode="multiple"
  onChange={(ids) => (expanded = ids)}>
  {#snippet panel(item)}
    {#if item.id === 'price'}<PriceRange />
    {:else if item.id === 'brand'}<BrandChecklist />
    {:else}<RatingFilter />{/if}
  {/snippet}
</SvAccordion>
```

**Tip:** `disabled` items are skipped by keyboard navigation and cannot be
toggled, so mark a section `disabled` (rather than dropping it) to keep its place
in the list while its data loads.

## Accessibility

- Each header is a real `<button>` inside an `<h3>`, with `aria-expanded` and
  `aria-controls` pointing at its panel region.
- Roving header focus: `ArrowUp` / `ArrowDown` move between headers, `Home` /
  `End` jump to the ends; `Enter` / `Space` toggle.
- `disabled` items are skipped by keyboard navigation and cannot be toggled.

## See also

- [SvTabs](sv-tabs.md) - the same content across tabs when only one panel shows at a time.
- [SvSplitter](sv-splitter.md) - resizable panes to lay an accordion beside detail content.
- [Layout overview](layout.md) - the whole layout family at a glance.
