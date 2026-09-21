<script lang="ts">
  import { stage } from '../state.svelte'
  import { highlight } from '../highlight'
  import Window from './Window.svelte'

  const lines = $derived(stage.editor.code.split('\n'))
  const html = $derived(highlight(stage.editor.code))
  let bodyEl = $state<HTMLDivElement | null>(null)

  $effect(() => {
    void stage.editor.code
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight
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
    <pre class="ed-code"><code>{@html html}</code>{#if stage.editor.cursor}<span class="ed-cursor"></span>{/if}</pre>
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
