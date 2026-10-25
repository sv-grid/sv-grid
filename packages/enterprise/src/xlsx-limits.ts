/**
 * Bounds for reading an .xlsx file, shared by `importData` and the
 * spreadsheet's `documentFromXlsx`.
 *
 * Both readers build dense rows, filling the gap before a cell with blanks so
 * columns stay aligned. The gap comes from the file: `<c r="ZZZZZZZ1">` asked
 * for about eight billion blanks and took the tab down. A real cell costs bytes
 * in the file; a blank costs nothing, so the blanks are what is budgeted.
 */

/** The last row a spreadsheet has (row 1,048,576). */
export const XLSX_MAX_ROWS = 1_048_576
/** The last column a spreadsheet has (column XFD). */
export const XLSX_MAX_COLS = 16_384
/** Blank cells a reader may add to fill gaps, across the whole sheet. */
export const XLSX_MAX_FILL = 10_000_000

export function xlsxRangeError(ref: string): Error {
  return new Error(
    `@svgrid/enterprise: cell ${ref} is outside the sheet (columns A-XFD, rows 1-1,048,576); the file is not a valid .xlsx`,
  )
}

/**
 * Bytes the parts of one file may unzip to, together. A zip bomb is a small
 * file whose parts inflate to gigabytes; read whole, one part could exhaust
 * the tab's memory before any check ran. A real workbook this size is far
 * past what the browser can lay out anyway.
 */
export const ZIP_MAX_UNZIPPED = 256 * 1024 * 1024

/** What one file may still unzip to; shared by all of its parts. */
export type UnzipBudget = { left: number; readonly limit: number }

export function createUnzipBudget(limit = ZIP_MAX_UNZIPPED): UnzipBudget {
  return { left: limit, limit }
}

type ZipStream = {
  on(event: 'data', cb: (chunk: Uint8Array) => void): ZipStream
  on(event: 'end', cb: () => void): ZipStream
  on(event: 'error', cb: (err: Error) => void): ZipStream
  resume(): ZipStream
  pause(): ZipStream
}

/** A JSZip entry, as much of it as {@link readZipEntry} uses. */
export type ZipEntryLike = {
  async(type: 'string' | 'base64'): Promise<string>
  internalStream?(type: 'uint8array'): ZipStream
}

const toBase64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

/**
 * Unzip one part as text or base64, counting its bytes against `budget` as
 * they inflate and stopping at the first chunk past it, so a bomb never
 * lands in memory. The size a zip declares for a part can be forged; the
 * bytes that come out cannot.
 */
export function readZipEntry(entry: ZipEntryLike, as: 'string' | 'base64', budget: UnzipBudget): Promise<string> {
  // A zip library without streams is read whole, as before.
  if (typeof entry.internalStream !== 'function') return entry.async(as)
  const stream = entry.internalStream('uint8array')
  return new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    let stopped = false
    stream
      .on('data', (chunk) => {
        if (stopped) return
        budget.left -= chunk.length
        if (budget.left < 0) {
          stopped = true
          stream.pause()
          reject(zipTooLargeError(budget.limit))
          return
        }
        chunks.push(chunk)
        size += chunk.length
      })
      .on('error', (err) => {
        if (stopped) return
        stopped = true
        reject(err)
      })
      .on('end', () => {
        if (stopped) return
        const bytes = new Uint8Array(size)
        let at = 0
        for (const c of chunks) {
          bytes.set(c, at)
          at += c.length
        }
        resolve(as === 'string' ? new TextDecoder().decode(bytes) : toBase64(bytes))
      })
      .resume()
  })
}

export function zipTooLargeError(limit: number): Error {
  return new Error(
    `@svgrid/enterprise: the file unzips to more than ${Math.round(limit / 1024 / 1024)} MB; it is damaged or built to exhaust memory, and was not read`,
  )
}

export function xlsxFillError(): Error {
  return new Error(
    `@svgrid/enterprise: the sheet's cells are spread too thinly to read (more than ${XLSX_MAX_FILL.toLocaleString('en-US')} empty cells between them)`,
  )
}
