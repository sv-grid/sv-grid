# Navbar blocks

Top bars for a site or an app: plain links with a call to action, a storefront
bar with search and a cart, and a bar with dropdown and mega menus. Each block
is one `.svelte` file built from `SvButton`, `SvMenu`, `SvBadge` and
`SvTextInput`, themed from the `--sg-*` tokens, and drawn over a short mock
page so you can see it in place.

Every navbar is a `<header>` with a labelled `<nav>`, the current link carries
`aria-current="page"`, and the phone menu button has `aria-expanded` and
`aria-controls` and closes on Escape or a link click.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/navbars"></div>

See them first with `npx @svgrid/ui try blocks/navbars`. No project needed.

## Simple navbar

Brand, four links and a Start free trial button. The mock page heading follows
the current link. Below 768 px the links and the button fold behind a menu
button that opens an in-flow panel under the bar, so the page moves down
instead of being covered.

<div data-docs-demo="587-block-navbars-simple" data-height="460"></div>

`npx @svgrid/ui add navbars-simple`

## Navbar with search

A storefront header: brand, a search field, an account menu and a cart button
with a count, over a row of category links. Submitting the search shows the
query in a toast; Add to cart on a product tile raises the count. On phones the
search takes its own row under the bar and the categories move behind a menu
button.

<div data-docs-demo="588-block-navbars-search" data-height="520"></div>

`npx @svgrid/ui add navbars-search`

## Navbar with dropdown menus

Products opens a mega menu with two columns of icon, title and description
links; Resources opens an `SvMenu`; Pricing is a plain link. Enter, Space or
ArrowDown opens the mega menu on its first link, ArrowUp and ArrowDown move
between links, and Escape closes it and puts focus back on Products. A click
outside or tabbing out also closes it. Below 768 px every link is listed in a
grouped phone menu.

<div data-docs-demo="591-block-navbars-dropdowns" data-height="520"></div>

`npx @svgrid/ui add navbars-dropdowns`

## Using a navbar in a SvelteKit app

A navbar belongs in the root layout, so it renders once and stays mounted
while the pages under it change. Copy the block, delete the mock `<main>`
below the `<header>`, and render it above the page content:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import NavbarsSimple from '$lib/components/ui/navbars-simple.svelte'

  let { children } = $props()
</script>

<NavbarsSimple />
{@render children()}
```

Inside the block, the demo stops each link click with `onNavigate: (_href, e)
=> e.preventDefault()` so the gallery stays put. Remove that line and the
links navigate through the SvelteKit router. Then drive the active link from
the URL instead of from clicks, and close the phone menu after every
navigation, including back and forward and `goto()` calls:

```svelte
<script lang="ts">
  import { page } from '$app/state'
  import { afterNavigate } from '$app/navigation'

  const nav = createSimpleNavbar({
    links: [
      { label: 'Product', href: '/product' },
      { label: 'Pricing', href: '/pricing' },
    ],
  })

  // aria-current follows the URL, so a deep link or a redirect marks the right item.
  $effect(() => { nav.current = page.url.pathname })

  // Close the phone menu once the new page is in.
  afterNavigate(() => { nav.menuOpen = false })
</script>
```

The other blocks work the same way: each core has a writable `current` (the
search block stores a category name, so map the path to one), and the menu
state closes through `menuOpen` (simple), `escape()` (search) or
`closeMenu()` and `closeMega()` (dropdowns). For nested routes, compare with
`page.url.pathname.startsWith(href)` in your own `linkProps` if a section link
should stay marked on its child pages.

## Headless

Every block here is a styled render of the core in its `<script module>`:
`createSimpleNavbar`, `createSearchNavbar` and `createDropdownNavbar`. To draw
your own markup, take the core alone with `npx @svgrid/ui add navbars-simple
--headless` (it writes `navbars-simple.svelte.ts`) and spread its prop-getters
on plain elements:

```svelte
<script lang="ts">
  import { createSimpleNavbar } from './navbars-simple.svelte.js'

  const nav = createSimpleNavbar()
  let menuBtn = $state<HTMLButtonElement | null>(null)
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && nav.escape()) menuBtn?.focus() }} />

<header>
  <button bind:this={menuBtn} {...nav.menuButtonProps()}>Menu</button>
  <nav aria-label="Main" {...nav.panelProps()}>
    {#each nav.links as l (l.href)}<a {...nav.linkProps(l.href)}>{l.label}</a>{/each}
  </nav>
</header>
```

## See also

- [UI blocks overview](./index.md)
- [SvMenu](../ui-components/sv-menu.md)
- [Footer blocks](./footers.md)
