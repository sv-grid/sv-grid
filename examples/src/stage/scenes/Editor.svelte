<script lang="ts">
  import { stage } from '../state.svelte'
  import { highlight } from '../highlight'
  import Window from './Window.svelte'

  const lines = $derived(stage.editor.code.split('\n'))
  const html = $derived(highlight(stage.editor.code))
  let bodyEl = $state<HTMLDivElement | null>(null)
  let codeEl = $state<HTMLPreElement | null>(null)

  const BASE_PX = 15.5
  const MIN_PX = 9.5

  /**
   * Shrink the type until the widest line fits. The pane is half as wide in
   * the split layout, and a clipped line is worse than a small one: lessons
   * were teaching options (`aggregate`, `summary`, `groupBy`) that sat past
   * the cut and never appeared on camera.
   */
  function fit() {
    if (!bodyEl || !codeEl) return
    bodyEl.style.fontSize = `${BASE_PX}px`
    const lens = lines.map((l) => l.length).sort((a, b) => a - b)
    const longest = lens[lens.length - 1] ?? 0
    if (!longest) return
    // Fit the 90th percentile rather than the longest line. Sample DATA rows
    // run to 175 characters in some snippets while the code that teaches the
    // lesson is half that; fitting the maximum would shrink everything to the
    // floor and still clip. An outlier data row losing its tail is fine.
    const target = lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.9))] ?? longest
    // One measurement gives the per-character advance at the base size.
    const charPx = codeEl.scrollWidth / longest
    if (!charPx) return
    const px = Math.max(MIN_PX, Math.min(BASE_PX, (BASE_PX * codeEl.clientWidth) / (target * charPx)))
    bodyEl.style.fontSize = `${px}px`
  }

  /**
   * Put the requested line in view, or follow the caret to the bottom. Run
   * again on the next two frames: a reveal changes the code and the layout in
   * one go, so the first measurement happens while the split is still settling
   * and used to leave the editor sitting on line 1.
   */
  function place() {
    if (!bodyEl) return
    fit()
    const line = stage.editor.focusLine
    if (line == null) {
      bodyEl.scrollTop = bodyEl.scrollHeight
      return
    }
    const row = bodyEl.querySelector<HTMLElement>(`.ed-gutter > div:nth-child(${line})`)
    if (!row) {
      bodyEl.scrollTop = bodyEl.scrollHeight
      return
    }
    // Centre it rather than pin it to the top, so the lines around it read.
    bodyEl.scrollTop = Math.max(0, row.offsetTop - bodyEl.clientHeight / 2 + row.offsetHeight)
  }

  $effect(() => {
    void stage.editor.code
    void stage.editor.focusLine
    void stage.layout
    place()
    const a = requestAnimationFrame(() => {
      place()
      requestAnimationFrame(place)
    })
    return () => cancelAnimationFrame(a)
  })
</script>

<Window>
  {#snippet bar()}
    <span class="ed-tab">{stage.editor.file}</span>
  {/snippet}
  <div class="ed" bind:this={bodyEl}>
    <div class="ed-gutter" aria-hidden="true">
      {#each lines as _, i (i)}<div>{i + 1}</div>{/each}
    </div>
    <pre class="ed-code" bind:this={codeEl}><code>{@html html}</code>{#if stage.editor.cursor}<span class="ed-cursor"></span>{/if}</pre>
  </div>
</Window>

<style>
  .ed-tab {
    padding: 4px 12px;
    border-radius: 6px;
    background: var(--sg-bg, #0c0a09);
    color: #e7e5e4;
    font-size: 13px;
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  }
  .ed {
    flex: 1;
    min-height: 0;
    display: flex;
    /* Not `stretch`, which is the default: that sizes the gutter and the <pre>
       to THIS box's height rather than to their content, and the <pre>'s
       `overflow: hidden` then cuts every line past the first screenful. The
       pane still scrolled, so the line numbers kept climbing over code that
       had already been clipped away - scrolling down with no new code. */
    align-items: flex-start;
    overflow: hidden;
    padding: 14px 0;
    font-family: ui-monospace, 'Cascadia Code', 'JetBrains Mono', Consolas, Menlo, monospace;
    font-size: 15.5px;
    line-height: 1.55;
  }
  .ed-gutter {
    width: 52px;
    padding-right: 14px;
    text-align: right;
    color: #57534e;
    user-select: none;
    flex-shrink: 0;
  }
  .ed-code {
    margin: 0;
    padding: 0 18px 0 6px;
    flex: 1;
    min-width: 0;
    color: #e7e5e4;
    white-space: pre;
    tab-size: 2;
    overflow: hidden;
  }
  .ed-code :global(.tk-kw) { color: #c4b5fd; }
  .ed-code :global(.tk-string) { color: #fdba74; }
  .ed-code :global(.tk-comment) { color: #78716c; font-style: italic; }
  .ed-code :global(.tk-tag) { color: #7dd3fc; }
  .ed-code :global(.tk-attr) { color: #a5f3fc; }
  .ed-code :global(.tk-type) { color: #fde68a; }
  .ed-code :global(.tk-number) { color: #f9a8d4; }
  .ed-cursor {
    display: inline-block;
    width: 2px;
    height: 1.2em;
    vertical-align: -0.25em;
    background: #fafaf9;
    animation: ed-blink 1s steps(2, start) infinite;
  }
  @keyframes ed-blink { to { visibility: hidden; } }
</style>
