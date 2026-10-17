<script lang="ts" module>
  /**
   * Upload drop zone block - the empty Files area of a deal record. While no
   * files are attached, SvFileUpload fills the panel as a large dashed drop
   * zone (drag or browse, accepted types and a 10 MB cap); added files move
   * into a list with type, size, an SvProgress upload bar and a remove button,
   * and the zone shrinks to an "add more" strip. Removing every file brings
   * the empty state back. SvBadge, SvButton, SvToaster.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createUploadList() below owns the file list, per-file upload
   * progress, the total size and rejections with no markup. The component
   * under it is one styled render of that core; import createUploadList from
   * this file (or `npx @svgrid/ui add empty-states-drop-zone --headless` for
   * the core alone) to draw your own.
   */
  import type { FileRejection } from '@svgrid/grid'

  export type UploadItem = { id: number; file: File; progress: number }
  export type UploadListOptions = {
    /** Accepted extensions or MIME types, comma separated; PDF, Office and images by default. */
    accept?: string
    /** Per-file size cap in bytes; 10 MB by default. */
    maxSize?: number
    /** Send one file to storage, reporting 0-100 as it goes. Resolve when
     *  done; reject to drop the file from the list. Without it, files
     *  complete at once. */
    upload?: (file: File, progress: (pct: number) => void) => Promise<void>
    onUploaded?: (file: File) => void
    onUploadError?: (file: File, error: unknown) => void
    /** Files the picker turned away (wrong type or too big). */
    onReject?: (rejections: FileRejection[]) => void
  }

  function formatSize(n: number) {
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`
  }
  /** Short uppercase extension for a file-type tile, e.g. PDF. */
  function fileExt(name: string) {
    return (name.split('.').pop() ?? '').toUpperCase().slice(0, 4)
  }

  export function createUploadList(opts: UploadListOptions = {}) {
    // Uploads run in parallel; a removed file ignores its late progress.
    let pending = $state<File[]>([])
    let items = $state<UploadItem[]>([])
    let nextId = 1

    const total = $derived(items.reduce((n, it) => n + it.file.size, 0))
    const find = (id: number) => items.find((x) => x.id === id)

    async function start(id: number, file: File) {
      try {
        await opts.upload?.(file, (pct) => {
          const it = find(id)
          if (it) it.progress = Math.min(100, pct)
        })
      } catch (err) {
        if (find(id)) { items = items.filter((x) => x.id !== id); opts.onUploadError?.(file, err) }
        return
      }
      const it = find(id)
      if (!it) return
      it.progress = 100
      opts.onUploaded?.(file)
    }

    /** Take accepted files from the picker into the list and start them. */
    function add(files: File[]) {
      if (!files.length) return
      const added = files.map((file) => ({ id: nextId++, file, progress: 0 }))
      items = [...items, ...added]
      // Empty the picker value so it never shows its own list.
      pending = []
      for (const it of added) start(it.id, it.file)
    }

    return {
      accept: opts.accept ?? '.pdf,.docx,.xlsx,.png,.jpg',
      maxSize: opts.maxSize ?? 10 * 1024 * 1024,
      /** Bind to the picker value; add() clears it. */
      get pending() { return pending },
      set pending(v: File[]) { pending = v },
      get items() { return items },
      /** Sum of all file sizes, in bytes. */
      get total() { return total },
      add,
      reject: (rejections: FileRejection[]) => opts.onReject?.(rejections),
      remove: (id: number) => { items = items.filter((x) => x.id !== id) },
      formatSize,
      fileExt,
    }
  }
</script>

<script lang="ts">
  import { SvFileUpload, SvProgress, SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const files = createUploadList({
    // Simulated upload: replace with a fetch/XHR to your storage endpoint.
    upload: (_file, progress) =>
      new Promise<void>((res) => {
        let pct = 0
        const timer = setInterval(() => {
          pct = Math.min(100, pct + 20 + Math.round(Math.random() * 15))
          progress(pct)
          if (pct >= 100) { clearInterval(timer); res() }
        }, 220)
      }),
    onUploaded: (file) => toast.success(`${file.name} uploaded`),
    onReject: (rejections) => {
      for (const r of rejections) {
        toast.error(r.reason === 'size' ? `${r.file.name} is over 10 MB` : `${r.file.name} is not a supported type`)
      }
    },
  })
</script>

<section class="sv-dropzone" aria-labelledby="sv-dropzone-title">
  <header class="sv-dropzone-bar">
    <div>
      <h2 id="sv-dropzone-title">Files</h2>
      <p class="sv-dropzone-muted">Northwind - Renewal 2027 deal</p>
    </div>
    {#if files.items.length}
      <span class="sv-dropzone-summary">{files.items.length} {files.items.length === 1 ? 'file' : 'files'} - {files.formatSize(files.total)}</span>
    {/if}
  </header>

  {#if files.items.length}
    <ul class="sv-dropzone-files">
      {#each files.items as it (it.id)}
        <li>
          <span class="sv-dropzone-type" aria-hidden="true">{files.fileExt(it.file.name)}</span>
          <div class="sv-dropzone-meta">
            <strong title={it.file.name}>{it.file.name}</strong>
            {#if it.progress < 100}
              <SvProgress value={it.progress} size="sm" ariaLabel={`Uploading ${it.file.name}`} />
            {:else}
              <span class="sv-dropzone-muted">{files.formatSize(it.file.size)}</span>
            {/if}
          </div>
          {#if it.progress >= 100}<SvBadge variant="success" size="sm">Uploaded</SvBadge>{/if}
          <SvButton variant="ghost" size="sm" ariaLabel={`Remove ${it.file.name}`} onclick={() => files.remove(it.id)}>Remove</SvButton>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="sv-dropzone-zone" class:sv-dropzone-is-compact={files.items.length > 0}>
    {#if !files.items.length}
      <p class="sv-dropzone-lead">No files yet</p>
      <p class="sv-dropzone-muted sv-dropzone-center">Attach the signed order form, quotes or anything the team needs for this deal.</p>
    {/if}
    <SvFileUpload
      bind:files={files.pending}
      onChange={files.add}
      onReject={files.reject}
      accept={files.accept}
      maxSize={files.maxSize}
      multiple
      ariaLabel="Upload files"
      hint="PDF, Word, Excel or images, up to 10 MB each"
      messages={{ prompt: files.items.length ? 'Drop more files or' : 'Drag files here or', browse: 'browse', hintTypes: 'Types:' }}
    />
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-dropzone {
    min-height: 460px; padding: 28px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 16px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-dropzone-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .sv-dropzone-bar h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-dropzone-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-dropzone-center { text-align: center; max-width: 44ch; margin: 0 0 10px; }
  .sv-dropzone-summary { font-size: 13px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-dropzone-lead { margin: 0; font-size: 15px; font-weight: 650; }

  .sv-dropzone-zone { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .sv-dropzone-zone.sv-dropzone-is-compact { flex: none; }
  /* SvFileUpload has a fixed 320 px width and no `block` prop; stretch it here. */
  .sv-dropzone-zone :global(.sv-field) { display: flex; width: 100%; max-width: 560px; }
  .sv-dropzone-zone :global(.sv-file) { width: 100%; }
  .sv-dropzone-zone:not(.sv-dropzone-is-compact) :global(.sv-file__zone) { padding: 44px 20px; border-width: 2px; }
  .sv-dropzone-zone:not(.sv-dropzone-is-compact) :global(.sv-field__hint) { text-align: center; }
  .sv-dropzone-zone.sv-dropzone-is-compact :global(.sv-field) { max-width: none; }
  .sv-dropzone-zone.sv-dropzone-is-compact :global(.sv-file__zone) { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 4px 10px; padding: 14px 16px; }

  .sv-dropzone-files {
    list-style: none; margin: 0; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-dropzone-files li { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dropzone-files li:last-child { border-bottom: 0; }
  .sv-dropzone-type {
    flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 8px;
    font-size: 10.5px; font-weight: 700; letter-spacing: .03em; color: var(--sg-muted, #64748b);
    background: var(--sg-bg-subtle, #f1f5f9); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-dropzone-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .sv-dropzone-meta strong { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-dropzone-meta .sv-dropzone-muted { margin: 0; font-size: 12.5px; font-variant-numeric: tabular-nums; }

  @media (max-width: 560px) {
    .sv-dropzone { padding: 18px 16px; }
    .sv-dropzone-files li { padding: 10px; gap: 10px; }
    .sv-dropzone-files li :global(.sv-badge) { display: none; }
  }
</style>
