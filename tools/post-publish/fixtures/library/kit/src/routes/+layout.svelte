<script lang="ts">
  import '../app.css'

  let { children } = $props()
  const routes = ['grid', 'chart', 'export', 'pivot', 'kanban', 'scheduler', 'gantt', 'sheet', 'base', 'ssrm']
</script>

<nav>
  {#each routes as r (r)}<a href={`/${r}`}>{r}</a>{/each}
</nav>
<main>
  {@render children?.()}
</main>

<style>
  nav { display: flex; gap: 0.75rem; padding: 0.5rem 1rem; border-bottom: 1px solid var(--sg-border); }
  main { padding: 1rem; }
</style>
