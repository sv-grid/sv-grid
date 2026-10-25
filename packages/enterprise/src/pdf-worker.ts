/// <reference path="./pdfmake-shims.d.ts" />
/**
 * Render a PDF export in a worker, so a large report does not freeze the
 * page. pdfmake lays out and writes the whole document in one synchronous
 * run, about a millisecond per row of eight columns on a desktop machine:
 * a 20,000-row export held the main thread for over twenty seconds.
 *
 * The app owns the worker file, so any bundler builds it:
 *
 * ```ts
 * // pdf.worker.ts
 * import { servePdfWorker } from '@svgrid/enterprise/pdf-worker'
 * servePdfWorker()
 * ```
 *
 * ```ts
 * await api.exportData({
 *   format: 'pdf',
 *   pdf: { worker: () => new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' }) },
 * })
 * ```
 *
 * The main thread builds the document as plain data (`buildPdfDocData`) and
 * posts it here with the font, if any; the worker loads pdfmake, attaches
 * the layout and footer functions (`hydratePdfDoc`), renders, and posts the
 * bytes back with progress along the way.
 */
import { hydratePdfDoc, registerPdfFont, registerPdfFonts, type PdfDocData, type PdfFont, type PdfMakeLike, type PdfWorkerLike } from './export-pdf'

export type { PdfWorkerLike }

/** Tags this channel's messages, so a worker shared with other traffic ignores the rest. */
export const PDF_WORKER_CHANNEL = 'svgrid-pdf'

export type PdfWorkerRequest = { channel: typeof PDF_WORKER_CHANNEL; id: number; doc: PdfDocData; font?: PdfFont }
export type PdfWorkerReply =
  | { channel: typeof PDF_WORKER_CHANNEL; id: number; progress: number }
  | { channel: typeof PDF_WORKER_CHANNEL; id: number; pdf: ArrayBuffer }
  | { channel: typeof PDF_WORKER_CHANNEL; id: number; error: string }

/** The pdfmake calls rendering needs, in either the 0.2 or the 0.3 shape. */
export type PdfMakeRenderer = PdfMakeLike & {
  fonts?: Record<string, unknown>
  addFonts?: (fonts: Record<string, unknown>) => void
  createPdf(def: unknown): {
    getBuffer(cb?: (bytes: Uint8Array) => void, options?: { progressCallback?: (progress: number) => void }): unknown
  }
}

