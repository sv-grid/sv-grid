export type CompareFaqItem = { question: string; answer: string }
export function shortCompetitor(competitor: string): string
export function compareTitle(competitor: string): string
export function compareFaq(comparison: {
  competitor: string
  alternativeIntro?: string
  faq?: CompareFaqItem[]
}): CompareFaqItem[]
export function compareKeywords(competitor: string, aliases?: string[]): string[]
export const COMPARE_HUB: {
  readonly eyebrow: string
  readonly h1: string
  readonly intro: string
  readonly why: { readonly heading: string; readonly body: string }
}
export function compareSeo(
  comparison: { competitor: string; seoTitle?: string; seoDescription?: string; oneLineVerdict?: string; tagline?: string },
  clamp?: (text: string) => string,
): { title: string; description: string }
export function compareJsonLd(
  comparison: {
    slug: string
    competitor: string
    published?: string
    verified?: string
    npm?: string
    url?: string
    faq?: CompareFaqItem[]
    alternativeIntro?: string
  },
  opts: { canon: string; description: string },
): unknown[]
