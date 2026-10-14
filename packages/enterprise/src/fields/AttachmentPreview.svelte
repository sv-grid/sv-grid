<script lang="ts">
  /**
   * Full-size view of one attachment, with Previous / Next (arrow keys) and
   * Escape to close. Images show inline, PDFs in an iframe, anything else as
   * its name with a Download link. Only http(s) and blob: URLs are used.
   */
  import { SvModal } from '@svgrid/grid'
  import { formatBytes, isImage, isPdf, safeUrl, type Attachment } from './attachments'

  let { items, index = $bindable() }: { items: Attachment[]; index: number | null } = $props()

  let open = $state(true)
  const item = $derived(index == null ? null : (items[index] ?? null))
  const src = $derived(item ? safeUrl(item.url, isImage(item)) : null)

  function step(d: number) {
    if (index == null || items.length < 2) return
    index = (index + d + items.length) % items.length
  }
  function close() {
    open = false
    index = null
  }
</script>

<SvModal bind:open title={item ? `${item.name}${item.size ? ` (${formatBytes(item.size)})` : ''}` : ''} width={900} onClose={close}>
  <!-- Arrow keys are handled on the window below, while the preview is open. -->
  <div class="sv-attp">
    {#if item && src && isImage(item)}
      <img class="sv-attp-img" {src} alt={item.name} />
    {:else if item && src && isPdf(item)}
      <iframe class="sv-attp-pdf" {src} title={item.name}></iframe>
    {:else if item}
      <div class="sv-attp-file">
        <span class="sv-attp-name">{item.name}</span>
        {#if src}<a class="sv-attp-download" href={src} download={item.name} target="_blank" rel="noopener noreferrer">Download</a>{/if}
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <div class="sv-attp-footer">
      <button type="button" class="sv-attp-btn" onclick={() => step(-1)} disabled={items.length < 2} aria-label="Previous file">Previous</button>
      <span class="sv-attp-count">{(index ?? 0) + 1} of {items.length}</span>
      <button type="button" class="sv-attp-btn" onclick={() => step(1)} disabled={items.length < 2} aria-label="Next file">Next</button>
    </div>
  {/snippet}
</SvModal>

<svelte:window
  onkeydown={(e) => {
    if (!open) return
    if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
  }}
/>

<style>
  .sv-attp { display: flex; align-items: center; justify-content: center; min-height: 360px; max-height: 70vh; }
  .sv-attp-img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 6px; }
  .sv-attp-pdf { width: 100%; height: 70vh; border: 0; border-radius: 6px; }
  .sv-attp-file { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .sv-attp-name { font-size: 15px; }
  .sv-attp-download { color: inherit; text-decoration: underline; }
  .sv-attp-footer { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; }
  .sv-attp-count { font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-attp-btn {
    height: 30px; padding: 0 12px; font: inherit; font-size: 13px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-attp-btn:disabled { opacity: 0.5; cursor: default; }
</style>
