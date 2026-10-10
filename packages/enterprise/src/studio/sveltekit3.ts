/**
 * Turn a generated SvelteKit 2 app into a SvelteKit 3 app.
 *
 * SvelteKit 3 shipped on 2026-10-01. It requires Vite 8, and Vite 8's Rolldown
 * bundler crashes inside StackBlitz's WebContainer ("Invalid atomic access
 * index", webcontainer-core #2105 / #2107), which is why the Studio's default
 * stays on SvelteKit 2 + Vite 7 (see the pin in packageJson()). A project opts
 * in with `kit: 3` and gets this conversion on top of the normal emit.
 *
 * It is a transform over the finished file set rather than a flag threaded
 * through every emitter, for two reasons. The SvelteKit 2 output stays byte for
 * byte what it was, so the default carries no risk from this change. And the
 * official `npx sv migrate sveltekit-3` is the oracle: it was run on a
 * Studio-generated app, and every rewrite below reproduces what it did there,
 * checked against SvelteKit 3's own type definitions where its docs and its
 * types disagreed (they do on `json`, which is deprecated, not removed).
 *
 * What the migrator could not decide for us, and what was decided instead:
 *  - env vars must be declared in `src/env.ts`. The migrator's default schema
 *    falls back to '' and flags it for review. Every read in the generated app
 *    already handles a missing value (`|| 'dev-insecure-...'`, `?? ''`,
 *    `if (env.X)`), so '' is the right fallback and is stated here, not flagged.
 *  - `drizzle.config.ts` keeps `process.env`: drizzle-kit runs outside Vite,
 *    where `$app/env` does not exist. Only `env.X` (no `process.`) is rewritten.
 */
import type { GeneratedFile } from './scaffold.js'

/** Toolchain SvelteKit 3 requires. Minimums are from the v3 migration guide. */
export const SVELTEKIT_3_DEV_DEPENDENCIES: Readonly<Record<string, string>> = {
  '@sveltejs/kit': '^3.0.0',
  '@sveltejs/vite-plugin-svelte': '^7.0.0',
  svelte: '^5.57.1',
  'svelte-check': '^4.7.5',
  typescript: '^6.0.0',
  vite: '^8.0.12',
}

/**
 * The first major of each adapter whose peerDependency is `@sveltejs/kit ^3`,
 * read from npm on 2026-10-08. None of the v3 adapter behaviour changes (node's
 * ORIGIN, vercel's edge runtime, cloudflare's platform APIs) reach Studio
 * output, so this is a version bump only.
 */
export const SVELTEKIT_3_ADAPTERS: Readonly<Record<string, string>> = {
  '@sveltejs/adapter-auto': '^8.0.0',
  '@sveltejs/adapter-node': '^6.0.0',
  '@sveltejs/adapter-vercel': '^7.0.0',
  '@sveltejs/adapter-netlify': '^7.0.1',
  '@sveltejs/adapter-cloudflare': '^8.0.0',
}

const SOURCE = /\.(ts|js|svelte)$/

/** Every major version of SvelteKit the Studio can emit. */
export type KitVersion = 2 | 3

export function toSvelteKit3(files: readonly GeneratedFile[]): GeneratedFile[] {
  const paths = new Set(files.map((f) => f.path))
  const adapter = adapterOf(files)
  const envNames = new Set<string>()

  const out: GeneratedFile[] = []
  for (const file of files) {
    // svelte.config.js is gone: its adapter and preprocess move into vite.config.ts.
    if (file.path === 'svelte.config.js') continue
    if (file.path === 'package.json') {
      out.push({ ...file, contents: packageJson3(file.contents) })
      continue
    }
    if (file.path === 'vite.config.ts') {
      out.push({ ...file, description: `Vite config, including SvelteKit (${adapter}).`, contents: viteConfig3(file.contents, adapter) })
      continue
    }
    if (file.path === 'tsconfig.json') {
      out.push({ ...file, contents: TSCONFIG_3 })
      continue
    }
    if (SOURCE.test(file.path) && file.path !== 'drizzle.config.ts') {
      const contents = rewriteSource(file.contents, paths, envNames)
      out.push(contents === file.contents ? file : { ...file, contents })
      continue
    }
    out.push(file)
  }
  if (envNames.size) out.push(envModule([...envNames].sort()))
  return out
}

