import { test, expect, describe } from 'vitest'
import addon from './index.mjs'

/** Minimal stand-in for the pieces of the sv workspace the add-on touches. */
function makeWorkspace(overrides = {}) {
  const deps = {}
  const files = {}
  return {
    ctx: {
      language: 'ts',
      isKit: true,
      directory: { src: 'src', lib: 'src/lib', kitRoutes: 'src/routes' },
      dependencyVersion: () => '^5.0.0',
      options: { demo: true, enterprise: false },
      sv: {
        dependency: (pkg, version) => { deps[pkg] = version },
        devDependency: (pkg, version) => { deps[pkg] = version },
        execute: async () => {},
        file: (path, edit) => {
          const result = edit(files[path] ?? '')
          if (result !== false) files[path] = result
        },
      },
      cancel: (reason) => { throw new Error('cancelled: ' + reason) },
      ...overrides,
    },
    deps,
    files,
  }
}

describe('@svgrid/sv add-on', () => {
  test('declares the shape the sv contract requires', () => {
    expect(addon.id).toBe('svgrid')
    expect(addon.options).toBeTruthy()
    expect(typeof addon.run).toBe('function')
    // `id` becomes the CLI name, so it must stay a bare slug.
    expect(addon.id).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  test('adds the grid dependency', async () => {
    const w = makeWorkspace()
    await addon.run(w.ctx)
    expect(w.deps['@svgrid/grid']).toBeTruthy()
    expect(w.deps['@svgrid/enterprise']).toBeUndefined()
  })

  test('adds enterprise only when asked', async () => {
    const w = makeWorkspace({ options: { demo: false, enterprise: true } })
    await addon.run(w.ctx)
    expect(w.deps['@svgrid/enterprise']).toBeTruthy()
  })

  test('writes a SvelteKit route when the project is Kit', async () => {
    const w = makeWorkspace()
    await addon.run(w.ctx)
    const path = 'src/routes/svgrid-demo/+page.svelte'
    expect(w.files[path]).toBeTruthy()
    expect(w.files[path]).toContain("from '@svgrid/grid'")
    expect(w.files[path]).toContain('<SvGrid')
    // Themed like the demos, not the bare fallback palette.
    expect(w.files[path]).toContain("import '@svgrid/grid/themes/ember.css'")
  })

  test('writes a lib component for a non-Kit project', async () => {
    const w = makeWorkspace({ isKit: false })
    await addon.run(w.ctx)
    expect(w.files['src/lib/SvGridDemo.svelte']).toBeTruthy()
    expect(w.files['src/routes/svgrid-demo/+page.svelte']).toBeUndefined()
  })

  test('emits the typed column annotation only for a TS project', async () => {
    const ts = makeWorkspace()
    await addon.run(ts.ctx)
    const tsFile = ts.files['src/routes/svgrid-demo/+page.svelte']
    expect(tsFile).toContain('lang="ts"')
    expect(tsFile).toContain('const columns: GridColumns<(typeof data)[number]> =')

    const js = makeWorkspace({ language: 'js' })
    await addon.run(js.ctx)
    const jsFile = js.files['src/routes/svgrid-demo/+page.svelte']
    expect(jsFile).not.toContain('lang="ts"')
    expect(jsFile).not.toContain('import { SvGrid, type GridColumns }')
    expect(jsFile).toContain("import { SvGrid } from '@svgrid/grid'")
    // Regression: without this JSDoc the JS demo fails svelte-check, because
    // SvelteKit's JS template enables checkJs and `field` widens to `string`.
    expect(jsFile).toContain("/** @type {import('@svgrid/grid').GridColumns<(typeof data)[number]>} */")
  })

  test('writes no demo when the user declines', async () => {
    const w = makeWorkspace({ options: { demo: false, enterprise: false } })
    await addon.run(w.ctx)
    expect(Object.keys(w.files)).toHaveLength(0)
  })

  test('refuses to clobber an existing file', async () => {
    const w = makeWorkspace()
    const path = 'src/routes/svgrid-demo/+page.svelte'
    w.files[path] = '<p>my own page</p>'
    await addon.run(w.ctx)
    expect(w.files[path]).toBe('<p>my own page</p>')
  })

  test('marks Svelte 4 unsupported rather than installing into it', async () => {
    let reason = null
    await addon.setup({
      dependencyVersion: () => '^4.2.0',
      unsupported: (r) => { reason = r },
      dependsOn: () => {},
      runsAfter: () => {},
      addOption: () => {},
    })
    expect(reason).toContain('Svelte 5')
  })

  test('accepts Svelte 5 and a project with no svelte pinned yet', async () => {
    for (const version of ['^5.0.0', '5.55.9', undefined]) {
      let reason = null
      await addon.setup({
        dependencyVersion: () => version,
        unsupported: (r) => { reason = r },
        dependsOn: () => {},
        runsAfter: () => {},
        addOption: () => {},
      })
      expect(reason, `svelte ${version}`).toBeNull()
    }
  })

  test('next steps point at the demo that was actually created', () => {
    const kit = addon.nextSteps({
      options: { demo: true, enterprise: false },
      isKit: true,
      directory: { lib: 'src/lib' },
    })
    expect(kit.join(' ')).toContain('/svgrid-demo')

    const bare = addon.nextSteps({
      options: { demo: true, enterprise: false },
      isKit: false,
      directory: { lib: 'src/lib' },
    })
    expect(bare.join(' ')).toContain('src/lib/SvGridDemo.svelte')

    const ent = addon.nextSteps({
      options: { demo: false, enterprise: true },
      isKit: true,
      directory: { lib: 'src/lib' },
    })
    expect(ent.join(' ')).toContain('license key')
  })
})
