/**
 * The product graph: the schema.org nodes that describe SvGrid itself
 * (Organization, SoftwareApplication, SoftwareSourceCode, WebSite).
 *
 * Two consumers emit it and they must agree, because a crawler sees both:
 *
 *   - tools/prerender-site.mjs injects it into the static HTML of every page,
 *   - website/src/lib/seo.ts rebuilds it after hydration on every route.
 *
 * They used to be separate hand-written copies: index.html carried one graph
 * (softwareVersion "1.0.0" for months after 3.0 shipped, an Enterprise offer
 * that said "pivot, AI" when the AI helpers are free) and seo.ts another with
 * different offers, keywords and names. Hydration left the static copy in
 * place, so every rendered page shipped two SoftwareApplication entities that
 * disagreed with each other. One builder, two callers.
 *
 * The names and keywords carry the terms people actually type - "svelte data
 * grid", "svelte datagrid", "svelte grid", "svelte table" - not only the
 * "Svelte 5 data grid" wording the page itself leads with.
 *
 * Dependency-free so Vite can bundle it into the site.
 */
import { isReleased } from './releases.mjs'

export const PRODUCT_NAME = 'SvGrid'

/** Names the product is found under, generic search phrasing included. */
export const PRODUCT_ALTERNATE_NAMES = [
  'sv-grid',
  '@svgrid/grid',
  'Svelte data grid',
  'Svelte datagrid',
  'Svelte grid',
  'Svelte 5 data grid',
  'Svelte table',
]

export const PRODUCT_KEYWORDS = [
  'svelte data grid',
  'svelte datagrid',
  'svelte grid',
  'svelte table',
  'svelte 5 data grid',
  'svelte data table',
  'sveltekit data grid',
  'headless data grid',
  'sv-grid',
  '@svgrid/grid',
  'AG Grid alternative svelte',
  'TanStack Table svelte 5',
]


/** The views the paid pack adds, as the calendar has them today. */
const VIEWS = isReleased('gantt') ? 'Scheduler, Gantt and Spreadsheet' : 'Scheduler and Spreadsheet'
// The Grid tier's renderers: the Spreadsheet is a Suite feature, so it is
// not in this list.
const GRID_VIEWS = isReleased('gantt') ? 'Kanban board, Scheduler and Gantt views' : 'Kanban board and Scheduler views'

export const PRODUCT_DESCRIPTION =
  `SvGrid is a Svelte data grid built for Svelte 5: a headless engine (createSvGrid) plus a drop-in <SvGrid> render component. Row and column virtualization, Excel-style filters, sorting, grouping with aggregation, tree data, master/detail, inline editing, cell-range selection with clipboard, WAI-ARIA and keyboard navigation, 20 themes. MIT-licensed core; @svgrid/enterprise adds the Kanban board, ${VIEWS} views, the Server-Side Row Model, Excel / PDF export, import, print, pivot tables and SvGrid Studio.`

/** What the $599 Grid Developer License adds, in one sentence, for the
 *  Enterprise offer. The Spreadsheet and Studio are the Suite tier's and are
 *  named in that offer instead. Keep in step with the pricing matrix
 *  (website/src/routes/Pricing.svelte). */
export const ENTERPRISE_PACK =
  `the ${GRID_VIEWS}, the Server-Side Row Model, Excel / PDF / CSV / HTML export + Print, Excel import, pivot tables + Pivot Designer, no-code alert rules and staged batch editing`

export const FEATURE_LIST = [
  'Headless engine (createSvGrid) plus a drop-in <SvGrid> render component',
  'Row and column virtualization',
  'Sorting, Excel-style filters, filter row, find-in-grid',
  'Row grouping with aggregation, tree data, master/detail',
  'Inline editing with typed editors, validation, undo / redo',
  'Cell-range selection, copy / paste, fill handle',
  'WAI-ARIA grid roles, keyboard navigation, right-to-left layout',
  '20 themes on CSS custom properties',
  'MCP server and llms.txt for AI assistants',
  `Enterprise: Kanban board, ${VIEWS} views of the same grid`,
  'Enterprise: Server-Side Row Model with SQL, REST and Supabase sources',
  'Enterprise: Excel / PDF export, import, print, pivot tables, SvGrid Studio',
]