/* ---------------------------------------------------------------- config */

function adapterOf(files: readonly GeneratedFile[]): string {
  const pkg = files.find((f) => f.path === 'package.json')
  if (!pkg) return '@sveltejs/adapter-auto'
  const dev = (JSON.parse(pkg.contents).devDependencies ?? {}) as Record<string, string>
  return Object.keys(dev).find((k) => k.startsWith('@sveltejs/adapter-')) ?? '@sveltejs/adapter-auto'
}

function packageJson3(contents: string): string {
  const pkg = JSON.parse(contents)
  const dev: Record<string, string> = { ...(pkg.devDependencies ?? {}) }
  for (const [name, range] of Object.entries(SVELTEKIT_3_DEV_DEPENDENCIES)) dev[name] = range
  for (const name of Object.keys(dev)) if (SVELTEKIT_3_ADAPTERS[name]) dev[name] = SVELTEKIT_3_ADAPTERS[name]
  pkg.devDependencies = dev
  // `#lib` is a standard subpath import now, so Node and every tool resolve it,
  // not only Vite. `#lib` alone points at an index; `#lib/*` is the common case.
  pkg.imports = { '#lib': './src/lib/index.js', '#lib/*': './src/lib/*' }
  return JSON.stringify(pkg, null, 2) + '\n'
}

/**
 * The v2 vite.config.ts with SvelteKit's config folded into the plugin call.
 * Everything else in the file (the dev-server watch exclusions) is kept.
 */
function viteConfig3(v2: string, adapter: string): string {
  const imports =
    `import adapter from '${adapter}'\n` +
    `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'\n`
  const withPlugin = v2.replace('sveltekit()', 'sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })')
  if (withPlugin === v2) throw new Error('toSvelteKit3: vite.config.ts has no sveltekit() call to configure')
  return imports + withPlugin
}

// `$app/tsconfig` replaces the generated ./.svelte-kit/tsconfig.json and brings
// the compiler options that used to be listed here. Matches the migrator.
const TSCONFIG_3 = `{
  "extends": "$app/tsconfig",
  "compilerOptions": {
    "sourceMap": true,
    "strict": true
  },
  "include": ["src", "vite.config.ts"]
}
`

/* --------------------------------------------------------------- sources */

function rewriteSource(src: string, paths: ReadonlySet<string>, envNames: Set<string>): string {
  let s = src
  s = rewriteLibImports(s, paths)
  s = rewriteEnv(s, envNames)
  s = rewriteKitImports(s)
  // keepFocus + noScroll are removed. `reset: false` is defined in v3's types as
  // "the current scroll position and focused element are left alone", which is
  // exactly what the two of them did together.
  s = s.replace(/\{\s*keepFocus:\s*true,\s*noScroll:\s*true\s*\}/g, '{ reset: false }')
  // page.url is readonly in v3, so `page.url.searchParams` is a
  // ReadonlyURLSearchParams, which the URLSearchParams constructor does not
  // accept. The generated code only copies it, never mutates it, so copying
  // from the query string is the same thing and type-checks on both majors.
  // The official migrator lists this as a manual task; the server-sorted list
  // screen hit it, and only `verify:app --all-paths` reaches that screen.
  s = s.replace(/new URLSearchParams\(page\.url\.searchParams\)/g, 'new URLSearchParams(page.url.search)')
  return s
}

/**
 * `$lib/x` -> `#lib/x.js`. Subpath imports need a real extension, and the right
 * one depends on what the file actually is, so each specifier is resolved
 * against the generated paths rather than guessed: `x.ts` and `x.svelte.ts`
 * are imported as `.js` (TypeScript maps it back), anything already carrying
 * its extension (`.svelte`, `.js`) is left as it is, and a directory resolves
 * to its index.
 */
