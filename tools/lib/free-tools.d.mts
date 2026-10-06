export type FreeToolFaq = { question: string; answer: string }
export type FreeTool = {
  slug: string
  name: string
  h1: string
  query: string
  title: string
  description: string
  keywords: string[]
  cardText: string
  lead: string
  steps: string[]
  faq: FreeToolFaq[]
}
export const FREE_TOOLS: FreeTool[]
export function findFreeTool(slug: string): FreeTool | null
