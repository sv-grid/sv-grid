<script lang="ts">
  /**
   * The attachment field's editor: every file in the cell as a tile, with
   * add (file picker, drop, paste, URL), remove, reorder (drag, or Alt+Left /
   * Alt+Right on a tile) and preview. Uploads run through the column's
   * uploader with progress; a failed one stays as a tile with Retry. Done
   * commits the list, Cancel (or Escape) leaves the cell as it was.
   */
  import { SvModal } from '@svgrid/grid'
  import AttachmentPreview from './AttachmentPreview.svelte'
  import {
    attachmentsFromText,
    formatBytes,
    isImage,
    limitAttachments,
    rejectReason,
    safeUrl,
    toAttachments,
    uploadAttachment,
    type Attachment,
    type AttachmentFieldProps,
  } from './attachments'

  let {
    value,
    title = 'Attachments',
    props,
    row,
    columnId,
    onDone,
    onCancel,
  }: {
    value: unknown
    title?: string
    props: AttachmentFieldProps
    row: unknown
    columnId: string
    onDone: (next: Attachment[]) => void
    onCancel: () => void
  } = $props()

  type Pending = { key: string; file: File; progress: number; error: string | null; ctl: AbortController }

  // svelte-ignore state_referenced_locally
  let items = $state<Attachment[]>(toAttachments(value))
  let pending = $state<Pending[]>([])
  let rejected = $state<string[]>([])
  let urlText = $state('')
  let previewIndex = $state<number | null>(null)
  let dragFrom = $state<number | null>(null)
  let dropping = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)
  let open = $state(true)
  let finished = false

  const busy = $derived(pending.some((p) => !p.error))

  function addFiles(files: Iterable<File>) {
    rejected = []
    for (const file of files) {
      const why = rejectReason(file, props, items.length + pending.length)
      if (why) {
        rejected = [...rejected, `${file.name}: ${why}`]
        continue
      }
      start({ key: `${file.name}-${file.size}-${Math.random()}`, file, progress: 0, error: null, ctl: new AbortController() })
    }
  }

  function start(p: Pending) {
    pending = [...pending.filter((x) => x.key !== p.key), p]
    const set = (patch: Partial<Pending>) => (pending = pending.map((x) => (x.key === p.key ? { ...x, ...patch } : x)))
    uploadAttachment(p.file, props, {
      row,
      columnId,
      signal: p.ctl.signal,
      onProgress: (f) => set({ progress: Math.max(0, Math.min(1, f)) }),
    }).then(
      (att) => {
        if (p.ctl.signal.aborted) return
        items = [...items, att]
        pending = pending.filter((x) => x.key !== p.key)
      },
      (err) => {
        if (p.ctl.signal.aborted) return
        set({ error: err instanceof Error ? err.message : 'Upload failed' })
      },
    )
  }

  function retry(p: Pending) {
    start({ ...p, progress: 0, error: null, ctl: new AbortController() })
  }

  function drop(p: Pending) {
    p.ctl.abort()
    pending = pending.filter((x) => x.key !== p.key)
  }

  // Kept out of the markup: AGENTS.md keeps `as` casts in <script>.
  function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    if (input.files) addFiles(input.files)
    input.value = ''
  }

  function addUrls() {
    const found = attachmentsFromText(urlText)
    if (!found.length) {
      rejected = ['No http(s) URL found']
      return
    }
    // The same checks as a picked file: accept (by the name's extension) and maxFiles.
    const { kept, rejected: refused } = limitAttachments(found, props, items.length + pending.length)
    items = [...items, ...kept]
    urlText = ''
    rejected = refused
  }

  function remove(i: number) {
    items = items.filter((_, j) => j !== i)
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return
    const next = items.slice()
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it!)
    items = next
  }

  function onTileKey(e: KeyboardEvent, i: number) {
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const to = i + (e.key === 'ArrowRight' ? 1 : -1)
      move(i, to)
      queueMicrotask(() => (document.querySelectorAll<HTMLElement>('.sv-attd-tile')[to])?.focus())
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(i)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      previewIndex = i
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])]
    if (files.length) {
      e.preventDefault()
      addFiles(files)
      return
    }
    const text = e.clipboardData?.getData('text') ?? ''
    if (!(e.target as HTMLElement).closest('input') && attachmentsFromText(text).length) {
      e.preventDefault()
      urlText = text
      addUrls()
    }
  }

  function done() {
    if (busy) return
    finished = true
    open = false
    onDone(items)
  }

  function cancel() {
    if (finished) return
    finished = true
    for (const p of pending) p.ctl.abort()
    open = false
    onCancel()
  }

  const ext = (a: Attachment) => (a.name.split('.').pop() ?? '').slice(0, 4).toUpperCase() || 'FILE'
