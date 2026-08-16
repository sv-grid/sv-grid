# Deploying

This app uses SvelteKit's `@sveltejs/adapter-auto`, which detects Vercel, Netlify,
and Cloudflare Pages automatically at build time. A CI workflow
(`.github/workflows/ci.yml`) checks + builds every push.

## Environment variables

Nothing is required while the app runs on its seeded in-memory data. When you
connect a real database or add auth, copy `.env.example` to `.env` locally and
set the same variables in your host's dashboard (see `.env.example` for the
list).

## Option A - Git integration (simplest)

1. Push this repo to GitHub.
2. Import it at your provider - <https://vercel.com/new>,
   <https://app.netlify.com/start>, or <https://dash.cloudflare.com/> (Pages) -
   the SvelteKit build is auto-detected.
3. Add any environment variables in the host's dashboard.

Every push to `main` then redeploys automatically.

## Option B - Deploy from your machine

```bash
npm run deploy        # runs: npx vercel deploy --prod
```

Prefer Netlify or Cloudflare? Use `npx netlify deploy --build --prod` or
`npx wrangler pages deploy` instead, and consider pinning the matching SvelteKit
adapter in `svelte.config.js` (`@sveltejs/adapter-netlify` /
`@sveltejs/adapter-cloudflare`).

## Connecting a real database before deploy

The starter's grids run on in-memory seed data - a deployed copy works, but data
resets on every restart and isn't shared between visitors. To go persistent:

1. Bind your entities to a database - the fastest path is the Studio designer
   (`npx @svgrid/studio designer`) or `npx @svgrid/studio add <table> --db
   postgres --url "$DATABASE_URL"`.
2. Regenerate; the emitted app then includes the connected API routes and a
   `DEPLOY.md` with database-specific steps (tables, migrations, seeding).
3. Set `DATABASE_URL` locally and on your host.

Docs: <https://svgrid.com/docs/enterprise/studio/>
