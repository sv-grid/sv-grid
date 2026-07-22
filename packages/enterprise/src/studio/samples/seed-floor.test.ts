import { describe, it, expect } from 'vitest'
import { sampleApps } from './index.js'

/**
 * A seed-density floor: every sample app must ship enough rows that its grids
 * scroll and its charts / KPIs look substantial (a dashboard with 6 rows reads
 * as unfinished). Guards against a sample regressing to a sparse curated seed.
 */
describe('sample seed density', () => {
  const FLOOR = 40 // total curated/padded rows across all entities
  const PRIMARY_FLOOR = 30 // the largest entity (the "fact" table) should scroll

  for (const app of sampleApps) {
    it(`${app.id} ships >= ${FLOOR} rows (largest entity >= ${PRIMARY_FLOOR})`, () => {
      const p = app.build()
      const counts = p.entities.map((e) => {
        const src = p.dataSources?.[e.name] as { seed?: unknown[] } | undefined
        return src?.seed?.length ?? 0
      })
      const total = counts.reduce((a, b) => a + b, 0)
      expect(total, `${app.id}: only ${total} rows`).toBeGreaterThanOrEqual(FLOOR)
      expect(Math.max(...counts), `${app.id}: largest entity too small`).toBeGreaterThanOrEqual(PRIMARY_FLOOR)
    })
  }
})
