export interface AiBriefSize {
  measuredAt?: string
  version?: string
  entries?: Record<string, { baseGzipKb?: number; cssGzipKb?: number; lazyGzipKb?: number }>
}

export function aiBriefLines(o: {
  site: string
  version: string | null
  size: AiBriefSize | null
  themeCount: number | null
  demoCount: number | null
  ganttReleased: boolean
}): string[]

export const START_HERE: string[]
export const SMALL_CORPUS: string[]
export const OPTIONAL_SECTIONS: Set<string>
export const OPTIONAL_PAGES: Set<string>

export function absoluteDocHref(href: string, o: { site: string; slug: string; knownSlugs: Set<string> }): string

export function plainDocBody(
  body: string,
  o: {
    site: string
    slug: string
    knownSlugs: Set<string>
    demoTitle?: (id: string) => string | null
    tutorial?: (id: string) => { title: string; youtube?: string } | null
  },
): string
