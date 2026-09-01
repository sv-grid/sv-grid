/**
 * Extract the REAL public API surface of @svgrid/grid and @svgrid/enterprise
 * from the workspace sources, so `check_svgrid_code` validates against what the
 * packages actually export rather than a hand-kept list that drifts.
 *
 * Everything here is plain text analysis - no TypeScript compiler, no bundler -
 * because it runs inside the MCP package's build step, which has neither.
 *
 * What comes out:
 *   exports      real exported symbol names, split value vs type
 *   subpaths     the specifiers a consumer may import from (package.json exports)
 *   props        the top-level keys of <SvGrid>'s Props type, with their types
 *   columnDef    the top-level keys of ColumnDef
 *   themes       the shipped theme stylesheet names
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

/**
 * Blank out comments and string/template bodies, preserving length and line
 * breaks so every offset in the result still points at the same character in
 * the source. Every scan below runs on the blanked copy and reads names back
 * out of it (identifiers are never inside a string, so they survive).
 */
export function blankOut(src) {
  const out = src.split('')
  let i = 0
  const n = src.length
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2)
      j = j === -1 ? n : j + 2
      blank(i, j)
      i = j
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === c) break
        j++
      }
      blank(i + 1, Math.min(j, n))
      i = Math.min(j + 1, n)
      continue
    }
    i++
  }
  return out.join('')
}

/** Split the inside of an `export { ... }` clause into named specifiers. */
function parseSpecifiers(clause, clauseIsTypeOnly) {
  const values = []
  const types = []
  for (const raw of clause.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const typeOnly = clauseIsTypeOnly || /^type\s+/.test(part)
    const body = part.replace(/^type\s+/, '')
    // `default as SvGrid` / `foo as bar` - the exported name is what follows `as`.
    const m = body.match(/^([A-Za-z_$][\w$]*)\s*(?:as\s+([A-Za-z_$][\w$]*))?$/)
    if (!m) continue
    const name = m[2] ?? m[1]
    if (name === 'default') continue
    ;(typeOnly ? types : values).push(name)
  }
  return { values, types }
}

/** Exported names declared or re-exported by one module. */
export function parseModuleExports(text) {
  const src = blankOut(text)
  const values = []
  const types = []
  const stars = []

  // Covers both `export { a } from './x'` and the bare `export { a }` form,
  // which the barrel uses to re-export something it imported at the top.
  const clause = /export\s+(type\s+)?\{([\s\S]*?)\}/g
  for (let m; (m = clause.exec(src)); ) {
    const { values: v, types: t } = parseSpecifiers(m[2], Boolean(m[1]))
    values.push(...v)
    types.push(...t)
  }

  // The specifier is blanked in `src`, so read it back from the original text
  // at the same offsets (blanking preserves length).
  const starRe = /export\s+\*\s+from\s*['"]([^'"]*)['"]/g
  for (let m; (m = starRe.exec(src)); ) {
    const start = m.index + m[0].length - m[1].length - 1
    stars.push(text.slice(start, start + m[1].length))
  }

  const decl =
    /export\s+(?:declare\s+)?(?:async\s+)?(const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g
  for (let m; (m = decl.exec(src)); ) {
    if (m[1] === 'type' || m[1] === 'interface') types.push(m[2])
    else values.push(m[2])
  }

  return { values, types, stars }
}

/** Resolve a relative specifier to a file on disk, trying the usual endings. */
function resolveModule(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base,
    base + '.ts',
    base + '.svelte.ts',
    base + '.svelte',
    join(base, 'index.ts'),
  ]
  return candidates.find((p) => existsSync(p) && !p.endsWith('/')) ?? null
}

/** Every name a barrel entry point exports, following `export *` re-exports. */
export function collectBarrel(entryFile) {
  const values = new Set()
  const types = new Set()
  const seen = new Set()

  const walk = (file) => {
    if (!file || seen.has(file) || !existsSync(file)) return
    seen.add(file)
    const parsed = parseModuleExports(readFileSync(file, 'utf8'))
    parsed.values.forEach((v) => values.add(v))
    parsed.types.forEach((t) => types.add(t))
    for (const spec of parsed.stars) {
      if (spec.startsWith('.')) walk(resolveModule(file, spec))
    }
  }
  walk(entryFile)

  return {
    values: [...values].sort(),
    types: [...types].sort(),
  }
}

/**
 * Top-level members of an object type alias, e.g. `export type Props<...> = {`.
 * Returns `{ name, optional, type }` per member. Nested object literals, unions
 * spanning lines and JSDoc between members are all skipped correctly because
 * the scan tracks bracket depth over a comment-blanked copy.
 */
