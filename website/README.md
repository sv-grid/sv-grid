# SvGrid website

Marketing + docs site for `sv-grid-core`. Vite + Svelte 5 + Tailwind, dark-only.

Pages (hash routing):

- `#/` - home, with hero, embedded live stock-market demo, GitHub + View examples CTAs
- `#/demos`, `#/demos/<id>` - all 20 demos from `examples/src/demos/` rendered inline with sidebar nav and Source modal
- `#/docs`, `#/docs/<slug>` - curated docs rendered from `docs/`
- `#/api` - hand-curated component / exports / API reference

## Run locally

```bash
# from the repo root
pnpm install

# dev server on http://localhost:5180
pnpm dev:site

# production build (writes website/dist)
pnpm build:site

# preview the production build
pnpm preview:site
```

The dev server proxies straight to Vite. Demos are imported from
`../examples/src/demos/*.svelte` via the `@demos` alias, and docs from
`../docs/**/*.md` via the `@docs` alias.

## PayPal checkout

The Pricing page (`#/pricing`) renders live PayPal subscription buttons
for the two sv-grid-pro tiers. The PayPal plan IDs and client-id are
pinned in `src/lib/paypal.ts`:

- Client-id: `AYor43h8U5H7JZE-l73WQ8Zc86Hbd9o0AbpmEhTvz3Sem8MkBqBs5B0zAFbLdFcJueTpxV6aFQ4n5Vde`
  (jQWidgets live PayPal account - same merchant that backs htmlelements.com checkout)
- `P-3N517466PB672681XNINVX4I` - Single Application Developer License
- `P-9N961750GE1769819NINVYIQ` - Multiple Application Developer License

Real subscriptions work out of the box on a clean clone. The client-id
is a public credential - analogous to a Stripe publishable key - and is
safe to ship in the client bundle.

### Overriding the client-id

Optional. Copy the env template and set a different value:

```bash
cp website/.env.example website/.env
# uncomment and edit VITE_PAYPAL_CLIENT_ID
```

- Any valid PayPal client-id (sandbox or live) → swaps the merchant for
  that build
- The literal string `sb` → disables checkout, falls back to a
  `mailto:sales@jqwidgets.com` button on each tier

### Post-purchase flow

After a successful subscription, the PayPal callback hands us a
`subscriptionID`. The tier card swaps to a green confirmation panel that
shows the ID and asks the user to forward it to `sales@jqwidgets.com` for
license-key issuance. The next step is to replace that manual handoff
with a PayPal webhook that auto-emails the SVPRO-... key.

## Deploy

CI publishes to GitHub Pages on every push to `main` via
[.github/workflows/deploy-website.yml](../.github/workflows/deploy-website.yml).

The default base path is `/sv-grid/` (so the site resolves at
`https://sv-grid.github.io/sv-grid/`). To deploy to a custom domain or a
different path, override the env var in the workflow:

```yaml
env:
  SVGRID_SITE_BASE: /   # custom domain or project root
```

### One-time GitHub Pages setup

1. In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`. The workflow runs `pnpm build:site` and publishes
   `website/dist`.
3. The first deploy creates the `github-pages` environment.

The workflow copies `index.html` to `404.html` so deep links keep working
even though the app uses hash routing.