function rewriteLibImports(src: string, paths: ReadonlySet<string>): string {
  return src.replace(/(['"`])\$lib\/([^'"`]+)\1/g, (whole, q: string, spec: string) => {
    const base = `src/lib/${spec}`
    if (paths.has(base)) return `${q}#lib/${spec}${q}`
    if (paths.has(`${base}.ts`) || paths.has(`${base}.js`)) return `${q}#lib/${spec}.js${q}`
    if (paths.has(`${base}/index.ts`) || paths.has(`${base}/index.js`)) return `${q}#lib/${spec}/index.js${q}`
    // Not a file this app generated (a user-added module, or one emitted
    // conditionally elsewhere). `.js` is what the migrator writes for a TS
    // source, which is overwhelmingly the case in a Studio app.
    return `${q}#lib/${spec}.js${q}`
  })
}

/**
 * `import { env } from '$env/dynamic/private'` + `env.X`
 *   -> `import { X } from '$app/env/private'` + `X`
 * Every name read is collected so src/env.ts can declare it, which v3 requires.
 */
function rewriteEnv(src: string, envNames: Set<string>): string {
  if (!/from\s+['"]\$env\/dynamic\/private['"]/.test(src)) return src
  const used = new Set<string>()
  // `(?<![.\w])` keeps `process.env.X` untouched; only the imported `env` changes.
  const body = src.replace(/(?<![.\w])env\.([A-Z_][A-Z0-9_]*)/g, (_m, name: string) => {
    used.add(name)
    return name
  })
  for (const n of used) envNames.add(n)
  const names = [...used].sort()
  return body.replace(
    /import\s*\{\s*env\s*\}\s*from\s*(['"])\$env\/dynamic\/private\1/,
    names.length ? `import { ${names.join(', ')} } from '$app/env/private'` : '',
  )
}

/**
 * Types that moved out of `@sveltejs/kit`, and the deprecated `json` helper.
 * `fail`, `redirect` and `error` stay where they are.
 */
function rewriteKitImports(src: string): string {
  let s = src
  s = s.replace(/import\s+type\s*\{\s*Handle\s*\}\s*from\s*(['"])@sveltejs\/kit\1/g, `import type { Handle } from '@sveltejs/kit/hooks'`)
  s = s.replace(/import\s+type\s*\{\s*SubmitFunction\s*\}\s*from\s*(['"])@sveltejs\/kit\1/g, `import type { SubmitFunction } from '$app/forms'`)

  // json(...) -> Response.json(...): same (data, init) signature. Only when
  // `json` really is the kit helper - a file importing it from somewhere else,
  // or calling res.json(), is not touched.
  const kitImport = /import\s*\{([^}]*)\}\s*from\s*(['"])@sveltejs\/kit\2/
  const names = (s.match(kitImport)?.[1] ?? '').split(',').map((x) => x.trim())
  if (names.includes('json')) {
    s = s.replace(/(?<![.\w])json\(/g, 'Response.json(')
    const rest = names.filter((x) => x && x !== 'json')
    s = s.replace(kitImport, rest.length ? `import { ${rest.join(', ')} } from '@sveltejs/kit'` : '')
  }
  return s
}

/* ------------------------------------------------------------------- env */

function envModule(names: readonly string[]): GeneratedFile {
  const decls = names.map((n) => `  ${n}: { schema: (input) => input ?? '' },`).join('\n')
  return {
    path: 'src/env.ts',
    description: 'Environment variables the app reads (SvelteKit 3 requires declaring them).',
    contents:
      `import { defineEnvVars } from '@sveltejs/kit/env'\n\n` +
      `// SvelteKit 3 reads only the variables declared here. A missing one comes\n` +
      `// through as '' - every read in this app already falls back on that\n` +
      `// (a dev default, '?? ""', or an if), so that is the intended behaviour.\n` +
      `export const variables = defineEnvVars({\n${decls}\n})\n`,
  }
}
