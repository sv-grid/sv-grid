<script lang="ts">
  /**
   * Modal that shows the .svelte source of the currently-running demo.
   * Source text is bundled at build time via Vite's `?raw` query.
   * Copy puts the text on the clipboard; Esc / backdrop closes.
   */
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
      // ignore - clipboard can be blocked by permissions / unfocused tab
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
  class="src-backdrop"
  onclick={(e) => { if (e.target === e.currentTarget) onClose() }}
  role="presentation"
>
  <div
    class="src-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="source-modal-title"
  >
    <header class="src-head">
      <div class="src-head-text">
        <h2 id="source-modal-title" class="src-title">{title}</h2>
        <p class="src-sub">Source - copy into your project as-is.</p>
      </div>
      <div class="src-head-actions">
        <button type="button" onclick={copy} class="src-btn">
          {#if copied}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Copied
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            Copy
          {/if}
        </button>
        <button type="button" onclick={onClose} aria-label="Close" class="src-close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
    <pre class="source-pre"><code>{source}</code></pre>
  </div>
</div>

<style>
  /* Use --sg-* tokens (which the app's theme switch already updates) and
     give every surface an explicit color in BOTH modes so the modal can't
     fall back to user-agent defaults. */
  .src-backdrop {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: stretch; justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    padding: 32px;
  }
  @media (max-width: 640px) { .src-backdrop { padding: 16px; } }

  .src-modal {
    display: flex; flex-direction: column;
    width: 100%; max-width: 1024px;
    border-radius: 10px; overflow: hidden;
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
  }

  .src-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    color: var(--sg-header-fg, var(--sg-fg, #0f172a));
  }
  .src-head-text { min-width: 0; }
  .src-title { font-size: 14px; font-weight: 600; margin: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .src-sub   { font-size: 11.5px; color: var(--sg-muted, #64748b);
    margin: 1px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .src-head-actions { display: flex; align-items: center; gap: 8px; }

  .src-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 6px; padding: 4px 12px;
    font-size: 13px; cursor: pointer;
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .src-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .src-close {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px;
    border-radius: 6px; cursor: pointer;
    background: transparent;
    color: var(--sg-muted, #64748b);
    border: 0;
  }
  .src-close:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }

  .source-pre {
    margin: 0; flex: 1; overflow: auto;
    padding: 16px; line-height: 1.55;
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
    background: #0b1220;
    color: #e2e8f0;
  }
</style>
