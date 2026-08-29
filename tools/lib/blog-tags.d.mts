export type TagEntry = { label: string; aliases?: string[] }
export type TagPost = { slug: string; title: string; description: string; tags: string[]; canonical?: string }
export type TagHub<P = TagPost> = { tag: string; slug: string; label: string; posts: P[] }

export const MIN_POSTS: number
export const TAG_VOCABULARY: Record<string, TagEntry>
export function canonicalTag(raw: string): string | null
export function tagSlug(canonical: string): string
export function tagLabel(canonical: string): string
export function tagFromSlug(slug: string): string | null
export function postTags(post: { tags?: string[] }): string[]
export function buildTagHubs<P extends TagPost>(posts: P[]): TagHub<P>[]
