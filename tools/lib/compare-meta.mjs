/**
 * Titles for the /compare/<slug> pages, shared by the prerenderer and the
 * website so the static HTML and the hydrated page agree.
 *
 * The pages already answered "SvGrid vs X". The other half of that intent is
 * "X alternative for Svelte", which people type far more often when they have
 * already decided to leave something, so the title carries that phrasing
 * whenever it fits inside a search result.
 */

const TITLE_MAX = 65

/**
 * The competitor name as someone types it into a search box: the display name
 * without its parenthetical qualifier. "AG Grid (community + enterprise)"
 * becomes "AG Grid". Names that are a list of products ("Flowbite / Skeleton
 * / shadcn-svelte tables") are left alone - there is no honest short form.
 */
export function shortCompetitor(competitor) {
  return String(competitor ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/**
 * Page title for a comparison. Prefers a variant that names the alternative
 * intent, then falls back to the plain comparison title for the few
 * competitors whose name is too long for either to fit.
 */
export function compareTitle(competitor) {
  const short = shortCompetitor(competitor)
  const variants = [
    `SvGrid vs ${short} - ${short} Alternative for Svelte`,
    `${short} Alternative for Svelte - SvGrid Comparison`,
    `SvGrid vs ${short} - Svelte Data Grid Comparison`,
  ]
  return variants.find((v) => v.length <= TITLE_MAX) ?? `SvGrid vs ${competitor} - Svelte Data Grid Comparison`
}

/**
 * The comparison's FAQ plus the alternative question, which is the phrasing
 * people actually search. The answer is the authored alternativeIntro rather
 * than generated text, so the rich result says what the page says.
 */
export function compareFaq(comparison) {
  const faq = comparison.faq ?? []
  if (!comparison.alternativeIntro) return faq
  const question = `Is SvGrid a good ${shortCompetitor(comparison.competitor)} alternative for Svelte?`
  if (faq.some((f) => f.question === question)) return faq
  return [...faq, { question, answer: comparison.alternativeIntro }]
}

/** Keywords for a comparison page, covering both halves of the intent. */
export function compareKeywords(competitor) {
  const short = shortCompetitor(competitor).toLowerCase()
  return [
    `svgrid vs ${short}`,
    `${short} alternative`,
    `${short} alternative for svelte`,
    `${short} svelte`,
    'svelte data grid comparison',
    'svelte 5',
    'sv-grid',
  ]
}
