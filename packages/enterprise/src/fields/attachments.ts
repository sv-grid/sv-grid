/**
 * The attachment field's value and the work around it: uploading a file,
 * turning pasted URLs into attachments, the text a copy or an export writes.
 * A cell holds an array, so it can hold several files.
 */

export type Attachment = {
  id: string
  url: string
  name: string
  /** MIME type, e.g. 'image/png'. */
  type: string
  size?: number
  width?: number
  height?: number
  /** A smaller image for the cell; the cell falls back to `url`. */
  thumbnailUrl?: string
}

/** What an upload function is told about the file it uploads. */
export type AttachmentUploadContext = {
  row: unknown
  columnId: string
  /** Aborted when the user removes the file or closes the dialog mid-upload. */
  signal: AbortSignal
  /** Report progress, 0..1. */
  onProgress: (fraction: number) => void
}

export type AttachmentUploader = (file: File, ctx: AttachmentUploadContext) => Promise<Attachment>

/** The attachment field's `fieldProps`. */
export type AttachmentFieldProps = {
  /** Accepted types, as for `<input accept>`: 'image/*,.pdf'. Default: anything. */
  accept?: string
  /** Most files a cell holds. Default 20. */
  maxFiles?: number
  /** Largest file in bytes. Default 25 MB. */
  maxSize?: number
  /** Uploads a file and returns its attachment. Default: the app-wide uploader. */
  upload?: AttachmentUploader
}

let appUploader: AttachmentUploader | null = null

/**
 * The uploader every attachment column uses unless its `fieldProps.upload`
 * sets one. Without any, files stay in this page as `blob:` URLs: fine for a
 * demo, gone on reload, so a real app sets one.
 */
export function setAttachmentUploader(upload: AttachmentUploader | null): void {
  appUploader = upload
}

let counter = 0
export const newAttachmentId = () => `att-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Upload one file with the column's uploader, the app's, or as a local blob URL. */
export async function uploadAttachment(file: File, props: AttachmentFieldProps, ctx: AttachmentUploadContext): Promise<Attachment> {
  const upload = props.upload ?? appUploader
  if (upload) return upload(file, ctx)
  ctx.onProgress(1)
  return { id: newAttachmentId(), url: URL.createObjectURL(file), name: file.name, type: file.type || guessType(file.name), size: file.size }
}

/** 'At most 1 file', 'At most 20 files'. */
export const tooManyFiles = (maxFiles: number) => `At most ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'}`

/**
 * Why a file is refused, or null when it is fine. `count` is how many the
 * cell holds already. Works for an attachment added by URL too: its type
 * comes from the name's extension, and a size is checked only when known.
 */
export function rejectReason(file: { name: string; type: string; size?: number }, props: AttachmentFieldProps, count: number): string | null {
  const maxFiles = props.maxFiles ?? 20
  const maxSize = props.maxSize ?? 25 * 1024 * 1024
  if (count >= maxFiles) return tooManyFiles(maxFiles)
  if (file.size != null && file.size > maxSize) return `Larger than ${formatBytes(maxSize)}`
  if (props.accept && !accepts(props.accept, file)) return 'Not an accepted type'
  return null
}

/** The attachments the field takes, in order, and why each of the others was refused. */
export function limitAttachments(list: ReadonlyArray<Attachment>, props: AttachmentFieldProps, count = 0): { kept: Attachment[]; rejected: string[] } {
  const kept: Attachment[] = []
  const rejected: string[] = []
  for (const a of list) {
    const why = rejectReason(a, props, count + kept.length)
    if (why) rejected.push(`${a.name}: ${why}`)
    else kept.push(a)
  }
  return { kept, rejected }
}

/**
 * The attachment column's valueParser: a list (a copied cell) or text with
 * URLs in it (a paste), kept to the field's accept, maxSize and maxFiles.
 */
export function parseAttachments(value: unknown, props: AttachmentFieldProps): Attachment[] {
  const list = Array.isArray(value) ? toAttachments(value) : attachmentsFromText(String(value ?? ''))
  return limitAttachments(list, props).kept
}

/** `<input accept>` semantics: '.pdf', 'image/*', 'application/json'. */
export function accepts(accept: string, file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase()
  const type = (file.type || guessType(file.name)).toLowerCase()
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) =>
      rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule,
    )
}

const EXT_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav',
}

export function guessType(name: string): string {
  const ext = name.split(/[?#]/)[0]!.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TYPES[ext] ?? 'application/octet-stream'
}

export const isImage = (a: { type?: string; name?: string }) => (a.type || guessType(a.name ?? '')).startsWith('image/')
export const isPdf = (a: { type?: string; name?: string }) => (a.type || guessType(a.name ?? '')) === 'application/pdf'

export function formatBytes(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  // One decimal below 10, none above; a whole number drops its '.0' (10 MB, 1.5 MB).
  const short = (x: number) => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.round(x)))
  if (n < 1024 * 1024) return `${short(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${short(n / 1024 / 1024)} MB`
  return `${short(n / 1024 / 1024 / 1024)} GB`
}

/** The cell value as a clean array: anything that is not an attachment is dropped. */
export function toAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  return value.filter((a): a is Attachment => !!a && typeof a === 'object' && typeof (a as Attachment).url === 'string')
}

/** What a copy and an export write: the file names. */
export function attachmentsText(value: unknown): string {
  return toAttachments(value).map((a) => a.name).join(', ')
}

/** Pasted text -> attachments, one per http(s) URL in it. Anything else is ignored. */
export function attachmentsFromText(text: string): Attachment[] {
  const out: Attachment[] = []
  for (const token of text.split(/[\s,]+/)) {
    let url: URL
    try {
      url = new URL(token)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? url.hostname)
    out.push({ id: newAttachmentId(), url: url.href, name, type: guessType(name) })
  }
  return out
}

/**
 * A URL safe to use: http(s) and blob: only. `forImage` also allows data:
 * images (raster and SVG), which are inert inside <img> but never become a link.
 */
export function safeUrl(url: unknown, forImage = false): string | null {
  if (typeof url !== 'string') return null
  // An SVG drawn by <img> runs no script, so a data: SVG is as inert as a PNG there.
  if (forImage && /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(url)) return url
  try {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'https://x.invalid/')
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'blob:' ? u.href : null
  } catch {
    return null
  }
}
