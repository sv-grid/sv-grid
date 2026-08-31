/**
 * Guard that every public symbol in the generated API reference is documented.
 *
 * `docs/reference/auto/` is built from JSDoc, and a symbol with none renders as
 * "_No JSDoc yet._". That started at 95 of 136 symbols - including the entire
 * headless vocabulary (`tableFeatures`, `Row`, `Column`, `SortingState`, the
 * row-model factories), which is exactly what a headless user or a TanStack
 * migrant reads first.
 *
 * Undocumented exports do not announce themselves, so this counts them. Adding
 * a public export without a doc comment now fails here.
 *
 * Regenerate with: `node tools/build-reference.mjs`
 * Run: `pnpm vitest run tools/reference-coverage.test.ts`
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const AUTO_DIR = join(process.cwd(), 'docs', 'reference', 'auto')
const NO_JSDOC = '_No JSDoc yet._'

async function pages() {
  const files = await readdir(AUTO_DIR)
  return files.filter((f) => f.endsWith('.md') && f !== 'index.md')
}

describe('generated API reference', () => {
  it('documents every exported symbol', async () => {
    const undocumented: string[] = []
    let symbols = 0

    for (const file of await pages()) {
      const text = await readFile(join(AUTO_DIR, file), 'utf8')
      symbols += (text.match(/^### `/gm) ?? []).length

      // Pair each heading with the line under it, so a failure names the symbol.
      const re = /^### `(\w+) (\w+)`\n\n(.*)$/gm
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        if (m[3]?.includes(NO_JSDOC)) undocumented.push(`${file}: ${m[1]} ${m[2]}`)
      }
    }

    expect(symbols).toBeGreaterThan(100)
    expect(undocumented, `Undocumented public exports:\n  ${undocumented.join('\n  ')}`).toEqual([])
  })

  it('emits complete declarations, not truncated ones', async () => {
    // The extractor used to stop at brace depth 0, so every union type came out
    // as a dangling `export type ExportFormat =` with no body - 20% of the
    // reference. Nothing should end on an unfinished opener.
    const truncated: string[] = []
    for (const file of await pages()) {
      const text = await readFile(join(AUTO_DIR, file), 'utf8')
      for (const block of text.matchAll(/```ts\n([\s\S]*?)```/g)) {
        const body = block[1]!.trim()
        if (/^export (type|interface|function|const)[^\n]*[=({|]\s*$/.test(body)) {
          truncated.push(`${file}: ${body.slice(0, 70)}`)
        }
      }
    }
    expect(truncated, `Truncated declarations:\n  ${truncated.join('\n  ')}`).toEqual([])
  })
})
