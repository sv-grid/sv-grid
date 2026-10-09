import { describe, it, expect } from 'vitest'
import { toSvelteKit3, SVELTEKIT_3_ADAPTERS } from './sveltekit3.js'
import { parseProject, serializeProject, setKitVersion } from './project.js'
import type { GeneratedFile } from './scaffold.js'

const f = (path: string, contents: string): GeneratedFile => ({ path, description: path, contents })

/** The smallest SvelteKit 2 bundle with one of every shape the Studio emits. */
function v2Bundle(extra: GeneratedFile[] = []): GeneratedFile[] {
  return [
    f('package.json', JSON.stringify({
      name: 'app',
      devDependencies: {
        '@sveltejs/adapter-node': '^5.2.0',
        '@sveltejs/kit': '^2.22.0',
        '@sveltejs/vite-plugin-svelte': '^6.0.0',
        svelte: '^5.55.5',
        'svelte-check': '^4.4.6',
        typescript: '^5.7.0',
        vite: '^7.0.0',
        vitest: '^4.1.5',
      },
    }, null, 2) + '\n'),
    f('svelte.config.js', `import adapter from '@sveltejs/adapter-node'\nexport default { kit: { adapter: adapter() } }\n`),
    f('vite.config.ts', `import { sveltekit } from '@sveltejs/kit/vite'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [sveltekit()],\n  server: { watch: { ignored: ['**/.studio/**'] } },\n})\n`),
    f('tsconfig.json', `{\n  "extends": "./.svelte-kit/tsconfig.json"\n}\n`),
    f('src/lib/data.ts', 'export const x = 1\n'),
    f('src/lib/handles.svelte.ts', 'export const h = 1\n'),
    f('src/lib/Card.svelte', '<div></div>\n'),
    f('src/lib/server/auth.ts', 'export const a = 1\n'),
    ...extra,
  ]
}

const byPath = (files: GeneratedFile[], path: string) => files.find((x) => x.path === path)

