<script lang="ts">
  /**
   * Floating "Ask AI" widget for the docs site. Opens a panel anchored
   * bottom-right; takes a freeform question; routes through a single
   * adapter you wire up at app boot:
   *
   *   <AskAi
   *     ask={async (q, ctx) => fetch('/api/docs-chat', {...}).then((r) => r.text())}
   *     grounding="https://svgrid.com/llms-full.txt"
   *   />
   *
   * `grounding` is fetched once and passed to your adapter as the
   * `ctx.docs` argument so the model can ground answers in the current
   * documentation rather than hallucinate from its training set.
   *
   * NOTE: zero outbound network calls of our own. The adapter is YOURS.
   */
  import { onMount } from 'svelte'

  type Ask = (
    question: string,
    ctx: { docs: string; history: Array<{ role: 'user' | 'assistant'; content: string }> },
  ) => Promise<string>

  type Props = {
    ask: Ask
    grounding?: string
    placeholder?: string
  }
  let { ask, grounding, placeholder = 'Ask anything about sv-grid…' }: Props = $props()

  let open = $state(false)
  let busy = $state(false)
  let q = $state('')
  let history = $state<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  let docs = $state<string>('')
  let panelEl: HTMLDivElement | undefined
  let inputEl: HTMLTextAreaElement | undefined

  onMount(async () => {
    if (grounding) {
      try {
        const r = await fetch(grounding)
        if (r.ok) docs = await r.text()
      } catch {
        // Grounding is optional; the model still answers from its weights.
      }
    }
  })

  async function submit() {
    if (busy || !q.trim()) return
    const question = q.trim()
    q = ''
    history = [...history, { role: 'user', content: question }]
    busy = true
    try {
      const answer = await ask(question, { docs, history })
      history = [...history, { role: 'assistant', content: answer }]
    } catch (e) {
      history = [...history, { role: 'assistant', content: `Sorry - ${String(e)}` }]
    } finally {
      busy = false
      requestAnimationFrame(() => panelEl?.scrollTo({ top: panelEl.scrollHeight, behavior: 'smooth' }))
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submit()
    }
    if (e.key === 'Escape') open = false
  }

  $effect(() => {
    if (open) requestAnimationFrame(() => inputEl?.focus())
  })

  // Global ⌘ / Ctrl + I to toggle.
  onMount(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        open = !open
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
</script>

<button class="ai-fab" class:is-open={open}
  onclick={() => (open = !open)}
  aria-label="Ask AI about sv-grid">
  <span class="ai-spark">✨</span>
  <span class="ai-fab-label">Ask AI</span>
  <kbd class="ai-fab-kbd">⌘I</kbd>
</button>

{#if open}
  <div class="ai-backdrop" role="presentation" onclick={() => (open = false)}></div>
  <aside class="ai-panel" role="dialog" aria-label="Ask AI">
    <header class="ai-head">
      <div class="ai-title">
        <span class="ai-spark">✨</span>
        Ask AI about sv-grid
      </div>
      <button class="ai-close" aria-label="Close" onclick={() => (open = false)}>×</button>
    </header>

    <div class="ai-body" bind:this={panelEl}>
      {#if history.length === 0}
        <div class="ai-empty">
          <p>Grounded in the live docs. Try:</p>
          <ul>
            <li><button onclick={() => { q = 'How do I disable sort on one column?'; void submit() }}>How do I disable sort on one column?</button></li>
            <li><button onclick={() => { q = 'Show me a server-side filter with TanStack Query'; void submit() }}>Server-side filter with TanStack Query</button></li>
            <li><button onclick={() => { q = 'How does the Pro license check work?'; void submit() }}>How does the Pro license check work?</button></li>
            <li><button onclick={() => { q = 'Generate a 5-column grid for an order list'; void submit() }}>Generate a 5-column grid for an order list</button></li>
          </ul>
        </div>
      {/if}
      {#each history as msg, i (i)}
        <article class="ai-msg ai-msg-{msg.role}">
          <header>{msg.role === 'user' ? 'You' : 'sv-grid AI'}</header>
          <div class="ai-msg-body">{@html escapeAndFormat(msg.content)}</div>
        </article>
      {/each}
      {#if busy}
        <article class="ai-msg ai-msg-assistant ai-msg-loading">
          <header>sv-grid AI</header>
          <div>Thinking…</div>
        </article>
      {/if}
    </div>

    <footer class="ai-foot">
      <textarea
        bind:this={inputEl}
        bind:value={q}
        onkeydown={onKey}
        rows="2"
        {placeholder}
        disabled={busy}
      ></textarea>
      <button class="ai-send" disabled={busy || !q.trim()} onclick={submit}>
        Ask <kbd>⌘↵</kbd>
      </button>
    </footer>
  </aside>
{/if}

<script context="module" lang="ts">
  /** Minimal markdown-ish formatter so code blocks render as <pre>. */
  function escapeAndFormat(s: string): string {
    const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
    const html = esc(s)
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
    return html
  }
</script>

<style>
  .ai-spark { display: inline-block; }

  .ai-fab {
    position: fixed; right: 20px; bottom: 20px;
    z-index: 90;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 14px;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
    transition: transform 100ms ease;
  }
  .ai-fab:hover  { transform: translateY(-1px); }
  .ai-fab.is-open { transform: scale(0.95); }
  .ai-fab-label  { font-size: 13px; }
  .ai-fab-kbd    {
    font-size: 10px; opacity: 0.85;
    background: rgba(255, 255, 255, 0.18);
    padding: 1px 5px; border-radius: 4px;
  }

  .ai-backdrop {
    position: fixed; inset: 0;
    z-index: 95;
    background: rgba(15, 23, 42, 0.30);
    backdrop-filter: blur(2px);
  }
  .ai-panel {
    position: fixed; right: 16px; bottom: 16px;
    z-index: 100;
    width: min(440px, calc(100vw - 32px));
    height: min(640px, calc(100vh - 32px));
    display: flex; flex-direction: column;
    background: var(--site-bg, #fff);
    color: var(--site-fg, #0f172a);
    border: 1px solid var(--site-border, #e2e8f0);
    border-radius: 14px;
    box-shadow: 0 25px 60px rgba(15, 23, 42, 0.30);
    overflow: hidden;
  }
  .ai-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--site-border, #e2e8f0);
  }
  .ai-title { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
  .ai-close {
    background: transparent; border: 0; cursor: pointer;
    font-size: 20px; color: var(--site-muted, #64748b);
    width: 28px; height: 28px; border-radius: 6px;
  }
  .ai-close:hover { background: rgba(148, 163, 184, 0.15); color: inherit; }

  .ai-body {
    flex: 1; min-height: 0;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .ai-empty p  { font-size: 13px; color: var(--site-muted, #64748b); margin: 0 0 8px; }
  .ai-empty ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .ai-empty button {
    background: rgba(99, 102, 241, 0.10);
    color: var(--site-accent, #4338ca);
    border: 0; border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .ai-empty button:hover { background: rgba(99, 102, 241, 0.18); }

  .ai-msg {
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
    line-height: 1.5;
  }
  .ai-msg header {
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--site-muted, #94a3b8); margin-bottom: 4px;
  }
  .ai-msg-user      { background: var(--site-row-alt-bg, #f8fafc); align-self: flex-end; max-width: 80%; }
  .ai-msg-assistant { background: rgba(99, 102, 241, 0.06); }
  .ai-msg-loading   { font-style: italic; opacity: 0.7; }
  .ai-msg-body :global(pre) {
    margin: 6px 0 0; padding: 8px;
    background: rgba(15, 23, 42, 0.06);
    border-radius: 6px;
    font-size: 11.5px;
    overflow-x: auto;
  }

  .ai-foot {
    display: flex; gap: 8px; align-items: stretch;
    padding: 10px 12px;
    border-top: 1px solid var(--site-border, #e2e8f0);
  }
  .ai-foot textarea {
    flex: 1; resize: none;
    border: 1px solid var(--site-border, #cbd5e1);
    border-radius: 8px;
    padding: 6px 10px;
    background: var(--site-bg, #fff);
    color: var(--site-fg, #0f172a);
    font-family: inherit; font-size: 13px;
    outline: none;
  }
  .ai-foot textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18); }
  .ai-send {
    background: #4338ca; color: #fff;
    border: 0; border-radius: 8px;
    padding: 0 14px;
    font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .ai-send:disabled { opacity: 0.50; cursor: default; }
  .ai-send kbd {
    font-size: 10px; opacity: 0.80;
    background: rgba(255, 255, 255, 0.18);
    padding: 1px 4px; border-radius: 4px;
  }
</style>
