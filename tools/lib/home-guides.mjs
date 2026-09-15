/**
 * The guides the home page links to, shared by the hydrated page
 * (website/src/routes/Home.svelte) and the static crawl body
 * (tools/prerender-site.mjs), so the two cannot list different posts.
 *
 * These are the posts written for the head term "svelte data grid". Until
 * 2026-09-15 nothing on the home page linked to any of them, so the one page
 * with the most authority passed none of it to the pages built to rank for
 * the query. Slugs are checked against website/src/content/blog by the
 * guardrail test; a post that is not published yet does not belong here.
 */
export const HOME_GUIDES = [
  { slug: 'best-svelte-data-grids-2026', title: 'The best Svelte data grids in 2026' },
  { slug: 'render-your-first-svelte-data-grid', title: 'Render your first Svelte data grid in under 5 minutes' },
  { slug: 'fastest-svelte-data-grid', title: 'What makes a Svelte data grid fast' },
  { slug: 'most-accessible-svelte-data-grid', title: 'Choosing the most accessible Svelte data grid' },
  { slug: 'open-source-vs-commercial-svelte-grids', title: 'Open-source vs commercial Svelte data grids' },
  { slug: 'what-is-a-headless-data-grid', title: 'What is a headless data grid?' },
]
