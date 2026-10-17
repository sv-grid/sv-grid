// The hosted MCP usage report: the SQL reads the columns the worker writes,
// and the rendering survives empty sections and multi-rule rows.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { queries, countRules, render } from './mcp-report.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('mcp-report', () => {
  it('reads the dataset the worker binds', () => {
    const toml = readFileSync(join(ROOT, 'workers', 'svgrid-mcp', 'wrangler.toml'), 'utf8')
    expect(toml).toMatch(/dataset = "svgrid_mcp"/)
    for (const sql of Object.values(queries(7)) as string[]) {
      expect(sql).toContain('FROM svgrid_mcp')
      expect(sql).toContain("INTERVAL '7' DAY")
    }
  })

  it('counts each rule in a row that lists several', () => {
    expect(
      countRules([
        { rules: 'svgrid/renamed-prop,svgrid/unknown-import', calls: '3' },
        { rules: 'svgrid/renamed-prop', calls: 2 },
      ]),
    ).toEqual([
      ['svgrid/renamed-prop', 5],
      ['svgrid/unknown-import', 3],
    ])
  })

  it('renders every section, empty ones included', () => {
    const md = render(7, {
      tools: [{ tool: 'search', calls: 10, errors: 0 }],
      searches: [{ query: 'pivot | table', calls: 4 }],
      unanswered: [],
      paid: [{ tool: 'fetch', query: '', id: 'demo:52-pivot-table', calls: 2 }],
      reads: [],
      rules: [],
    })
    expect(md).toContain('# Hosted MCP usage, last 7 days')
    expect(md).toContain('| pivot \\| table | 4 |')
    expect(md).toContain('| fetch | demo:52-pivot-table | 2 |')
    expect(md.match(/_None\._/g)).toHaveLength(3)
  })
})
