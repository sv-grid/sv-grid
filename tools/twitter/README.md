# Automated Twitter/X posting

One tweet per day for [svgrid.com](https://svgrid.com), posted from the `@svgrid`
account by GitHub Actions. Each run picks the most timely thing to promote,
composes the copy, attaches an image, and posts it.

## What it posts (priority order)

`tools/twitter/select-content.mjs`:

1. **Release** - a new `@svgrid/grid` or `@svgrid/enterprise` version hit npm in
   the last ~26h (checked against the npm registry).
2. **Blog** - a blog post whose frontmatter `date` is today (just went live via
   the drip). **Uses the post's own hero image** (see below).
3. **Highlight** - a curated feature highlight (`highlights.mjs`), rotated one
   step per day. Even days.
4. **AI** - an original tweet written by the Anthropic API, grounded on the real
   export surface from `packages/grid/src/index.ts`. Odd days.

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

Force types: `release | blog | highlight | ai`.

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

`.github/workflows/daily-tweet.yml` runs at **07:40 UTC** (after the website
rebuild at 07:12, so today's blog post + its image are present). Trigger manually
from the Actions tab: leave `post` unchecked for a dry run (media uploaded as an
artifact), check it to post now; `force` pins the type.

## Files

| File | Role |
| --- | --- |
| `tools/post-tweet.mjs` | Orchestrator / CLI (`--post`, `--verify`, dry-run default) |
| `tools/twitter/select-content.mjs` | Picks the topic; extracts the blog hero image |
| `tools/twitter/compose.mjs` | Builds tweet text + reply + card/image per type |
| `tools/twitter/render-card.mjs` | Renders the branded PNG (non-blog types) |
| `tools/twitter/highlights.mjs` | Curated feature highlights |
| `tools/twitter/x-client.mjs` | Zero-dependency X API client (OAuth 1.0a) |

Note: `tools/twitter/tips-data.mjs` + `build-tips-pages.mjs` are unrelated - they
generate the SEO tips blog pages, not tweets.
