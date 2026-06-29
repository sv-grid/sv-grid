// GitHub Discussions integration via giscus (https://giscus.app).
//
// giscus embeds the repo's GitHub Discussions as a comment widget: visitors
// sign in with GitHub and post / reply, and every thread is a real Discussion
// in the repo. No backend required - it's a GitHub-hosted iframe, which suits
// this static site perfectly.
//
// SETUP (one-time, before the live widget appears):
//   1. Enable Discussions on github.com/sv-grid/sv-grid
//      (Settings -> General -> Features -> Discussions).
//   2. Install the giscus app and grant it this repo:
//      https://github.com/apps/giscus
//   3. Pick a Discussions category for site comments. We use the built-in
//      "Q&A" category (set in `category` below). A dedicated "Announcement"-type
//      category is cleaner (only maintainers can open the mapped threads), but
//      any category works - just keep `category` + `categoryId` in sync.
//   4. Open https://giscus.app, enter `sv-grid/sv-grid` + the category, and copy
//      the generated `data-repo-id` and `data-category-id` into the constants
//      below (replacing the REPLACE_WITH_* placeholders).
//
// Until both *_ID placeholders are filled, <Giscus> renders a friendly
// "join the discussion on GitHub" fallback instead of a broken/empty widget.

export const GISCUS = {
  repo: 'sv-grid/sv-grid',
  repoId: 'R_kgDOSbwZWQ',
  // The Discussions category these comments post into (display name + id).
  // Must match the category name in GitHub exactly. Using the built-in "Q&A"
  // category; switch this string (and categoryId) if you later make a dedicated
  // "Comments" category.
  category: 'Q&A',
  categoryId: 'DIC_kwDOSbwZWc4C98qe',
  // The giscus client script + its iframe origin (for postMessage theme syncs).
  src: 'https://giscus.app/client.js',
  origin: 'https://giscus.app',
} as const

/** The repo's Discussions tab - used by the fallback + the Community page. */
export const DISCUSSIONS_URL = `https://github.com/${GISCUS.repo}/discussions`

/** True once the real repo/category ids have replaced the placeholders. */
export function giscusConfigured(): boolean {
  return (
    !GISCUS.repoId.startsWith('REPLACE_') &&
    !GISCUS.categoryId.startsWith('REPLACE_')
  )
}

/** Map the site theme (`<html data-theme>`) to a giscus theme name. */
export function giscusTheme(siteTheme: 'light' | 'dark'): string {
  return siteTheme === 'light' ? 'light' : 'dark'
}
