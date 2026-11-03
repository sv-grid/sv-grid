/**
 * Minify a built package `dist/` so the published tarball ships dense,
 * comment-free code instead of readable source. This is the last dist step
 * before publish, after svelte-package, strip-dist-tests, add-dist-extensions
 * and the cdn/node/wc builds.
 *
 * svelte-package copies src/ through almost verbatim: readable JS plus .svelte
 * components with their TS, JSDoc and indentation intact. A paid pack should
 * not hand its source out that way. What each file can take depends on who
 * compiles it:
 *
 *   - Plain `.js` / `.mjs` modules are fully minified: local names mangled,
 *     comments and whitespace gone. They are already their final form (Node /
 *     a bundler runs them as-is), and ESM import/export names are preserved, so
 *     every subpath entry still resolves.
 *   - `.svelte.js` / `.svelte.ts` rune modules keep their identifiers. The
 *     Svelte compiler and the signal graph key off names, and transform-mode
 *     tree-shaking is left off so no reactive declaration is dropped. Comments
 *     and whitespace still go.
 *   - `.svelte` components: only the <script> and <style> blocks are minified.
 *     Scripts keep their identifiers (the template references script locals by
 *     name) and have their TS stripped; styles are minified as CSS. The markup
 *     between them is left byte-for-byte because text whitespace is significant
 *     in Svelte; its HTML comments are the one thing removed.
 *   - `.css` files are minified. `.d.ts` are left alone - they are the public
 *     API contract and consumers read them for types.
 *
 * Usage: node tools/minify-dist.mjs [distDir=./dist]
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transform } from 'esbuild'

const SCRIPT_JS = {
  // Instance/module scripts: strip types and comments, pack the whitespace, but
  // never rename - the template binds to these names, and a dropped reactive
  // declaration would silently stop updating. Syntax minification stays OFF:
  // it folds adjacent statements into a comma sequence, which turns a bare
  // `$effect(...)` / `$derived(...)` into an expression Svelte rejects
  // (effect_invalid_placement).
  loader: 'ts',
  // Keep every value import as written. The TS loader otherwise drops an
  // import the script itself never reads, and a component the template uses
  // (<BaseTabs>, <RecordView>) is exactly that: enterprise 3.1.35 shipped
  // SvBase.svelte with none of its child components imported ("BaseTabs is
  // not defined"). `import type` still goes.
  tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
  minifyWhitespace: true,
  minifySyntax: false,
  minifyIdentifiers: false,
  treeShaking: false,
  legalComments: 'none',
  charset: 'utf8',
  target: 'esnext',
}

const RUNE_MODULE = { ...SCRIPT_JS, loader: 'js' }

const PLAIN_JS = {
  // Final-form modules: safe to mangle locals; esbuild keeps ESM binding names.
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  target: 'esnext',
}

const CSS = { loader: 'css', minify: true, legalComments: 'none', charset: 'utf8' }

const HTML_COMMENT = /<!--[\s\S]*?-->/g
const BLOCK = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi

/** Minify one <script>/<style> inner body; return the original on any failure. */
async function minifyBlock(tag, body) {
  const trimmed = body.trim()
  if (!trimmed) return body
  try {
    const opts = tag.toLowerCase() === 'style' ? CSS : SCRIPT_JS
    const { code } = await transform(trimmed, opts)
    return '\n' + code.trimEnd() + '\n'
  } catch {
    return body
  }
}

/** The components a .svelte file imports (`import Name from './Name.svelte'`). */
export function componentImports(code) {
  return [...code.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]+\.svelte['"]/g)].map((m) => m[1])
}

/** Minify a `.svelte` file: its script/style blocks, and template comments. */
export async function minifySvelte(source) {
  const blocks = []
  // Pull every script/style out behind a placeholder so the HTML-comment strip
  // cannot reach into code (a `<!--` can sit inside a JS/CSS string).
  const shell = source.replace(BLOCK, (_m, tag, attrs, body) => {
    const token = `\0B${blocks.length}\0`
    blocks.push({ tag, attrs, body })
    return token
  })
  const stripped = shell.replace(HTML_COMMENT, '')
  let out = stripped
  for (let i = 0; i < blocks.length; i++) {
    const { tag, attrs, body } = blocks[i]
    const inner = await minifyBlock(tag, body)
    out = out.replace(`\0B${i}\0`, `<${tag}${attrs}>${inner}</${tag}>`)
  }
  // A component the template uses must still be imported: the script cannot
  // see the template, so a minifier that drops "unused" imports breaks it.
  const kept = new Set(componentImports(out))
  const lost = componentImports(source).filter((n) => !kept.has(n))
  if (lost.length) throw new Error(`dropped component import(s): ${lost.join(', ')}`)
  return out
}

/** Minify a standalone JS/CSS file; return null to leave it unchanged. */
export async function minifyFile(name, source) {
  if (name.endsWith('.svelte')) return minifySvelte(source)
  if (name.endsWith('.svelte.js') || name.endsWith('.svelte.ts')) {
    const { code } = await transform(source, RUNE_MODULE)
    return code
  }
  if (name.endsWith('.js') || name.endsWith('.mjs')) {
    const { code } = await transform(source, PLAIN_JS)
    return code
  }
  if (name.endsWith('.css')) {
    const { code } = await transform(source, CSS)
    return code
  }
  return null
}

function files(dir) {
  const out = []
  const walk = (d) => {
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(full)
      } else if (!e.name.endsWith('.d.ts')) {
        out.push(full)
      }
    }
  }
  walk(dir)
  return out
}

// Run as a script; tools/minify-dist.test.ts imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2] || './dist')

async function main(dist) {
  let touched = 0
  let before = 0
  let after = 0
  for (const file of files(dist)) {
    const source = readFileSync(file, 'utf8')
    let next
    try {
      next = await minifyFile(file.replace(/\\/g, '/'), source)
    } catch (err) {
      console.error(`minify-dist: ${file}: ${err.message}`)
      process.exitCode = 1
      continue
    }
    if (next == null || next === source) continue
    before += Buffer.byteLength(source)
    after += Buffer.byteLength(next)
    writeFileSync(file, next)
    touched += 1
  }

  const kb = (n) => Math.round(n / 1024) + 'KB'
  console.log(
    `minify-dist: minified ${touched} file(s) in ${dist} (${kb(before)} -> ${kb(after)})`,
  )
}
