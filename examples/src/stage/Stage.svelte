<script lang="ts">
  /**
   * The recording stage: one of a handful of scenes, filling the viewport.
   * Every scene is laid out for a 1280x720 frame; main.ts scales the page for
   * a 1920x1080 recording so the same scripts work at both sizes.
   */
  import { stage } from './state.svelte'
  import TitleCard from './scenes/TitleCard.svelte'
  import Terminal from './scenes/Terminal.svelte'
  import Editor from './scenes/Editor.svelte'
  import BrowserFrame from './scenes/BrowserFrame.svelte'
</script>

<div class="stage demo-page" class:is-fading={stage.fading} data-layout={stage.layout}>
  {#if stage.layout === 'title' || stage.layout === 'end'}
    <TitleCard end={stage.layout === 'end'} />
  {:else if stage.layout === 'terminal'}
    <div class="stage-one"><Terminal /></div>
  {:else if stage.layout === 'editor'}
    <div class="stage-one"><Editor /></div>
  {:else if stage.layout === 'browser'}
    <div class="stage-one"><BrowserFrame /></div>
  {:else if stage.layout === 'split'}
    <div class="stage-split">
      <div class="stage-split-left"><Editor /></div>
      <div class="stage-split-right"><BrowserFrame /></div>
    </div>
  {/if}
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    width: 1280px;
    height: 720px;
    background: var(--sg-bg, #0c0a09);
    color: var(--sg-fg, #fafaf9);
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    transition: opacity 180ms ease;
    overflow: hidden;
  }
  .stage.is-fading { opacity: 0; }
  .stage-one {
    position: absolute;
    inset: 36px 48px;
    display: flex;
  }
  .stage-one > :global(*) { flex: 1; min-width: 0; }
  .stage-split {
    position: absolute;
    inset: 36px 40px;
    display: grid;
    grid-template-columns: 1.18fr 1fr;
    gap: 20px;
  }
  .stage-split-left, .stage-split-right { display: flex; min-width: 0; }
  .stage-split-left > :global(*), .stage-split-right > :global(*) { flex: 1; min-width: 0; }
</style>
