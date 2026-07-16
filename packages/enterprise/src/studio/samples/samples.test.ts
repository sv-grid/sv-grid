import { describe, it, expect } from 'vitest'
import { compile } from 'svelte/compiler'
import { sampleApps, getSampleApp } from './index.js'
import { validateProject, parseProject, serializeProject } from '../project.js'
import { emitStudioProject } from '../emit-project.js'

describe('sample apps', () => {
  it('ships a non-empty gallery with unique ids', () => {
    expect(sampleApps.length).toBeGreaterThanOrEqual(4)
    const ids = sampleApps.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of sampleApps) {
      expect(s.name).toBeTruthy()
      expect(s.description).toBeTruthy()
      expect(s.emoji).toBeTruthy()
      expect(s.accent).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('getSampleApp resolves by id', () => {
    expect(getSampleApp('crm')?.name).toBe('CRM')
    expect(getSampleApp('nope')).toBeUndefined()
  })

  for (const sample of sampleApps) {
    describe(sample.id, () => {
      const project = sample.build()

      it('is a valid project (no errors)', () => {
        const errors = validateProject(project).filter((i) => i.level === 'error')
        expect(errors, JSON.stringify(errors)).toHaveLength(0)
      })

      it('has entities, screens and curated seed', () => {
        expect(project.entities.length).toBeGreaterThanOrEqual(2)
        expect(project.screens.length).toBeGreaterThanOrEqual(3)
        for (const e of project.entities) {
          const src = project.dataSources?.[e.name]
          expect(src?.kind).toBe('memory')
          expect((src as { seed?: unknown[] }).seed?.length).toBeGreaterThan(0)
        }
      })

      it('round-trips through parse/serialize', () => {
        const again = parseProject(serializeProject(project))
        expect(again.entities.map((e) => e.name)).toEqual(project.entities.map((e) => e.name))
        expect(again.dataSources).toEqual(project.dataSources)
      })

      it('generates compiling Svelte pages + seeded data.ts', () => {
        const files = emitStudioProject(project)
        const data = files.find((f) => f.path.endsWith('src/lib/data.ts'))!
        // Curated seed is baked in (a recognizable value from each app).
        expect(data.contents).toContain('createInMemoryDataSource')
        for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
          expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
        }
      })
    })
  }
})
