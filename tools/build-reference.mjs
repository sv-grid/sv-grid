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
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'

// The barrel re-exports from ~208 modules; these are the ones whose public
// surface belongs in a typed reference. The rest are internal helpers that
// happen to be re-exported, or components already covered far better by the
// hand-written per-component tutorials under docs/help/ui-components.
//
// Adding a file here is deliberate work, not a free win: every symbol it
// exports must carry JSDoc or tools/reference-coverage.test.ts fails.
const SOURCES = [
  // `ai.ts` lives in the free grid, not enterprise - the AI assistant ships in
  // @svgrid/grid with a bring-your-own model adapter.
  { pkg: '@svgrid/grid', dir: 'packages/grid/src',
    files: [
      'core.ts', 'svgrid-wrapper.types.ts', 'ai.ts',
      // Models a consumer builds by hand, so their shapes are load-bearing.
      'scheduler-model.ts', 'dock-model.ts', 'dock-manager-model.ts',
      'chart.ts', 'createTree.svelte.ts',
      // Extension points: registering an editor or a filter engine, shaping
      // list options.
      'editor-contract.ts', 'editor-registry.ts', 'list-option.ts',
      'builtin-editors.ts', 'advanced-filter.svelte.ts',
      // Filtering vocabulary - the operators a consumer builds filters from.
      'filtering/filter-operator-catalogue.ts', 'filtering/row-predicate.ts',
      // Localization and cell display.
      'grid-messages.ts', 'cell-formatting.ts',
      // Utilities consumers call directly.
      'positioning.ts', 'toast-store.svelte.ts', 'spreadsheet.ts',
      'chart-export.ts', 'scheduler-ical.ts', 'duration.ts',
      'datetime/date-core.ts', 'datetime/timezone.ts',
      'datetime/mask.ts', 'datetime/date-format.ts', 'datetime/date-restrict.ts',
    ] },
  { pkg: '@svgrid/enterprise',       dir: 'packages/enterprise/src',
    files: ['export.ts', 'pivot.ts', 'import.ts', 'install.ts'] },
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
      // Capture the whole declaration, not just its first line.
      //
      // This used to stop as soon as brace depth hit 0, which is fine for an
      // interface but truncates everything that has no braces - every union
      // type alias came out as a dangling `export type ExportFormat =` with no
      // body, which was 20% of the generated reference. So the capture now also
      // follows a statement that is syntactically unfinished: brackets of any
      // kind still open, a line ending mid-expression, or a next line that
      // opens with a continuation token (`|`, `&`, `extends`, ...).
      const depthOf = (l) => {
        let d = 0
        for (const ch of l ?? '') {
          if (ch === '{' || ch === '(' || ch === '[') d += 1
          else if (ch === '}' || ch === ')' || ch === ']') d -= 1
        }
        return d
      }
      /** Line ends mid-expression, so the statement continues. */
      const endsOpen = (l) => /[=|&,(<+]\s*$/.test(l ?? '')
      /** Next line opens with a token that can only continue the previous one. */
      const startsCont = (l) => /^\s*([|&?:]|extends\b|implements\b)/.test(l ?? '')

      const sigLines = [lines[i]]
      let depth = depthOf(lines[i])
      i += 1
      while (i < lines.length) {
        const next = lines[i]
        const unfinished = depth > 0 || endsOpen(sigLines[sigLines.length - 1]) || startsCont(next)
        if (!unfinished) break
        // Never swallow the following symbol: once brackets are balanced, a new
        // JSDoc block or `export` starts the next declaration, not this one.
        if (depth <= 0 && (/^\s*\/\*\*/.test(next ?? '') || /^export\s/.test(next ?? ''))) break
        sigLines.push(next)
        depth += depthOf(next)
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
  const indexLines = [
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
      // A configured source that has moved must be loud. This used to `continue`
      // silently, so when ai.ts moved to the grid package the generator quietly
      // stopped emitting it and left the old page behind - a reference doc for a
      // module that no longer existed at that path, stale for as long as nobody
      // looked.
      let body
      try {
        body = await readFile(fullPath, 'utf-8')
      } catch {
        console.error(`build-reference: configured source not found: ${fullPath}`)
        process.exitCode = 1
        continue
      }
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
