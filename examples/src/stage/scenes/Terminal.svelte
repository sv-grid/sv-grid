<script lang="ts">
  import { stage } from '../state.svelte'
  import Window from './Window.svelte'

  let bodyEl = $state<HTMLDivElement | null>(null)

  // Keep the newest line in view, like a terminal does.
  $effect(() => {
    void stage.terminal.lines.length
    void stage.terminal.typing
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight
  })
</script>

<Window title={stage.terminal.title}>
  <div class="term" bind:this={bodyEl}>
    {#each stage.terminal.lines as line, i (i)}
      {#if line.kind === 'cmd'}
        <div class="term-line term-cmd"><span class="term-prompt">{stage.terminal.prompt}</span>{line.text}</div>
      {:else}
        <div class="term-line term-out {line.cls ? `is-${line.cls}` : ''}">{line.text || ' '}</div>
      {/if}
    {/each}
    <!-- One line: pre-wrap keeps every newline inside the div. -->
    <div class="term-line term-cmd"><span class="term-prompt">{stage.terminal.prompt}</span>{stage.terminal.typing}{#if stage.terminal.cursor}<span class="term-cursor"></span>{/if}</div>
  </div>
</Window>

<style>
  .term {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 18px 22px;
    font-family: ui-monospace, 'Cascadia Code', 'JetBrains Mono', Consolas, Menlo, monospace;
    font-size: 19px;
    line-height: 1.55;
    color: #e7e5e4;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .term-prompt { color: #a8a29e; }
  .term-cmd { color: #fafaf9; }
  .term-out { color: #d6d3d1; }
  .term-out.is-dim { color: #78716c; }
  .term-out.is-ok { color: #4ade80; }
  .term-out.is-bold { color: #fafaf9; font-weight: 600; }
  .term-out.is-warn { color: #fbbf24; }
  .term-out.is-err { color: #f87171; }
  .term-cursor {
    display: inline-block;
    width: 10px;
    height: 1.1em;
    margin-left: 2px;
    vertical-align: -0.2em;
    background: #e7e5e4;
    animation: term-blink 1s steps(2, start) infinite;
  }
  @keyframes term-blink { to { visibility: hidden; } }
</style>
