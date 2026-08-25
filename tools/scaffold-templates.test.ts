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
const templates = ['minimal', 'sveltekit', 'admin-dashboard']

describe('create-sv-grid templates', () => {
  it.each(templates)('%s scaffolds with its dotfiles renamed back', (template) => {
    const app = scaffold(template)
    expect(existsSync(join(app, 'package.json'))).toBe(true)
    expect(existsSync(join(app, '_package.json'))).toBe(false)
    expect(existsSync(join(app, '.gitignore'))).toBe(true)
    // A leftover placeholder means renameDotfiles missed a file.
    expect(readFileSync(join(app, 'package.json'), 'utf8')).not.toContain('__NAME__')
  })

  it.each(templates)('%s honours --theme and --dark everywhere it records one', (template) => {
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

  it.each(templates)('%s honours --light in the shell too', (template) => {
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

  it('an unknown template fails loudly instead of scaffolding something else', () => {
    expect(() => scaffold('does-not-exist')).toThrow()
  })
})
