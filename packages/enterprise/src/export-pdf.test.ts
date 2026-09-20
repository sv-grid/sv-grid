import { describe, expect, it } from 'vitest'
import { buildPdfDocDefinition, cssColorToHex, hexLuminance, readGridPdfTheme, registerPdfFonts, resolvePdfCharts, resolvePdfVfs } from './export-pdf'

const columns = [
  { header: 'Company', align: 'left' as const },
  { header: 'Price', align: 'right' as const },
]
const rows = [
  ['ACME', '$19.95'],
  ['Globex', '$1,000.00'],
  ['Initech', '$42.00'],
]
const now = new Date('2026-07-10T12:00:00Z')

describe('buildPdfDocDefinition', () => {
  it('builds a table with a bold, filled, repeated header row', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    const table = (def.content.at(-1) as any).table
    expect(table.headerRows).toBe(1)
    expect(table.body).toHaveLength(4) // header + 3 rows
    const header = table.body[0]
    expect(header[0]).toMatchObject({ text: 'Company', bold: true, fillColor: '#334155' })
    expect(header[1].alignment).toBe('right')
  })

  it('carries per-column alignment into body cells', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    const table = (def.content.at(-1) as any).table
    expect(table.body[1][0]).toMatchObject({ text: 'ACME', alignment: 'left' })
    expect(table.body[1][1]).toMatchObject({ text: '$19.95', alignment: 'right' })
  })

  it('zebra-stripes even body rows but not the header', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    const layout = (def.content.at(-1) as any).layout
    expect(layout.fillColor(0)).toBeNull() // header
    expect(layout.fillColor(1)).toBeNull() // odd body row
    expect(layout.fillColor(2)).toBe('#f1f5f9') // even body row
  })

  it('defaults A4 portrait, auto-landscape for wide grids', () => {
    const narrow = buildPdfDocDefinition({ columns, rows, now })
    expect(narrow.pageSize).toBe('A4')
    expect(narrow.pageOrientation).toBe('portrait')

    const wideCols = Array.from({ length: 10 }, (_, i) => ({ header: `C${i}` }))
    const wide = buildPdfDocDefinition({ columns: wideCols, rows: [], now })
    expect(wide.pageOrientation).toBe('landscape')

    const forced = buildPdfDocDefinition({ columns: wideCols, rows: [], opts: { pageOrientation: 'portrait' }, now })
    expect(forced.pageOrientation).toBe('portrait')
  })

  it('renders title / subtitle / logo before the table', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      opts: { title: 'Orders', subtitle: 'Q3', logo: 'data:image/png;base64,AAAA' },
      now,
    })
    expect((def.content[0] as any).image).toBe('data:image/png;base64,AAAA')
    expect((def.content[1] as any).text).toBe('Orders')
    expect((def.content[2] as any).text).toBe('Q3')
  })

  it('emits a "Page X of Y" + date footer by default, suppressible', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    expect(def.footer).toBeTypeOf('function')
    const footer = def.footer!(2, 5) as any
    expect(footer.columns[0].text).toBe('2026-07-10')
    expect(footer.columns[1].text).toBe('Page 2 of 5')

    const noFooter = buildPdfDocDefinition({ columns, rows, opts: { showPageNumbers: false }, now })
    expect(noFooter.footer).toBeUndefined()
  })

  it('renders a structured body with group + subtotal rows', () => {
    const def = buildPdfDocDefinition({
      columns,
      body: [
        { kind: 'group', label: 'Region: North (2)', level: 0 },
        { kind: 'data', cells: ['ACME', '$19.95'] },
        { kind: 'data', cells: ['Globex', '$1,000.00'] },
        { kind: 'subtotal', cells: ['Subtotal', '$1,019.95'] },
      ],
      now,
    })
    const table = (def.content.at(-1) as any).table
    expect(table.body).toHaveLength(5) // header + group + 2 data + subtotal
    // Group header spans all columns, bold + filled.
    expect(table.body[1][0]).toMatchObject({ text: 'Region: North (2)', colSpan: 2, bold: true })
    // Subtotal row is bold + filled.
    expect(table.body[4][1]).toMatchObject({ text: '$1,019.95', bold: true, fillColor: '#f8fafc' })
    // Zebra only stripes plain data rows, never group / subtotal.
    const layout = (def.content.at(-1) as any).layout
    expect(layout.fillColor(1)).toBeNull() // group row
    expect(layout.fillColor(4)).toBeNull() // subtotal row
  })

  it('applies dataCellStyle (conditional formatting) to data cells only', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      dataCellStyle: (r, c) =>
        r === 0 && c === 1 ? { fill: '#fee2e2', color: '#991b1b', bold: true } : undefined,
      now,
    })
    const table = (def.content.at(-1) as any).table
    expect(table.body[1][1]).toMatchObject({ fillColor: '#fee2e2', color: '#991b1b', bold: true })
    expect(table.body[2][1].fillColor).toBeUndefined() // other cells untouched
  })

  it('adds a hyperlink to a data cell', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      dataCellLink: (r, c) => (r === 0 && c === 0 ? 'https://x.test' : undefined),
      now,
    })
    const table = (def.content.at(-1) as any).table
    expect(table.body[1][0]).toMatchObject({ link: 'https://x.test', decoration: 'underline' })
    expect(table.body[2][0].link).toBeUndefined()
  })

  it('honors explicit column widths + margins + theme colors', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      opts: { columnWidths: [80, '*'], margins: [10, 10, 10, 10], headerColor: '#111827', zebra: false },
      now,
    })
    const table = (def.content[0] as any).table
    expect(table.widths).toEqual([80, '*'])
    expect(def.pageMargins).toEqual([10, 10, 10, 10])
    expect(table.body[0][0].fillColor).toBe('#111827')
    expect((def.content[0] as any).layout.fillColor(2)).toBeNull() // zebra off
  })

  it('applies the blanket styles: header, rows, zebra, and A1 cell overrides', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      styles: {
        headerRow: { backgroundColor: '#0f766e', color: '#ecfeff', fontSize: 10, textAlign: 'center' },
        rows: { color: '#1e293b', fontStyle: 'italic', fontWeight: 'bold' },
        rowAlternate: { backgroundColor: '#fefce8', color: '#713f12' },
        cells: { B3: { backgroundColor: '#fee2e2', fontWeight: 700 }, A1: { color: '#ff0000' } },
      },
      now,
    })
    const t = def.content[0] as any
    const header = t.table.body[0]
    expect(header[0]).toMatchObject({ fillColor: '#0f766e', color: '#ff0000', fontSize: 10, alignment: 'center', bold: true })
    expect(header[1].color).toBe('#ecfeff')
    // Data rows: the blanket colour and weight, the alternate text colour on odd rows.
    expect(t.table.body[1][0]).toMatchObject({ color: '#1e293b', italics: true, bold: true })
    expect(t.table.body[2][0].color).toBe('#713f12')
    expect(t.layout.fillColor(2)).toBe('#fefce8')
    // B3 is the second data row, second column.
    expect(t.table.body[2][1]).toMatchObject({ fillColor: '#fee2e2', bold: true })
  })

  it('takes explicit pdf colours over styles over the grid theme over the defaults', () => {
    const theme = {
      headerColor: '#123456', headerTextColor: '#abcdef', textColor: '#222222', zebraColor: '#eeeeee', borderColor: '#cccccc',
    }
    const themed = buildPdfDocDefinition({ columns, rows, theme, now }).content[0] as any
    expect(themed.table.body[0][0]).toMatchObject({ fillColor: '#123456', color: '#abcdef' })
    expect(themed.table.body[1][0].color).toBe('#222222')
    expect(themed.layout.fillColor(2)).toBe('#eeeeee')
    expect(themed.layout.hLineColor()).toBe('#cccccc')

    const layered = buildPdfDocDefinition({
      columns,
      rows,
      theme,
      styles: { headerRow: { backgroundColor: '#654321' }, rowAlternate: { backgroundColor: '#dddddd' } },
      opts: { headerColor: '#000000' },
      now,
    }).content[0] as any
    expect(layered.table.body[0][0].fillColor).toBe('#000000') // pdf option
    expect(layered.layout.fillColor(2)).toBe('#dddddd') // styles over theme
    expect(layered.table.body[1][0].color).toBe('#222222') // theme where nothing else says
  })

  it('prints header and footer lines around the table, and merges data cells', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      headerLines: [{ text: 'Quarterly report', style: { fontWeight: 'bold', fontSize: 12 } }, { left: 'ACME', right: 'Q3' }],
      footerLines: [{ image: 'data:image/png;base64,AAAA', width: 40 }],
      merges: [{ row: 0, col: 0, colSpan: 2 }, { row: 1, col: 1, rowSpan: 2 }],
      opts: { showPageNumbers: false },
      now,
    })
    const c = def.content as any[]
    expect(c[0]).toMatchObject({ text: 'Quarterly report', bold: true, fontSize: 12 })
    expect(c[1].columns.map((x: any) => x.text)).toEqual(['ACME', '', 'Q3'])
    expect(c.at(-1)).toMatchObject({ image: 'data:image/png;base64,AAAA', width: 40 })
    const body = c.find((x) => x.table).table.body
    expect(body[1][0].colSpan).toBe(2)
    expect(body[1][1].text).toBe('')
    expect(body[2][1].rowSpan).toBe(2)
    expect(body[3][1].text).toBe('')
  })

  it('leaves merges alone under a structured body', () => {
    const def = buildPdfDocDefinition({
      columns,
      body: [{ kind: 'group', label: 'A' }, { kind: 'data', cells: ['ACME', '1'] }, { kind: 'data', cells: ['Globex', '2'] }],
      merges: [{ row: 0, col: 0, rowSpan: 2 }],
      now,
    })
    const body = (def.content[0] as any).table.body
    expect(body[2][0].rowSpan).toBeUndefined()
  })
})

