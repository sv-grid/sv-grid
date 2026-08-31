#!/usr/bin/env node
/**
 * Guard against double-encoded UTF-8 getting committed.
 *
 * Two docs pages shipped with text that had been read as **cp1252** and
 * re-encoded as UTF-8, so every original byte became its own code point:
 * `> Step 4 of 6 Â· [â† Data and columns]` instead of `· [←`. It reached
 * production and was served to LLMs through llms-full.txt, because nothing
 * checked for it. This is that check.
 *
 * It is cp1252 rather than latin1: the byte 0x86 came back as U+2020 DAGGER,
 * which only cp1252 maps that way.
 *
 *   node tools/check-encoding.mjs          # report, exit 1 on any finding
 *   node tools/check-encoding.mjs --fix    # repair in place
 *
 * A run only qualifies as damage when it is 2+ cp1252-representable characters
 * that reverse into exactly ONE valid non-ASCII character. Ordinary accented
 * prose ("café", "naïve") cannot match that, so this does not fire on real text.
 *
 * Dependency-free so it runs on a fresh clone without `pnpm install`.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIX = process.argv.includes('--fix')

/** Directories worth scanning: everything a human authors. */
const SCAN = ['docs', 'examples/src', 'packages/grid/src', 'packages/enterprise/src', 'packages/svgrid-ui/recipes']
const EXT = /\.(md|svelte|ts|mjs|json|css)$/
const SKIP_DIR = /^(node_modules|dist|build|\.git|\.svelte-kit|coverage)$/

/** cp1252 0x80-0x9F -> Unicode. Every other byte maps to itself. */
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
]
const TO_BYTE = new Map()
for (let b = 0; b < 0x100; b++) {
  TO_BYTE.set(b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b, b)
}

const strictUtf8 = new TextDecoder('utf-8', { fatal: true })

/** @returns {[repairedText: string, findings: Array<{bad: string, good: string}>]} */
function repair(text) {
  let out = ''
  let run = ''
  const findings = []

  const flush = () => {
    if (run.length >= 2) {
      const bytes = Buffer.from([...run].map((c) => TO_BYTE.get(c.codePointAt(0))))
      let decoded = null
      try {
        decoded = strictUtf8.decode(bytes)
      } catch {
        decoded = null
      }
      if (decoded && [...decoded].length === 1 && decoded.codePointAt(0) > 0x7f) {
        findings.push({ bad: run, good: decoded })
        out += decoded
        run = ''
        return
      }
    }
    out += run
    run = ''
  }

  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp > 0x7f && TO_BYTE.has(cp)) run += ch
    else {
      flush()
      out += ch
    }
  }
  flush()
  return [out, findings]
}

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out // a directory that does not exist here is not an error
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIR.test(e.name)) walk(p, out)
    } else if (EXT.test(e.name)) out.push(p)
  }
  return out
}

let totalFiles = 0
let totalSeqs = 0

for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, 'utf8')
    const [fixed, findings] = repair(text)
    if (!findings.length) continue
    totalFiles++
    totalSeqs += findings.length
    const rel = relative(ROOT, file).split('\\').join('/')
    console.log(`${FIX ? 'fixed' : 'FOUND'}  ${rel}`)
    for (const f of findings) {
      console.log(`         ${JSON.stringify(f.bad)} -> ${JSON.stringify(f.good)}`)
    }
    if (FIX) writeFileSync(file, fixed, 'utf8')
  }
}

if (!totalSeqs) {
  console.log('check-encoding: no double-encoded UTF-8 found')
  process.exit(0)
}

console.log(`\ncheck-encoding: ${totalSeqs} sequence(s) in ${totalFiles} file(s)`)
if (!FIX) {
  console.log('Run `node tools/check-encoding.mjs --fix` to repair.')
  process.exitCode = 1
}
