/**
 * Enforce the hard contract of examples/src/mobile.css: EVERY declaration in
 * it must sit inside a `max-width` media query, so the file cannot change
 * desktop rendering.
 *
 * That promise is the whole reason the mobile pass was allowed to touch a
 * shared stylesheet at all ("I like the demos as they are"), and it is the
 * kind of thing that quietly rots the first time someone adds a rule at the
 * top of the file. This makes it mechanical instead of a code-review habit.
 *
 * Usage:  node tools/check-mobile-css.mjs      (wired into `pnpm lint`)
 * Exits non-zero, listing the offending line, if any rule escapes a guard.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, '..', 'examples', 'src', 'mobile.css')

const src = await readFile(FILE, 'utf-8')

// Strip comments so a `{` inside prose can't trip the scanner.
const clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const lines = clean.split('\n')
const problems = []

// An orphan `*/` survives comment-stripping only when prose was left outside a
// comment - e.g. a second paragraph appended after an existing `*/`. CSS then
// swallows the stray text AND the rule that follows it, silently dropping the
// rule while every brace still balances. That has bitten this file, so check it
// explicitly rather than trusting review.
clean.split('\n').forEach((line, i) => {
  if (line.includes('*/')) {
    problems.push({
      n: i + 1,
      text: line.trim(),
      why: 'stray `*/` outside a comment - the rule after it is silently dropped',
    })
  }
})
let depth = 0 // brace depth
let guardDepth = -1 // depth at which the enclosing max-width media query opened

lines.forEach((line, i) => {
  // Detect an at-rule opening on this line before counting its braces.
  const at = line.match(/@([a-z-]+)([^{]*)\{/)
  if (at && depth === 0) {
    const [, name, params] = at
    // Two query shapes are accepted, because both are provably unreachable on
    // a desktop:
    //   max-width           - a narrow viewport.
    //   max-height + pointer: coarse - a phone in landscape (844x390), which
    //     never matches max-width. The coarse-pointer half is what keeps it
    //     off desktop: a short desktop WINDOW has a fine pointer.
    // A bare max-height would NOT be safe - a short desktop window matches it.
    const guarded =
      name === 'media' &&
      (/max-width/.test(params) || (/max-height/.test(params) && /pointer\s*:\s*coarse/.test(params)))
    if (guarded) guardDepth = depth
    else if (name !== 'supports') {
      problems.push({ n: i + 1, text: line.trim(), why: `top-level @${name} is not a desktop-safe guard (need max-width, or max-height + pointer: coarse)` })
    }
  }

  // A selector block opening at depth 0 is an unguarded rule.
  if (/\{/.test(line) && !at && depth === 0) {
    problems.push({ n: i + 1, text: line.trim(), why: 'rule is outside any media query' })
  }

  for (const ch of line) {
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth <= guardDepth) guardDepth = -1
    }
  }
})

if (problems.length) {
  process.stderr.write(`check-mobile-css: ${problems.length} problem(s) in examples/src/mobile.css\n\n`)
  for (const p of problems) {
    process.stderr.write(`  line ${p.n}: ${p.why}\n    ${p.text.slice(0, 90)}\n`)
  }
  process.stderr.write(
    `\nEvery rule in this file must live inside a media query a desktop cannot\n` +
      `match - \`(max-width: ...)\`, or \`(max-height: ...) and (pointer: coarse)\`\n` +
      `for landscape phones - so it cannot affect desktop rendering. And no prose\n` +
      `may sit outside a comment, which silently drops the rule that follows it.\n`,
  )
  process.exit(1)
}

process.stdout.write('check-mobile-css: ok - every rule is inside a desktop-safe media guard\n')
