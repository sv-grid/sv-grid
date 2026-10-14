<script lang="ts">
  import '../app.css'
  import { SvToaster } from '@svgrid/grid'
  // Who a person field can pick.
  import '$lib/people'

  let { children } = $props()

  // Light or dark: app.html settles it before the first paint; this flips it.
  function toggleMode() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('svgrid-theme', JSON.stringify({ mode: next }))
    } catch {
      // Private window: the choice lasts this visit.
    }
  }
</script>

<div class="app">
  <header class="bar">
    <strong>My base</strong>
    <button type="button" onclick={toggleMode}>Light / dark</button>
  </header>
  <main>
    {@render children()}
  </main>
</div>
<!-- Notices from automations and from saves the database refused. -->
<SvToaster />

<style>
  .app { display: flex; flex-direction: column; height: 100vh; background: var(--sg-bg, #fff); color: var(--sg-fg, #111); font-family: var(--sg-font, system-ui, sans-serif); }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .bar button { border: 1px solid var(--sg-border, #e5e7eb); background: none; color: inherit; border-radius: 6px; padding: 4px 10px; font: inherit; cursor: pointer; }
  main { flex: 1; min-height: 0; padding: 12px 16px 16px; display: flex; flex-direction: column; }
</style>
