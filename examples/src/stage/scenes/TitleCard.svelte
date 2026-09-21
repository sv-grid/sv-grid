<script lang="ts">
  /** Title and end cards of a marketing cut. Brand ink follows the theme. */
  import { stage } from '../state.svelte'
  let { end = false }: { end?: boolean } = $props()
  const t = $derived(stage.title)
</script>

<div class="card" class:is-end={end}>
  {#if t.brand}
    <div class="card-brand">
      <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
        <rect x="4" y="4" width="6" height="4" rx="1.2" fill="currentColor" opacity="0.95"/><rect x="11" y="4" width="4" height="4" rx="1.2" fill="currentColor" opacity="0.95"/><rect x="16" y="4" width="4" height="4" rx="1.2" fill="currentColor" opacity="0.95"/><path d="M16.9 5.4 L19.1 5.4 L18 6.9 Z" fill="#ff5a1f"/><rect x="4" y="9" width="6" height="3" rx="0.9" fill="currentColor" opacity="0.32"/><rect x="11" y="9" width="4" height="3" rx="0.9" fill="currentColor" opacity="0.32"/><rect x="16" y="9" width="4" height="3" rx="0.9" fill="#ff5a1f"/><rect x="4" y="13" width="6" height="3" rx="0.9" fill="currentColor" opacity="0.32"/><rect x="11" y="13" width="4" height="3" rx="0.9" fill="currentColor" opacity="0.32"/><rect x="16" y="13" width="4" height="3" rx="0.9" fill="#ff5a1f"/><rect x="4" y="17" width="6" height="3" rx="0.9" fill="currentColor" opacity="0.32"/><rect x="11" y="17" width="4" height="3" rx="0.9" fill="currentColor" opacity="0.32"/><rect x="16" y="17" width="4" height="3" rx="0.9" fill="#ff5a1f"/>
      </svg>
      <span>SvGrid</span>
    </div>
  {/if}
  {#if t.kicker}<div class="card-kicker">{t.kicker}</div>{/if}
  {#if t.title}<h1 class="card-title">{t.title}</h1>{/if}
  {#if t.subtitle}<p class="card-sub">{t.subtitle}</p>{/if}
  {#if t.lines.length}
    <div class="card-lines">
      {#each t.lines as line, i (i)}<code>{line}</code>{/each}
    </div>
  {/if}
</div>

<style>
  .card {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 120px;
    gap: 14px;
    animation: card-in 500ms ease both;
  }
  .card-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--sg-fg, #fafaf9);
  }
  .card-kicker {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #ff5a1f;
  }
  .card-title {
    margin: 0;
    font-size: 58px;
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.02em;
    max-width: 980px;
    color: var(--sg-fg, #fafaf9);
  }
  .card-sub {
    margin: 4px 0 0;
    font-size: 24px;
    line-height: 1.4;
    max-width: 880px;
    color: var(--sg-muted, #a8a29e);
  }
  .card-lines {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 18px;
  }
  .card-lines code {
    align-self: flex-start;
    padding: 10px 18px;
    border: 1px solid var(--sg-border, #292524);
    border-radius: 10px;
    background: var(--sg-bg-subtle, #151311);
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    font-size: 22px;
    color: #fafaf9;
  }
  .is-end .card-title { font-size: 48px; }
  @keyframes card-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
</style>