describe('toSvelteKit3', () => {
  it('moves config out of svelte.config.js into the sveltekit() plugin call', () => {
    const out = toSvelteKit3(v2Bundle())
    expect(byPath(out, 'svelte.config.js')).toBeUndefined()
    const vite = byPath(out, 'vite.config.ts')!.contents
    expect(vite).toContain(`import adapter from '@sveltejs/adapter-node'`)
    expect(vite).toContain('sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })')
    // The dev-server watch exclusions survive the rewrite.
    expect(vite).toContain(`ignored: ['**/.studio/**']`)
  })

  it('bumps the toolchain and the adapter to SvelteKit 3 majors and adds the #lib import map', () => {
    const pkg = JSON.parse(byPath(toSvelteKit3(v2Bundle()), 'package.json')!.contents)
    expect(pkg.devDependencies['@sveltejs/kit']).toBe('^3.0.0')
    expect(pkg.devDependencies.vite).toBe('^8.0.12')
    expect(pkg.devDependencies.typescript).toBe('^6.0.0')
    expect(pkg.devDependencies['@sveltejs/adapter-node']).toBe(SVELTEKIT_3_ADAPTERS['@sveltejs/adapter-node'])
    // Untouched: not part of the SvelteKit toolchain.
    expect(pkg.devDependencies.vitest).toBe('^4.1.5')
    expect(pkg.imports).toEqual({ '#lib': './src/lib/index.js', '#lib/*': './src/lib/*' })
  })

  it('extends $app/tsconfig instead of the generated .svelte-kit one', () => {
    const ts = byPath(toSvelteKit3(v2Bundle()), 'tsconfig.json')!.contents
    expect(ts).toContain('"extends": "$app/tsconfig"')
    expect(ts).not.toContain('.svelte-kit')
  })

  it('resolves each $lib import against the real files to pick the extension', () => {
    const page = f('src/routes/+page.svelte', [
      `import { x } from '$lib/data'`,
      `import { h } from '$lib/handles.svelte'`,
      `import Card from '$lib/Card.svelte'`,
      `import { a } from '$lib/server/auth'`,
    ].join('\n'))
    const out = byPath(toSvelteKit3(v2Bundle([page])), 'src/routes/+page.svelte')!.contents
    expect(out).toContain(`'#lib/data.js'`) // x.ts -> .js
    expect(out).toContain(`'#lib/handles.svelte.js'`) // x.svelte.ts -> .svelte.js
    expect(out).toContain(`'#lib/Card.svelte'`) // already explicit -> unchanged
    expect(out).toContain(`'#lib/server/auth.js'`)
    expect(out).not.toContain('$lib')
  })

  it('rewrites $env/dynamic/private to named $app/env/private imports and declares every name', () => {
    const auth = f('src/lib/server/session.ts', [
      `import { env } from '$env/dynamic/private'`,
      `const s = env.SESSION_SECRET || 'dev'`,
      `const t = env.SMTP_HOST`,
    ].join('\n'))
    const out = toSvelteKit3(v2Bundle([auth]))
    const src = byPath(out, 'src/lib/server/session.ts')!.contents
    expect(src).toContain(`import { SESSION_SECRET, SMTP_HOST } from '$app/env/private'`)
    expect(src).toContain(`const s = SESSION_SECRET || 'dev'`)
    expect(src).not.toContain('env.')
    const envTs = byPath(out, 'src/env.ts')!.contents
    expect(envTs).toContain(`from '@sveltejs/kit/env'`)
    expect(envTs).toContain('SESSION_SECRET:')
    expect(envTs).toContain('SMTP_HOST:')
  })

  it('leaves process.env alone, including in drizzle.config.ts which runs outside Vite', () => {
    const drizzle = f('drizzle.config.ts', `export default { dbCredentials: { url: process.env.DATABASE_URL! } }\n`)
    const mixed = f('src/lib/server/db.ts', [
      `import { env } from '$env/dynamic/private'`,
      `const a = env.DATABASE_URL`,
      `const b = process.env.NODE_ENV`,
    ].join('\n'))
    const out = toSvelteKit3(v2Bundle([drizzle, mixed]))
    expect(byPath(out, 'drizzle.config.ts')!.contents).toContain('process.env.DATABASE_URL')
    const db = byPath(out, 'src/lib/server/db.ts')!.contents
    expect(db).toContain('const a = DATABASE_URL')
    expect(db).toContain('const b = process.env.NODE_ENV')
  })

  it('moves Handle to @sveltejs/kit/hooks and SubmitFunction to $app/forms', () => {
    const hooks = f('src/hooks.server.ts', `import type { Handle } from '@sveltejs/kit'\n`)
    const form = f('src/routes/x/+page.svelte', `import type { SubmitFunction } from '@sveltejs/kit'\n`)
    const out = toSvelteKit3(v2Bundle([hooks, form]))
    expect(byPath(out, 'src/hooks.server.ts')!.contents).toContain(`from '@sveltejs/kit/hooks'`)
    expect(byPath(out, 'src/routes/x/+page.svelte')!.contents).toContain(`from '$app/forms'`)
  })

  it("replaces the deprecated kit json() helper with Response.json, but not a response's .json()", () => {
    const route = f('src/routes/api/cron/+server.ts', [
      `import { json, error } from '@sveltejs/kit'`,
      `const body = await request.json()`,
      `return json({ ok: true })`,
    ].join('\n'))
    const out = byPath(toSvelteKit3(v2Bundle([route])), 'src/routes/api/cron/+server.ts')!.contents
    expect(out).toContain(`import { error } from '@sveltejs/kit'`)
    expect(out).toContain('return Response.json({ ok: true })')
    expect(out).toContain('await request.json()')
  })

  it('maps goto keepFocus + noScroll onto reset: false', () => {
    const list = f('src/routes/deals/+page.svelte', `void goto(u, { keepFocus: true, noScroll: true })\n`)
    const out = byPath(toSvelteKit3(v2Bundle([list])), 'src/routes/deals/+page.svelte')!.contents
    expect(out).toContain('goto(u, { reset: false })')
    expect(out).not.toMatch(/keepFocus|noScroll/)
  })

  it('copies the readonly page.url from its query string, not its searchParams', () => {
    // Found by verify:app --all-paths: the server-sorted list did not type-check
    // on v3, because page.url.searchParams is a ReadonlyURLSearchParams there.
    const list = f('src/routes/deals/+page.svelte', `const sp = new URLSearchParams(page.url.searchParams)\n`)
    const out = byPath(toSvelteKit3(v2Bundle([list])), 'src/routes/deals/+page.svelte')!.contents
    expect(out).toContain('new URLSearchParams(page.url.search)')
    expect(out).not.toContain('page.url.searchParams')
  })

  it('leaves files that need no change as the same object', () => {
    const plain = f('src/routes/about/+page.svelte', '<h1>About</h1>\n')
    const before = v2Bundle([plain])
    const after = toSvelteKit3(before)
    expect(byPath(after, 'src/routes/about/+page.svelte')).toBe(plain)
  })
})

describe('kit on the project model', () => {
  const base = { title: 'T', entities: [], screens: [], dataSource: 'memory' } as never

  it('survives a save and reload, so a v3 project regenerates as v3', () => {
    const v3 = setKitVersion(base, 3)
    expect(parseProject(serializeProject(v3)).kit).toBe(3)
  })

  it('stores the default as the absence of the field', () => {
    const back = setKitVersion(setKitVersion(base, 3), 2)
    expect('kit' in back).toBe(false)
    expect(parseProject(serializeProject(back)).kit).toBeUndefined()
  })
})
