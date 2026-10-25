/**
 * E2E: a PDF export rendered in a real module worker, built by Vite.
 *
 * The unit tests join the two ends through structuredClone in one process;
 * this is the part they cannot show. pdfmake has to load inside a bundled
 * worker (where its bundle sets no `pdfMake` global, which crashed createPdf
 * until the loader set one), the document has to cross intact, and the page
 * has to keep drawing frames while the worker renders. A blocked page draws
 * one or two frames; a free one draws dozens.
 */
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

// Vite serves workspace files under /@fs/<absolute path>.
const fsUrl = (rel: string) => `/sv-grid/@fs/${resolve(rel).replace(/\\/g, '/').replace(/^\//, '')}`

test('a 5,000-row PDF renders in a module worker while the page keeps drawing', async ({ page }) => {
  await page.goto('/sv-grid/')
  const urls = {
    pdf: fsUrl('packages/enterprise/src/export-pdf.ts'),
    worker: fsUrl('packages/enterprise/src/pdf-worker.ts'),
    entry: fsUrl('tests/e2e/fixtures/pdf-worker-entry.ts'),
  }
  const out = await page.evaluate(async (urls) => {
    const pdf = await import(/* @vite-ignore */ urls.pdf)
    const pw = await import(/* @vite-ignore */ urls.worker)
    const rows = Array.from({ length: 5000 }, (_, i) => [`Row ${i}`, `Customer ${i % 37}`, String(i * 3), `$${(i * 1.5).toFixed(2)}`])
    const doc = pdf.buildPdfDocData({
      columns: [{ header: 'Row' }, { header: 'Customer' }, { header: 'Qty', align: 'right' }, { header: 'Amount', align: 'right' }],
      rows,
      dataCellStyle: (r: number, c: number) => (c === 2 && r % 3 === 0 ? { icon: '▲' } : undefined),
      opts: { title: 'Worker export', watermark: 'DRAFT', labels: { page: (p: number, n: number) => `${p} / ${n}` } },
    })
    let frames = 0
    let drawing = true
    const tick = () => {
      frames += 1
      if (drawing) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    const progress: number[] = []
    const blob: Blob = await pw.renderPdfInWorker(() => new Worker(urls.entry, { type: 'module' }), doc, {
      onProgress: (p: number) => progress.push(p),
    })
    drawing = false
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5))
    return { head, size: blob.size, frames, progress }
  }, urls)
  expect(out.head).toBe('%PDF-')
  expect(out.size).toBeGreaterThan(100_000)
  expect(out.frames).toBeGreaterThan(10)
  expect(out.progress.length).toBeGreaterThan(5)
  expect(out.progress.length).toBeLessThanOrEqual(102)
  expect(out.progress.at(-1)).toBe(1)
})
