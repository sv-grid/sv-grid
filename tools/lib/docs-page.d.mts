export function titleFromMarkdown(md: string, fallback: string): string
export function descriptionFromMarkdown(md: string): string
export function faqFromMarkdown(md: string): { question: string; answer: string }[]
export function keywordsFor(title: string, category: string): string[]