/** The part of a worker's global scope (or a `MessagePort`) this needs. */
export type PdfWorkerScope = {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

/**
 * Render a document from `buildPdfDocData` with the pdfmake given. The
 * worker's half of the export, exported so it can run anywhere pdfmake does.
 */
export function renderPdfDoc(
  doc: PdfDocData,
  pdfMake: PdfMakeRenderer,
  opts: { font?: PdfFont; onProgress?: (progress: number) => void } = {},
): Promise<Uint8Array> {
  if (opts.font) registerPdfFont(pdfMake, opts.font)
  const def = hydratePdfDoc(doc)
  return new Promise<Uint8Array>((resolve, reject) => {
    const done = (bytes: Uint8Array | ArrayBuffer) => resolve(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    try {
      // 0.2 calls back; 0.3 returns a promise and ignores the callback.
      const returned = pdfMake.createPdf(def).getBuffer(done, { progressCallback: opts.onProgress })
      if (returned && typeof (returned as PromiseLike<Uint8Array>).then === 'function') {
        ;(returned as PromiseLike<Uint8Array>).then(done, reject)
      }
    } catch (err) {
      reject(err)
    }
  })
}

async function loadPdfMake(): Promise<PdfMakeRenderer> {
  // @ts-ignore - "pdfmake" is an optional peerDependency
  const mod = (await import('pdfmake/build/pdfmake')) as { default?: unknown }
  // @ts-ignore - "pdfmake" is an optional peerDependency
  const vfs = await import('pdfmake/build/vfs_fonts')
  const pdfMake = (mod.default ?? mod) as PdfMakeRenderer
  if (!registerPdfFonts(pdfMake, vfs)) {
    throw new Error('"pdfmake/build/vfs_fonts" did not contain a font map; the installed pdfmake is not one this export knows.')
  }
  // createPdf reads `pdfMake.tableLayouts` off the global, and a bundled
  // import never sets that global, so without this every render failed with
  // "Cannot read properties of undefined (reading 'tableLayouts')". The page
  // side does the same in ensureGlobals.
  ;(globalThis as unknown as { pdfMake?: unknown }).pdfMake = pdfMake
  return pdfMake
}

export type ServePdfWorkerOptions = {
  /** Where to listen. Default: the worker's global scope. */
  scope?: PdfWorkerScope
  /** How to get pdfmake. Default: import the installed `pdfmake` peer. */
  loadPdfMake?: () => Promise<PdfMakeRenderer>
}

/** Answer PDF export requests from the main thread. Call it once, in the worker. */
export function servePdfWorker(options: ServePdfWorkerOptions = {}): { dispose(): void } {
  const scope = options.scope ?? (globalThis as unknown as PdfWorkerScope)
  const load = options.loadPdfMake ?? loadPdfMake
  let pdfMake: Promise<PdfMakeRenderer> | null = null
  const reply = (message: PdfWorkerReply, transfer?: Transferable[]) => scope.postMessage(message, transfer)
  const listener = async (event: MessageEvent) => {
    const msg = event.data as Partial<PdfWorkerRequest> | null
    if (!msg || msg.channel !== PDF_WORKER_CHANNEL || typeof msg.id !== 'number' || !msg.doc) return
    const { id, doc, font } = msg as PdfWorkerRequest
    try {
      pdfMake ??= load()
      // pdfmake reports progress per item drawn: a 5,000-row table sent
      // 79,129 messages. One per percent is enough for a progress bar.
      let sent = -1
      const bytes = await renderPdfDoc(doc, await pdfMake, {
        font,
        onProgress: (progress) => {
          if (progress < 1 && progress - sent < 0.01) return
          sent = progress
          reply({ channel: PDF_WORKER_CHANNEL, id, progress })
        },
      })
      // A copy of exactly these bytes, handed over rather than cloned.
      const pdf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      reply({ channel: PDF_WORKER_CHANNEL, id, pdf }, [pdf])
    } catch (err) {
      pdfMake = null
      reply({ channel: PDF_WORKER_CHANNEL, id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  scope.addEventListener('message', listener)
  return { dispose: () => scope.removeEventListener('message', listener) }
}

let nextJob = 1

/**
 * The main thread's half: post the document to a fresh worker, report its
 * progress, and resolve with the PDF. An abort terminates the worker.
 */
export function renderPdfInWorker(
  makeWorker: () => PdfWorkerLike,
  doc: PdfDocData,
  opts: { font?: PdfFont; signal?: AbortSignal; onProgress?: (progress: number) => void } = {},
): Promise<Blob> {
  const worker = makeWorker()
  const id = nextJob++
  return new Promise<Blob>((resolve, reject) => {
    const finish = () => {
      opts.signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      finish()
      reject(new DOMException('Export aborted', 'AbortError'))
    }
    if (opts.signal?.aborted) return onAbort()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data as PdfWorkerReply | null
      if (!msg || msg.channel !== PDF_WORKER_CHANNEL || msg.id !== id) return
      if ('progress' in msg) return opts.onProgress?.(msg.progress)
      finish()
      if ('pdf' in msg) resolve(new Blob([msg.pdf], { type: 'application/pdf' }))
      else reject(new Error(`@svgrid/enterprise: the PDF worker failed: ${msg.error}`))
    })
    worker.addEventListener('error', (event: ErrorEvent) => {
      finish()
      reject(new Error(`@svgrid/enterprise: the PDF worker failed to start or crashed: ${event.message || 'no message'}. Check that it calls servePdfWorker().`))
    })
    const request: PdfWorkerRequest = { channel: PDF_WORKER_CHANNEL, id, doc, ...(opts.font ? { font: opts.font } : {}) }
    worker.postMessage(request)
  })
}
