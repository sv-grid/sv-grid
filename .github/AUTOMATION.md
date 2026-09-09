# Repo automation

Three GitHub Actions keep the packages and the blog moving without manual work.

| Workflow | File | Schedule (UTC) | What it does |
| --- | --- | --- | --- |
| Blog post (twice weekly) | [daily-blog.yml](workflows/daily-blog.yml) | Tue + Fri 05:23 | Generates one new blog post and commits it, queued behind the existing posts. |
| Publish npm packages | [publish-npm.yml](workflows/publish-npm.yml) | after every green Test run on `main`, plus 06:37 | Publishes each public `@svgrid/*` package whose shipped files changed. |
| Deploy website | [deploy-website.yml](workflows/deploy-website.yml) | 07:12 | Regenerates the blog's SEO structure (tips pages, pillar hubs, "Related reading" blocks), then rebuilds the site so posts whose date has arrived go live. |

## Required secrets and variables

Add these under **Settings -> Secrets and variables -> Actions**:

- `NPM_TOKEN` (secret) - an npm **automation** token with publish rights to the `@svgrid` scope.
- `WEBSITE_TOKEN` (secret) - read access to the private `website` submodule, which is a pnpm workspace member.
- `ANTHROPIC_API_KEY` (secret) - Anthropic API key used to write each post.
- `BLOG_MODEL` (variable, optional) - model id for generation. Defaults to `claude-sonnet-4-6`. Use `claude-opus-4-8` for higher quality at higher cost.

## How the npm publish stays clean

The packages are consumed by paying customers, so we never push an empty version and
never publish a commit that has not gone green. The publish workflow is triggered by
the **Test** workflow completing successfully on `main` (`workflow_run`), so lint,
type-check, unit tests and the Playwright suite all pass before anything reaches npm.
The 06:37 schedule stays on as a safety net: Test runs with `cancel-in-progress`, so a
commit that is superseded within minutes never emits a success event of its own.

[tools/release-packages.mjs](../tools/release-packages.mjs) decides what ships. Each
release is marked with a `<dir>-v<version>` git tag, and on the next run a package
only gets its patch (build) number bumped and republished if its **shipped** files
changed since that tag - its `files` entries plus the scripts that generate `dist/`.
Tests, docs and demos do not trigger a release. Commits with nothing shippable are no-ops.

- Every public package is covered, in dependency order: `grid`, `enterprise`, `grid-wc`, `mcp`, `studio`, `ui`, `create`, `create-studio`, `migrate`, `sv`.
- A package with no `<dir>-v*` tag yet is **baselined** on the first run: tagged at the version already on npm, published nothing. Its first auto-release is its next real change.
- One cascade rule: `@svgrid/grid-wc` compiles grid and enterprise *into* its bundle, so a grid change republishes it even though its own files did not move. Everything else depends through `^x.y.z` ranges that a patch already satisfies.
- Publishing runs through the same script's `--publish` mode. It deliberately does **not** call `tools/publish.mjs`, the local release script: it is gitignored as maintainer-only, so in CI it does not exist and the first real run died on `MODULE_NOT_FOUND`. Both use **pnpm, never npm**: every package except grid, migrate and sv carries `@svgrid/...: workspace:^` in its dependencies or peers, and npm ships that string verbatim, so every consumer's install dies with `EUNSUPPORTEDPROTOCOL`. pnpm rewrites it to the concrete version.
- The bumped `package.json` files are committed and tagged **after** a successful publish, so a failed run leaves `main` untouched and is safe to re-run.
- Run manually any time from the Actions tab: `force: true` publishes even with no detected change, and `only: grid,mcp` restricts the run to named package directories.
- Adding a package: give it an entry in `PACKAGES` in `tools/release-packages.mjs` - that one list drives detection, ordering and publishing. Add it to `ORDER` in your local `tools/publish.mjs` too if you also release by hand.

## How the blog drip works

[tools/generate-blog-post.mjs](../tools/generate-blog-post.mjs) writes one post per run and
**appends it to the end of the queue** - its `date` is a random 2 to 5 days after the latest
existing post, which averages 3.5 and so publishes twice a week at uneven intervals. Generation
runs on the same twice-weekly cadence, so the queue neither grows nor drains.
Future-dated posts are hidden until their day arrives ([website/src/lib/blog.ts](../website/src/lib/blog.ts)),
so a generated post is never public the same day; it queues behind the already-scheduled backlog,
which leaves a long review window. The 1200x630 hero/social image is generated automatically at
build time from the post's frontmatter ([tools/blog-card.mjs](../tools/blog-card.mjs)), so no image
file is committed.

- The subject comes from [tools/blog-topics.json](../tools/blog-topics.json), a priority-ordered list of search queries. Each entry names the demos and docs the post has to link and the API identifiers its code has to use; the generator checks all of that before writing, and the post carries a keyword-led `seoTitle` / `seoDescription`. A topic counts as done once `website/src/content/blog/<slug>.md` exists, so the queue file never changes when a post ships. An empty queue is a no-op run. `node tools/generate-blog-post.mjs --list-topics` shows the queue; `tools/seo-guardrails.test.ts` fails CI when an entry points at a demo, doc or API name that does not exist.
- Preview without committing: run the workflow manually with `dry_run: true`, or locally with `node tools/generate-blog-post.mjs --next --dry-run` (needs `ANTHROPIC_API_KEY` in your env). `--freeform` restores the old "model picks a topic" behaviour for one-offs.
- House rules are enforced in the prompt and sanitized in the output: no em-dash glyphs, straight quotes only.

## How the blog's SEO structure stays current

The generated post is a bare article. Three scripts turn the pile of posts into a topic cluster,
and the deploy runs them against the freshly cloned website before every build (`pnpm blog:seo`
runs the same three locally):

1. [tools/twitter/build-tips-pages.mjs](../tools/twitter/build-tips-pages.mjs) - the four tips pages the daily tip tweet deep-links into, from `tools/twitter/tips-data.mjs`.
2. [tools/blog-pillars.mjs](../tools/blog-pillars.mjs) - the three pillar hubs (comparisons, integrations, guides) listing every published post.
3. [tools/blog-internal-links.mjs](../tools/blog-internal-links.mjs) - a "Related reading" block on every post, linking only to posts already published.

Their output is never committed: it is rebuilt from the day's post set on each deploy, so a post
that goes live today is linked from its siblings and hubs the same day. Pillar and tips pages keep a
fixed publish date so regenerating does not reset their age. The prerender also emits the blog's
RSS feed at `/feed.xml` (latest 30 published posts, full content) and advertises it from every page.

## Note on the version-bump and blog commits

Both workflows push with the default `GITHUB_TOKEN`. Commits made with that token do not trigger
other workflows, which is why the website rebuild runs on its own daily schedule rather than on each
blog commit. New posts are far-future-dated, so the next scheduled rebuild publishes them on time.
