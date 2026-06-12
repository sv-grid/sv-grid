/**
 * Integration tests for the `filterLocale` prop. Mounts a real
 * <SvGrid> with accented data, drives the column-menu filter via
 * `api.setFilter()`, then asserts the visible row count via
 * `api.getDisplayedRows()`.
 *
 * Covers:
 *   - Accent-insensitive `contains` operator on the menu filter
 *   - Diacritic-stripped global filter (via `setGlobalFilter` not in
 *     the public api yet; here we use `api.setFilter('city', ...)`
 *     which exercises the same pipeline)
 *   - filterLocale prop pass-through (es-ES, de-DE)
 *   - Regression: ASCII queries still narrow rows
 */

import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type City = {
  id: number
  city: string
  country: string
  region: 'Europe' | 'Americas' | 'Asia'
  population: number
}

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })

const rows: City[] = [
  { id: 1,  city: 'München',     country: 'Deutschland',  region: 'Europe',   population: 1_510_000 },
  { id: 2,  city: 'Köln',        country: 'Deutschland',  region: 'Europe',   population: 1_080_000 },
  { id: 3,  city: 'Genève',      country: 'Suisse',       region: 'Europe',   population:   203_000 },
  { id: 4,  city: 'Montréal',    country: 'Canada',       region: 'Americas', population: 1_780_000 },
  { id: 5,  city: 'México',      country: 'México',       region: 'Americas', population: 9_210_000 },
  { id: 6,  city: 'São Paulo',   country: 'Brasil',       region: 'Americas', population: 12_330_000 },
  { id: 7,  city: 'Tōkyō',       country: '日本',          region: 'Asia',     population: 13_960_000 },
  { id: 8,  city: 'İstanbul',    country: 'Türkiye',      region: 'Asia',     population: 15_840_000 },
  { id: 9,  city: 'Málaga',      country: 'España',       region: 'Europe',   population:   580_000 },
  { id: 10, city: 'Berlin',      country: 'Deutschland',  region: 'Europe',   population: 3_770_000 },
]

const cols: ColumnDef<typeof features, City>[] = [
  { field: 'city',       header: 'City',       width: 180, editable: false },
  { field: 'country',    header: 'Country',    width: 160, editable: false },
  { field: 'region',     header: 'Region',     width: 110, editable: false },
  { field: 'population', header: 'Population', width: 130, editable: false, align: 'right' },
]

type MountOpts = { filterLocale?: string | ReadonlyArray<string> }

function mountGrid(opts: MountOpts = {}) {
  return new Promise<{
    api: SvGridApi<typeof features, City>
    destroy: () => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: SvGridApi<typeof features, City> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: rows,
        columns: cols,
        features,
        _rowModels: {
          coreRowModel:     createCoreRowModel(),
          filteredRowModel: createFilteredRowModel(),
          sortedRowModel:   createSortedRowModel(sortFns),
        },
        containerHeight: 360,
        virtualization: false,
        columnVirtualization: false,
        showPagination: false,
        showColumnFilters: false,
        showGlobalFilter: false,
        showRowSelection: false,
        filterLocale: opts.filterLocale,
        onApiReady(received: SvGridApi<typeof features, City>) {
          api = received
          res({
            api,
            destroy: () => { unmount(app); target.remove() },
          })
        },
      } as any,
    })
    queueMicrotask(() => { if (!api) rej(new Error('onApiReady never fired')) })
  })
}

const tick = () => new Promise<void>((r) => queueMicrotask(r))

describe('SvGrid filter - default locale (no prop)', () => {
  it('"munch" matches "München" via contains operator', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'contains', value: 'munch' })
      await tick()
      const visible = api.getDisplayedRows()
      expect(visible.map((r) => r.city)).toEqual(['München'])
    } finally { destroy() }
  })

  it('"geneve" matches "Genève"', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'contains', value: 'geneve' })
      await tick()
      const visible = api.getDisplayedRows()
      expect(visible.map((r) => r.city)).toEqual(['Genève'])
    } finally { destroy() }
  })

  it('"sao paulo" matches "São Paulo"', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'contains', value: 'sao paulo' })
      await tick()
      const visible = api.getDisplayedRows()
      expect(visible.map((r) => r.city)).toEqual(['São Paulo'])
    } finally { destroy() }
  })

  it('"tokyo" matches "Tōkyō"', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'contains', value: 'tokyo' })
      await tick()
      const visible = api.getDisplayedRows()
      expect(visible.map((r) => r.city)).toEqual(['Tōkyō'])
    } finally { destroy() }
  })

  it('"istanbul" matches "İstanbul" (dotted-I default folding)', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'contains', value: 'istanbul' })
      await tick()
      const visible = api.getDisplayedRows()
      expect(visible.map((r) => r.city)).toEqual(['İstanbul'])
    } finally { destroy() }
  })

  it('"deutschland" matches all German cities', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('country', { operator: 'contains', value: 'deutschland' })
      await tick()
      const visible = api.getDisplayedRows()
      expect(visible.map((r) => r.city).sort()).toEqual(['Berlin', 'Köln', 'München'])
    } finally { destroy() }
  })
})

describe('SvGrid filter - filterLocale="de-DE"', () => {
  it('explicit German locale - "munchen" still matches "München"', async () => {
    const { api, destroy } = await mountGrid({ filterLocale: 'de-DE' })
    try {
      api.setFilter('city', { operator: 'contains', value: 'munchen' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['München'])
    } finally { destroy() }
  })

  it('"koln" matches "Köln"', async () => {
    const { api, destroy } = await mountGrid({ filterLocale: 'de-DE' })
    try {
      api.setFilter('city', { operator: 'contains', value: 'koln' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['Köln'])
    } finally { destroy() }
  })
})

describe('SvGrid filter - filterLocale="es-ES"', () => {
  it('"mexico" matches "México"', async () => {
    const { api, destroy } = await mountGrid({ filterLocale: 'es-ES' })
    try {
      api.setFilter('city', { operator: 'contains', value: 'mexico' })
      await tick()
      const cities = api.getDisplayedRows().map((r) => r.city)
      expect(cities).toContain('México')
    } finally { destroy() }
  })

  it('"malaga" matches "Málaga"', async () => {
    const { api, destroy } = await mountGrid({ filterLocale: 'es-ES' })
    try {
      api.setFilter('city', { operator: 'contains', value: 'malaga' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['Málaga'])
    } finally { destroy() }
  })
})

describe('SvGrid filter - startsWith + equals operators', () => {
  it('startsWith "mun" matches München', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'startsWith', value: 'mun' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['München'])
    } finally { destroy() }
  })

  it('equals "berlin" matches exactly "Berlin" (case-insensitive)', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'equals', value: 'berlin' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['Berlin'])
    } finally { destroy() }
  })

  it('equals "kolN" matches "Köln" (case + accent insensitive)', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'equals', value: 'kolN' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['Köln'])
    } finally { destroy() }
  })
})

describe('SvGrid filter - clear + compose', () => {
  it('clearFilter removes the narrowing', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('city', { operator: 'contains', value: 'munch' })
      await tick()
      expect(api.getDisplayedRows().length).toBe(1)

      api.clearFilter('city')
      await tick()
      expect(api.getDisplayedRows().length).toBe(rows.length)
    } finally { destroy() }
  })

  it('two column filters compose (AND across columns)', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('country',  { operator: 'contains', value: 'deutschland' })
      api.setFilter('city',     { operator: 'contains', value: 'mun' })
      await tick()
      expect(api.getDisplayedRows().map((r) => r.city)).toEqual(['München'])
    } finally { destroy() }
  })
})