</script>

<SvModal bind:open {title} width={680} onClose={cancel}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sv-attd"
    class:is-dropping={dropping}
    onpaste={onPaste}
    ondragover={(e) => {
      if (dragFrom !== null || !e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      dropping = true
    }}
    ondragleave={(e) => {
      if (e.currentTarget === e.target) dropping = false
    }}
    ondrop={(e) => {
      dropping = false
      if (dragFrom !== null || !e.dataTransfer?.files.length) return
      e.preventDefault()
      addFiles(e.dataTransfer.files)
    }}
  >
    {#if items.length === 0 && pending.length === 0}
      <p class="sv-attd-empty">No files yet. Drop files here, paste them, or use Add files.</p>
    {/if}
    <ul class="sv-attd-tiles" aria-label="Files">
      {#each items as a, i (a.id)}
        <li
          class="sv-attd-tile"
          class:is-dragging={dragFrom === i}
          tabindex="0"
          draggable="true"
          aria-label={`${a.name}${a.size ? `, ${formatBytes(a.size)}` : ''}. Enter to preview, Delete to remove, Alt+Arrow to move.`}
          onkeydown={(e) => onTileKey(e, i)}
          ondragstart={(e) => {
            dragFrom = i
            e.dataTransfer?.setData('text/plain', a.name)
          }}
          ondragend={() => (dragFrom = null)}
          ondragover={(e) => {
            if (dragFrom === null) return
            e.preventDefault()
          }}
          ondrop={(e) => {
            if (dragFrom === null) return
            e.preventDefault()
            move(dragFrom, i)
            dragFrom = null
          }}
        >
          <button type="button" class="sv-attd-face" onclick={() => (previewIndex = i)} tabindex="-1" aria-hidden="true">
            {#if isImage(a) && safeUrl(a.thumbnailUrl ?? a.url, true)}
              <img src={safeUrl(a.thumbnailUrl ?? a.url, true)} alt="" loading="lazy" decoding="async" draggable="false" />
            {:else}
              <span class="sv-attd-ext">{ext(a)}</span>
            {/if}
          </button>
          <span class="sv-attd-name" title={a.name}>{a.name}</span>
          <span class="sv-attd-size">{formatBytes(a.size)}</span>
          <button type="button" class="sv-attd-remove" aria-label={`Remove ${a.name}`} onclick={() => remove(i)}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </li>
      {/each}
      {#each pending as p (p.key)}
        <li class="sv-attd-tile is-pending" aria-label={p.error ? `${p.file.name}: ${p.error}` : `Uploading ${p.file.name}`}>
          <span class="sv-attd-face"><span class="sv-attd-ext">{p.error ? '!' : `${Math.round(p.progress * 100)}%`}</span></span>
          <span class="sv-attd-name" title={p.file.name}>{p.file.name}</span>
          {#if p.error}
            <span class="sv-attd-error">{p.error}</span>
            <span class="sv-attd-actions">
              <button type="button" class="sv-attd-link" onclick={() => retry(p)}>Retry</button>
              <button type="button" class="sv-attd-link" onclick={() => drop(p)}>Remove</button>
            </span>
          {:else}
            <span class="sv-attd-bar"><span style:width={`${Math.round(p.progress * 100)}%`}></span></span>
            <button type="button" class="sv-attd-remove" aria-label={`Cancel ${p.file.name}`} onclick={() => drop(p)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if rejected.length}
      <ul class="sv-attd-rejected" role="alert">
        {#each rejected as r, i (i)}<li>{r}</li>{/each}
      </ul>
    {/if}
  </div>

  {#snippet footer()}
    <div class="sv-attd-footer">
      <input
        bind:this={fileInput}
        type="file"
        multiple
        accept={props.accept}
        hidden
        onchange={onPick}
      />
      <button type="button" class="sv-attd-btn" onclick={() => fileInput?.click()}>Add files</button>
      <input
        class="sv-attd-url"
        type="url"
        placeholder="or paste a URL"
        aria-label="Add a file by URL"
        bind:value={urlText}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addUrls()
          }
        }}
      />
      <span class="sv-attd-spacer"></span>
      <button type="button" class="sv-attd-btn" onclick={cancel}>Cancel</button>
      <button type="button" class="sv-attd-btn is-primary" onclick={done} disabled={busy}>
        {busy ? `Uploading ${pending.filter((p) => !p.error).length}...` : 'Done'}
      </button>
    </div>
  {/snippet}
</SvModal>

{#if previewIndex !== null}
  <AttachmentPreview items={items} bind:index={previewIndex} />
{/if}

<style>
  .sv-attd { min-height: 160px; border: 2px dashed transparent; border-radius: 8px; padding: 4px; }
  .sv-attd.is-dropping { border-color: var(--sg-accent, #2563eb); }
  .sv-attd-empty { margin: 40px 0; text-align: center; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-attd-tiles {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;
  }
  .sv-attd-tile {
    position: relative; display: flex; flex-direction: column; gap: 3px;
    padding: 6px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px;
    background: var(--sg-bg, #fff); cursor: grab; min-width: 0;
  }
  .sv-attd-tile:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 1px; }
  .sv-attd-tile.is-dragging { opacity: 0.4; }
  .sv-attd-tile.is-pending { cursor: default; }
  .sv-attd-face {
    display: flex; align-items: center; justify-content: center;
    height: 96px; border: 0; padding: 0; border-radius: 6px; overflow: hidden;
    background: var(--sg-header-bg, #f8fafc); cursor: zoom-in;
  }
  .sv-attd-face img { width: 100%; height: 100%; object-fit: cover; }
  .sv-attd-ext { font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-attd-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-attd-size, .sv-attd-error { font-size: 11px; color: var(--sg-muted, #64748b); }
  .sv-attd-error { color: var(--sg-danger, #dc2626); }
  .sv-attd-actions { display: flex; gap: 8px; }
  .sv-attd-link { border: 0; padding: 0; background: none; color: inherit; text-decoration: underline; font: inherit; font-size: 12px; cursor: pointer; }
  .sv-attd-bar { height: 4px; border-radius: 2px; background: var(--sg-header-bg, #f8fafc); overflow: hidden; }
  .sv-attd-bar > span { display: block; height: 100%; background: var(--sg-muted, #64748b); transition: width 120ms linear; }
  .sv-attd-remove {
    position: absolute; top: 10px; inset-inline-end: 10px;
    display: inline-flex; padding: 3px; border: 0; border-radius: 999px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); cursor: pointer; opacity: 0.85;
  }
  .sv-attd-remove:hover { opacity: 1; }
  .sv-attd-rejected { margin: 10px 0 0; padding-inline-start: 18px; font-size: 12px; color: var(--sg-danger, #dc2626); }
  .sv-attd-footer { display: flex; align-items: center; gap: 8px; width: 100%; }
  .sv-attd-spacer { flex: 1; }
  .sv-attd-url {
    width: 220px; height: 30px; padding: 0 8px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-attd-btn {
    height: 30px; padding: 0 12px; font: inherit; font-size: 13px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-attd-btn.is-primary { background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); border-color: transparent; }
  .sv-attd-btn:disabled { opacity: 0.6; cursor: default; }
</style>