export function parseTypeMembers(text, typeName) {
  const src = blankOut(text)
  const head = new RegExp(`export\\s+(?:type|interface)\\s+${typeName}\\b`).exec(src)
  if (!head) return []

  const open = src.indexOf('{', head.index)
  if (open === -1) return []

  const members = []
  let depth = 0
  let i = open
  let memberStart = -1

  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '{' || c === '[' || c === '(') {
      depth++
      if (depth === 1) memberStart = i + 1
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth--
      if (depth === 0) break
      continue
    }
    if (depth !== 1) continue
    if (c === ';' || c === ',' || c === '\n') {
      memberStart = i + 1
      continue
    }
    if (memberStart !== -1 && /\S/.test(c)) {
      const rest = src.slice(i)
      // Property (`name?: T`) or method (`name(...): T`, generics included).
      const m =
        /^(?:readonly\s+)?([A-Za-z_$][\w$]*)(\?)?\s*:/.exec(rest) ??
        /^([A-Za-z_$][\w$]*)(\?)?\s*[(<]/.exec(rest)
      if (m) {
        // Skip from the `:` / `(` / `<` itself, so a method's own parameter
        // list is consumed here. Skipping from AFTER the `(` would leave its
        // `)` for the outer scan, which would read it as the end of the type.
        const valueStart = i + m[0].length - 1
        let j = valueStart
        let d = 0
        for (; j < src.length; j++) {
          const t = src[j]
          if (t === '{' || t === '[' || t === '(') d++
          else if (t === '}' || t === ']' || t === ')') {
            if (d === 0) break
            d--
          } else if (d === 0 && (t === ';' || t === '\n')) break
        }
        members.push({
          name: m[1],
          optional: Boolean(m[2]),
          type: text
            .slice(valueStart, j)
            .replace(/^:\s*/, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120),
        })
        i = j - 1
        memberStart = -1
        continue
      }
      // Not a member start (a union continuation, a modifier); wait for the
      // next boundary before trying again.
      memberStart = -1
    }
  }

  return members
}

/** Importable specifiers from a package.json `exports` map. */
export function subpathsOf(pkgJson, pkgName) {
  const out = []
  for (const key of Object.keys(pkgJson.exports ?? {})) {
    if (key === './package.json') continue
    if (key.includes('*')) continue
    out.push(key === '.' ? pkgName : pkgName + key.slice(1))
  }
  return out.sort()
}

/** Build the whole surface manifest from the workspace. */
export function buildApiSurface(repoRoot) {
  const gridSrc = join(repoRoot, 'packages', 'grid', 'src')
  const entSrc = join(repoRoot, 'packages', 'enterprise', 'src')
  const gridPkg = JSON.parse(readFileSync(join(repoRoot, 'packages', 'grid', 'package.json'), 'utf8'))
  const entPkg = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'enterprise', 'package.json'), 'utf8'),
  )

  const grid = collectBarrel(join(gridSrc, 'index.ts'))
  const enterprise = collectBarrel(join(entSrc, 'index.ts'))

  const propsText = readFileSync(join(gridSrc, 'SvGrid.types.ts'), 'utf8')
  const props = parseTypeMembers(propsText, 'Props')
  const columnDef = parseTypeMembers(readFileSync(join(gridSrc, 'core.ts'), 'utf8'), 'ColumnDef')

  // What `api` actually has on it, so a wrong method name is caught by name
  // rather than by a hand-kept list of guesses.
  const apiMethods = parseTypeMembers(
    readFileSync(join(gridSrc, 'svgrid-wrapper.types.ts'), 'utf8'),
    'SvGridApi',
  ).map((m) => m.name)
  const enterpriseApiMethods = parseTypeMembers(
    readFileSync(join(entSrc, 'install.ts'), 'utf8'),
    'EnterpriseGridApi',
  ).map((m) => m.name)

  const themesDir = join(repoRoot, 'packages', 'grid', 'themes')
  const themes = existsSync(themesDir)
    ? readdirSync(themesDir)
        .filter((f) => f.endsWith('.css'))
        .sort()
    : []

  return {
    gridVersion: gridPkg.version,
    enterpriseVersion: entPkg.version,
    grid: { ...grid, subpaths: subpathsOf(gridPkg, '@svgrid/grid') },
    enterprise: { ...enterprise, subpaths: subpathsOf(entPkg, '@svgrid/enterprise') },
    props,
    columnDef,
    apiMethods: apiMethods.sort(),
    enterpriseApiMethods: enterpriseApiMethods.sort(),
    themes,
    features: grid.values.filter((v) => v.endsWith('Feature')).sort(),
    rowModels: grid.values.filter((v) => /^create\w+RowModel$/.test(v)).sort(),
  }
}