describe('the grid theme', () => {
  it('converts css colours and measures luminance', () => {
    expect(cssColorToHex('rgb(51, 65, 85)')).toBe('#334155')
    expect(cssColorToHex('rgba(0, 0, 0, 0)')).toBeNull()
    expect(cssColorToHex('#fff')).toBe('#ffffff')
    expect(cssColorToHex('transparent')).toBeNull()
    expect(hexLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(hexLuminance('#000000')).toBe(0)
  })

  it('reads the header, text, stripe and line colours off a mounted grid, header only under a dark theme', () => {
    const root = document.createElement('div')
    root.className = 'sv-grid-root'
    root.innerHTML = [
      '<div class="sv-grid-container" style="background-color: rgb(255, 255, 255)">',
      '<table><thead class="sv-grid-head"><tr><th class="sv-grid-column" style="background-color: rgb(241, 245, 249); color: rgb(15, 23, 42)"><div class="sv-grid-header-cell">A</div></th></tr></thead>',
      '<tbody class="sv-grid-body"><tr class="sv-grid-row"><td class="sv-grid-cell sv-grid-row-number-cell" style="color: rgb(148, 163, 184)">1</td><td class="sv-grid-cell" style="color: rgb(30, 41, 59); border-bottom-color: rgb(226, 232, 240); border-bottom-style: solid">1</td></tr>',
      '<tr class="sv-grid-row sv-grid-row-alt"><td class="sv-grid-cell sv-grid-row-number-cell">2</td><td class="sv-grid-cell" style="background-color: rgb(248, 250, 252)">2</td></tr></tbody></table></div>',
    ].join('')
    document.body.appendChild(root)
    expect(readGridPdfTheme(root)).toEqual({
      headerColor: '#f1f5f9',
      headerTextColor: '#0f172a',
      textColor: '#1e293b',
      borderColor: '#e2e8f0',
      zebraColor: '#f8fafc',
    })
    root.querySelector<HTMLElement>('.sv-grid-container')!.style.backgroundColor = 'rgb(15, 23, 42)'
    expect(readGridPdfTheme(root)).toEqual({ headerColor: '#f1f5f9', headerTextColor: '#0f172a' })
    // A dark page under an unpainted grid, and light text on its own, read as dark too.
    root.querySelector<HTMLElement>('.sv-grid-container')!.style.backgroundColor = ''
    document.body.style.backgroundColor = 'rgb(28, 25, 23)'
    expect(readGridPdfTheme(root)).toEqual({ headerColor: '#f1f5f9', headerTextColor: '#0f172a' })
    document.body.style.backgroundColor = ''
    root.querySelectorAll<HTMLElement>('.sv-grid-cell:not(.sv-grid-row-number-cell)')[0]!.style.color = 'rgb(250, 250, 249)'
    expect(readGridPdfTheme(root)).toEqual({ headerColor: '#f1f5f9', headerTextColor: '#0f172a' })
    root.remove()
    expect(readGridPdfTheme(null)).toEqual({})
  })
})

describe('charts and a KPI strip alongside the table', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='

  it('prints the KPI strip between the subtitle and the table, one box per number', () => {
    const def = buildPdfDocDefinition({
      columns, rows, now,
      opts: { title: 'Q3', kpis: [{ label: 'Revenue', value: '$1.2M', delta: '+4.2%', color: '#16a34a' }, { label: 'Orders', value: '842' }] },
    })
    const kinds = def.content.map((c: any) => (c.text ? 'text' : c.table && c.table.body[0][0].stack ? 'kpis' : c.table ? 'table' : c.image ? 'image' : 'other'))
    expect(kinds).toEqual(['text', 'kpis', 'table'])
    const strip = (def.content[1] as any).table
    expect(strip.widths).toEqual(['*', '*'])
    expect(strip.body[0]).toHaveLength(2)
    const first = strip.body[0][0]
    expect(first.stack.map((t: any) => t.text)).toEqual(['Revenue', '$1.2M', '+4.2%'])
    expect(first.stack[1].bold).toBe(true)
    expect(first.stack[2].color).toBe('#16a34a')
    expect(strip.body[0][1].stack).toHaveLength(2)
  })

  it('places image charts above the table by default, sized to the content width', () => {
    const def = buildPdfDocDefinition({
      columns, rows, now,
      opts: { charts: [{ image: png, title: 'Revenue by region', caption: 'Source: ledger' }, { image: png, width: 200 }] },
    })
    const blocks = def.content.filter((c: any) => c.stack) as any[]
    expect(blocks).toHaveLength(2)
    expect(def.content.indexOf(blocks[1])).toBeLessThan(def.content.length - 1)
    // A4 portrait, default margins: 595.28 - 28 - 28.
    expect(blocks[0].stack.map((t: any) => t.text ?? 'image')).toEqual(['Revenue by region', 'image', 'Source: ledger'])
    expect(blocks[0].stack[1].width).toBeCloseTo(539.28, 2)
    expect(blocks[1].stack[0].width).toBe(200)
    expect(blocks[0].unbreakable).toBe(true)
  })

  it('puts them below the table with chartsPosition, and widens with landscape', () => {
    const def = buildPdfDocDefinition({
      columns, rows, now,
      opts: { charts: [{ image: png }], chartsPosition: 'below', pageOrientation: 'landscape', margins: [20, 20, 20, 20] },
    })
    const last = def.content.at(-1) as any
    expect(last.stack[0].width).toBeCloseTo(841.89 - 40, 2)
    expect((def.content.find((c: any) => c.table) as any).table.headerRows).toBe(1)
    expect(def.content.indexOf(def.content.find((c: any) => c.table)!)).toBeLessThan(def.content.indexOf(last))
  })

  it('takes resolved charts over the element entries it cannot draw', () => {
    const el = { tagName: 'svg' } as unknown as SVGSVGElement
    const def = buildPdfDocDefinition({
      columns, rows, now,
      opts: { charts: [{ element: el, title: 'Live' }] },
      charts: [{ image: png, title: 'Rasterised' }],
    })
    const blocks = def.content.filter((c: any) => c.stack) as any[]
    expect(blocks).toHaveLength(1)
    expect(blocks[0].stack[0].text).toBe('Rasterised')
    // Without the resolved list, an element entry is skipped rather than drawn wrong.
    const bare = buildPdfDocDefinition({ columns, rows, now, opts: { charts: [{ element: el }] } })
    expect(bare.content.filter((c: any) => c.stack)).toHaveLength(0)
  })

  it('resolvePdfCharts rasterises elements in order and passes images through', async () => {
    const seen: string[] = []
    const rasterize = async (el: SVGSVGElement | HTMLElement) => {
      seen.push((el as { id: string }).id)
      return new Blob(['png-bytes'], { type: 'image/png' })
    }
    const out = await resolvePdfCharts(
      [{ element: { id: 'a' } as unknown as HTMLElement, title: 'A' }, { image: png, caption: 'given' }, { element: { id: 'b' } as unknown as HTMLElement }],
      rasterize,
    )
    expect(seen).toEqual(['a', 'b'])
    expect(out.map((c) => c.title ?? c.caption ?? '')).toEqual(['A', 'given', ''])
    expect(out[0]!.image.startsWith('data:image/png;base64,')).toBe(true)
    expect(out[1]!.image).toBe(png)
    expect(await resolvePdfCharts(undefined, rasterize)).toEqual([])
  })
})

