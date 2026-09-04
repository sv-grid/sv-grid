# Daily automation

Three scheduled GitHub Actions keep the package and the blog moving without manual work.

| Workflow | File | Schedule (UTC) | What it does |
| --- | --- | --- | --- |
| Blog post (twice weekly) | [daily-blog.yml](workflows/daily-blog.yml) | Tue + Fri 05:23 | Generates one new blog post and commits it, queued behind the existing posts. |
| Publish npm package | [publish-npm.yml](workflows/publish-npm.yml) | 06:37 | Publishes `@svgrid/grid` to npm, but only when its source changed. |
| Deploy website | [deploy-website.yml](workflows/deploy-website.yml) | 07:12 | Regenerates the blog's SEO structure (tips pages, pillar hubs, "Related reading" blocks), then rebuilds the site so posts whose date has arrived go live. |

## Required secrets and variables

Add these under **Settings -> Secrets and variables -> Actions**:

- `NPM_TOKEN` (secret) - an npm **automation** token with publish rights to the `@svgrid` scope.
- `ANTHROPIC_API_KEY` (secret) - Anthropic API key used to write each post.
- `BLOG_MODEL` (variable, optional) - model id for generation. Defaults to `claude-sonnet-4-6`. Use `claude-opus-4-8` for higher quality at higher cost.

## How the npm publish stays clean

`@svgrid/grid` is consumed by enterprise customers, so we never push an empty version.
[tools/release-grid.mjs](../tools/release-grid.mjs) marks each release with a `grid-v<version>`
git tag and, on the next run, only bumps the patch (build) number and republishes if
`packages/grid/src` or its `package.json` changed since that tag. Days with no changes are no-ops.

- First scheduled run finds no `grid-v*` tag, so it lays down the baseline tag `grid-v1.0.2` (the version already on npm) and publishes nothing.
- `@svgrid/enterprise` is the paid SKU and is deliberately **not** auto-published. To add another public package later, give it the same detect/bump/tag treatment in `publish-npm.yml`.
- Run manually any time from the Actions tab; `force: true` publishes even with no detected change.

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
