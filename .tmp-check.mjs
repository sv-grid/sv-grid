/**
 * Run a hand-written post through the same bar the generator enforces.
 * Writing them myself skips the script, so it must not skip the checks.
 */
import { readFileSync } from 'node:fs'

const slug = process.argv[2]
const raw = readFileSync(`website/src/content/blog/${slug}.md`, 'utf-8')
const meta = {}
const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw)
for (const line of fm[1].split('\n')) {
  const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line)
  if (kv) meta[kv[1]] = kv[2]
}
const body = raw.slice(fm[0].length)

const src = readFileSync('tools/generate-blog-post.mjs', 'utf-8')
const parseList = (name) => {
  const b = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\]`).exec(src)
  // `startsWith('/')` alone also matches the `//` comments inside these lists,
  // which then fail the literal match below and throw.
  return b[1].split('\n').map((l) => l.trim().replace(/,$/, ''))
    .filter((l) => l.startsWith('/') && !l.startsWith('//'))
    .map((l) => { const m = /^\/((?:\\.|\[[^\]]*\]|[^/])+)\/([a-z]*)$/.exec(l); return new RegExp(m[1], m[2]) })
}
const BANNED = [
  "in this post we'll", 'in this post, we', "let's dive", 'lets dive', "let's start",
  "here's the thing", 'at the end of the day', "it's worth noting that",
  'the good news is', "that's why we",
]

const prose = body.replace(/```[\s\S]*?```/g, ' ')
const code = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
const codeLines = code.flatMap(([, c]) => c.split('\n')).filter((l) => l.trim()).length
const words = prose.split(/\s+/).filter(Boolean).length
const images = [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]

const types = readFileSync('packages/grid/src/SvGrid.types.ts', 'utf-8')
const REAL = new Set(['data', 'columns'])
for (const [, n] of types.matchAll(/^ {2,4}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)) REAL.add(n)
const invented = new Set()
for (const [, attrs] of body.matchAll(/<SvGrid\b([\s\S]*?)(?:\/>|>)/g)) {
  for (const [, n] of attrs.matchAll(/(?:^|\s)([a-zA-Z][a-zA-Z0-9]*)\s*=/g)) if (!REAL.has(n)) invented.add(n)
}

const errs = []
// Mirror the generator: a comparison post argues in prose, so its code floor is
// lower (blockFloor 2 / codeFloor 45 in tools/generate-blog-post.mjs).
const isComparison = meta.category === 'Comparisons'
const blockFloor = isComparison ? 2 : 3
const codeFloor = isComparison ? 45 : 90
if (words < 900) errs.push(`prose ${words} words, need >= 900`)
if (code.length < blockFloor) errs.push(`${code.length} code blocks, need >= ${blockFloor}`)
if (codeLines < codeFloor) errs.push(`${codeLines} code lines, need >= ${codeFloor}`)
if (!images.length) errs.push('no image')
for (const [, alt, srcPath] of images) {
  if (!/^\/(thumbs|blog-media|docs-media)\//.test(srcPath)) errs.push(`bad image path ${srcPath}`)
  if (!alt.trim() || /^(screenshot|image)\b/i.test(alt.trim())) errs.push('lazy alt text')
}
if (/[—–]/.test(raw)) errs.push('em/en dash')
// Against prose, not body: a `# comment` at column 0 inside a shell block is
// not a heading. Same fix applied in tools/generate-blog-post.mjs.
if (/^#\s/m.test(prose)) errs.push('H1 in body')
const lower = body.toLowerCase()
for (const p of BANNED) if (lower.includes(p)) errs.push(`banned phrase "${p}"`)
for (const [re, label] of [[/\bnot just\b[^.]{0,50}\b(it'?s|they'?re|but)\b/i, 'not-just reframe'],
  [/\bnot only\b[^.]{0,70}\bbut also\b/i, 'not-only reframe'],
  [/\bwhether you(?:'re| are)\b/i, 'whether-you hedge'],
  [/\b(seamless(ly)?|effortless(ly)?|blazing[- ]fast|robust|powerful)\b/i, 'booster adjective']]) {
  if (re.test(prose)) errs.push(`style tell: ${label}`)
}
if (invented.size) errs.push(`invented SvGrid props: ${[...invented]}`)
if (!meta.seoTitle) errs.push('no seoTitle')
else if (meta.seoTitle.length > 60) errs.push(`seoTitle ${meta.seoTitle.length} chars, max 60`)
if (!meta.seoDescription) errs.push('no seoDescription')
else if (meta.seoDescription.length > 155) errs.push(`seoDescription ${meta.seoDescription.length} chars, max 155`)
if (!prose.slice(0, 700).toLowerCase().includes(process.argv[3] ?? '')) errs.push('primary query missing from the opening')
if (!isComparison) {
  const named = parseList('RIVAL_VENDORS').filter((r) => r.test(body))
  if (named.length) errs.push(`names rivals outside Comparisons: ${named.length}`)
} else {
  // The inverse failure the generator guards: a comparison that names nobody.
  const named = [...parseList('RIVAL_VENDORS'), ...parseList('UI_KIT_ALTERNATIVES')]
    .filter((r) => r.test(body))
  if (named.length < 2) errs.push(`comparison names ${named.length} alternatives, need >= 2`)
}

console.log(`${slug}`)
console.log(`  ${words} words | ${code.length} blocks | ${codeLines} code lines | ${images.length} image`)
console.log(`  seoTitle ${meta.seoTitle?.length} | seoDescription ${meta.seoDescription?.length}`)
console.log(errs.length ? '  FAIL:\n    ' + errs.join('\n    ') : '  PASS - meets every check the generator enforces')
process.exitCode = errs.length ? 1 : 0
