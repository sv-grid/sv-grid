/**
 * A JSON Schema for `ChartSpec`, generated from packages/grid/src/chart-types.ts
 * with the TypeScript compiler API. The chart types are plain (no generics),
 * so the walk is small: object types become `properties`, string-literal
 * unions `enum`, template literals a `pattern`, arrays and tuples `items`,
 * the recursive `TreeNode` a `$ref`, and a function-typed member a
 * `$comment` with no `type` so a validator accepts whatever is there. Every
 * JSDoc comment becomes the `description`, so the schema reads like the
 * types do.
 *
 *   node tools/build-schemas.mjs   # writes docs/schemas/chart-spec.json
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

/** The aliases the schema walks, with `ChartSpec` as the root. */
const ROOT_TYPE = 'ChartSpec'

/** Build the schema object for `chart-types.ts` under `repoRoot`. */
export function buildChartSpecSchema(repoRoot, baseUri) {
  const file = join(repoRoot, 'packages', 'grid', 'src', 'chart-types.ts')
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  /** name -> type alias node */
  const aliases = new Map()
  source.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node)) aliases.set(node.name.text, node)
  })
  if (!aliases.has(ROOT_TYPE)) throw new Error(`chart-types.ts has no ${ROOT_TYPE}`)

  const defs = {}
  const pending = new Set()

  const docOf = (node) => {
    const docs = ts.getJSDocCommentsAndTags(node).filter((d) => ts.isJSDoc(d))
    const text = docs.map((d) => (typeof d.comment === 'string' ? d.comment : (d.comment ?? []).map((c) => c.text ?? '').join(''))).join(' ').replace(/\s+/g, ' ').trim()
    return text || undefined
  }
  const withDoc = (schema, node) => {
    const description = docOf(node)
    return description ? { ...schema, description } : schema
  }
  const ref = (name) => {
    if (!defs[name] && !pending.has(name)) pending.add(name)
    return { $ref: `#/$defs/${name}` }
  }

  function convert(type, depth = 0) {
    if (depth > 12) return {}
    if (ts.isParenthesizedTypeNode(type)) return convert(type.type, depth)
    if (ts.isLiteralTypeNode(type)) {
      const lit = type.literal
      if (ts.isStringLiteral(lit)) return { const: lit.text }
      if (ts.isNumericLiteral(lit)) return { const: Number(lit.text) }
      if (lit.kind === ts.SyntaxKind.TrueKeyword) return { const: true }
      if (lit.kind === ts.SyntaxKind.FalseKeyword) return { const: false }
      if (lit.kind === ts.SyntaxKind.NullKeyword) return { type: 'null' }
      return {}
    }
    if (ts.isTemplateLiteralTypeNode(type)) {
      const pattern =
        '^' +
        escape(type.head.text) +
        type.templateSpans.map((span) => (span.type.kind === ts.SyntaxKind.NumberKeyword ? '\\d+(?:\\.\\d+)?' : '.*') + escape(span.literal.text)).join('') +
        '$'
      return { type: 'string', pattern }
    }
    if (ts.isUnionTypeNode(type)) {
      const parts = type.types.map((t) => convert(t, depth + 1))
      const consts = parts.filter((p) => 'const' in p && typeof p.const === 'string')
      if (consts.length === parts.length) return { type: 'string', enum: consts.map((p) => p.const) }
      const hasNull = parts.some((p) => p.type === 'null')
      const rest = parts.filter((p) => p.type !== 'null')
      // Booleans written as `true | false` and the like collapse.
      const out = rest.length === 1 ? rest[0] : { anyOf: rest }
      return hasNull ? { anyOf: [...(out.anyOf ?? [out]), { type: 'null' }] } : out
    }
    if (ts.isArrayTypeNode(type)) return { type: 'array', items: convert(type.elementType, depth + 1) }
    if (ts.isTupleTypeNode(type)) return { type: 'array', prefixItems: type.elements.map((e) => convert(e, depth + 1)), minItems: type.elements.length }
    if (ts.isTypeLiteralNode(type)) return objectSchema(type.members, depth)
    if (ts.isFunctionTypeNode(type)) return { $comment: 'a function; set it in code, it has no JSON form' }
    if (ts.isTypeReferenceNode(type)) {
      const name = ts.isIdentifier(type.typeName) ? type.typeName.text : type.typeName.getText()
      const args = type.typeArguments ?? []
      if (name === 'Array' || name === 'ReadonlyArray') return { type: 'array', items: args[0] ? convert(args[0], depth + 1) : {} }
      if (name === 'Record') return { type: 'object', additionalProperties: args[1] ? convert(args[1], depth + 1) : {} }
      if (name === 'Partial' && args[0]) {
        // Partial<Alias> becomes its own definition with nothing required.
        if (ts.isTypeReferenceNode(args[0]) && ts.isIdentifier(args[0].typeName) && aliases.has(args[0].typeName.text)) return ref('Partial' + args[0].typeName.text)
        const inner = convert(args[0], depth + 1)
        return { ...inner, required: undefined }
      }
      if (name === 'Snippet' || name === 'Component') return { $comment: 'a Svelte snippet; set it in code' }
      if (aliases.has(name)) return ref(name)
      return {}
    }
    switch (type.kind) {
      case ts.SyntaxKind.StringKeyword: return { type: 'string' }
      case ts.SyntaxKind.NumberKeyword: return { type: 'number' }
      case ts.SyntaxKind.BooleanKeyword: return { type: 'boolean' }
      case ts.SyntaxKind.NullKeyword: return { type: 'null' }
      case ts.SyntaxKind.UnknownKeyword:
      case ts.SyntaxKind.AnyKeyword: return {}
      default: return {}
    }
  }

  function objectSchema(members, depth) {
    const properties = {}
    const required = []
    for (const m of members) {
      if (!ts.isPropertySignature(m) || !m.type) continue
      const key = ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) ? m.name.text : m.name.getText()
      properties[key] = withDoc(convert(m.type, depth + 1), m)
      if (!m.questionToken) required.push(key)
    }
    const out = { type: 'object', properties }
    if (required.length) out.required = required
    return out
  }

  function define(name) {
    if (name.startsWith('Partial') && aliases.has(name.slice(7))) {
      const base = aliases.get(name.slice(7))
      const inner = ts.isTypeLiteralNode(base.type) ? objectSchema(base.type.members, 0) : convert(base.type, 0)
      delete inner.required
      defs[name] = { title: name, description: `${name.slice(7)} with every property optional.`, ...inner }
      return
    }
    const alias = aliases.get(name)
    if (!alias) return
    const type = alias.type
    let schema
    if (ts.isTypeLiteralNode(type)) schema = objectSchema(type.members, 0)
    else if (ts.isIntersectionTypeNode(type)) {
      // Merge object literals and referenced aliases into one property bag.
      schema = { type: 'object', properties: {} }
      for (const part of type.types) {
        const s = ts.isTypeLiteralNode(part) ? objectSchema(part.members, 0) : convert(part, 0)
        if (s.$ref) { const target = s.$ref.split('/').pop(); define(target); Object.assign(schema.properties, defs[target]?.properties ?? {}) }
        else Object.assign(schema.properties, s.properties ?? {})
      }
    } else schema = convert(type, 0)
    defs[name] = { title: name, ...withDoc(schema, alias) }
  }

  define(ROOT_TYPE)
  // Referenced aliases, transitively.
  while (pending.size) {
    const name = [...pending][0]
    pending.delete(name)
    if (!defs[name]) define(name)
  }

  const root = defs[ROOT_TYPE]
  delete defs[ROOT_TYPE]
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${baseUri}/chart-spec.json`,
    ...root,
    $comment: 'Generated from packages/grid/src/chart-types.ts by tools/lib/chart-spec-schema.mjs; do not edit by hand.',
    $defs: defs,
  }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
