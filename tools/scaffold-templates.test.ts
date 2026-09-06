/**
 * Guards `@svgrid/create` scaffolding: every registered template has to come out
 * of the CLI runnable, and `--theme` has to reach every place a theme is
 * recorded. The theme choice lives in three places now (the stylesheet, the HTML
 * shell's `data-theme`, and - where there is a runtime picker - a TS constant),
 * and a mismatch between any two of them shows up as a colour flash or a picker
 * that disagrees with what is on screen.
 *
 * This only scaffolds. It does not install or build - that costs a minute per
 * template and belongs in a manual pass, not in the docs-guardrail job.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const cli = join(repoRoot, 'packages', 'create-sv-grid', 'index.mjs')

const workDirs: string[] = []
afterAll(() => {
  for (const dir of workDirs) rmSync(dir, { recursive: true, force: true })
})

function scaffold(template: string, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'svgrid-scaffold-'))
  workDirs.push(dir)
  execFileSync(process.execPath, [cli, 'app', '--template', template, ...args], {
    cwd: dir,
    stdio: 'pipe',
  })
  return join(dir, 'app')
}

/** The `<html>` shell, wherever this template keeps it. */
function shellOf(app: string) {
  for (const candidate of [join(app, 'src', 'app.html'), join(app, 'index.html')]) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
  }
  throw new Error('no HTML shell found in ' + app)
}

// Keep in step with TEMPLATES in packages/create-sv-grid/index.mjs.
const templates = ['minimal', 'sveltekit', 'pivot-dashboard', 'admin-dashboard', 'headless']
// The subset that renders <SvGrid> and therefore has a --sg-* palette to write
// a theme into. `headless` ships the engine and no CSS, so it is deliberately
// never asked and never told which preset to use.
const themedTemplates = ['minimal', 'sveltekit', 'pivot-dashboard', 'admin-dashboard']

