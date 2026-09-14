/**
 * Chart gallery code cards.
 *
 * `docs/help/charts/gallery.md` embeds one demo per chart family as a
 * `data-code` host, the Preview / Code card the ui-components pages use.
 * The card's Code tab is the fenced block that follows the host, and this
 * script writes that block from the demo file itself: the demo's `<script>`
 * without its banner comment, then its markup without the demo page's
 * `.note` blurb and `<style>`. The demo is the preview, so the code beside
 * it is the code that renders it, and a demo edit reruns this script rather
 * than a second copy of the spec going stale in the markdown.
 *
 *   node tools/gallery-doc-code.mjs           rewrite the blocks
 *   node tools/gallery-doc-code.mjs --check   exit 1 when a block is stale
 *
 * `tools/gallery-doc-code.test.ts` runs the check.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
export const ROOT = join(HERE, '..')
export const GALLERY = 'docs/help/charts/gallery.md'

const HOST_RE = /^<div data-docs-demo="([^"]+)"[^>]*\bdata-code\b[^>]*><\/div>\r?\n/gm

/** The code shown beside a gallery demo: its script minus the banner, its markup minus the blurb and styles. */
export function galleryCodeFor(demoId, root = ROOT) {
  const src = readFileSync(join(root, 'examples/src/demos', `${demoId}.svelte`), 'utf8').replace(/\r\n/g, '\n')
  const scriptMatch = /<script lang="ts">\n([\s\S]*?)<\/script>/.exec(src)
  if (!scriptMatch) throw new Error(`${demoId}: no <script lang="ts"> block`)
  // The banner is the JSDoc comment the demo opens with (title, bullets, licence line).
  const script = scriptMatch[1].replace(/^\s*\/\*\*[\s\S]*?\*\/\n/, '')
  const afterScript = src.slice(scriptMatch.index + scriptMatch[0].length)
  const styleAt = afterScript.indexOf('<style>')
  let markup = (styleAt >= 0 ? afterScript.slice(0, styleAt) : afterScript).trim()
  // The one-sentence blurb in the demo's control bar is docs prose, not chart code.
  markup = markup.replace(/\n[ \t]*<span class="note">[\s\S]*?<\/span>/g, '')
  return `<script lang="ts">\n${script.replace(/\s+$/, '')}\n</script>\n\n${markup}\n`
}

/** The page with every `data-code` host followed by its derived block. Returns the new text. */
export function withGalleryCode(markdown, root = ROOT) {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
  const text = markdown.replace(/\r\n/g, '\n')
  const out = text.replace(new RegExp(HOST_RE.source + '(?:\\n?```svelte\\n[\\s\\S]*?\\n```\\n)?', 'gm'), (whole, demoId) => {
    const host = whole.slice(0, whole.indexOf('\n') + 1)
    return `${host}\n\`\`\`svelte\n${galleryCodeFor(demoId, root)}\`\`\`\n`
  })
  return eol === '\n' ? out : out.replace(/\n/g, eol)
}

function main() {
  const check = process.argv.includes('--check')
  const path = join(ROOT, GALLERY)
  const before = readFileSync(path, 'utf8')
  const after = withGalleryCode(before)
  const hosts = [...before.matchAll(HOST_RE)].map((m) => m[1])
  if (after === before) {
    console.log(`gallery code: ${hosts.length} cards up to date`)
    return
  }
  if (check) {
    console.error(`gallery code: ${GALLERY} is stale, run node tools/gallery-doc-code.mjs`)
    process.exit(1)
  }
  writeFileSync(path, after)
  console.log(`gallery code: wrote ${hosts.length} cards to ${GALLERY}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
