# Gantt view: release on 1 November 2026

The code is on main. What is not public yet is everything that names it:
the demos, the guide, the solution page copy, the marketing lines. Until the
date the site hides them; on the date most of it comes back by itself, and
the rest is one patch.

## What flips on its own

`tools/lib/releases.mjs` holds the record (`gantt`, date `2026-11-01`). Every
consumer reads it, so the morning deploy on the date (the daily cron in
`.github/workflows/deploy-website.yml`, 07:12 UTC) rebuilds the site with:

- the eight Gantt demos (474-481) back in the gallery, the search index, the
  prerender, the sitemap and the MCP manifests (`pendingDemoIds`);
- the guide under `docs/help/gantt` routed and indexed, and the stub at
  `docs/help/rows/gantt.md` gone, with `docs/_data/doc-moves.json` sending the
  old URL on to the hub (`isPendingDoc`, `movedPage`);
- the `/svelte/gantt-chart` page reading its released copy instead of the
  `prerelease` override (`resolveSolution`);
- the Gantt tab on the docs landing showcase, the product JSON-LD, the
  `/svelte/` route title, the two prerendered sentences and the llms.txt intro
  naming the view (`isReleased`);
- the MCP page's demo count.

To see the released site before the date: `SVGRID_TODAY=2026-11-01 pnpm
build` in `website/`, or set `globalThis.__SVGRID_TODAY__` before the app
loads (the Gantt e2e suite does).

## What needs a hand

Plain text the build cannot switch. Apply the two patches, review, commit:

```sh
git apply plans/gantt-release.patch
cd website && git apply ../plans/gantt-release-website.patch && cd ..
# On a fresh checkout the line endings may differ from the patch: add --ignore-whitespace.
```

They add the Gantt to the pricing matrix and FAQs, the home page card and
FAQ, the Enterprise row of the demos product switcher, both npm READMEs and
the docs pack overview, the SVAR comparison, two blog posts, the changelog's
two entries, the See-also lines, and move the roadmap item from in progress
to shipped. Then:

1. Delete `docs/help/rows/gantt.md` and the `gantt` record in
   `tools/lib/releases.mjs` (the date has passed; the record only adds noise).
2. Regenerate: `node tools/build-docs-index.mjs && node
   tools/build-docs-page-index.mjs && node tools/build-demo-search-index.mjs
   && node tools/build-changelog-json.mjs && (cd packages/mcp && node
   scripts/build-manifests.mjs)`.
3. Run the guards: `pnpm vitest run --dir tools`, the website suite (the
   search-quality Gantt cases switch themselves on), `pnpm exec playwright
   test tests/e2e/gantt.spec.ts`.
4. Publish `@svgrid/enterprise` (the renderer) and `@svgrid/grid` (the
   `gantt` prop's types and the `registerGanttView` seam, unpublished since
   4.0.0) - the release workflow bumps both once the tree changes.
5. Commit the website submodule first, then the main repo with the gitlink.

If the date moves, change it in `tools/lib/releases.mjs` and in the roadmap
note, the stub page and the solution page's `prerelease` intro (all say
"1 November 2026").
