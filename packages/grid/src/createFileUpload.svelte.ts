/**
 * createFileUpload - the HEADLESS core behind <SvFileUpload>: a drag-and-drop
 * file field with accept / size / count validation, exposed as **prop-getters**
 * you spread onto YOUR OWN markup. The DataTransfer / File reading is a DOM
 * concern that stays in the renderer; the core owns the list, validation, drag
 * state and ARIA. Parity: Smart `smart-file-upload`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createFileUpload } from '@svgrid/grid'
 *   let files = $state<File[]>([])
 *   const fu = createFileUpload({ files: () => files, onChange: (f) => (files = f) })
 * </script>
 * <div {...fu.dropzoneProps()} ondrop={(e) => fu.addFiles([...e.dataTransfer.files])}>...</div>
 * <input {...fu.inputProps()} />
 * ```
 */
import { editorAria, type EditorAriaState } from './editor-contract'

export type FileRejectReason = 'type' | 'size' | 'count'
export type FileRejection = { file: File; reason: FileRejectReason }

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type FileUploadConfig = {
  files: () => File[]
  onChange?: (files: File[]) => void
  /** Rejected files (wrong type / too big / over the count cap). */
  onReject?: (rejections: FileRejection[]) => void
  /** Comma list like "image/*,.pdf" (matches MIME or extension). */
  accept?: () => string | undefined
  multiple?: () => boolean
  /** Max size per file in bytes. */
  maxSize?: () => number | undefined
  /** Max number of files (multiple mode). */
  maxFiles?: () => number | undefined
  disabled?: () => boolean
  readonly?: () => boolean
  // Editor contract (ARIA + validation) - folded into dropzoneProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

/** Whether `file` satisfies an `accept` list (MIME globs or extensions). Pure. */
export function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((tok) => {
    if (tok.startsWith('.')) return name.endsWith(tok)
    if (tok.endsWith('/*')) return type.startsWith(tok.slice(0, -1))
    return type === tok
  })
}

export function createFileUpload(config: FileUploadConfig) {
  const accept = () => config.accept?.()
  const multiple = () => config.multiple?.() ?? false
  const maxSize = () => config.maxSize?.()
  const maxFiles = () => config.maxFiles?.()
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false
  const isInteractive = $derived(!disabled() && !readonly())

  let dragging = $state(false)

  function addFiles(incoming: File[]) {
    if (!isInteractive || !incoming.length) return
    const accepted: File[] = []
    const rejected: FileRejection[] = []
    for (const f of incoming) {
      if (!fileMatchesAccept(f, accept())) { rejected.push({ file: f, reason: 'type' }); continue }
      const cap = maxSize()
      if (cap != null && f.size > cap) { rejected.push({ file: f, reason: 'size' }); continue }
      accepted.push(f)
    }
    let next = multiple() ? [...config.files(), ...accepted] : accepted.slice(-1)
    const limit = maxFiles()
    if (multiple() && limit != null && next.length > limit) {
      for (const f of next.slice(limit)) rejected.push({ file: f, reason: 'count' })
      next = next.slice(0, limit)
    }
    if (rejected.length) config.onReject?.(rejected)
    config.onChange?.(next)
  }

  function removeAt(index: number) {
    if (!isInteractive) return
    config.onChange?.(config.files().filter((_, i) => i !== index))
  }
  function clear() { if (isInteractive) config.onChange?.([]) }

  const setDragging = (v: boolean) => { if (isInteractive) dragging = v }

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  return {
    /** Whether files are being dragged over the dropzone. */
    get dragging() { return dragging },
    /** Whether interaction is allowed. */
    get isInteractive() { return isInteractive },
    /** Selected files (controlled value). */
    get files() { return config.files() },
    addFiles,
    removeAt,
    clear,
    setDragging,
    /** Spread onto the dropzone element (click opens the picker; Enter/Space too).
     *  Wire drag events yourself (they carry a DataTransfer): call
     *  `setDragging(true/false)` and `addFiles([...e.dataTransfer.files])`. */
    dropzoneProps: () => ({
      role: 'button' as const,
      tabindex: isInteractive ? 0 : -1,
      'data-dragging': dragging ? '' : undefined,
      'aria-disabled': !isInteractive || undefined,
      ...editorAria(ariaState()),
    }),
    /** Spread onto the visually-hidden <input type="file">. */
    inputProps: () => ({
      type: 'file' as const,
      accept: accept(),
      multiple: multiple(),
      disabled: !isInteractive,
      tabindex: -1,
    }),
    /** Spread onto a selected file's remove <button> at `index`. */
    removeProps: (index: number) => ({
      type: 'button' as const,
      onclick: () => removeAt(index),
    }),
  }
}

export type FileUpload = ReturnType<typeof createFileUpload>
