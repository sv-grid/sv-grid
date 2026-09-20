export type Release = {
  date: string
  title: string
  docs: string[]
  stubs?: string[]
  demos: string[]
}
export const RELEASES: Record<string, Release>
export const TODAY: string
export function isReleased(id: string, today?: string): boolean
export function pendingReleases(today?: string): Array<Release & { id: string }>
export function pendingDemoIds(today?: string): Set<string>
export function isPendingDoc(slug: string, today?: string): boolean
export function resolveSolution<T extends object>(entry: T, today?: string): T