describe('pdf fonts', () => {
  const map = { 'Roboto-Regular.ttf': 'AAEA', 'Roboto-Medium.ttf': 'AAEB' }

  it('finds the font map in every shape vfs_fonts has shipped or a bundler has wrapped it in', () => {
    expect(resolvePdfVfs(map)).toBe(map)
    expect(resolvePdfVfs({ default: map })).toBe(map)
    expect(resolvePdfVfs({ pdfMake: { vfs: map } })).toBe(map)
    expect(resolvePdfVfs({ default: { pdfMake: { vfs: map } } })).toBe(map)
    expect(resolvePdfVfs({ vfs: map })).toBe(map)
    expect(resolvePdfVfs({ default: { vfs: map } })).toBe(map)
    expect(resolvePdfVfs({ default: {} })).toBeNull()
    expect(resolvePdfVfs({ default: { 'Roboto-Regular.ttf': 1 } })).toBeNull()
    expect(resolvePdfVfs(null)).toBeNull()
  })

  it('finds the map in the installed pdfmake, which exports it as the module itself', async () => {
    const mod = await import('pdfmake/build/vfs_fonts')
    const vfs = resolvePdfVfs(mod)
    expect(vfs).not.toBeNull()
    expect(typeof vfs!['Roboto-Medium.ttf']).toBe('string')
    expect(vfs!['Roboto-Medium.ttf']!.length).toBeGreaterThan(1000)
  })

  it('registers on the instance in hand through addVirtualFileSystem and the vfs property, not a global', () => {
    const calls: unknown[] = []
    const pdfMake = { addVirtualFileSystem: (v: unknown) => calls.push(v) } as Parameters<typeof registerPdfFonts>[0]
    expect(registerPdfFonts(pdfMake, { default: map })).toBe(true)
    expect(calls).toEqual([map])
    expect(pdfMake.vfs).toBe(map)
    const old = {} as Parameters<typeof registerPdfFonts>[0]
    expect(registerPdfFonts(old, { pdfMake: { vfs: map } })).toBe(true)
    expect(old.vfs).toBe(map)
    expect(registerPdfFonts({}, { default: {} })).toBe(false)
  })

  it('makes a real pdf with the installed pdfmake once its fonts are registered this way', async () => {
    const mod = (await import('pdfmake/build/pdfmake')) as unknown as { default?: unknown }
    const pdfMake = (mod.default ?? mod) as Parameters<typeof registerPdfFonts>[0] & {
      createPdf: (def: unknown) => { getBuffer(cb: (b: Uint8Array) => void): void }
    }
    // The fonts module registers itself only into a global `pdfMake` that
    // exists at its import time; here none does, so the instance starts bare.
    expect(registerPdfFonts(pdfMake, await import('pdfmake/build/vfs_fonts'))).toBe(true)
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('pdfmake never called back')), 15_000)
      try {
        pdfMake.createPdf({ content: 'hello' }).getBuffer((b) => { clearTimeout(t); resolve(b) })
      } catch (e) { clearTimeout(t); reject(e) }
    })
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  }, 30_000)
})