describe('create-sv-grid templates', () => {
  it.each(templates)('%s scaffolds with its dotfiles renamed back', (template) => {
    const app = scaffold(template)
    expect(existsSync(join(app, 'package.json'))).toBe(true)
    expect(existsSync(join(app, '_package.json'))).toBe(false)
    expect(existsSync(join(app, '.gitignore'))).toBe(true)
    // A leftover placeholder means renameDotfiles missed a file.
    expect(readFileSync(join(app, 'package.json'), 'utf8')).not.toContain('__NAME__')
  })

  it.each(themedTemplates)('%s honours --theme and --dark everywhere it records one', (template) => {
    const app = scaffold(template, ['--theme', 'dracula', '--dark'])

    // 1. The stylesheet: either the preset import or its resolved tokens.
    const css = readFileSync(join(app, 'src', 'app.css'), 'utf8')
    const marked = css.match(/\/\* svgrid-theme:start \*\/([\s\S]*?)\/\* svgrid-theme:end \*\//)
    expect(marked, 'template lost its svgrid-theme markers').toBeTruthy()
    const block = marked![1]!
    if (block.includes('@import')) {
      expect(block).toContain("themes/dracula.css")
    } else {
      // Dracula's dark background. If the preset ever changes this assertion
      // should change with it - it is here to prove the tokens are the chosen
      // preset's, not the default's.
      expect(block).toContain('#282a36')
    }

    // 2. The HTML shell, so --dark is dark on the first paint rather than after
    //    a toggle. The generated dark tokens sit under :root[data-theme='dark'].
    expect(shellOf(app)).toMatch(/<html\b[^>]*data-theme="dark"/)
  })

  it.each(themedTemplates)('%s honours --light in the shell too', (template) => {
    expect(shellOf(scaffold(template, ['--theme', 'excel', '--light']))).toMatch(
      /<html\b[^>]*data-theme="light"/,
    )
  })

  // Asking for a preset is not asking for a mode. minimal and sveltekit follow
  // the OS when nobody said, and pinning one silently would take that away.
  it.each(['minimal', 'sveltekit'])(
    '%s still follows the OS when no mode was asked for',
    (template) => {
      const shell = shellOf(scaffold(template, ['--theme', 'dracula']))
      expect(shell).toContain("matchMedia('(prefers-color-scheme: dark)')")
    },
  )

  it('sveltekit seeds its runtime picker with the scaffolded theme', () => {
    const app = scaffold('sveltekit', ['--theme', 'dracula', '--dark'])
    const ts = readFileSync(join(app, 'src', 'lib', 'theme.svelte.ts'), 'utf8')
    expect(ts).toContain("INITIAL_THEME = 'dracula'")
    expect(ts).toContain("INITIAL_MODE: ThemeMode = 'dark'")
    // The picker must not disagree with the stylesheet underneath it.
    expect(readFileSync(join(app, 'src', 'app.css'), 'utf8')).toContain('themes/dracula.css')
  })

  it('sveltekit ships the server-side pieces the tutorial describes', () => {
    const app = scaffold('sveltekit')
    const server = readFileSync(join(app, 'src', 'routes', 'people', '+page.server.ts'), 'utf8')
    expect(server).toContain('export const load')
    expect(server).toContain('export const actions')
    const pageSvelte = readFileSync(join(app, 'src', 'routes', 'people', '+page.svelte'), 'utf8')
    // Sorting is the server's job here; a grid left to sort internally would
    // silently disagree with the URL.
    expect(pageSvelte).toContain('externalSort')
  })

  it('sveltekit ships an auth scaffold that gates on the server', () => {
    const app = scaffold('sveltekit')
    const read = (...p: string[]) => readFileSync(join(app, ...p), 'utf8')

    // $lib/server is the folder SvelteKit refuses to bundle into the client, so
    // the hashes cannot leak through an accidental component import.
    const auth = read('src', 'lib', 'server', 'auth.ts')
    expect(auth).toContain('PBKDF2')
    expect(auth).toContain('httpOnly: true')
    expect(auth).toContain("sameSite: 'lax'")
    // Web Crypto, not node:crypto: the template ships no @types/node, and
    // adapter-auto may land it on an edge runtime with no Node built-ins.
    // Match the import, not the word - the header explains the choice in prose.
    expect(auth).not.toMatch(/from ['"]node:crypto['"]/)
    expect(auth).toContain('crypto.subtle')

    // One list drives the gate, so a new protected route is an entry rather
    // than a check somebody has to remember to copy.
    expect(read('src', 'hooks.server.ts')).toContain('PROTECTED')

    // Sign-out is POST-only. A GET logout fires from any prefetcher, and a
    // +page.server.ts with no +page.svelte beside it returns 415.
    const logoutDir = join(app, 'src', 'routes', 'logout')
    expect(existsSync(join(logoutDir, '+server.ts'))).toBe(true)
    expect(existsSync(join(logoutDir, '+page.server.ts'))).toBe(false)
    expect(read('src', 'routes', 'logout', '+server.ts')).toContain('export const POST')

    // The role check has to be in the action. `canEdit` only hides the UI, and
    // hiding a button stops nobody from posting the form by hand.
    const peopleServer = read('src', 'routes', 'people', '+page.server.ts')
    expect(peopleServer).toContain("locals.user?.role !== 'admin'")
    expect(peopleServer).toContain('error(403')
  })

  it('pivot-dashboard keeps its drill logic pure and its facts on the server', () => {
    const app = scaffold('pivot-dashboard')
    const read = (...p: string[]) => readFileSync(join(app, ...p), 'utf8')

    // The drill module is the part worth unit-testing, which only stays true
    // while it has no Svelte and no grid imports to drag a DOM in behind it.
    const drill = read('src', 'lib', 'drill.ts')
    expect(drill).toContain('export function drillThrough')
    expect(drill).not.toMatch(/from ['"]@svgrid\//)
    expect(drill).not.toMatch(/from ['"]svelte/)

    // Facts are built in `load`, not in the component: the browser should get
    // rows, not a database connection.
    expect(read('src', 'routes', '+page.server.ts')).toContain('export const load')

    // The cube needs the designer's rendered rows to walk a clicked cell up to
    // its ancestors, and the enterprise entry point is where it comes from.
    const page = read('src', 'routes', '+page.svelte')
    expect(page).toContain('onPivot')
    expect(page).toContain('onCellClick')
    expect(page).toMatch(/from ['"]@svgrid\/enterprise['"]/)

    // The seed must be deterministic or SSR and hydration disagree. Match the
    // call - the header names Math.random in prose to explain why it is absent.
    expect(read('src', 'lib', 'facts.ts')).not.toMatch(/Math\.random\s*\(/)
  })

  // The whole promise of this template is that no grid CSS arrives with it. A
  // stray preset import or --sg-* token would quietly re-theme an app whose
  // owner was told the stylesheet is theirs.
  it('headless ships the engine and none of the renderer', () => {
    const app = scaffold('headless')
    const appSvelte = readFileSync(join(app, 'src', 'App.svelte'), 'utf8')
    expect(appSvelte).toContain("from '@svgrid/grid/core'")
    expect(appSvelte).toContain('createSvGrid')
    expect(appSvelte).not.toContain('<SvGrid')

    // Comments stripped first: the file explains what --sg-* is and why it is
    // absent, and that prose is not a token.
    const css = readFileSync(join(app, 'src', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toContain('@svgrid/grid/themes')
    expect(css).not.toContain('--sg-')
    expect(css).not.toContain('svgrid-theme:start')
  })

  // Passing --theme to a template with nothing to theme used to collect the
  // answer, apply none of it, and still report a theme in the summary.
  it('headless ignores --theme instead of pretending to apply it', () => {
    const app = scaffold('headless', ['--theme', 'dracula', '--dark'])
    const css = readFileSync(join(app, 'src', 'app.css'), 'utf8')
    expect(css).not.toContain('dracula')
    expect(css).not.toContain('#282a36')
  })

  it('an unknown template fails loudly instead of scaffolding something else', () => {
    expect(() => scaffold('does-not-exist')).toThrow()
  })
})
