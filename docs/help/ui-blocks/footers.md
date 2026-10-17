# Footer blocks

Site footers for the bottom of every page: a sitemap with four link columns for
a marketing site, and a one-row footer for an app. Each block is one `.svelte`
file built from `SvBadge` (plus an `SvButton` for Back to top in the sitemap),
themed from the `--sg-*` tokens. Each demo draws the end of a page above the
footer so you see it in context.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/footers"></div>

See them first with `npx @svgrid/ui try blocks/footers`. No project needed.

Both footers are a `<footer>` with their links in a `<nav aria-label="...">`
and the copyright year from `new Date().getFullYear()`. Each file starts with a
headless core, `createSitemapFooter()` or `createSimpleFooter()`, that holds
the link data and the ARIA wiring, so you can pass your own links in.

## Sitemap footer

Brand and a one-line summary on the left, four link columns (Product, Company,
Resources, Legal) on the right, and a bottom bar with the copyright and a Back
to top button. An `SvBadge` marks the Changelog link as new. The columns go
four across, then two below 860 px (with the brand moving above them), then
one below 340 px.

<div data-docs-demo="593-block-footers-sitemap" data-height="620"></div>

`npx @svgrid/ui add footers-sitemap`

## Simple footer

One row under an app page: the copyright on the left, Privacy, Terms and
Status on the right; Status carries a green `SvBadge` reading Operational.
Below 560 px the row stacks with the links above the copyright.

<div data-docs-demo="595-block-footers-simple" data-height="440"></div>

`npx @svgrid/ui add footers-simple`

## Rendering the footer once

A footer belongs in the root layout, so every page gets it and none repeats it.
The block files draw a mock page end above the footer for the demo: delete the
`<main class="sv-footer-...-page">` element, keep the `<footer>`, drop the
border and padding on the two wrappers if the footer should run edge to edge,
and render the component after the page content.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import SiteFooter from '$lib/components/ui/footers-sitemap.svelte'

  let { children } = $props()
</script>

<main>
  {@render children()}
</main>
<SiteFooter />
```

Keep the links in one array that the footer, the navbar and the sitemap all
read, so a renamed page changes in one place. The core takes its columns
through `opts` as `{ title, links: { label, href }[] }` objects (the block's module
script exports that shape as `FooterColumn`):

```ts
// src/lib/site-links.ts
type FooterColumn = { title: string; links: { label: string; href: string }[] }

export const siteColumns: FooterColumn[] = [
  { title: 'Product', links: [{ label: 'Dashboards', href: '/product/dashboards' }, { label: 'Pricing', href: '/pricing' }] },
  { title: 'Company', links: [{ label: 'About', href: '/about' }, { label: 'Careers', href: '/careers' }] },
  { title: 'Legal', links: [{ label: 'Privacy policy', href: '/legal/privacy' }, { label: 'Terms of service', href: '/legal/terms' }] },
]

/** The navbar shows the Product column. */
export const navLinks = siteColumns.find((c) => c.title === 'Product')?.links ?? []
```

In the footer file, pass the array to the core:

```ts
import { siteColumns } from '$lib/site-links'

const footer = createSitemapFooter({
  columns: siteColumns,
  onBackToTop: () => root?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
})
```

The same array builds `sitemap.xml`. Prerendered routes have no real origin at
build time, so write yours in:

```ts
// src/routes/sitemap.xml/+server.ts
import type { RequestHandler } from './$types'
import { siteColumns } from '$lib/site-links'

const ORIGIN = 'https://northwind.example'
export const prerender = true

export const GET: RequestHandler = () => {
  const urls = siteColumns
    .flatMap((c) => c.links)
    .filter((l) => l.href.startsWith('/'))
    .map((l) => `<url><loc>${ORIGIN}${l.href}</loc></url>`)
    .join('')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  )
}
```

The simple footer takes its links the same way, plus `currentPath`, so the
link for the page you are on gets `aria-current="page"`. In SvelteKit pass
`page.url.pathname` from `$app/state`:

```ts
import { page } from '$app/state'

const footer = createSimpleFooter({
  company: 'Northwind Analytics, Inc.',
  currentPath: page.url.pathname,
  links: [
    { label: 'Privacy', href: '/legal/privacy' },
    { label: 'Terms', href: '/legal/terms' },
    { label: 'Status', href: '/status', status: true },
  ],
})
```

`status: true` puts the green Operational `SvBadge` after that link. The core
reads `currentPath` once, when it is created; in a root layout that stays
mounted across navigations, compare `page.url.pathname` in the markup instead.

## See also

- [UI blocks overview](./index.md)
- [Navbar blocks](./navbars.md)
- [SvBadge](../ui-components/sv-badge.md)
