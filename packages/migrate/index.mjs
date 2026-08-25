#!/usr/bin/env node
/**
 * npx @svgrid/migrate [paths...]
 *
 * Ports svelte-headless-table components to SvGrid. Prints the proposed result
 * by default and only touches disk with --write, because a codemod that
 * silently rewrites a file it half-understood is worse than no codemod.
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { migrate, SOURCE_PACKAGES } from './transform.mjs'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('-')))
const inputs = args.filter((a) => !a.startsWith('-'))
const WRITE = flags.has('--write') || flags.has('-w')

if (flags.has('--help') || flags.has('-h')) {
  console.log(`
  @svgrid/migrate - port svelte-headless-table components to SvGrid

  Usage
    npx @svgrid/migrate [paths...]          preview the migration (default)
    npx @svgrid/migrate src --write         apply it in place

  Options
    -w, --write     rewrite the files instead of printing the result
    -h, --help      show this

  Defaults to scanning ./src. Only .svelte files that import
  ${SOURCE_PACKAGES.map((p) => '`' + p + '`').join(' or ')} are touched.

  The transform translates column definitions and plugin config, and deletes
  the <Subscribe>/<Render> scaffolding that SvGrid's renderer replaces. Custom
  cell renderers are preserved as TODO comments, never dropped silently.
`)
  process.exit(0)
}

// Colour only when stdout is a TTY, so redirected output stays clean.
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const esc = (code) => (useColor ? String.fromCharCode(27) + '[' + code + 'm' : '')
const RED = esc(31)
const YELLOW = esc(33)
const GREEN = esc(32)
const DIM = esc(2)
const BOLD = esc(1)
const OFF = esc(0)

function collect(target, out = []) {
  let st
  try {
    st = statSync(target)
  } catch {
    console.error(`${RED}Not found:${OFF} ${target}`)
    process.exitCode = 1
    return out
  }
  if (st.isFile()) {
    if (extname(target) === '.svelte') out.push(target)
    return out
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    collect(join(target, entry.name), out)
  }
  return out
}

const roots = inputs.length ? inputs : ['src']
const files = roots.flatMap((r) => collect(r))

if (!files.length) {
  console.log(`No .svelte files found under ${roots.join(', ')}.`)
  // Leave process.exitCode alone: collect() sets it to 1 for a path that does
  // not exist, and a typo'd path must not look like a clean run to a script.
  process.exit(process.exitCode ?? 0)
}

let migrated = 0
let totalWarnings = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (!SOURCE_PACKAGES.some((p) => source.includes(p))) continue

  const result = migrate(source)
  const rel = relative(process.cwd(), file) || file

  if (!result.applicable) {
    console.log(`${DIM}skip${OFF} ${rel}`)
    for (const w of result.warnings) console.log(`     ${YELLOW}!${OFF} ${w}`)
    continue
  }

  migrated++
  totalWarnings += result.warnings.length

  if (WRITE) {
    writeFileSync(file, result.code)
    console.log(`${GREEN}migrated${OFF} ${rel}`)
  } else {
    console.log(`\n${BOLD}--- ${rel} ---${OFF}`)
    console.log(result.code)
  }

  for (const w of result.warnings) console.log(`  ${YELLOW}warning${OFF} ${w}`)
  for (const n of result.notes) console.log(`  ${DIM}note    ${n}${OFF}`)
}

console.log('')
if (!migrated) {
  console.log('Nothing to migrate: no file imported the source library.')
} else if (WRITE) {
  console.log(`${GREEN}Rewrote ${migrated} file(s).${OFF} ${totalWarnings} warning(s) to review.`)
  console.log(`${DIM}Run your type-checker and tests - the markup is regenerated, not edited.${OFF}`)
} else {
  console.log(`${migrated} file(s) would change, with ${totalWarnings} warning(s).`)
  console.log(`Re-run with ${BOLD}--write${OFF} to apply.`)
}
