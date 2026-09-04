export const KNOWN_FLAGS: Set<string>

export type Fence = {
  file: string
  /** 0-based position of this block within its file. Stable snippet id input. */
  index: number
  /** 1-based line of the first line of code (not the fence). */
  line: number
  lang: string
  flags: Set<string>
  code: string
}

export function extractFences(file: string, src: string): Fence[]
export function isComponentShaped(code: string): boolean
export function splitComponent(code: string): { script: string; markup: string }
export function declaredNames(script: string): Set<string>
export function mergePreamble(preambleScript: string, snippetCode: string): string
/**
 * FNV-1a of a code block, whitespace-normalised so a CRLF checkout keys the
 * same as an LF one. The browser imports this to match a rendered `<pre>`
 * against the manifest, so it must stay sync and dependency-free.
 */
export function blockKey(code: string): string
