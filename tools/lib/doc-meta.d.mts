export const HIDDEN_SLUGS: Set<string>
export const HIDDEN_PREFIXES: string[]
export function isHiddenDoc(slug: string): boolean
export const SECTION_TITLES: Record<string, string>
export function sectionOf(rel: string): string

export type DocFrontmatter = {
  seoTitle?: string
  seoDescription?: string
  keywords?: string[]
  noindex?: boolean
  [key: string]: string | string[] | boolean | undefined
}
export function parseDocFrontmatter(raw: string): { meta: DocFrontmatter; body: string }

export const UI_COMPONENT_NAMES: Record<string, string>
export function uiComponentName(h1: string): string | null
export function docSeoTitle(doc: { slug: string; section: string; title: string }): string
