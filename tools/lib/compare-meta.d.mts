export type CompareFaqItem = { question: string; answer: string }
export function shortCompetitor(competitor: string): string
export function compareTitle(competitor: string): string
export function compareFaq(comparison: {
  competitor: string
  alternativeIntro?: string
  faq?: CompareFaqItem[]
}): CompareFaqItem[]
export function compareKeywords(competitor: string): string[]
