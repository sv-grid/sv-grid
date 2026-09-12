/** Split website/public/llms-full.txt back into slug -> markdown body. */
export function parseDocsCorpus(text: string): Map<string, string>
/** The slug a corpus block URL is keyed by (`help/x` for /docs/help/x/,
 *  `compare/x` for /compare/x/), or null for a block the search ignores. */
export function corpusSlug(url: string): string | null
