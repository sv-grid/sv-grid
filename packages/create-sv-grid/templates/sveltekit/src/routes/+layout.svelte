<script lang="ts">
  import '../app.css'
  import { theme, presets } from '$lib/theme.svelte'

  let { children, data } = $props()

  // Apply on mount so the picker's starting value wins over the stylesheet, and
  // on every later change. Runs client-side only - the server-rendered HTML is
  // already themed by the stylesheet import in app.css.
  $effect(() => {
    theme.apply()
  })
</script>

<header class="bar">
  <strong>SvGrid + SvelteKit</strong>

  <label>
    Theme
    <select
      value={theme.id}
      onchange={(e) => theme.set(e.currentTarget.value)}
      aria-label="Grid theme"
    >
      {#each presets as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>

  <button type="button" onclick={() => theme.toggleMode()} aria-pressed={theme.mode === 'dark'}>
    {theme.mode === 'dark' ? 'Dark' : 'Light'}
  </button>

  {#if data?.user}
    <span class="who">{data.user.email} <em>({data.user.role})</em></span>
    <!-- A form, not a link: see routes/logout/+page.server.ts for why. -->
    <form class="out" method="POST" action="/logout"><button type="submit">Sign out</button></form>
  {:else}
    <a class="who" href="/login">Sign in</a>
  {/if}
</header>

<main>
  {@render children?.()}
</main>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--sg-border);
    background: var(--sg-header-bg);
    color: var(--sg-header-fg);
    font-family: system-ui, sans-serif;
  }
  .bar label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
  }
  .bar select,
  .bar button {
    font: inherit;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
  }
  .bar button {
    cursor: pointer;
    min-width: 4.5rem;
  }
  .who {
    margin-inline-start: auto;
    font-size: 0.875rem;
    color: var(--sg-header-fg);
  }
  .who em { color: var(--sg-muted, #64748b); font-style: normal; }
  .out { margin: 0; }
  main {
    padding: 1.25rem;
    font-family: system-ui, sans-serif;
    color: var(--sg-fg);
    background: var(--sg-bg);
    min-height: 100vh;
  }
</style>
