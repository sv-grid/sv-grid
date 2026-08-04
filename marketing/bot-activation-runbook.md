# Twitter/X bot activation runbook

The automation is **built and verified launch-ready** (the script loads, resolves
deps, and exits cleanly). It is **dormant** only because the four X credentials
are not set. Do these steps once and it starts posting twice a day on its own.

Verified state (2026-08-04): `node tools/post-tweet.mjs --verify` runs clean and
reports the exact missing secrets. Nothing else is blocking.

## What it does once live

- **07:40 UTC** promo tweet (`daily-tweet.yml`): today's blog post (its own hero
  image + AI copy), or a major/minor release, or a curated highlight, or an
  AI-written original. Link goes in a first reply, not the body.
- **15:40 UTC** product-tip tweet (`daily-tip.yml`): one tip from a 43-tip pool
  (SvGrid / UI components / Studio), rotating ~6-week cycle, branded card, deep
  link to the tip's SEO page in a reply.

Running cost is designed to be ~\$1/month (link-in-reply avoids X's per-link
charge).

## Step 1 - create the X app (once)

1. Sign in to [developer.x.com](https://developer.x.com) **as @svgrid** (not a
   personal account).
2. Create a project + app. New accounts are pay-per-use, so add a payment method
   and set a **spend cap** (a few dollars is plenty).
3. In the app settings, set **App permissions = Read and write**.
4. **Regenerate the Access Token AND Secret AFTER** switching to Read and write.
   A token minted while the app was read-only cannot post - this is the single
   most common failure.

## Step 2 - add four GitHub Actions secrets

Repo -> **Settings -> Secrets and variables -> Actions -> New repository secret**.
Copy from the app's **Keys and tokens** tab:

| X portal field | GitHub secret name |
| --- | --- |
| API Key | `X_API_KEY` |
| API Key Secret | `X_API_SECRET` |
| Access Token | `X_ACCESS_TOKEN` |
| Access Token Secret | `X_ACCESS_TOKEN_SECRET` |

Or from a shell with the `gh` CLI:

```bash
gh secret set X_API_KEY
gh secret set X_API_SECRET
gh secret set X_ACCESS_TOKEN
gh secret set X_ACCESS_TOKEN_SECRET
```

Optional (already present from other workflows, improves quality):
`ANTHROPIC_API_KEY` (AI-written hooks) and `WEBSITE_TOKEN` (blog check + hero
images). Without them it falls back to templates / the branded card.

## Step 3 - confirm the credentials belong to @svgrid

From the **Actions** tab, run **Daily tweet** with **verify** checked (posts
nothing, just prints which handle the creds authenticate as). Confirm it says
`@svgrid`. If it errors, the token was almost certainly minted before Read+write
(redo Step 1.4).

## Step 4 - one manual live post to prove it end-to-end

Run **Daily tweet** again, this time with **post** checked (and optionally
`force = highlight` to control what goes out). Check the @svgrid timeline.

After that, leave it alone - the two cron schedules take over automatically.

## Before enabling the TIP tweet: publish the tip pages

The tip tweet deep-links to SEO tip pages that live in the **private website
submodule** and are **not** auto-deployed. If they are not published yet, the
reply links 404. To publish:

```bash
node tools/twitter/build-tips-pages.mjs      # regenerates the 4 tip pages
# then inside website/ (the private sv-grid/website repo):
#   git add src/content/blog/*tips*.md && git commit && git push
```

The site rebuilds on push. Do this once before relying on the 15:40 tip tweet;
the 07:40 promo tweet has no such dependency and is safe to run immediately.

## Rollback

Disable either workflow from the Actions tab (**...** menu -> Disable workflow),
or delete the secrets. No posts go out without all four `X_*` secrets present.
