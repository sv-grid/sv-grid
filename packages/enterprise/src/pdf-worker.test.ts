/**
 * The PDF worker: the document crosses as data, the real pdfmake renders it on
 * the other side, progress and the bytes come back, and an abort or a failure
 * ends the worker. Node has no Web Worker, so the two ends are joined through
 * structuredClone, the copy a real postMessage makes: a function left anywhere
 * in the document would make it throw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPdfDocData, buildPdfDocDefinition } from './export-pdf'
import { renderPdfInWorker, servePdfWorker, PDF_WORKER_CHANNEL, type PdfWorkerLike, type PdfWorkerScope } from './pdf-worker'
import { exportGrid } from './export'
import { clearLicenseKey, setLicenseKey } from './license'

type Listener = (event: MessageEvent) => void

/** A worker and the scope inside it, joined the way postMessage joins them. */
function workerPair(serve = true) {
  const toMain: Listener[] = []
  const toWorker: Listener[] = []
  const send = (listeners: Listener[], message: unknown, transfer?: Transferable[]) => {
    const data = structuredClone(message, transfer ? { transfer } : undefined)
    setTimeout(() => listeners.forEach((l) => l({ data } as MessageEvent)))
  }
  const scope: PdfWorkerScope = {
    postMessage: (m, t) => send(toMain, m, t),
    addEventListener: (_type, l) => void toWorker.push(l),
    removeEventListener: (_type, l) => void toWorker.splice(toWorker.indexOf(l), 1),
  }
  const terminate = vi.fn()
  const worker: PdfWorkerLike = {
    postMessage: (m: unknown) => send(toWorker, m),
    addEventListener: (type: string, l: Listener) => void (type === 'message' && toMain.push(l)),
    terminate,
  } as unknown as PdfWorkerLike
  const served = serve ? servePdfWorker({ scope }) : null
  return { worker, scope, terminate, served }
}

const params = () => ({
  columns: [{ header: 'Name' }, { header: 'Score', align: 'right' as const }],
  rows: Array.from({ length: 40 }, (_, i) => [`Row ${i}`, String(i)]),
  dataCellStyle: (r: number, c: number) => (c === 1 && r % 2 ? { icon: '▲' } : undefined),
  opts: { title: 'Scores', kpis: [{ label: 'Rows', value: '40' }], labels: { page: (p: number, n: number) => `Seite ${p} von ${n}` } },
})

describe('the document as data', () => {
  it('survives the copy to a worker, where the hydrated one does not', () => {
    expect(() => structuredClone(buildPdfDocData(params()))).not.toThrow()
    expect(() => structuredClone(buildPdfDocDefinition(params()))).toThrow()
  })

  it('carries the page label as a template, and falls back when the label reformats its numbers', () => {
    expect(buildPdfDocData(params()).svgridFooter?.page).toBe('Seite {page} von {pages}')
    const formatted = buildPdfDocData({ ...params(), opts: { labels: { page: (p, n) => `${p.toLocaleString('de-DE')}/${n.toLocaleString('de-DE')}` } } })
    expect(formatted.svgridFooter?.page).toBe('Page {page} of {pages}')
  })
})

describe('rendering in a worker', () => {
  it('renders with the real pdfmake on the far side, reports progress, and ends the worker', async () => {
    const { worker, terminate } = workerPair()
    const progress: number[] = []
    const blob = await renderPdfInWorker(() => worker, buildPdfDocData(params()), { onProgress: (p) => progress.push(p) })
    expect(blob.type).toBe('application/pdf')
    const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 5)
    expect(String.fromCharCode(...head)).toBe('%PDF-')
    expect(progress.length).toBeGreaterThan(0)
    expect(progress.every((p) => p >= 0 && p <= 1)).toBe(true)
    expect(terminate).toHaveBeenCalledTimes(1)
  }, 60_000)

  it('rejects with the reason when the worker cannot render, and ends it', async () => {
    const { worker, scope, terminate } = workerPair(false)
    servePdfWorker({ scope, loadPdfMake: async () => { throw new Error('pdfmake is not installed') } })
    await expect(renderPdfInWorker(() => worker, buildPdfDocData(params()))).rejects.toThrow(/PDF worker failed: pdfmake is not installed/)
    expect(terminate).toHaveBeenCalled()
  })

  it('ends the worker on abort', async () => {
    const { worker, terminate } = workerPair(false)
    const ctrl = new AbortController()
    const job = renderPdfInWorker(() => worker, buildPdfDocData(params()), { signal: ctrl.signal })
    ctrl.abort()
    await expect(job).rejects.toMatchObject({ name: 'AbortError' })
    expect(terminate).toHaveBeenCalled()
  })

  it('ignores messages that are not its own', async () => {
    const { scope } = workerPair(false)
    const post = vi.spyOn(scope, 'postMessage')
    const served = servePdfWorker({ scope, loadPdfMake: vi.fn() })
    expect(PDF_WORKER_CHANNEL).toBe('svgrid-pdf')
    served.dispose()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('exportGrid with pdf.worker', () => {
  const g = globalThis as unknown as { pdfMake?: unknown }
  beforeEach(() => {
    setLicenseKey('SVENTERPRISE-DEV-TEST')
    // The tests above import pdfmake in this same process, and its bundle
    // sets the global as it loads; in a browser that happens in the worker.
    delete g.pdfMake
  })
  afterEach(() => {
    clearLicenseKey()
    delete g.pdfMake
  })
  const api = {
    getDisplayedRows: () => [{ name: 'Ada', score: 1 }],
    getSelectedRows: () => [],
    getData: () => [],
    getColumns: () => [{ id: 'name', field: 'name', header: 'Name', visible: true }, { id: 'score', field: 'score', header: 'Score', visible: true }],
    getState: () => ({ grouping: [] }),
    getColumnPinning: () => ({ left: [], right: [] }),
  } as never

  it('renders in the worker, with no pdfmake global to lean on', async () => {
    // A bundled worker has no `pdfMake` global until the loader sets one;
    // pdfmake's createPdf crashed without it.
    expect(g.pdfMake).toBeUndefined()
    const { worker } = workerPair()
    const posted = vi.spyOn(worker, 'postMessage')
    const phases: number[] = []
    const result = await exportGrid(api, {
      format: 'pdf',
      download: false,
      pdf: { worker: () => worker },
      onProgress: (p) => phases.push(p.ratio),
    })
    expect(posted).toHaveBeenCalledTimes(1)
    expect(posted.mock.calls[0]![0]).toMatchObject({ channel: 'svgrid-pdf' })
    expect(phases.at(-1)).toBe(1)
    expect(result).toBeTruthy()
  }, 60_000)

  it('warns about a large PDF rendered on the page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.pdfMake = { createPdf: () => ({ getBlob: (cb: (b: Blob) => void) => cb(new Blob(['%PDF-'])) }) }
    const many = Array.from({ length: 2500 }, (_, i) => ({ name: `R${i}`, score: i }))
    await exportGrid({ ...(api as object), getDisplayedRows: () => many } as never, { format: 'pdf', download: false })
    expect(warn.mock.calls.some(([m]) => /2,500-row PDF on the page/.test(String(m)))).toBe(true)
    warn.mockRestore()
  })
})