export const GITHUB_URL = 'https://github.com/sv-grid/sv-grid'
export const NPM_URL = 'https://www.npmjs.com/package/@svgrid/grid'
export const PUBLISHER_ID = 'https://www.jqwidgets.com/#organization'

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': PUBLISHER_ID,
    name: 'jQWidgets',
    url: 'https://www.jqwidgets.com',
    sameAs: [
      'https://www.htmlelements.com',
      'https://github.com/jqwidgets',
      'https://github.com/HTMLElements',
      'https://www.facebook.com/jqwidgets',
      'https://github.com/sv-grid',
    ],
  }
}

/**
 * `homepage` is the canonical site root with a trailing slash, `version` the
 * published @svgrid/grid version, and `reviews` schema.org Review nodes: real,
 * named testimonials only, never a rating (see website/src/lib/testimonials.ts).
 * @typedef {{ homepage: string, version: string, reviews?: unknown[] }} ProductGraphOptions
 */

/** @param {ProductGraphOptions} opts */
export function softwareApplicationLd({ homepage, version, reviews = [] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRODUCT_NAME,
    alternateName: PRODUCT_ALTERNATE_NAMES,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Data grid / table component',
    operatingSystem: 'Web',
    softwareVersion: version,
    description: PRODUCT_DESCRIPTION,
    url: homepage,
    downloadUrl: NPM_URL,
    sameAs: [GITHUB_URL, NPM_URL],
    isAccessibleForFree: true,
    license: 'https://opensource.org/licenses/MIT',
    featureList: FEATURE_LIST,
    keywords: PRODUCT_KEYWORDS.join(', '),
    publisher: { '@id': PUBLISHER_ID },
    offers: [
      {
        '@type': 'Offer',
        name: 'Community (MIT)',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free under the MIT License, including commercial use. No license key, no row-count cap.',
      },
      {
        '@type': 'Offer',
        name: 'Enterprise - Grid Developer License',
        price: '599',
        priceCurrency: 'USD',
        description: `Per developer. Buy once, keep forever - optional yearly renewal for new updates and support, cancel anytime. Covers unlimited deployed production applications in your organisation. Adds ${ENTERPRISE_PACK}, plus email support and a private Slack channel. No spreadsheet, no Studio.`,
      },
      {
        '@type': 'Offer',
        name: 'Enterprise Suite - Suite Developer License',
        price: '999',
        priceCurrency: 'USD',
        description: 'Per developer. Buy once, keep forever - optional yearly renewal for new updates and support, cancel anytime. Covers unlimited deployed production applications in your organisation. Everything in Enterprise plus the Excel-style Spreadsheet (SvSheet, formula engine, xlsx / xls / ods files) and SvGrid Studio (visual designer, SvelteKit code generator, SQL / REST / Supabase data sources).',
      },
      {
        '@type': 'Offer',
        name: 'Enterprise - Custom (Site / Org-wide License)',
        priceCurrency: 'USD',
        description: 'Custom contract for organisations with 50+ developers, MSA / NDA, source-code escrow, named support engineer, on-prem documentation, custom SLAs, multi-year terms, or government / FedRAMP procurement. Contact sales@jqwidgets.com.',
      },
    ],
    ...(reviews.length ? { review: reviews } : {}),
  }
}

/** @param {ProductGraphOptions} opts */
export function softwareSourceCodeLd({ homepage, version }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: '@svgrid/grid',
    version,
    codeRepository: GITHUB_URL,
    programmingLanguage: ['TypeScript', 'Svelte'],
    runtimePlatform: 'Svelte 5',
    license: 'https://opensource.org/licenses/MIT',
    url: homepage,
  }
}

/** @param {ProductGraphOptions} opts */
export function webSiteLd({ homepage }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: PRODUCT_NAME,
    url: homepage,
    publisher: { '@id': PUBLISHER_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${homepage}demos?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * The whole product graph, in the order the nodes reference each other.
 * @param {ProductGraphOptions} opts
 */
export function productGraph(opts) {
  return [organizationLd(), softwareApplicationLd(opts), softwareSourceCodeLd(opts), webSiteLd(opts)]
}
