/**
 * The generated ChartSpec schema stays true to the code it describes.
 *
 * Three things drift silently: a field added to `ChartSpec` and forgotten in
 * the validator's key list, a chart type added to the union and forgotten in
 * `CHART_TYPES`, and a schema that a real spec no longer satisfies. Each is a
 * cheap set comparison here. The structural validator is deliberately small
 * (types, enums, patterns, required, items, $ref, anyOf), enough to walk the
 * sample specs; it is not a JSON Schema implementation.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildChartSpecSchema } from './lib/chart-spec-schema.mjs'
import { CHART_TYPES, KNOWN_SERIES_KEYS, KNOWN_SPEC_KEYS } from '../packages/grid/src/chart-validate'
import { sampleChartSpec, sampleChartThumb } from '../packages/grid/src/chart-samples'

const ROOT = join(__dirname, '..')
const schema = buildChartSpecSchema(ROOT, 'https://svgrid.com/schemas') as Schema
type Schema = Record<string, any>

/** Validate `value` against `node`, returning the first failure path or null. */
function check(node: Schema, value: unknown, path: string): string | null {
  if (!node || Object.keys(node).length === 0) return null
  if (node.$ref) {
    const name = String(node.$ref).split('/').pop()!
    const target = schema.$defs[name]
    if (!target) return `${path}: dangling $ref ${name}`
    return check(target, value, path)
  }
  if (node.anyOf) {
    const results = (node.anyOf as Schema[]).map((n) => check(n, value, path))
    return results.some((r) => r === null) ? null : `${path}: matches none of ${node.anyOf.length} branches (${results[0]})`
  }
  if ('const' in node) return Object.is(node.const, value) ? null : `${path}: expected ${JSON.stringify(node.const)}`
  if (node.enum && !node.enum.includes(value)) return `${path}: ${JSON.stringify(value)} not in enum`
  if (node.type === 'string') {
    if (typeof value !== 'string') return `${path}: expected string`
    if (node.pattern && !new RegExp(node.pattern).test(value)) return `${path}: "${value}" fails ${node.pattern}`
    return null
  }
  if (node.type === 'number') return typeof value === 'number' ? null : `${path}: expected number`
  if (node.type === 'boolean') return typeof value === 'boolean' ? null : `${path}: expected boolean`
  if (node.type === 'null') return value === null ? null : `${path}: expected null`
  if (node.type === 'array') {
    if (!Array.isArray(value)) return `${path}: expected array`
    if (node.items) for (let i = 0; i < value.length; i += 1) { const r = check(node.items, value[i], `${path}[${i}]`); if (r) return r }
    return null
  }
  if (node.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${path}: expected object`
    const obj = value as Record<string, unknown>
    for (const req of node.required ?? []) if (!(req in obj)) return `${path}: missing ${req}`
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue
      const prop = node.properties?.[k]
      if (prop) { const r = check(prop, v, `${path}.${k}`); if (r) return r }
      else if (node.additionalProperties) { const r = check(node.additionalProperties, v, `${path}.${k}`); if (r) return r }
      else if (node.properties) return `${path}: unknown property ${k}`
    }
    return null
  }
  return null
}

describe('chart-spec.json', () => {
  it('lists the same top-level and series keys the validator knows', () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...KNOWN_SPEC_KEYS].sort())
    expect(Object.keys(schema.$defs.ChartSeries.properties).sort()).toEqual([...KNOWN_SERIES_KEYS].sort())
    expect(schema.required).toEqual(['type', 'categories', 'series'])
  })

  it('lists the same chart types the validator knows', () => {
    expect([...schema.$defs.ChartType.enum].sort()).toEqual([...CHART_TYPES].sort())
  })

  it('keeps the overlay union as a pattern set that reads every overlay string', () => {
    const overlay = schema.$defs.SeriesOverlay
    for (const s of ['linear', 'sma:20', 'ema:7', 'wma:5', 'bb:20:2', 'bb:20:2.5', 'vwap', 'poly:3', 'exp', 'log', 'power']) {
      expect(check(overlay, s, 'overlay'), s).toBeNull()
    }
    expect(check(overlay, 'sma20', 'overlay')).not.toBeNull()
  })

  it('validates every sample spec of every type, full size and thumbnail', () => {
    for (const type of CHART_TYPES) {
      expect(check(schema, JSON.parse(JSON.stringify(sampleChartSpec(type))), type), type).toBeNull()
      expect(check(schema, JSON.parse(JSON.stringify(sampleChartThumb(type))), `${type} thumb`), type).toBeNull()
    }
  })

  it('is the file on disk, in both places', () => {
    const disk = JSON.parse(readFileSync(join(ROOT, 'docs', 'schemas', 'chart-spec.json'), 'utf8'))
    expect(disk).toEqual(JSON.parse(JSON.stringify(schema)))
    const index = JSON.parse(readFileSync(join(ROOT, 'docs', 'schemas', 'index.json'), 'utf8'))
    expect(index.schemas.map((s: { id: string }) => s.id)).toContain('chart-spec')
  })
})
