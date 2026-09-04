# SvBreadcrumb

A navigation trail that shows where the current page sits in your app's
hierarchy.

`SvBreadcrumb` renders an ordered list of crumbs. Each item is a link (when you
give it an `href`), a button (when you give it an `onClick`), or plain text. The
last item is the current page and is never interactive - it carries
`aria-current="page"`. Long trails collapse their middle into an expandable
ellipsis so a deep path never overflows the bar. Every color comes from the
grid's `--sg-*` tokens, so it matches your grid and forms in light and dark.

Related: [SvPagination](sv-pagination.md) · [SvStepper](sv-stepper.md) · [Navigation & rich overview](navigation.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvBreadcrumb` starter into your app:

<div data-docs-add="add breadcrumb"></div>

Prefer to see it first? `npx @svgrid/ui try breadcrumb` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvBreadcrumb` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvBreadcrumb } from '@svgrid/grid'
```

## Example

<div data-docs-demo="332-app-navigation" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvBreadcrumb } from '@svgrid/grid'
</script>

<SvBreadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Orders', href: '/orders' },
  { label: '#1024' },
]} />
```

## Props

| Prop        | Type                          | Default       | Description                                                     |
| ----------- | ----------------------------- | ------------- | --------------------------------------------------------------- |
| `items`     | `ReadonlyArray<BreadcrumbItem>` | -           | The crumbs, root first. The last is the current page.           |
| `separator` | `string`                      | `/`           | Glyph drawn between crumbs (e.g. a chevron).                     |
| `maxItems`  | `number`                      | -             | Collapse the middle to an ellipsis when the trail exceeds this. |
| `ariaLabel` | `string`                      | `Breadcrumb`  | Accessible name for the `<nav>` landmark.                        |

`BreadcrumbItem` (exported): `{ label: string; href?: string; onClick?: () => void; icon?: string }`.
Pass `href` for a real link, `onClick` for a router push, or neither for static
text. `icon` is any string (emoji, char, or font-icon glyph) rendered before the
label.

## Examples

### Router navigation without full page loads

Use `onClick` instead of `href` when you drive navigation through a client-side
router, so no full document load happens:

```svelte
<SvBreadcrumb items={[
  { label: 'Home', onClick: () => goto('/') },
  { label: 'Reports', onClick: () => goto('/reports') },
  { label: 'Q3' },
]} />
```

### Collapsing deep trails

Set `maxItems` and long paths keep the first crumb, an ellipsis button, and the
last two. Clicking the ellipsis expands the full trail:

```svelte
<SvBreadcrumb maxItems={4} items={deepPath} />
```

### Icons in crumbs

Give any crumb an `icon` for a leading glyph, handy for a home root:

```svelte
<SvBreadcrumb items={[{ label: 'Home', href: '/', icon: '🏠' }, { label: 'Team' }]} />
```

### Building the trail from a route

Derive the crumbs from the current path so the trail always matches where the
router is. Give every crumb but the last an `onClick` that pushes the matching
sub-path; leave the last one plain so it renders as the current page:

```svelte
<script lang="ts">
  import { SvBreadcrumb, type BreadcrumbItem } from '@svgrid/grid'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  const titles: Record<string, string> = { orders: 'Orders', items: 'Items' }

  // /orders/1024/items -> Home / Orders / 1024 / Items
  const crumbs = $derived.by<BreadcrumbItem[]>(() => {
    const segments = page.url.pathname.split('/').filter(Boolean)
    return [
      { label: 'Home', icon: '🏠', onClick: () => goto('/') },
      ...segments.map((seg, i) => {
        const label = titles[seg] ?? seg
        if (i === segments.length - 1) return { label }
        const href = '/' + segments.slice(0, i + 1).join('/')
        return { label, onClick: () => goto(href) }
      }),
    ]
  })
</script>

<SvBreadcrumb items={crumbs} maxItems={4} separator="›" />
```

Tip: when collapsed, the trail always keeps the first crumb plus the last two,
so `maxItems` only changes the display once you have more than three crumbs. Set
it a step above your typical depth so shallow pages never sprout an ellipsis.

## Accessibility

- Renders a `<nav aria-label>` landmark wrapping an ordered list.
- The final crumb is marked `aria-current="page"` and is never a link or button.
- Separators are `aria-hidden` so they are not announced.
- The collapse control is a real `<button>` with an accessible label.

## Collapsing a deep trail

`maxItems` keeps the first and last crumbs and folds the middle, so a deep path
does not wrap onto a second line. Items take an `href` or an `onClick` -
whichever your router wants.

```svelte {runnable}
<script lang="ts">
  import { SvBreadcrumb, type BreadcrumbItem } from '@svgrid/grid'

  const trail: BreadcrumbItem[] = [
    { label: 'Home', href: '/', icon: '*' },
    { label: 'Reports', href: '/reports' },
    { label: 'Finance', href: '/reports/finance' },
    { label: 'Q3', href: '/reports/finance/q3' },
    { label: 'Revenue' },
  ]
</script>

<SvBreadcrumb items={trail} />

<SvBreadcrumb items={trail} maxItems={3} separator="/" />
```

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvPagination](sv-pagination.md) - move through pages of a list.
- [SvStepper](sv-stepper.md) - progress through an ordered flow.
