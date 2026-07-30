# Automated Twitter/X posting

**Two tweets per day** for [svgrid.com](https://svgrid.com), posted from the
`@svgrid` account by GitHub Actions:

1. A **promo tweet** (`daily-tweet.yml`, 07:40 UTC) - the day's news.
2. A **product-tip tweet** (`daily-tip.yml`, 15:40 UTC) - one tip about SvGrid,
   SvGrid UI Components, or SvGrid Studio.

## Tweet 1: the promo tweet (priority order)

`tools/twitter/select-content.mjs`:

1. **Release** - a **major or minor** `@svgrid/grid` / `@svgrid/enterprise`
   release (1st or 2nd version number bumped) hit npm in the last ~26h.
   **Patch-only releases (3rd number) are ignored** so they never repeat the
   same announcement. A major/minor release takes over the tweet for that day.
2. **Blog** - a blog post whose frontmatter `date` is today (just went live via
   the drip). **Uses the post's own hero image** and AI copy that talks about
   that specific post (see below). This is the normal daily tweet.
3. **Highlight** - a curated feature highlight (`highlights.mjs`), rotated one
   step per day. Even days.
4. **AI** - an original tweet written by the Anthropic API, grounded on the real
   export surface from `packages/grid/src/index.ts`. Odd days.

## Tweet 2: the product-tip tweet

`daily-tip.yml` runs `TWEET_FORCE=tip`, which selects one tip from
`PRODUCT_TIPS` in `tools/twitter/tips-data.mjs` (10 SvGrid + 6 UI Components + 6
Studio tips), rotated one step per day so it cycles across all three areas. Copy
is deterministic (no model call); it renders a branded card and puts the docs
link in a first reply. This job needs only the four `X_*` secrets.

## The blog tweet: image + info + link

- **Image:** the post's first inline hero image (`![alt](/blog-media/x.png)`),
  resolved to `website/public/blog-media/x.png` in the cloned website and
  uploaded as the tweet media. If the file is missing, it falls back to a
  rendered branded card.
- **Info:** the tweet text is an AI-written hook about the post (title +
  description as grounding), with a template fallback.
- **Link:** posted as a first **reply** (`Read it here: <url>`), not in the main
  tweet - this avoids X's per-link API charge and its link-in-body reach
  penalty, and the image already carries the visual.

Release / highlight / AI tweets use a rendered 16:9 branded card
(`render-card.mjs`) instead of a post image.

## Running locally

```bash
node tools/post-tweet.mjs --verify        # prints which @handle the creds belong to (posts nothing)
node tools/post-tweet.mjs                  # DRY RUN: prints tweet + saves media to .tweet-out/, posts nothing
TWEET_FORCE=blog node tools/post-tweet.mjs # preview the blog tweet (uses today's post if any)
node tools/post-tweet.mjs --post           # actually post (needs the four X_* creds)
```

Force types: `release | blog | highlight | ai | tip`. Preview the tip tweet with
`TWEET_FORCE=tip node tools/post-tweet.mjs`.

## One-time setup: X developer portal

Posting uses OAuth 1.0a user context. Create an app on [developer.x.com](https://developer.x.com)
signed in **as @svgrid**, set **App permissions to Read and write**, then
generate the Access Token *after* setting that (a read-only token cannot post).
New accounts are pay-per-use, so add a payment method and a spend cap.

Copy from the app's **Keys and tokens** tab:

| Portal (Consumer Keys / Auth Tokens) | Repo secret |
| --- | --- |
| API Key | `X_API_KEY` |
| API Key Secret | `X_API_SECRET` |
| Access Token | `X_ACCESS_TOKEN` |
| Access Token Secret | `X_ACCESS_TOKEN_SECRET` |

Optional: `ANTHROPIC_API_KEY` (AI hooks), `WEBSITE_TOKEN` (blog check + images),
`vars.TWEET_MODEL`. Add secrets under **Settings -> Secrets and variables ->
Actions** (or `gh secret set X_API_KEY`, etc.).

## Schedule

- `.github/workflows/daily-tweet.yml` - the promo tweet at **07:40 UTC** (after
  the website rebuild at 07:12, so today's blog post + its image are present).
- `.github/workflows/daily-tip.yml` - the product-tip tweet at **15:40 UTC**.

Trigger either manually from the Actions tab: leave `post` unchecked for a dry
run (media uploaded as an artifact), check it to post now; on the promo tweet
`force` pins the type.

## Files

| File | Role |
| --- | --- |
| `tools/post-tweet.mjs` | Orchestrator / CLI (`--post`, `--verify`, dry-run default) |
| `tools/twitter/select-content.mjs` | Picks the topic; extracts the blog hero image |
| `tools/twitter/compose.mjs` | Builds tweet text + reply + card/image per type |
| `tools/twitter/render-card.mjs` | Renders the branded PNG (non-blog types) |
| `tools/twitter/highlights.mjs` | Curated feature highlights |
| `tools/twitter/x-client.mjs` | Zero-dependency X API client (OAuth 1.0a) |
| `tools/twitter/tips-data.mjs` | Tip pool: feeds both the tip tweet and the SEO tips pages |

Note: `tools/twitter/tips-data.mjs` is the single source of truth for tips. Its
`PRODUCT_TIPS` (grid + UI + Studio) drive the daily **tip tweet**, and every tip
also becomes a section on an SEO tips **page** via `build-tips-pages.mjs`:

| Tip array | Tweet | Page (`/blog/...`) |
| --- | --- | --- |
| `SVELTE_TIPS` | - | `svelte-5-tips-and-tricks` |
| `SVGRID_TIPS` | grid | `svgrid-tips-and-tricks` |
| `SVGRID_UI_TIPS` | UI components | `svgrid-ui-components-tips-and-tricks` |
| `SVGRID_STUDIO_TIPS` | Studio | `svgrid-studio-tips-and-tricks` |

The tip tweet's reply **deep-links** to that tip's `#anchor` on its page (which
in turn links out to the docs). Regenerate the pages after editing tips:
`node tools/twitter/build-tips-pages.mjs`.

**Publishing the pages:** `build-tips-pages.mjs` writes into the PRIVATE website
submodule (`website/src/content/blog/`); it is NOT run at deploy time. To make
the pages live, commit + push them inside `website/` (the `sv-grid/website`
repo), then the site rebuilds. Until then the tweet deep-links 404, so publish
the pages before enabling the tip tweets.
