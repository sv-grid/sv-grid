/**
 * Generate the standalone theme-preset stylesheets under `themes/` from the
 * canonical data in `src/themes/index.ts` (built to `dist/themes/index.js` by
 * the `svelte-package` step that runs before this script). One `<id>.css` per
 * preset - a plain `--sg-*` token block, so a consumer can just:
 *
 *   @import '@svgrid/grid/themes/material.css';
 *
 * Re-uses the already-documented `[data-theme='dark']` convention
 * (docs/help/tokens.md) - no new theming mechanism invented.
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'themes')

const { themePresets, resolveThemeTokens } = await import(pathToFileURL(join(root, 'dist/themes/index.js')).href)

mkdirSync(outDir, { recursive: true })
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.css')) unlinkSync(join(outDir, file))
}

function block(selector, tokens) {
  const lines = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')
  return `${selector} {\n${lines}\n}`
}

for (const preset of themePresets) {
  const light = resolveThemeTokens(preset, 'light')
  const dark = resolveThemeTokens(preset, 'dark')
  const css = `/* ${preset.name} - generated from packages/grid/src/themes/index.ts. Do not edit by hand. */\n${block(':root', light)}\n${block(":root[data-theme='dark']", dark)}\n`
  writeFileSync(join(outDir, `${preset.id}.css`), css)
}

console.log(`build-themes: ${themePresets.length} preset stylesheets -> themes/`)
