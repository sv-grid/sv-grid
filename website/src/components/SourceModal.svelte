<script lang="ts">
  type Props = {
    title: string
    source: string
    onClose: () => void
  }
  let { title, source, onClose }: Props = $props()

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  async function copy() {
    try {
      await navigator.clipboard.writeText(source)
      copied = true
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copied = false), 1500)
    } catch {
      // ignore
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  $effect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

<div
  class="fixed inset-0 z-50 flex items-stretch justify-center p-4 sm:p-8"
  style="background: rgba(0,0,0,0.6)"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose()
  }}
  role="presentation"
>
  <div
    class="flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border shadow-2xl"
    style="background: var(--site-bg-elev); border-color: var(--site-border);"
    role="dialog"
    aria-modal="true"
    aria-labelledby="source-modal-title"
  >
    <header
      class="flex items-center justify-between gap-3 border-b px-4 py-3"
      style="border-color: var(--site-border);"
    >
      <div class="min-w-0">
        <h2 id="source-modal-title" class="truncate text-sm font-semibold">{title}</h2>
        <p class="truncate text-xs" style="color: var(--site-muted);">
          Source - copy into your project as-is.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={copy}
          class="inline-flex items-center gap-1.5 rounded border px-3 py-1 text-sm"
          style="border-color: var(--site-border); color: var(--site-fg); background: var(--site-bg);"
        >
          {#if copied}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Copied
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            Copy
          {/if}
        </button>
        <button
          type="button"
          onclick={onClose}
          aria-label="Close"
          class="inline-flex h-8 w-8 items-center justify-center rounded"
          style="color: var(--site-muted);"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
    <pre class="source-pre m-0 flex-1 overflow-auto p-4 leading-relaxed"><code>{source}</code></pre>
  </div>
</div>

<style>
  /* Light theme: dark text on a light-gray panel. Dark theme: light
     text on near-black. Pinned to known-good values so the modal
     never falls back to dark-on-dark when the site is in light mode. */
  .source-pre {
    background: #f1f5f9;
    color: #1e293b;
    font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
    font-size: 12.5px;
    tab-size: 2;
  }
  .source-pre code {
    font: inherit;
    color: inherit;
    background: transparent;
    display: block;
  }
  :global(html[data-theme='dark']) .source-pre {
    background: #0a1124;
    color: #e2e8f0;
  }
</style>
