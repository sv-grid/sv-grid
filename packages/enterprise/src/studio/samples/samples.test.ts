import { describe, it, expect } from 'vitest'
import { compile } from 'svelte/compiler'
import { sampleApps, getSampleApp } from './index.js'
import { starterProject } from './starter.js'
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

  it('every app has a distinct visual identity (unique design-system preset)', () => {
    const presets = sampleApps.map((s) => s.build().theme?.preset)
    expect(presets.every(Boolean), 'an app is missing a theme preset').toBe(true)
    // Distinct presets => each app reads as its own product, not a recolored sibling.
    expect(new Set(presets).size, 'preset ids are not unique across apps').toBe(sampleApps.length)
  })

  it('ships a mix of dark-mode and top-nav apps for visual variety', () => {
    const themes = sampleApps.map((s) => s.build().theme)
    expect(themes.filter((t) => t?.mode === 'dark').length).toBeGreaterThanOrEqual(3)
    expect(themes.filter((t) => t?.shell?.style === 'top-nav').length).toBeGreaterThanOrEqual(3)
  })

  it('generated apps ship an app-chrome toolbar with a working quick screen-search', () => {
    const layout = emitStudioProject(getSampleApp('crm')!.build()).find((f) => f.path.endsWith('+layout.svelte'))!.contents
    expect(layout).toContain('sv-app__toolbar')
    expect(layout).toContain('sv-app__search-in')
    // The search is functional: a derived filter over the nav screens.
    expect(layout).toContain('const results = $derived')
    expect(layout).toContain('sv-app__avatar')
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

  // Wave 1: these apps get the full editor treatment (rich form controls +
  // validation + computed fields). Guards against a regression that flattens a
  // sample back to plain text/number fields.
  // Every shipped sample now gets the full editor treatment. This guards against
  // any app being flattened back to plain text/number fields.
  const RICH_EDITOR_TYPES = new Set(['phone', 'country', 'mask', 'slider', 'rating', 'chips', 'color', 'datetime', 'password'])
  for (const id of sampleApps.map((s) => s.id)) {
    describe(`${id} (rich editors)`, () => {
      const project = getSampleApp(id)!.build()
      const allFields = project.entities.flatMap((e) => e.fields)

      it('uses several rich form editors', () => {
        const used = new Set(allFields.map((f) => f.input?.editorType).filter((t): t is string => !!t && RICH_EDITOR_TYPES.has(t)))
        expect(used.size, [...used].join(',')).toBeGreaterThanOrEqual(4)
      })

      it('adds real validation + a computed field', () => {
        expect(allFields.some((f) => f.required)).toBe(true)
        expect(allFields.some((f) => typeof f.min === 'number' || typeof f.max === 'number')).toBe(true)
        expect(allFields.some((f) => f.formula || f.computed)).toBe(true)
      })

      it('serializes editorType into the generated schema (so the edit panel renders them)', () => {
        const files = emitStudioProject(project)
        const schema = files.find((f) => f.path.endsWith('src/lib/schemas.ts'))!.contents
        expect(schema).toContain('editorType')
        // The computed formula compiles into a runtime `computed` assignment.
        expect(schema).toMatch(/\.computed = \(row\)/)
      })
    })
  }

  // Flagships reworked into enterprise layouts: they must use the full visual
  // palette (KPI cards + gauge + pivot + tabs) and a status-pill grid, not just
  // "3 KPIs + bar + pie + grid".
  const flatKinds = (p: ReturnType<(typeof sampleApps)[number]['build']>): Set<string> => {
    const kinds = new Set<string>()
    for (const s of p.screens) for (const b of s.blocks) kinds.add(b.config.kind)
    return kinds
  }
  // EVERY shipped app must now be an enterprise layout, not just the flagships.
  for (const id of sampleApps.map((s) => s.id)) {
    describe(`${id} (enterprise layout)`, () => {
      const project = getSampleApp(id)!.build()
      it('uses gauge + pivot + tabs + kpi + chart blocks', () => {
        const kinds = flatKinds(project)
        for (const k of ['kpi', 'chart', 'gauge', 'pivot', 'tabs']) expect(kinds.has(k), `${id}: missing ${k}`).toBe(true)
      })
      it('has a KPI card with a sparkline trend or target', () => {
        const kpis = project.screens.flatMap((s) => s.blocks).filter((b) => b.config.kind === 'kpi')
        expect(kpis.some((b) => (b.config as { trendField?: string }).trendField || (b.config as { target?: number }).target != null)).toBe(true)
      })
      it('has a grid with conditional-format status pills', () => {
        const grids = project.screens.flatMap((s) => s.blocks).filter((b) => b.config.kind === 'grid')
        expect(grids.some((b) => ((b.config as { formatRules?: unknown[] }).formatRules?.length ?? 0) > 0)).toBe(true)
      })
      it('generated app imports SvGauge, SvPivotDesigner, SvTabs + an enhanced KPI card', () => {
        const all = emitStudioProject(project).map((f) => f.contents).join('\n')
        for (const c of ['SvGauge', 'SvPivotDesigner', 'SvTabs']) expect(all.includes(c), `${id}: missing ${c}`).toBe(true)
        // A sparkline (trendField) or a "% of target" delta chip - either enhances the card.
        expect(all.includes('kpi__spark') || all.includes('kpi__delta'), `${id}: no enhanced KPI card`).toBe(true)
      })
    })
  }

  describe('signature views', () => {
    it('CRM Deal 360 emits SvRecordDetail with a resolved relation subtitle + a related timeline', () => {
      const project = getSampleApp('crm')!.build()
      const detail = project.screens.flatMap((s) => s.blocks).find((b) => b.config.kind === 'detail')
      expect(detail, 'crm: no detail block').toBeTruthy()
      const all = emitStudioProject(project).map((f) => f.contents).join('\n')
      expect(all.includes('SvRecordDetail')).toBe(true)
      const tag = all.match(/<SvRecordDetail[\s\S]*?\/>/)![0]
      // The companyId relation subtitle resolves to the denormalized display column.
      expect(tag).toContain('subtitleField="company"')
      // The Activities related tab loads the child table and filters by the FK.
      expect(tag).toContain('related={[')
      expect(tag).toContain('foreignKey: "dealId"')
      expect(all).toContain('load_md_activities_rows')
    })

    it('EVERY app has a detail page that emits SvRecordDetail reading ?id from the URL', () => {
      for (const s of sampleApps) {
        const project = s.build()
        const detail = project.screens.flatMap((sc) => sc.blocks).find((b) => b.config.kind === 'detail')
        expect(detail, `${s.id}: no detail block`).toBeTruthy()
        const all = emitStudioProject(project).map((f) => f.contents).join('\n')
        expect(all.includes('SvRecordDetail'), `${s.id}: no SvRecordDetail`).toBe(true)
        expect(all.includes("selectedId={$page.url.searchParams.get('id')"), `${s.id}: detail not URL-addressable`).toBe(true)
      }
    })

    it('EVERY app connects a view to its detail page (grid rowLink / board / calendar / master-detail drill)', () => {
      for (const s of sampleApps) {
        const detailIds = new Set(s.build().screens.filter((sc) => sc.blocks.some((b) => b.config.kind === 'detail')).map((sc) => sc.id))
        const drills = s.build().screens.flatMap((sc) => sc.blocks).some((b) =>
          (b.config.kind === 'grid' && b.config.rowLink && detailIds.has(b.config.rowLink.screen)) ||
          ((b.config.kind === 'board' || b.config.kind === 'calendar') && b.config.openScreen != null && detailIds.has(b.config.openScreen)) ||
          (b.config.kind === 'master-detail' && b.config.linkScreen != null && detailIds.has(b.config.linkScreen)))
        expect(drills, `${s.id}: nothing drills into its detail page`).toBe(true)
        // And the generated app actually navigates there.
        const all = emitStudioProject(s.build()).map((f) => f.contents).join('\n')
        expect(all.includes("import { goto }"), `${s.id}: no goto for drill-through`).toBe(true)
      }
    })

    it('child relation title fields on detail timelines resolve to display columns', () => {
      // clinic appointments titled by doctorId -> doctor; fleet trips by driverId -> driver.
      for (const [id, title] of Object.entries({ clinic: 'doctor', fleet: 'driver' })) {
        const all = emitStudioProject(getSampleApp(id)!.build()).map((f) => f.contents).join('\n')
        const rel = all.match(/related=\{\[[\s\S]*?\]\}/)![0]
        expect(rel, `${id}: child title not resolved`).toContain(`titleField: "${title}"`)
      }
    })

    it('scheduler apps resolve relation title + resource fields to their display columns', () => {
      // The scheduler grid view carries titleField + resourceField in the `scheduler={{ ... }}`
      // config; relation FKs resolve to their display columns (classId -> class, etc.).
      const cases: Record<string, { title: string; resource?: string }> = {
        clinic: { title: 'patient', resource: 'doctor' },
        gym: { title: 'member', resource: 'class' },
        restaurant: { title: 'name', resource: 'table' }, // title is a plain text field
        fleet: { title: 'driver', resource: 'vehicle' },
      }
      for (const [id, { title, resource }] of Object.entries(cases)) {
        const all = emitStudioProject(getSampleApp(id)!.build()).map((f) => f.contents).join('\n')
        const tag = all.match(/scheduler=\{\{[\s\S]*?\}\}/)![0]
        expect(tag, `${id}: schedule title not resolved`).toContain(`titleField: '${title}'`)
        if (resource) expect(tag, `${id}: resource not resolved`).toContain(`resourceField: '${resource}'`)
      }
    })
  })
})

