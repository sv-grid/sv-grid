/**
 * Upgrade a Svelte 4 svelte-headless-table app to Svelte 5, one step at a
 * time, and capture every diagnostic verbatim.
 *
 *   node tools/migration-lab/run.mjs          # ~3 minutes, needs the npm registry
 *
 * The guide docs/help/svelte-5-upgrade-data-tables.md quotes the files this
 * writes into captured/. Nothing in that guide's code blocks is typed by hand,
 * and tools/migration-lab.test.ts fails when the quoted blocks and the
 * captured files disagree.
 *
 * Steps (one capture each):
 *
 *   01  Svelte 4 baseline: install the pinned versions, run svelte-check.
 *   02  `npm install svelte@5`: the peer-dependency conflict, as npm prints it.
 *   03  Svelte 5 installed over the conflict, the component untouched: the
 *       legacy-mode component still type-checks, or does not.
 *   04  The component ported to runes by the rules in the official migration
 *       guide (fixture/runes), the table wiring untouched: what is left.
 *   05  The codemod from packages/migrate (what `npx @svgrid/migrate` ships): the preview, then the write.
 *   06  After the codemod: svelte-check on the result, with what it names.
 *   07  The two hand edits those warnings ask for, then the same check.
 *
 * `src/` is a working copy the script creates from fixture/ and leaves in its
 * final state; package.json is restored to the Svelte 4 pins at the end so
 * the next run starts from the same place. Both `src/` and node_modules are
 * gitignored; captured/ is not.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LAB = dirname(fileURLToPath(import.meta.url))
const SRC = join(LAB, 'src')
const CAPTURED = join(LAB, 'captured')
const PKG = join(LAB, 'package.json')

const SVELTE5 = '5.57.1'
// The codemod from this checkout, not the registry: the lab is what proves a
// change to it before it is published, and the header records its version.
const MIGRATE_CLI = join(LAB, '..', '..', 'packages', 'migrate', 'index.mjs')
const MIGRATE = JSON.parse(readFileSync(join(LAB, '..', '..', 'packages', 'migrate', 'package.json'), 'utf8')).version
const GRID = '3.0.4'

const originalPkg = readFileSync(PKG, 'utf8')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

/** Run a command in the lab and return everything it printed, exit code included. */
function run(cmd, args, { allowFail = true } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: LAB,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', npm_config_color: 'false', npm_config_fund: 'false', npm_config_audit: 'false', npm_config_update_notifier: 'false' },
    maxBuffer: 64 * 1024 * 1024,
  })
  const out = `$ ${[cmd.replace(/\.cmd$/, ''), ...args].join(' ')}\n${(r.stdout ?? '') + (r.stderr ?? '')}\n(exit ${r.status})\n`
  if (!allowFail && r.status !== 0) {
    console.error(out)
    throw new Error(`${cmd} ${args.join(' ')} failed`)
  }
  return { out, status: r.status ?? -1 }
}

/**
 * Strip what differs between two honest runs: colour codes, the absolute lab
 * path, npm's per-run log file name, and the machine-specific bits of a
 * "Loading svelte-check in workspace" line.
 */
