<script lang="ts">
  /** A desktop window: title bar with traffic lights, then whatever is inside. */
  import type { Snippet } from 'svelte'
  let { title = '', children, bar }: { title?: string; children: Snippet; bar?: Snippet } = $props()
</script>

<div class="win">
  <div class="win-bar">
    <span class="win-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    {#if bar}{@render bar()}{:else}<span class="win-title">{title}</span>{/if}
  </div>
  <div class="win-body">
    {@render children()}
  </div>
</div>

<style>
  .win {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #292524);
    border-radius: 12px;
    background: var(--sg-bg-subtle, #151311);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }
  .win-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 40px;
    padding: 0 14px;
    border-bottom: 1px solid var(--sg-border, #292524);
    background: color-mix(in srgb, var(--sg-bg-subtle, #151311) 70%, var(--sg-bg, #0c0a09) 30%);
    font-size: 13px;
    color: var(--sg-muted, #a8a29e);
  }
  .win-dots { display: inline-flex; gap: 7px; }
  .win-dots i { width: 11px; height: 11px; border-radius: 50%; background: #3f3a36; display: block; }
  .win-title { margin: 0 auto; transform: translateX(-24px); }
  .win-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
