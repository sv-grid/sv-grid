# UI blocks

A block is a whole page section built from the SvGrid UI components: a sign-in
screen, a 404 page, a pricing table, an empty state. Each one is a single
`.svelte` file that imports from `@svgrid/grid` and nothing else. You copy it into
your app and change it like any other file you own.

Blocks are free and MIT-licensed, like the components they are made of.

## Add a block

Add one block by name, or a whole group at once:

<div data-docs-add="add blocks/auth"></div>

That writes one file per block into
`src/lib/components/ui/` (or the `componentsDir` in your `svgrid.json`) and
installs `@svgrid/grid` if it is missing. To look before you add,
`npx @svgrid/ui try blocks/auth` opens the group in a sandbox with a theme picker
and a dark mode toggle. No project needed.

`npx @svgrid/ui list` prints every block group and the blocks in it.

If your app already uses shadcn-svelte, every block is also served from
`https://svgrid.com/r/<name>.json`:

```sh
npx shadcn-svelte@latest add https://svgrid.com/r/login.json
```

## Headless first

Every block is headless, like the components. The top of each file, its
`<script module>`, holds a `create<Name>()` core: the state, validation, async
flow and accessible prop-getters, with no markup. The styled component below it
is one render of that core. To draw your own markup over the same behaviour,
take the core alone:

```sh
npx @svgrid/ui add auth-forgot-password --headless   # writes auth-forgot-password.svelte.ts
```

```svelte
<script lang="ts">
  import { createForgotPassword } from './auth-forgot-password.svelte.js'

  const reset = createForgotPassword({
    onRequest: async (email) => {
      const r = await fetch('/api/password-reset', { method: 'POST', body: JSON.stringify({ email }) })
      if (!r.ok) throw new Error('Reset failed')
    },
  })
</script>

{#if reset.sentTo}
  <p>We sent a link to {reset.sentTo}.</p>
  <button {...reset.resendProps()}>Resend{reset.cooldown ? ` in ${reset.cooldown}s` : ''}</button>
{:else}
  <form {...reset.formProps()}>
    <input {...reset.fieldProps()} />
    {#if reset.error}<p>{reset.error}</p>{/if}
    <button disabled={reset.busy}>Send reset link</button>
  </form>
{/if}
```

If you keep the styled file, the core is still importable from it:
`import { createForgotPassword } from './auth-forgot-password.svelte'`.

## What you get in the file

- **Components, not markup copies.** The inputs, buttons, cards and toasts are
  `Sv*` components. Their keyboard handling, validation and accessibility come
  from the package, so a `@svgrid/grid` update fixes them in every block you have
  copied.
- **Theme tokens.** Colors, borders and radii come from the `--sg-*` custom
  properties, so a block follows whichever theme preset or dark mode your app uses.
- **Prefixed classes.** Every class a block defines starts with `sv-` and a
  block-specific stem (`sv-signin-head`), so your app's global CSS and the
  block's styles never match each other's elements.
- **No assets to host.** Logos, illustrations and photos are inline SVG or CSS.
- **Phones.** Every block is checked at 375 px wide.
- **Working state.** Forms validate, buttons show a loading state, and submits
  fire a toast. Replace the toast call with your own request.

## Groups

