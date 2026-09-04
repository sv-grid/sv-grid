/**
 * Gate for the /api reference: every documented member must have an example,
 * and that example must compose into a component that actually compiles.
 *
 * The /api page hands each member's snippet to `buildRunnableExample()`
 * (website/src/lib/api-playground.ts), which wraps it in a sandbox and opens
 * the result in the site playground. If the composition is broken, the user
 * clicks "Open in playground" and lands on a compile error - so this runs the
 * same composition here and compiles every result with the real Svelte + TS
 * compilers.
 *
 * What it does NOT prove: that a mounted example behaves. That is
 * tests/e2e/api-examples.spec.ts, which mounts each one in a browser.
 *
 *   node tools/check-api-examples.mjs            # report + non-zero on failure
 *   node tools/check-api-examples.mjs --write out/   # also dump the sources
 */
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const webRoot = join(root, 'website')

// `website/` is a private submodule. On a checkout without it there is nothing
// to check, and failing would just make the public repo unbuildable.
if (!existsSync(join(webRoot, 'src', 'lib', 'api-reference.ts'))) {
  console.log('API examples: website/ submodule not checked out - skipping')
  process.exit(0)
}

const require = createRequire(join(webRoot, 'package.json'))

/** @type {typeof import('typescript')} */
const ts = require('typescript')
// svelte/compiler ships as CJS from this workspace, so the ESM namespace hangs
// the API off `default`.
const svelteMod = await import(pathToFileURL(require.resolve('svelte/compiler')).href)
const svelte = svelteMod.preprocess ? svelteMod : svelteMod.default

const tmpDir = join(webRoot, 'node_modules', '.api-examples')
mkdirSync(tmpDir, { recursive: true })

/** Transpile a browser TS module and import it, with `import type` erased. */
async function importTs(relPath, name) {
  const src = readFileSync(join(webRoot, relPath), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: relPath,
  }).outputText
  const file = join(tmpDir, `${name}.mjs`)
  writeFileSync(file, out)
  return import(pathToFileURL(file).href + `?v=${Date.now()}`)
}

const { sections } = await importTs('src/lib/api-reference.ts', 'api-reference')
const { buildRunnableExample, NON_RUNNABLE_SECTIONS } = await importTs(
  'src/lib/api-playground.ts',
  'api-playground',
)

const writeArgIdx = process.argv.indexOf('--write')
const writeDir = writeArgIdx > -1 ? process.argv[writeArgIdx + 1] : null
if (writeDir) mkdirSync(writeDir, { recursive: true })

const missingExample = []
const missingRunnable = []
const compileFailures = []
let compiled = 0

for (const section of sections) {
  for (const prop of section.props ?? []) {
    const id = `${section.id} :: ${prop.name}`

    if (!prop.example && !prop.runnable) {
      missingExample.push(id)
      continue
    }

    const built = buildRunnableExample(section, prop)
    if (!built) {
      // Fine only when the section is deliberately not Svelte (MCP tools) and
      // the member points at an existing example instead.
      if (NON_RUNNABLE_SECTIONS.has(section.id)) {
        if (!prop.see?.demo && !prop.see?.docs) missingRunnable.push(`${id} (no runnable example and no \`see\` reference)`)
        continue
      }
      missingRunnable.push(id)
      continue
    }

    if (writeDir) {
      writeFileSync(join(writeDir, `${section.id}__${prop.name.replace(/\W+/g, '_')}.svelte`), built.source)
    }

    try {
      const preprocessed = await svelte.preprocess(
        built.source,
        {
          script: ({ content }) => ({
            code: ts.transpileModule(content, {
              compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
                isolatedModules: true,
                verbatimModuleSyntax: true,
              },
            }).outputText,
          }),
        },
        { filename: 'Example.svelte' },
      )
      svelte.compile(preprocessed.code, {
        generate: 'client',
        dev: false,
        css: 'external',
        filename: 'Example.svelte',
      })
      compiled++
    } catch (err) {
      compileFailures.push({ id, mode: built.mode, message: String(err?.message ?? err) })
    }
  }
}

rmSync(tmpDir, { recursive: true, force: true })

const total = compiled + compileFailures.length
console.log(`API examples: ${total} members composed, ${compiled} compile clean`)

let failed = false
if (missingExample.length) {
  failed = true
  console.log(`\nFAIL  ${missingExample.length} member(s) with no example:`)
  for (const id of missingExample) console.log(`  - ${id}`)
}
if (missingRunnable.length) {
  failed = true
  console.log(`\nFAIL  ${missingRunnable.length} member(s) with no runnable example:`)
  for (const id of missingRunnable) console.log(`  - ${id}`)
}
if (compileFailures.length) {
  failed = true
  console.log(`\nFAIL  ${compileFailures.length} member(s) whose example does not compile:`)
  for (const f of compileFailures) console.log(`  - [${f.mode}] ${f.id}\n      ${f.message.split('\n')[0]}`)
}

if (failed) process.exit(1)
console.log('ok - every API member has an example that composes and compiles')
