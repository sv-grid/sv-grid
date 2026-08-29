export const EDITOR_CATEGORIES: Set<string>

export type RegistryDemo = {
  id: string
  title: string
  blurb: string
  category: string
  pro: boolean
  seoTitle?: string
  seoDescription?: string
}
export function parseDemoRegistry(root: string): Promise<RegistryDemo[]>
export function readDemoSource(root: string, id: string): Promise<{ source: string; pitch: string }>
export function readDemoMeta(
  root: string,
  id: string,
): Promise<{
  description: string
  faq: { question: string; answer: string }[]
  keywords: string[]
  exists: boolean
}>
