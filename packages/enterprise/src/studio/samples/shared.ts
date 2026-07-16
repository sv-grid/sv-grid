/**
 * Shared helpers for the curated sample apps. A `SampleApp` is a ready-made
 * `StudioProject` (entities + screens + curated seed + theme) that a user loads
 * to see a beautiful, working multi-entity app in a couple of clicks.
 *
 * Pure + node-safe (studio subtree): each sample is plain data built from the
 * same immutable ops the designer uses, so it round-trips through
 * parse/serialize and generates a runnable app with no special-casing.
 */
import type { EntitySchema } from '../../schema.js'
import type { ChartType } from '@svgrid/grid'
import { generateValue } from '../sample-data.js'
import { defaultBlockConfig, sanitizeProject, screenFromTemplate, type Block, type BlockConfig, type Reduce, type Screen, type ScreenTemplate, type StudioProject, type EntityDataSource } from '../project.js'

type Row = Record<string, unknown>

/**
 * Extend a curated seed to `target` rows so grids scroll and charts / KPIs look
 * substantial (real dashboards have data). The hand-authored rows stay first;
 * extra rows get realistic generated values, valid ids, and foreign keys drawn
 * from `fkPools` (relation field -> list of parent ids).
 */
export function pad(schema: EntitySchema, rows: Row[], target: number, fkPools: Record<string, string[]> = {}): Row[] {
  if (rows.length >= target) return rows
  const pk = schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id'
  const prefix = String(rows[0]?.[pk] ?? 'r').replace(/\d+$/, '') || 'r'
  const out = [...rows]
  for (let i = rows.length; i < target; i++) {
    const row: Row = {}
    for (const f of schema.fields) {
      if (f.field === pk) { row[f.field] = `${prefix}${i + 1}`; continue }
      if (f.type === 'relation') {
        const pool = fkPools[f.field] ?? []
        row[f.field] = pool.length ? pool[i % pool.length] : (rows[i % rows.length]?.[f.field] ?? '')
        continue
      }
      row[f.field] = generateValue(f, i)
    }
    out.push(row)
  }
  return out
}

/** The `id` values of a seed array (for building foreign-key pools). */
export const ids = (rows: Row[]): string[] => rows.map((r) => String(r.id))

/** A ready-made app shown in the gallery. */
export type SampleApp = {
  /** Stable id (also the `--template` value). */
  id: string
  /** Display name, e.g. "CRM". */
  name: string
  /** One-line description for the gallery card. */
  description: string
  /** A single emoji used as the card icon. */
  emoji: string
  /** Accent color (themes the built app). */
  accent: string
  /** Build the full project (fresh each call). */
  build: () => StudioProject
}

/** A dashboard tile spec (KPI, chart, or the grid). */
export type Tile =
  | { kpi: string; measure?: string; reduce: Reduce; span?: 1 | 2 | 3 }
  | { chart: string; measure?: string; reduce?: Reduce; type?: ChartType; span?: 1 | 2 | 3 }
  | { grid: true; span?: 1 | 2 | 3 }

/** Compose a rich dashboard screen from explicit tiles (KPIs + charts + a grid). */
export function dashScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  tiles: Tile[],
): Screen {
  const blocks: Block[] = tiles.map((t, i) => {
    if ('kpi' in t) {
      const config: BlockConfig = { kind: 'kpi', label: t.kpi, ...(t.measure ? { measure: t.measure } : {}), reduce: t.reduce }
      return { id: `kpi-${i + 1}`, span: t.span ?? 1, config }
    }
    if ('chart' in t) {
      const config: BlockConfig = { kind: 'chart', dimension: t.chart, ...(t.measure ? { measure: t.measure } : {}), reduce: t.reduce ?? 'sum', type: t.type ?? 'bar' }
      return { id: `chart-${i + 1}`, span: t.span ?? 2, config }
    }
    return { id: `grid-${i + 1}`, span: t.span ?? 3, config: defaultBlockConfig('grid', entity) }
  })
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

/** Build a screen from a template, then override its id / route / title / nav. */
export function screen(
  entity: EntitySchema,
  template: ScreenTemplate,
  over: { id: string; title: string; route?: string; order: number; child?: EntitySchema; foreignKey?: string },
): Screen {
  const base = screenFromTemplate(entity, template, { child: over.child, foreignKey: over.foreignKey })
  return {
    ...base,
    id: over.id,
    title: over.title,
    route: over.route ?? over.id,
    nav: { show: true, label: over.title, order: over.order },
  }
}

/** Assemble a sample project: entities + screens + per-entity curated seed + theme/shell. */
export function project(opts: {
  title: string
  brand: string
  accent: string
  footer?: string
  navStyle?: 'sidebar' | 'top-nav'
  entities: EntitySchema[]
  screens: Screen[]
  seed: Record<string, Record<string, unknown>[]>
}): StudioProject {
  const dataSources: Record<string, EntityDataSource> = {}
  for (const e of opts.entities) dataSources[e.name] = { kind: 'memory', seed: opts.seed[e.name] ?? [] }
  return sanitizeProject({
    title: opts.title,
    entities: opts.entities,
    screens: opts.screens,
    dataSource: 'memory',
    dataSources,
    theme: { accent: opts.accent, shell: { style: opts.navStyle ?? 'sidebar', brand: opts.brand, footer: opts.footer ?? '', navPosition: 'left' } },
  })
}
