import { describe, it, expect } from 'vitest'
import { starterDatasets, getStarterDataset } from './datasets.js'
import { crudAppFromSchemas } from '../screen-suites.js'
import { validateProject, parseProject, serializeProject } from '../project.js'

describe('starter datasets', () => {
  it('ships a picker-ready gallery with unique ids', () => {
    expect(starterDatasets.length).toBeGreaterThanOrEqual(4)
    const ids = starterDatasets.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of starterDatasets) {
      expect(d.name).toBeTruthy()
      expect(d.description).toBeTruthy()
      expect(d.emoji).toBeTruthy()
    }
  })

  it('getStarterDataset resolves by id', () => {
    expect(getStarterDataset('customers-orders')?.name).toBe('Customers & orders')
    expect(getStarterDataset('nope')).toBeUndefined()
  })

  it('build() returns fresh data each call (never a shared mutable seed)', () => {
    const dataset = starterDatasets[0]!
    const a = dataset.build()
    const b = dataset.build()
    expect(a).toEqual(b)
    expect(a.seed).not.toBe(b.seed)
    expect(a.entities[0]).not.toBe(b.entities[0])
  })

  for (const dataset of starterDatasets) {
    describe(dataset.id, () => {
      const { entities, seed } = dataset.build()

      it('pairs a parent and a child linked by a real relation', () => {
        expect(entities).toHaveLength(2)
        const names = new Set(entities.map((e) => e.name))
        const relations = entities.flatMap((e) => e.fields.filter((f) => f.type === 'relation'))
        expect(relations.length).toBeGreaterThanOrEqual(1)
        for (const r of relations) expect(names.has(r.relation!.entity)).toBe(true)
      })

      it('has a colored enum (so the generated app gets status pills and a chart)', () => {
        const colored = entities.flatMap((e) => e.fields).filter((f) => f.type === 'enum' && f.options?.some((o) => o.color))
        expect(colored.length).toBeGreaterThanOrEqual(1)
      })

      it('seeds every entity with enough rows to scroll', () => {
        for (const e of entities) {
          expect(seed[e.name], `${e.name} has no seed`).toBeTruthy()
          expect(seed[e.name]!.length).toBeGreaterThanOrEqual(10)
        }
      })

      it('seed rows carry unique ids and resolvable foreign keys', () => {
        for (const e of entities) {
          const pk = e.idField ?? 'id'
          const values = seed[e.name]!.map((r) => r[pk])
          expect(values.every((v) => v != null && v !== '')).toBe(true)
          expect(new Set(values).size).toBe(values.length)
        }
        for (const child of entities) {
          for (const f of child.fields) {
            if (f.type !== 'relation') continue
            const parent = entities.find((e) => e.name === f.relation!.entity)!
            const parentPk = parent.idField ?? 'id'
            const pool = new Set(seed[parent.name]!.map((r) => String(r[parentPk])))
            for (const row of seed[child.name]!) {
              expect(pool.has(String(row[f.field])), `${child.name}.${f.field} -> ${row[f.field]}`).toBe(true)
            }
          }
        }
      })

      it('generates a valid app through crudAppFromSchemas', () => {
        const app = crudAppFromSchemas(entities, { title: dataset.name, seed })
        expect(validateProject(app).filter((i) => i.level === 'error')).toEqual([])
        expect(app.screens.length).toBeGreaterThanOrEqual(3)
        expect(parseProject(serializeProject(app))).toEqual(app)
      })
    })
  }
})
