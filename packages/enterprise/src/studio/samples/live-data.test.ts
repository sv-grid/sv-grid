import { describe, it, expect } from 'vitest'
import { compile } from 'svelte/compiler'
import { liveDataSamples, getLiveDataSample } from './live-data.js'
import { validateProject, parseProject, serializeProject, type EntityDataSource } from '../project.js'
import { emitStudioProject } from '../emit-project.js'

describe('live-data starters', () => {
  it('ships a gallery with unique ids and card metadata', () => {
    expect(liveDataSamples.length).toBeGreaterThanOrEqual(3)
    const ids = liveDataSamples.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of liveDataSamples) {
      expect(s.name).toBeTruthy()
      expect(s.description).toBeTruthy()
      expect(s.emoji).toBeTruthy()
      expect(s.accent).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('getLiveDataSample resolves by id', () => {
    expect(getLiveDataSample('live-northwind-pglite')?.name).toBe('Northwind · Local Postgres')
    expect(getLiveDataSample('nope')).toBeUndefined()
  })

  for (const sample of liveDataSamples) {
    describe(sample.id, () => {
      const project = sample.build()

      it('is a valid project (no errors)', () => {
        const errors = validateProject(project).filter((i) => i.level === 'error')
        expect(errors, JSON.stringify(errors)).toHaveLength(0)
      })

      it('binds every entity to a REAL source (never memory)', () => {
        expect(project.entities.length).toBeGreaterThanOrEqual(1)
        for (const e of project.entities) {
          const src = project.dataSources?.[e.name] as EntityDataSource | undefined
          expect(src, `${e.name}: no source`).toBeTruthy()
          expect(src!.kind).not.toBe('memory')
        }
      })

      it('round-trips through parse/serialize', () => {
        const again = parseProject(serializeProject(project))
        expect(again.entities.map((e) => e.name)).toEqual(project.entities.map((e) => e.name))
        expect(again.dataSources).toEqual(project.dataSources)
      })

      it('generates compiling Svelte pages', () => {
        const files = emitStudioProject(project)
        for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
          expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
        }
      })
    })
  }

  it('every starter is a real app: a dashboard, a detail page, and drill-through', () => {
    for (const s of liveDataSamples) {
      const blocks = s.build().screens.flatMap((sc) => sc.blocks)
      expect(blocks.some((b) => b.config.kind === 'kpi'), `${s.id}: no dashboard KPIs`).toBe(true)
      const all = emitStudioProject(s.build()).map((f) => f.contents).join('\n')
      expect(all.includes('SvRecordDetail'), `${s.id}: no detail page`).toBe(true)
      expect(all.includes('import { goto }'), `${s.id}: no drill-through`).toBe(true)
      expect(all.includes("selectedId={$page.url.searchParams.get('id')"), `${s.id}: detail not URL-addressable`).toBe(true)
    }
  })

  it('the Northwind (Supabase) detail timelines match the denormalized view by name/company', () => {
    const all = emitStudioProject(getLiveDataSample('live-northwind-supabase')!.build()).map((f) => f.contents).join('\n')
    expect(all).toContain('parentField: "name"')    // product -> order_lines by product name
    expect(all).toContain('parentField: "company"') // customer -> order_lines by company
  })

  it('PGlite starter generates embedded Postgres bootstrap + seeded rows', () => {
    const data = emitStudioProject(getLiveDataSample('live-northwind-pglite')!.build()).find((f) => f.path.endsWith('src/lib/data.ts'))!.contents
    expect(data).toContain("import { PGlite } from '@electric-sql/pglite'")
    expect(data).toContain('createSqlDataSource')
    expect(data).toContain('Chai') // a curated seed row is baked in
  })

  it('Supabase starter generates a client bound to the hosted sample', () => {
    const files = emitStudioProject(getLiveDataSample('live-northwind-supabase')!.build())
    const conn = files.find((f) => f.path.endsWith('src/lib/connections.ts'))!.contents
    expect(conn).toContain('rbnnlzgtfzsylllniozo.supabase.co')
    expect(conn).toContain('createClient')
    const data = files.find((f) => f.path.endsWith('src/lib/data.ts'))!.contents
    expect(data).toContain('createSupabaseDataSource')
    expect(data).toContain("table: 'order_lines'")
  })

  it('REST starter generates createRestDataSource against DummyJSON', () => {
    const data = emitStudioProject(getLiveDataSample('live-dummyjson-rest')!.build()).find((f) => f.path.endsWith('src/lib/data.ts'))!.contents
    expect(data).toContain('createRestDataSource')
    expect(data).toContain('dummyjson.com/products')
    expect(data).toContain('dummyJsonAdapter') // real server paging via the adapter (skip/limit/sortBy)
    expect(data).not.toContain('body?.products') // adapter unwraps { products, total }, no manual parse
  })
})
