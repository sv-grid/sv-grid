#!/usr/bin/env node
/**
 * Generate /docs/reference/auto/*.md from JSDoc + TypeScript types in
 * the published package sources. The output is committed to the repo
 * so the docs site stays buildable without a TypeScript runtime, and
 * a CI check fails if the regeneration diverges from the committed
 * version (catches "code changed but docs forgot to rebuild").
 *
 * Run from the repo root: `node tools/build-reference.mjs`.
 *
 * What we extract:
 *   - Every exported type alias / interface / function
 *   - Each member's JSDoc comment (cleaned + dedented)
 *   - The TypeScript signature as-written
 *
 * What we DON'T extract:
 *   - Internal symbols (marked @internal or in /internal/ paths)
 *   - Default values (use the hand-written /reference/SvGrid.md tables for those)
 *   - Generic constraints beyond the first level
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'

const SOURCES = [
  { pkg: '@svgrid/grid', dir: 'packages/grid/src',
    files: ['core.ts', 'svgrid-wrapper.types.ts'] },
  { pkg: '@svgrid/enterprise',       dir: 'packages/enterprise/src',
    files: ['export.ts', 'pivot.ts', 'import.ts', 'ai.ts', 'install.ts'] },
]
const OUT_DIR = 'docs/reference/auto'

/**
 * Very small JSDoc-aware extractor. Walks the file line by line,
 * collects /** ... *\/ blocks, then attaches them to the following
 * `export <kind> <name>` line.
 *
 * No real TypeScript parser; we're aiming for "good enough" for
 * docs surface, not a full compiler. Skip @internal blocks entirely.
 */
function extract(src) {
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1)
  const lines = src.split(/\r?\n/)
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Capture a JSDoc block if we see one
    let doc = ''
    if (/^\s*\/\*\*/.test(line)) {
      const block = []
      while (i < lines.length && !/\*\//.test(lines[i])) { block.push(lines[i]); i += 1 }
      block.push(lines[i] ?? '')
      i += 1
      doc = block
        .map((l) => l.replace(/^\s*\/\*\*?/, '').replace(/^\s*\*\/?/, '').replace(/^\s/, ''))
        .join('\n').trim()
    }
    // Skip @internal-tagged blocks
    if (/^@internal\b/m.test(doc)) {
      // skip non-blank declaration line then continue
      while (i < lines.length && /^\s*$/.test(lines[i])) i += 1
      i += 1
      continue
    }
    const declMatch = /^export\s+(type|interface|function|class|const)\s+([A-Za-z_]\w*)/.exec(lines[i] ?? '')
    if (declMatch) {
      const kind = declMatch[1]
      const name = declMatch[2]
      // Capture the declaration block (single line for type aliases;
      // braces-balanced for interfaces / classes).
      const sigLines = [lines[i]]
      let depth = 0
      for (const ch of lines[i] ?? '') { if (ch === '{') depth += 1; else if (ch === '}') depth -= 1 }
      i += 1
      while (i < lines.length && depth > 0) {
        sigLines.push(lines[i])
        for (const ch of lines[i] ?? '') { if (ch === '{') depth += 1; else if (ch === '}') depth -= 1 }
        i += 1
      }
      out.push({ kind, name, doc, signature: sigLines.join('\n').trim() })
      continue
    }
    i += 1
  }
  return out
}

function md(name, sym) {
  return [
    `### \`${sym.kind} ${sym.name}\``,
    '',
    sym.doc ? sym.doc : '_No JSDoc yet._',
    '',
    '```ts',
    sym.signature,
    '```',
    '',
  ].join('\n')
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  let indexLines = [
    '# Auto-generated reference',
    '',
    '_Generated from the published TypeScript sources. Do not edit by hand - rerun `node tools/build-reference.mjs`._',
    '',
    'For the hand-curated reference (with defaults + behaviour tables),',
    'see [the main reference index](../index.md).',
    '',
  ]
  for (const src of SOURCES) {
    // Scoped names like "@svgrid/grid" can't be filenames (the "/" and "@").
    // Use a filesystem-safe slug for the .md files + links; keep src.pkg for labels.
    const pkgSlug = src.pkg.replace('@', '').replace('/', '-')
    indexLines.push(`## ${src.pkg}`, '')
    for (const f of src.files) {
      const fullPath = join(src.dir, f)
      let body
      try { body = await readFile(fullPath, 'utf-8') }
      catch { continue }
      const symbols = extract(body)
      if (symbols.length === 0) continue
      const slug = basename(f, '.ts')
      const out = [
        `# \`${src.pkg}\` · \`${f}\``,
        '',
        `Auto-generated. Source: \`${fullPath}\`.`,
        '',
        ...symbols.map((s) => md(s.name, s)),
      ].join('\n')
      const outPath = join(OUT_DIR, `${pkgSlug}-${slug}.md`)
      await writeFile(outPath, out, 'utf-8')
      indexLines.push(
        `- [\`${src.pkg}/${f}\`](./${pkgSlug}-${slug}.md) - ${symbols.length} exports`,
      )
    }
    indexLines.push('')
  }
  await writeFile(join(OUT_DIR, 'index.md'), indexLines.join('\n'), 'utf-8')
  process.stdout.write(`build-reference: regenerated docs/reference/auto/\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
