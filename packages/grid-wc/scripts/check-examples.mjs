/**
 * Compile every framework example, and check the Vue ones by hand.
 *
 * The examples are what the docs ship as "open this and it runs", so a broken
 * one is worse than a missing one. Each framework is checked with its own
 * compiler:
 *
 *   React   tsc              - a wrong prop is a type error on the component.
 *   Vue     vue-tsc          - checks the script block.
 *   Angular ngc              - with `strictTemplates`, so a wrong binding in a
 *                              template is NG8002 rather than a runtime no-op.
 *
 * Vue needs the extra pass below. In Vue an unknown attribute is legal - it
 * falls through to the root element - so `<SvGrid sortabel />` type-checks
 * cleanly and silently does nothing. Verified: misspelling a prop fails the
 * React and Angular checks and passes the Vue one. So the Vue templates are
 * additionally checked against the generated surface.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ELEMENT_PROPS, ELEMENT_EVENTS, LEGACY_EVENTS } from '../src/surface.generated.js'

const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')
const repo = join(cwd, '..', '..')
// pnpm links a binary into the package that declared the dependency, and
// hoists shared ones to the root - so look in both rather than guessing.
const bin = (name) => {
  const local = join(cwd, 'node_modules', '.bin', name)
  return existsSync(local) || existsSync(`${local}.CMD`) ? local : join(repo, 'node_modules', '.bin', name)
}

function run(label, cmd, args) {
  // `shell` only for the pnpm bin shims, which on Windows are .CMD files that
  // cannot be spawned directly. NOT for node: its path is
  // `C:\Program Files\nodejs\node.exe`, and a shell splits that on the space.
  const isNode = cmd === process.execPath
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: !isNode && process.platform === 'win32',
  })
  if (r.status !== 0) {
    console.error(`check-examples: ${label} failed`)
    process.exit(r.status ?? 1)
  }
  console.log(`check-examples: ${label} ok`)
}

run('react (tsc)', bin('tsc'), ['-p', 'tsconfig.examples.json'])
run('vue (vue-tsc)', bin('vue-tsc'), ['-p', 'tsconfig.examples.json', '--noEmit'])
run('angular (ngc, strictTemplates)', bin('ngc'), [
  '-p',
  'tsconfig.examples.angular.json',
])

// The docs listings are generated FROM these files, so an edit here that is
// not synced leaves the pages describing the previous version.
run('docs listings are current', process.execPath, [join(here, 'sync-example-docs.mjs'), '--check'])

// ---------------------------------------------------------------------------
// The Vue gap: unknown attributes are legal, so check them ourselves.
// ---------------------------------------------------------------------------
const props = new Set(ELEMENT_PROPS.map((p) => p.name))
const attrs = new Set(ELEMENT_PROPS.map((p) => p.attribute).filter(Boolean))
const events = new Set([
  ...ELEMENT_EVENTS.map((e) => e.event),
  ...LEGACY_EVENTS.map((l) => l.event),
])

const vueDir = join(cwd, 'examples', 'vue')
const problems = []

for (const entry of readdirSync(vueDir)) {
  const dir = join(vueDir, entry)
  if (!statSync(dir).isDirectory()) continue
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.vue'))) {
    const src = readFileSync(join(dir, file), 'utf8')
    // Every <SvGrid ...> opening tag, attributes included.
    for (const tag of src.matchAll(/<SvGrid\b([\s\S]*?)\/?>/g)) {
      // Blank out attribute VALUES first. Bare boolean attributes have no `=`,
      // so the scan below cannot require one - and without this, words inside a
      // quoted value would be read as attribute names. Requiring `=` was the
      // first attempt and it missed `<SvGrid sortabel />` entirely, which is
      // the exact case this check exists for.
      const withoutValues = tag[1].replace(/=\s*"[^"]*"|=\s*'[^']*'/g, '=""')
      for (const attr of withoutValues.matchAll(
        /(?:^|\s)(:|@|v-bind:|v-on:)?([a-zA-Z][\w-]*)(?=[\s=/>]|$)/g,
      )) {
        const kind = attr[1] ?? ''
        const name = attr[2]
        if (name === 'key' || name === 'ref' || name === 'style' || name === 'class') continue
        const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const ok =
          kind === '@' || kind === 'v-on:'
            ? events.has(name.toLowerCase())
            : props.has(camel) || attrs.has(name)
        if (!ok) problems.push(`${entry}/${file}: ${kind}${name}`)
      }
    }
  }
}

if (problems.length) {
  console.error(
    'check-examples: Vue examples use props or events that do not exist on the grid:\n  ' +
      problems.join('\n  ') +
      '\n\nVue accepts unknown attributes as fallthrough, so these fail silently at runtime.',
  )
  process.exit(1)
}
console.log(`check-examples: vue template props ok`)
