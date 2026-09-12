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

/** Keywords for a comparison page, covering both halves of the intent plus
 *  the names people actually type for the competitor (its aliases). */
export function compareKeywords(competitor, aliases = []) {
  const short = shortCompetitor(competitor).toLowerCase()
  const out = [
    `svgrid vs ${short}`,
    `${short} alternative`,
    `${short} alternative for svelte`,
    `${short} svelte`,
  ]
  for (const a of aliases) {
    const k = String(a).toLowerCase()
    if (k && k !== short && !out.includes(k)) out.push(k)
  }
  out.push('svelte data grid comparison', 'svelte 5', 'sv-grid')
  return out
}

/** The hub page's on-page copy. One source for the SPA and the prerender,
 *  which had drifted to two different H1s. The H1 matches the indexed title. */
export const COMPARE_HUB = Object.freeze({
  eyebrow: 'Comparisons',
  h1: 'SvGrid vs Other Svelte Data Grids',
  intro:
    'Side-by-side comparisons against the other data grids you might consider on a Svelte project, with the version, licence and download numbers read from npm on a stated date. Each page ends with when to choose SvGrid and when to choose the alternative.',
  why: {
    heading: 'Why we publish these',
    body:
      'Most "X vs Y" pages are marketing. Ours include the cases where the other library is the better pick, because you would find out anyway and we would rather you learned it from us first. Every number on these pages is measured, dated and listed under Sources at the bottom.',
  },
})

/**
 * <title> and meta description for a comparison, with the authored overrides
 * winning over the derived defaults. The description is clamped like every
 * other description on the site (tools/lib/seo-text.mjs).
 */
export function compareSeo(comparison, clamp) {
  const title = comparison.seoTitle || compareTitle(comparison.competitor)
  const raw = comparison.seoDescription || comparison.oneLineVerdict || comparison.tagline || ''
  const description = typeof clamp === 'function' ? clamp(raw) : raw
  return { title, description }
}

/**
 * The JSON-LD graph for a comparison page: TechArticle (dated, with the two
 * products as `about`), BreadcrumbList and, when there are questions, FAQPage.
 * Built once here so the prerendered head and the hydrated head carry the same
 * graph. No Review or AggregateRating: this is an article, not a rating.
 *
 * @param {{ slug: string, competitor: string, published?: string, verified?: string, npm?: string, url?: string, faq?: CompareFaqItem[], alternativeIntro?: string }} comparison
 * @param {{ canon: string, description: string }} opts  `canon` is the site origin plus base, no trailing slash.
 */
export function compareJsonLd(comparison, { canon, description }) {
  const homepage = `${canon}/`
  const url = `${canon}/compare/${comparison.slug}/`
  const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !d.startsWith('1970')
  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `SvGrid vs ${comparison.competitor}`,
    description,
    url,
    inLanguage: 'en',
    ...(isDate(comparison.published) ? { datePublished: comparison.published } : {}),
    ...(isDate(comparison.verified) ? { dateModified: comparison.verified } : {}),
    about: [
      { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication', url: homepage },
      {
        '@type': 'SoftwareApplication',
        name: shortCompetitor(comparison.competitor),
        applicationCategory: 'DeveloperApplication',
        ...(comparison.url ? { url: comparison.url } : {}),
      },
    ],
    isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: homepage },
    publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SvGrid', item: homepage },
      { '@type': 'ListItem', position: 2, name: 'Comparisons', item: `${canon}/compare/` },
      { '@type': 'ListItem', position: 3, name: `SvGrid vs ${comparison.competitor}`, item: url },
    ],
  }
  const graph = [article, breadcrumb]
  const faq = compareFaq(comparison)
  if (faq.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    })
  }
  return graph
}
