export type DemoAboutModel = {
  id: string
  description: string
  pitch: string[]
  facts: {
    imports: string[]
    features: string[]
    columns: { field: string; header?: string }[]
    api: string[]
  } | null
  faq: { question: string; answer: string }[]
  docs: { slug: string; title: string }[]
  posts: { slug: string; title: string; description?: string }[]
  source: string
}
export const DEMO_ABOUT_HEADINGS: {
  readonly about: string
  readonly facts: string
  readonly faq: string
  readonly docs: string
  readonly posts: string
  readonly source: (id: string) => string
}
export const DEMO_ABOUT_ORDER: readonly string[]
export function demoAboutModel(input: {
  id: string
  source?: string
  meta?: { description?: string; faq?: { question: string; answer: string }[] } | null
  related?: { docs?: { slug: string; title: string }[]; posts?: { slug: string; title: string; description?: string }[] } | null
}): DemoAboutModel
export function demoAboutSections(model: DemoAboutModel): string[]
export function renderDemoAboutHtml(
  model: DemoAboutModel,
  opts: { href: (kind: 'docs' | 'blog', slug: string) => string; escape?: (s: string) => string; sourceLink?: string },
): string
