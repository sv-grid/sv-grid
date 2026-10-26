/**
 * Rewrite the "Open this prompt in Bolt / Lovable" links in the AI app builder
 * tutorials from the prompt block above each one.
 *
 *   node tools/sync-ai-builder-links.mjs           rewrite docs/help/bolt-new.md and lovable.md
 *   node tools/sync-ai-builder-links.mjs --check   exit 1 when a link is stale (CI)
 *
 * Each link carries the whole prompt URL-encoded, so editing the visible
 * ```text block without regenerating it leaves a button that pre-fills an
 * older prompt than the one the reader just read. The link is the line
 * `[**Open this prompt in Bolt**](...)` or `[**Open this prompt in Lovable**](...)`,
 * and its prompt is the nearest ```text block before it.
 *
 * Bolt reads `?prompt=` from the query string; Lovable's Build with URL reads
 * `#prompt=` from the fragment (https://docs.lovable.dev/integrations/build-with-url).
 * Neither sends the prompt by itself: it waits in the chat box for the reader.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const PAGES = ['docs/help/bolt-new.md', 'docs/help/lovable.md']

// encodeURIComponent leaves ( ) ' * ! alone, and a bare ")" ends a markdown
// link early, cutting the prompt off at its first closing parenthesis.
const encode = (text) => encodeURIComponent(text).replace(/[()'*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

const BUILDERS = {
  Bolt: (prompt) => `https://bolt.new/?prompt=${encode(prompt)}`,
  Lovable: (prompt) => `https://lovable.dev/#prompt=${encode(prompt)}`,
}

// Lovable discards a prompt over 50,000 characters and empties the box.
const LOVABLE_MAX = 50_000

// Greedy to the last ")" on the line, so a stale link written before the
// encoding above still matches and gets rewritten.
const LINK = /^\[\*\*Open this prompt in (Bolt|Lovable)\*\*\]\((.*)\)\s*$/

/** The page with every prompt link rebuilt, and the prompts it found. */
export function syncPromptLinks(markdown) {
  const lines = markdown.split(/\r?\n/)
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
  const prompts = []
  let lastText = null
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '```text') {
      const body = []
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== '```') body.push(lines[j++])
      lastText = body.join('\n')
      i = j
      continue
    }
    const m = LINK.exec(lines[i])
    if (!m) continue
    if (lastText == null) throw new Error(`line ${i + 1}: "${m[1]}" link with no \`\`\`text prompt above it`)
    if (m[1] === 'Lovable' && lastText.length > LOVABLE_MAX) {
      throw new Error(`line ${i + 1}: the Lovable prompt is ${lastText.length} characters; Lovable drops anything over ${LOVABLE_MAX}`)
    }
    prompts.push({ builder: m[1], prompt: lastText, line: i + 1 })
    lines[i] = `[**Open this prompt in ${m[1]}**](${BUILDERS[m[1]](lastText)})`
    lastText = null
  }
  return { markdown: lines.join(eol), prompts }
}

/** The prompt a builder link would pre-fill, decoded from the URL. */
export function promptFromLink(url) {
  const m = /^https:\/\/bolt\.new\/\?prompt=(.*)$/.exec(url) ?? /^https:\/\/lovable\.dev\/#prompt=(.*)$/.exec(url)
  return m ? decodeURIComponent(m[1]) : null
}

async function main() {
  const check = process.argv.includes('--check')
  let stale = 0
  for (const rel of PAGES) {
    const file = join(ROOT, rel)
    const before = await readFile(file, 'utf8')
    const { markdown, prompts } = syncPromptLinks(before)
    if (markdown === before) {
      console.log(`${rel}: ${prompts.length} prompt link(s) current`)
      continue
    }
    if (check) {
      stale += 1
      console.error(`${rel}: prompt links are stale - run node tools/sync-ai-builder-links.mjs`)
    } else {
      await writeFile(file, markdown)
      console.log(`${rel}: rewrote ${prompts.length} prompt link(s)`)
    }
  }
  if (stale) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