| Group | Add it | Blocks |
| --- | --- | --- |
| [Sign-in & registration](./auth.md) | `add blocks/auth` | Split login, sign-up, two-factor code, SSO and magic link, forgot password |
| [Error pages](./error-pages.md) | `add blocks/error-pages` | 404 with search, 500 with retry, maintenance, 403 |
| [Empty states](./empty-states.md) | `add blocks/empty-states` | First item, upload drop zone, no search results, widget cards |
| [Form layouts](./form-layouts.md) | `add blocks/form-layouts` | Stacked, two-column, notification settings, settings with side nav, danger zone |
| [Page headings](./page-headings.md) | `add blocks/page-headings` | Breadcrumbs, tabs, record meta, stats |
| [Onboarding](./onboarding.md) | `add blocks/onboarding` | Setup wizard, progress checklist |
| [App shells & dashboards](./app-shells.md) | `add blocks/app-shells` | Analytics dashboard, sidebar app shell |
| [KPI cards](./kpi-cards.md) | `add blocks/kpi-cards` | With icons, with trend, live sparklines |
| [Stats](./stats.md) | `add blocks/stats` | Weekly report with CSV export, status board |
| [Filter panels](./filter-panels.md) | `add blocks/filter-panels` | Sidebar facets, toolbar, applied chips, collapsible filters over an SvGrid |
| [Activity feeds](./activity-feeds.md) | `add blocks/activity-feeds` | Activity timeline, notification list, comment thread, audit log |
| [AI assistant](./ai.md) | `add blocks/ai` | Prompt suggestions, ask bar over an SvGrid, model settings |
| [Orders](./orders.md) | `add blocks/orders` | Order history on SvGrid, order tracking |
| [Banners](./banners.md) | `add blocks/banners` | Announcement bar, inline alerts, cookie consent, billing warning |
| [Navbars](./navbars.md) | `add blocks/navbars` | Simple, storefront with search, mega menu |
| [Footers](./footers.md) | `add blocks/footers` | Sitemap, simple |
| [Checkout](./checkout.md) | `add blocks/checkout` | Split, stepped, payment methods, order confirmation |
| [Shopping carts](./shopping-carts.md) | `add blocks/shopping-carts` | Cart page, slide-over cart |
| [Reviews](./reviews.md) | `add blocks/reviews` | Rating summary, review list, write a review |
| [Contact](./contact.md) | `add blocks/contact` | Contact form, contact cards, support request with hours |
| [Hero](./hero.md) | `add blocks/hero` | Centered, with email sign-up |
| [Features](./features.md) | `add blocks/features` | Icon grid, list with screenshot |
| [Call to action](./cta.md) | `add blocks/cta` | Centered, justified |
| [Pricing](./pricing.md) | `add blocks/pricing` | Three tiers with billing toggle, per-seat with highlighted plan, comparison table |
| [FAQ](./faq.md) | `add blocks/faq` | Accordion with search, centered with topics |
| [Bento grids](./bento.md) | `add blocks/bento` | Feature bento |
| [Testimonials](./testimonials.md) | `add blocks/testimonials` | Quote cards, carousel |
| [Logo clouds](./logo-clouds.md) | `add blocks/logo-clouds` | Customer wordmark grid |
| [Team](./team.md) | `add blocks/team` | Team grid with department filter |
| [Product cards](./product-cards.md) | `add blocks/product-cards` | Card grid, horizontal card |
| [Product lists](./product-lists.md) | `add blocks/product-lists` | List with sort and view toolbar, featured product |
| [Product overview](./product-overview.md) | `add blocks/product-overview` | Gallery, variants and add to cart |
| [Blog](./blog.md) | `add blocks/blog` | Post cards with category filter, featured article |

Every block also has a live page in the
[demo gallery](https://svgrid.com/demos/420-block-login), under SvGrid UI > Blocks, one page per group.


## A few to start with

### 404 with search

A site search that filters a list of popular pages as you type, for the page a
broken link lands on.

<div data-docs-demo="530-block-error-pages-404-links" data-height="560"></div>

### Ask bar over a grid

A plain-language question filters or summarizes an `SvGrid` of invoices through
the free AI helpers, offline with the mock provider.

<div data-docs-demo="575-block-ai-ask-bar" data-height="640"></div>

### Split checkout

Contact, shipping, delivery and card fields beside a sticky order summary, with
every field validated before Pay.

<div data-docs-demo="599-block-checkout-split" data-height="1020"></div>

## See also

- [Add components with the CLI](../ui-components/cli.md)
- [SvGrid UI components](../ui-components/index.md)
- [Theme presets](../../recipes/theme-presets.md)
