# Daily automation

Three scheduled GitHub Actions keep the package and the blog moving without manual work.

| Workflow | File | Schedule (UTC) | What it does |
| --- | --- | --- | --- |
| Daily blog post | [daily-blog.yml](workflows/daily-blog.yml) | 05:23 | Generates one new blog post and commits it, queued behind the existing posts. |
| Publish npm package | [publish-npm.yml](workflows/publish-npm.yml) | 06:37 | Publishes `@svgrid/grid` to npm, but only when its source changed. |
| Deploy website | [deploy-website.yml](workflows/deploy-website.yml) | 07:12 | Rebuilds the site so posts whose date has arrived go live. |

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

## How the daily blog post works

[tools/generate-blog-post.mjs](../tools/generate-blog-post.mjs) writes one post per run and
**appends it to the end of the queue** - its `date` is one day after the latest existing post.
Future-dated posts are hidden until their day arrives ([website/src/lib/blog.ts](../website/src/lib/blog.ts)),
so a generated post is never public the same day; it queues behind the already-scheduled backlog,
which leaves a long review window. The 1200x630 hero/social image is generated automatically at
build time from the post's frontmatter ([tools/blog-card.mjs](../tools/blog-card.mjs)), so no image
file is committed.

- Preview without committing: run the workflow manually with `dry_run: true`, or locally with `node tools/generate-blog-post.mjs --dry-run` (needs `ANTHROPIC_API_KEY` in your env).
- House rules are enforced in the prompt and sanitized in the output: no em-dash glyphs, straight quotes only.

## Note on the version-bump and blog commits

Both workflows push with the default `GITHUB_TOKEN`. Commits made with that token do not trigger
other workflows, which is why the website rebuild runs on its own daily schedule rather than on each
blog commit. New posts are far-future-dated, so the next scheduled rebuild publishes them on time.
