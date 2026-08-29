/**
 * The public API surface as facts: export names from packages/grid/src/index.ts
 * and SvGridApi method names from the wrapper types. The blog generator grounds
 * the model on these; the topic queue validates its `api` identifiers against
 * them so a queued post can never be asked to document a method that does not
 * exist.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadGridExports(root) {
  const src = readFileSync(join(root, 'packages', 'grid', 'src', 'index.ts'), 'utf-8')
  const values = new Set()
  const types = new Set()
  for (const [, inner] of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const raw of inner.split(',')) {
      const t = raw.trim()
      if (!t) continue
      const isType = t.startsWith('type ')
      const clean = t.replace(/^type\s+/, '').replace(/\s+as\s+.+$/, '').trim()
      if (!clean) continue
      if (isType) types.add(clean)
      else values.add(clean)
    }
  }
  for (const [, name] of src.matchAll(/export\s*\{\s*default\s+as\s+(\w+)/g)) values.add(name)
  return { values: [...values].sort(), types: [...types].sort() }
}

export function loadApiMethods(root) {
  try {
    const src = readFileSync(join(root, 'packages', 'grid', 'src', 'svgrid-wrapper.types.ts'), 'utf-8')
    const methods = new Set()
    for (const m of src.matchAll(/^\s{2,4}(\w+)\s*\(/gm)) methods.add(m[1])
    return [...methods].sort()
  } catch {
    return []
  }
}

/** Every identifier a post may name: value exports + api methods. */
export function knownApiIdentifiers(root) {
  const { values } = loadGridExports(root)
  return new Set([...values, ...loadApiMethods(root)])
}
