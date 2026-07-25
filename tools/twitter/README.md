# Automated Twitter/X posting

One tweet per day for [svgrid.com](https://svgrid.com), posted from the
`@svgrid` account by GitHub Actions. Each run picks the most timely thing to
promote, writes the copy, renders a branded card, and posts it.

## What it posts

The selector runs in priority order (`tools/twitter/select-content.mjs`):

1. **Release** - a new `@svgrid/grid` or `@svgrid/enterprise` version hit npm in
   the last ~26h (checked against the npm registry).
2. **Blog** - a blog post whose frontmatter `date` is today (it just went live
   via the drip in `schedule-blog.mjs`). Needs the private website checked out.
3. **Highlight** - a curated feature/demo highlight (`highlights.mjs`), rotated
   one step per day. Used on even days when nothing timelier applies.
4. **AI** - an original tweet written by the Anthropic API, grounded on the real
   export surface from `packages/grid/src/index.ts`. Used on odd days.

Release and highlight copy is templated (brand-safe, deterministic). Blog and AI
copy is model-written, with a template fallback if `ANTHROPIC_API_KEY` is unset
or the call fails. Every tweet gets a 16:9 card image rendered with the same
brand tokens as the GitHub social cards (`tools/render-social-preview.mjs`).

**Link goes in a first reply, not the main tweet.** The main tweet is card image
+ copy only; the link is posted as an immediate reply. This is deliberate:

- **Cost.** X's pay-per-use API charges **$0.20 per post that contains a link**
  vs **$0.015** for a link-free post (as of the Feb 2026 pricing change). Two
  link-free posts (main + reply) cost ~$0.03 instead of $0.20 - about
  **$0.90/month** vs ~$6/month for one-a-day.
- **Reach.** X's ranking has long deprioritized links in the post body; the
  link-in-reply pattern avoids that penalty. The card already carries the topic
  and the `svgrid.com` wordmark, so the main tweet loses nothing.

## Running it locally

```bash
# Verify credentials: prints which @handle the keys authenticate as, posts nothing.
# Run this once before the first live tweet (a dry run does NOT test auth).
node tools/post-tweet.mjs --verify

# Dry run: prints the tweet, writes the card to .tweet-out/card.png, posts nothing
node tools/post-tweet.mjs

# Force a specific type to preview each path
TWEET_FORCE=highlight node tools/post-tweet.mjs
TWEET_FORCE=ai        node tools/post-tweet.mjs   # needs ANTHROPIC_API_KEY for a real hook
TWEET_FORCE=release   node tools/post-tweet.mjs   # only produces output if a recent release exists

# Actually post (needs the four X_* creds below)
node tools/post-tweet.mjs --post
```

## One-time setup: X developer portal

The API posts on behalf of the account using **OAuth 1.0a user context**, which
needs four values from a developer app owned by (or with access to) the `@svgrid`
account.

1. Sign in to <https://developer.x.com> **as the @svgrid account** and create a
   project + app. New accounts default to **pay-per-use** (there is no usable
   free write tier since Feb 2026), so add a payment method. At one link-free
   post + one link reply per day this runs about **$0.90/month** (see the cost
   note above); a spend cap in the portal keeps it bounded.
2. In the app's **User authentication settings**, enable OAuth 1.0a, set app
   permissions to **Read and write** (required to post and to upload media), and
   set a callback URL (any valid URL, e.g. `https://svgrid.com`, it is unused
   here). Save.
3. On the app's **Keys and tokens** tab, generate/copy:
   - **API Key** and **API Key Secret** (the consumer key/secret) ->
     `X_API_KEY`, `X_API_SECRET`
   - **Access Token** and **Access Token Secret** -> `X_ACCESS_TOKEN`,
     `X_ACCESS_TOKEN_SECRET`

   Important: generate the **access token AFTER** setting permissions to Read and
   write. A token minted while the app was read-only cannot post - regenerate it
   if you change permissions later.

## Repo secrets and variables

Add these under **Settings -> Secrets and variables -> Actions**:

| Name                | Kind     | Required | Purpose                                             |
| ------------------- | -------- | -------- | --------------------------------------------------- |
| `X_API_KEY`         | secret   | yes      | App consumer key                                    |
| `X_API_SECRET`      | secret   | yes      | App consumer secret                                 |
| `X_ACCESS_TOKEN`    | secret   | yes      | @svgrid access token                                |
| `X_ACCESS_TOKEN_SECRET` | secret | yes    | @svgrid access token secret                         |
| `ANTHROPIC_API_KEY` | secret   | no       | Enables AI-written hooks (already used by the blog) |
| `WEBSITE_TOKEN`     | secret   | no       | Read the private website for the blog check (already used by the blog) |
| `TWEET_MODEL`       | variable | no       | Model id for AI copy (default `claude-sonnet-4-6`)  |

## Schedule

`.github/workflows/daily-tweet.yml` runs at **07:40 UTC** - after the website
rebuild (07:12) so today's blog post is live when linked. Trigger it manually
from the **Actions** tab with **Run workflow**: leave "post" unchecked for a dry
run (the rendered card is uploaded as an artifact), or check it to post now. The
optional `force` input pins the topic type.

## Files

| File                             | Role                                                    |
| -------------------------------- | ------------------------------------------------------- |
| `tools/post-tweet.mjs`           | Orchestrator / CLI entry (`--post`, `--dry-run` default)|
| `tools/twitter/select-content.mjs` | Decides what to tweet today                            |
| `tools/twitter/compose.mjs`      | Builds the tweet text + card content per type           |
| `tools/twitter/render-card.mjs`  | Renders the branded PNG with Chromium                   |
| `tools/twitter/highlights.mjs`   | Curated feature/demo highlights (edit to add more)      |
| `tools/twitter/x-client.mjs`     | Zero-dependency X API client (OAuth 1.0a)               |
