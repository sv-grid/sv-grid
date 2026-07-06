# Community demos

Demos in this folder are contributed by the community. They live **only in the
[playground](https://svgrid.com/playground)** - pick one from the demo switcher's
**Community** group to run and remix it - and are not listed in the main
[examples gallery](https://svgrid.com/demos). They carry a **Community** badge,
credit you by name, and can be upvoted on GitHub.

## Submit one in 3 steps

1. **Copy the template.** Duplicate [`example-status-board.svelte`](./example-status-board.svelte)
   to `examples/src/demos/community/<your-slug>.svelte`. Use a short, kebab-case
   slug (it becomes the demo id `community-<your-slug>` and the URL
   `svgrid.com/playground/community-<your-slug>`).

2. **Fill in the header.** Every community demo starts with an HTML comment the
   site reads for attribution:

   ```html
   <!--
     title: Your demo title
     author: Your Name
     github: your-handle
     tags: editing, filtering, charts
     discussion: 0
   -->
   ```

   - `title` - shown in the gallery + switcher.
   - `author` / `github` - your credit and profile link (omit `github` to skip the link).
   - `tags` - comma-separated feature tags, shown as chips.
   - `discussion` - **leave `0`**. A maintainer sets it to the GitHub Discussion
     number that backs your demo's upvotes once the thread exists (see below).

3. **Open a PR.** The easiest path: build your demo in the
   [playground](https://svgrid.com/playground) and click **Share as a community
   demo** - it prepends the header, copies the file, and opens a pre-filled
   GitHub PR for you. Or add the file by hand and open a PR the usual way.

## Rules of the road

- **Keep it self-contained.** Import only from `@svgrid/grid` (and
  `@svgrid/enterprise` if you're showing a Pro feature). Inline your sample data
  instead of importing `../shared/*`, so the demo runs in the playground and in a
  downloaded project without extra files.
- **One file, no new dependencies.** If it needs a new npm package it won't run
  in the playground - keep it to the grid.
- **MIT.** By opening a PR you agree to license your contribution under the
  repository's MIT license.
- Reviewers check that it compiles, is on-topic (a grid demo), and is something
  you'd be comfortable pasting into your own app.

## Upvotes (GitHub-native stars)

Each community demo is backed by a GitHub **Discussion** in the *Community demos*
category. The playground reads that discussion's 👍 reaction count and shows it as
the demo's star count. There is no separate voting database - the star is a GitHub
reaction, tied to a real account.

Visitors can upvote **in place** from the playground (sign in with GitHub, click
Upvote, the count updates live) when the voting worker is deployed - see
[`workers/svgrid-vote/`](../../../../workers/svgrid-vote/). If it isn't, the
Upvote control just links out to the discussion, where they click 👍.

Maintainers: after merging, create/locate the discussion and set the demo's
`discussion:` header to its number. The helper
[`tools/seed-community-discussions.mjs`](../../../../tools/seed-community-discussions.mjs)
prints (and, with `--create`, posts) one discussion per community demo that
doesn't have one yet.
