/**
 * Build the SvGrid Figma kit plugin into tools/figma/dist/.
 *
 *   node tools/figma/build.mjs                      # Ember + shadcn, light + dark
 *   node tools/figma/build.mjs --themes=ember,material
 *   node tools/figma/build.mjs --themes=all
 *
 * Token values are not typed anywhere in the plugin. They come from
 * resolveThemeTokens() in packages/grid/src/themes/index.ts, the same function
 * that writes packages/grid/themes/*.css, so a Figma variable and the CSS
 * custom property it names always hold the same value. Tokens a preset leaves
 * unset are filled with the fallback the grid's own CSS uses (see tokens.mjs).
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'
import { build } from 'esbuild'
import { TOKEN_GROUPS, NUMBER_TOKENS, DENSITY, deriveTokens } from './tokens.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const outDir = join(here, 'dist')

const { themePresets, resolveThemeTokens } = await import(
  pathToFileURL(join(repo, 'packages/grid/src/themes/index.ts')).href
)

const arg = process.argv.find((a) => a.startsWith('--themes='))?.slice('--themes='.length)
const themeIds = !arg ? ['ember', 'shadcn'] : arg === 'all' ? themePresets.map((p) => p.id) : arg.split(',')

const presets = themeIds.map((id) => {
  const p = themePresets.find((t) => t.id === id)
  if (!p) throw new Error(`Unknown theme "${id}". Known: ${themePresets.map((t) => t.id).join(', ')}`)
  return p
})

/** One Figma variable mode per (preset, light/dark). */
const modes = presets.flatMap((p) =>
  ['light', 'dark'].map((m) => ({
    id: `${p.id}-${m}`,
    name: `${p.name} ${m === 'light' ? 'Light' : 'Dark'}`,
    tokens: deriveTokens(resolveThemeTokens(p, m)),
  })),
)

function collect(defs) {
  return defs.map((d) => ({
    ...d,
    values: Object.fromEntries(
      modes.map((m) => {
        const v = m.tokens[d.token]
        if (v === undefined) throw new Error(`${m.id}: no value for ${d.token}`)
        return [m.id, v]
      }),
    ),
  }))
}

export function kitPayload() {
  return {
    modes: modes.map(({ id, name }) => ({ id, name })),
    colors: collect(TOKEN_GROUPS),
    numbers: collect(NUMBER_TOKENS).map((d) => ({
      ...d,
      values: Object.fromEntries(Object.entries(d.values).map(([k, v]) => [k, parseFloat(v)])),
    })),
    density: DENSITY,
    builtFrom: themeIds,
    commit: execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim(),
    builtAt: new Date().toISOString().slice(0, 10),
    gridVersion: JSON.parse(readFileSync(join(repo, 'packages/grid/package.json'), 'utf8')).version,
  }
}

export async function bundle({ write = true } = {}) {
  const result = await build({
    entryPoints: [join(here, 'src/main.ts')],
    bundle: true,
    format: 'iife',
    // The plugin sandbox runs an older JS engine; lower ?. ?? and object spread.
    target: 'es2017',
    write: false,
    define: { __SG_KIT__: JSON.stringify(kitPayload()) },
    logLevel: 'warning',
  })
  const code = result.outputFiles[0].text
  if (write) {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'code.js'), code)
    // Written, not copied: a Windows copy keeps the source's old timestamp, which
    // made a fresh build look stale.
    writeFileSync(join(outDir, 'manifest.json'), readFileSync(join(here, 'manifest.json')))
  }
  return code
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = await bundle()
  console.log(
    `figma kit: ${modes.length} modes (${modes.map((m) => m.name).join(', ')}), ` +
      `${(code.length / 1024).toFixed(0)} KB -> tools/figma/dist/`,
  )
}
