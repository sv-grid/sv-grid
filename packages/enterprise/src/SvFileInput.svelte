<script lang="ts">
  /**
   * SvFileInput - a file / image upload control for the edit form. Picks a file,
   * shows an image preview (when `image`), and stores a URL. With an `upload`
   * handler it pushes to your storage and stores the returned URL; without one it
   * falls back to an inline data URL (great for demos / small assets). Used by
   * SvGridEditPanel for fields with an `upload` config.
   */
  type Props = {
    value: unknown
    onChange: (url: string) => void
    id?: string
    accept?: string
    image?: boolean
    disabled?: boolean
    /** Push the file to storage and resolve with the URL to store. */
    upload?: (file: File) => Promise<string>
  }

  let { value, onChange, id, accept, image = false, disabled = false, upload }: Props = $props()

  let loading = $state(false)
  let error = $state<string | null>(null)
  let name = $state('')
  let inputEl: HTMLInputElement | undefined = $state()

  const url = $derived(typeof value === 'string' ? value : '')

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read the file'))
      reader.readAsDataURL(file)
    })
  }

  async function onPick(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    name = file.name
    error = null
    loading = true
    try {
      onChange(upload ? await upload(file) : await readAsDataUrl(file))
    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed'
    } finally {
      loading = false
    }
  }

  function clear() {
    onChange('')
    name = ''
    if (inputEl) inputEl.value = ''
  }
</script>

<div class="sv-file">
  {#if image && url}
    <img class="sv-file__preview" src={url} alt="preview" />
  {/if}

  <div class="sv-file__row">
    <button
      type="button"
      class="sv-file__btn"
      {disabled}
      onclick={() => inputEl?.click()}
    >{loading ? 'Uploading…' : url ? 'Replace' : 'Choose file'}</button>

    {#if url && !image}
      <span class="sv-file__name" title={name || url}>{name || 'Uploaded file'}</span>
    {/if}
    {#if url && !disabled}
      <button type="button" class="sv-file__clear" aria-label="Remove" title="Remove" onclick={clear}>&times;</button>
    {/if}

    <input
      {id}
      bind:this={inputEl}
      class="sv-file__input"
      type="file"
      {accept}
      {disabled}
      onchange={onPick}
    />
  </div>

  {#if error}<p class="sv-file__err">{error}</p>{/if}
</div>

<style>
  .sv-file { display: flex; flex-direction: column; gap: 8px; }
  .sv-file__row { display: flex; align-items: center; gap: 8px; }
  .sv-file__input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .sv-file__preview {
    width: 64px; height: 64px; object-fit: cover; border-radius: 8px;
    border: 1px solid var(--sg-border, #ddd); background: var(--sg-header-bg, #f6f6f6);
  }
  .sv-file__btn {
    padding: 7px 12px; border: 1px solid var(--sg-border, #ccc); border-radius: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, inherit); cursor: pointer; font: inherit;
  }
  .sv-file__btn:disabled { opacity: 0.6; cursor: default; }
  .sv-file__name { font-size: 12px; color: var(--sg-muted, #666); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  .sv-file__clear {
    border: none; background: none; cursor: pointer; font-size: 16px; line-height: 1;
    color: var(--sg-muted, #888); padding: 2px 4px;
  }
  .sv-file__err { margin: 0; font-size: 12px; color: #dc2626; }
</style>
