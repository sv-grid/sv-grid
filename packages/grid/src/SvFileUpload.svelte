<script lang="ts" module>
  export type { FileRejection, FileRejectReason } from './createFileUpload.svelte'
</script>

<script lang="ts">
  /**
   * SvFileUpload - a drag-and-drop file field with a click-to-browse fallback,
   * accept / size / count validation and a selected-files list. Parity: Smart
   * `smart-file-upload`. Controlled via `files` + `onChange`.
   *
   * Part of the editor kit: carries the shared contract (label, hint, error
   * validation, `dir`/RTL and localizable `messages`) via `<SvField>`. The
   * drag/validation/state live in the headless `createFileUpload` core.
   */
  import SvField from './SvField.svelte'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createFileUpload, type FileRejection } from './createFileUpload.svelte'

  /** User-facing strings (localizable via `messages`). */
  type FileMessages = { prompt: string; browse: string; remove: string; hintTypes: string }
  const DEFAULT_MESSAGES: FileMessages = {
    prompt: 'Drag files here or', browse: 'browse', remove: 'Remove', hintTypes: 'Accepted:',
  }

  type Props = SvEditorProps & {
    files?: File[]
    onChange?: (files: File[]) => void
    onReject?: (rejections: FileRejection[]) => void
    accept?: string
    multiple?: boolean
    /** Max size per file in bytes. */
    maxSize?: number
    maxFiles?: number
    messages?: Partial<FileMessages>
  }

  let {
    files = $bindable([]),
    onChange,
    onReject,
    accept,
    multiple = false,
    maxSize,
    maxFiles,
    disabled = false,
    readonly = false,
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    messages,
  }: Props = $props()

  const autoId = nextEditorId('sv-file')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  const fu = createFileUpload({
    files: () => files,
    onChange: (f) => { files = f; onChange?.(f) },
    onReject: (r) => onReject?.(r),
    accept: () => accept,
    multiple: () => multiple,
    maxSize: () => maxSize,
    maxFiles: () => maxFiles,
    disabled: () => disabled,
    readonly: () => readonly,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
    ariaLabel: () => ariaLabel,
  })

  let inputEl = $state<HTMLInputElement | null>(null)

  function openPicker() { if (fu.isInteractive) inputEl?.click() }
  function onDropzoneKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() }
  }
  function onInputChange(e: Event) {
    const list = (e.currentTarget as HTMLInputElement).files
    if (list) fu.addFiles([...list])
    ;(e.currentTarget as HTMLInputElement).value = '' // allow re-selecting the same file
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    fu.setDragging(false)
    if (e.dataTransfer?.files) fu.addFiles([...e.dataTransfer.files])
  }

  const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-file" class:is-disabled={disabled}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-file__zone"
      class:is-dragging={fu.dragging}
      class:is-invalid={invalid}
      {...fu.dropzoneProps()}
      onclick={openPicker}
      onkeydown={onDropzoneKey}
      ondragenter={(e) => { e.preventDefault(); fu.setDragging(true) }}
      ondragover={(e) => { e.preventDefault(); fu.setDragging(true) }}
      ondragleave={() => fu.setDragging(false)}
      ondrop={onDrop}
    >
      <svg class="sv-file__icon" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
      <p class="sv-file__prompt">{M.prompt} <span class="sv-file__browse">{M.browse}</span></p>
      {#if accept}<p class="sv-file__types">{M.hintTypes} {accept}</p>{/if}
      <input bind:this={inputEl} class="sv-file__input" {...fu.inputProps()} onchange={onInputChange} />
    </div>

    {#if files.length}
      <ul class="sv-file__list">
        {#each files as file, i (file.name + file.size + i)}
          <li class="sv-file__item">
            <span class="sv-file__name" title={file.name}>{file.name}</span>
            <span class="sv-file__size">{fmtSize(file.size)}</span>
            {#if fu.isInteractive}
              <button class="sv-file__remove" aria-label={`${M.remove} ${file.name}`} {...fu.removeProps(i)}>&times;</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</SvField>

<style>
  .sv-file {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-input-border, var(--sg-border, #cbd5e1));
    --_radius: var(--sg-radius, 8px);
    display: flex; flex-direction: column; gap: 8px; width: 320px; color: var(--sg-fg, #0f172a);
  }
  .sv-file.is-disabled { opacity: 0.6; }
  .sv-file__zone {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 22px 16px; text-align: center; cursor: pointer;
    background: var(--sg-input-bg, #fff); color: var(--sg-muted, #64748b);
    border: 1.5px dashed var(--_border); border-radius: var(--_radius); transition: border-color 0.15s, background 0.15s;
  }
  .sv-file__zone:hover, .sv-file__zone:focus-visible { border-color: var(--_accent); outline: none; }
  .sv-file__zone.is-dragging { border-color: var(--_accent); background: color-mix(in srgb, var(--_accent) 8%, transparent); color: var(--_accent); }
  .sv-file__zone.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-file__icon { color: var(--_accent); }
  .sv-file__prompt { margin: 0; font-size: 13px; }
  .sv-file__browse { color: var(--_accent); font-weight: 650; text-decoration: underline; }
  .sv-file__types { margin: 0; font-size: 11.5px; opacity: 0.8; }
  .sv-file__input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); border: 0; }

  .sv-file__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .sv-file__item {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 12.5px;
    background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px;
  }
  .sv-file__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 550; }
  .sv-file__size { color: var(--sg-muted, #64748b); flex: none; font-variant-numeric: tabular-nums; }
  .sv-file__remove { flex: none; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
  .sv-file__remove:hover { color: var(--sg-danger, #dc2626); }
</style>