function sanitize(text) {
  return text
    // eslint-disable-next-line no-control-regex -- the ANSI escape is the thing being stripped
    .replace(/\u001b\[[0-9;]*m/g, '')
    // svelte-check prints the drive letter in lower case; the path here has it
    // in upper case. Both spellings, both slash styles.
    .replace(new RegExp(LAB.split(/[\\/]/).map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\\\/]'), 'gi'), '<lab>')
    .replace(/^npm (?:error|ERR!) A complete log of this run can be found in:.*$\n?/gm, '')
    .replace(/^npm (?:error|ERR!)\s+C:\\Users\\.*\.log\s*$\n?/gm, '')
    // "added 32 packages in 3s": the count is a fact, the seconds are not.
    .replace(/ in \d+(?:\.\d+)?(?:ms|s)\b/g, ' in <time>')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
}

function versions() {
  const read = (name) => {
    try {
      return JSON.parse(readFileSync(join(LAB, 'node_modules', name, 'package.json'), 'utf8')).version
    } catch {
      return 'not installed'
    }
  }
  return {
    node: process.version,
    npm: run(npm, ['--version']).out.split('\n')[1]?.trim(),
    svelte: read('svelte'),
    'svelte-check': read('svelte-check'),
    typescript: read('typescript'),
    'svelte-headless-table': read('svelte-headless-table'),
    '@svgrid/grid': read('@svgrid/grid'),
  }
}

function header(step, title) {
  const v = versions()
  const lines = [
    `# ${step} ${title}`,
    `# captured ${new Date().toISOString().slice(0, 10)} by tools/migration-lab/run.mjs on ${process.platform} ${process.arch}`,
    `# node ${v.node}, npm ${v.npm}, svelte ${v.svelte}, svelte-check ${v['svelte-check']}, typescript ${v.typescript}, svelte-headless-table ${v['svelte-headless-table']}, @svgrid/grid ${v['@svgrid/grid']}`,
    '',
  ]
  return lines.join('\n')
}

function capture(file, step, title, body) {
  mkdirSync(CAPTURED, { recursive: true })
  writeFileSync(join(CAPTURED, file), header(step, title) + sanitize(body))
  console.log(`wrote captured/${file}`)
}

function resetSrc(fixture) {
  rmSync(SRC, { recursive: true, force: true })
  cpSync(join(LAB, 'fixture', fixture), SRC, { recursive: true })
}

function check() {
  return run(npx, ['svelte-check', '--tsconfig', './tsconfig.json', '--output', 'human', '--threshold', 'warning']).out
}

try {
  // 01 Svelte 4 baseline.
  rmSync(join(LAB, 'node_modules'), { recursive: true, force: true })
  rmSync(join(LAB, 'package-lock.json'), { force: true })
  writeFileSync(PKG, originalPkg)
  resetSrc('svelte4')
  const install4 = run(npm, ['install'], { allowFail: false })
  capture('01-svelte4-baseline.txt', '01', 'Svelte 4 baseline: install the pinned versions, then svelte-check', install4.out + '\n' + check())

  // 02 The upgrade command, as a reader types it.
  const upgrade = run(npm, ['install', `svelte@${SVELTE5}`])
  capture('02-npm-install-svelte5.txt', '02', `npm install svelte@${SVELTE5} with svelte-headless-table in package.json`, upgrade.out)

  // 03 Force it through and check the untouched component.
  const forced = run(npm, ['install', `svelte@${SVELTE5}`, '--legacy-peer-deps'], { allowFail: false })
  capture('03-svelte5-legacy-component.txt', '03', 'Svelte 5 installed with --legacy-peer-deps; the Svelte 4 component untouched', forced.out + '\n' + check())

  // 04 Port the component to runes by the migration guide's rules; keep the table wiring.
  resetSrc('runes')
  capture('04-svelte5-runes-component.txt', '04', 'The component ported to runes (fixture/runes); the svelte-headless-table wiring untouched', check())

  // 05 The codemod, preview then write, on the Svelte 4 original.
  resetSrc('svelte4')
  const preview = run('node', [MIGRATE_CLI, 'src'])
  const write = run('node', [MIGRATE_CLI, 'src', '--write'])
  capture(
    '05-codemod.txt',
    '05',
    `@svgrid/migrate ${MIGRATE}, run from packages/migrate in this checkout (published as npx @svgrid/migrate): preview, then --write`,
    (preview.out + '\n' + write.out).replaceAll(MIGRATE_CLI, 'packages/migrate/index.mjs'),
  )

  // 06 Type-check the result on Svelte 5 with the grid installed and the old table gone.
  const swap = run(npm, ['install', `@svgrid/grid@${GRID}`, '--legacy-peer-deps'], { allowFail: false })
  const drop = run(npm, ['uninstall', 'svelte-headless-table', '--legacy-peer-deps'])
  capture('06-after-codemod.txt', '06', 'After the codemod: @svgrid/grid installed, svelte-headless-table removed, svelte-check', swap.out + '\n' + drop.out + '\n' + check())

  // 07 The two hand edits the codemod's warnings ask for: drop the pager the
  // grid now draws itself, and carry the row click as a callback prop wired
  // to onRowClick. Then the same check.
  const table = join(SRC, 'PeopleTable.svelte')
  const app = join(SRC, 'App.svelte')
  let edited = readFileSync(table, 'utf8').replace(/\r\n/g, '\n')
  edited = edited.replace(/\n<p>[\s\S]*?<\/p>\n/, '\n')
  edited = edited.replace(
    '  export let pageSize = 5\n',
    '  export let pageSize = 5\n  export let onselect: (person: Person) => void = () => {}\n',
  )
  edited = edited.replace(
    'pageable pageSize={pageSize} />',
    'pageable pageSize={pageSize}\n  onRowClick={({ row }) => onselect(row)} />',
  )
  writeFileSync(table, edited)
  writeFileSync(
    app,
    readFileSync(app, 'utf8').replace(/\r\n/g, '\n').replace('on:select={(e) => (selected = e.detail)}', 'onselect={(p) => (selected = p)}'),
  )
  capture('07-hand-edits.txt', '07', 'After the two hand edits the warnings named (pager removed, row click as a prop on onRowClick): svelte-check', check())

  // The rewritten component, for the guide's before/after.
  writeFileSync(join(CAPTURED, 'PeopleTable.after.svelte'), readFileSync(table, 'utf8').replace(/\r\n/g, '\n'))
  console.log('wrote captured/PeopleTable.after.svelte')
} finally {
  writeFileSync(PKG, originalPkg)
}