describe('starter project (fresh `svgrid-studio designer` session)', () => {
  const project = starterProject()

  it('is a valid, multi-page CRM (dashboard + CRUD + board + calendar + forecast) with seeded rows', () => {
    expect(validateProject(project).filter((i) => i.level === 'error')).toHaveLength(0)
    expect(project.entities.map((e) => e.name)).toEqual(['customers', 'deals'])
    // Several pages, so the first-run app is a real app, not a lone table.
    const ids = project.screens.map((s) => s.id)
    expect(ids).toEqual(['overview', 'customers', 'pipeline', 'deals', 'calendar', 'forecast'])
    // A range of block kinds across the app (the "wow" surface).
    const kinds = new Set(project.screens.flatMap((s) => s.blocks.map((b) => b.config.kind)))
    for (const k of ['kpi', 'chart', 'pivot', 'grid', 'board', 'calendar']) expect(kinds.has(k as never), `missing ${k}`).toBe(true)
    for (const e of ['customers', 'deals']) {
      const seed = (project.dataSources?.[e] as { seed?: unknown[] } | undefined)?.seed
      expect(seed?.length ?? 0, `${e} seed`).toBeGreaterThanOrEqual(10)
    }
  })

  it('the Customers page turns on the enterprise-grade grid surface (filter + export + pills + row actions)', () => {
    const screen = project.screens.find((s) => s.id === 'customers')!
    const grid = screen.blocks.find((b) => b.config.kind === 'grid')!.config as Record<string, unknown>
    expect(screen.blocks.some((b) => b.config.kind === 'filter')).toBe(true)
    expect(grid.filterable).toBe(true)
    expect(grid.export).toEqual({ csv: true, json: true, copy: true })
    expect(grid.rowSummaries).toBe(true)
    expect((grid.rowActions as unknown[])?.length).toBeGreaterThan(0)
    // status / industry / plan render as colored chips (editorType 'list' on the enum fields).
    const cust = project.entities.find((e) => e.name === 'customers')!
    for (const f of ['status', 'industry', 'plan']) {
      expect(cust.fields.find((x) => x.field === f)?.input?.editorType, `${f} chip`).toBe('list')
    }
  })

  it('generates enterprise-wired, compiling code with a visible export toolbar', () => {
    const files = emitStudioProject(project)
    const customersPage = files.find((f) => f.path.endsWith('customers/+page.svelte'))!.contents
    expect(customersPage).toContain('@svgrid/enterprise')
    expect(customersPage).toContain('exportCsv') // export toolbar wired to the grid api
    // Every generated screen compiles (dashboard, board, calendar, forecast, ...).
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('round-trips through parse/serialize', () => {
    const again = parseProject(serializeProject(project))
    expect(again.entities.map((e) => e.name)).toEqual(project.entities.map((e) => e.name))
    expect(again.dataSources).toEqual(project.dataSources)
  })
})
