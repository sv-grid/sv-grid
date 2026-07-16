<script lang="ts">
  import '../app.css'
  import { page } from '$app/stores'

  let { children } = $props()
  const nav = [{"href":"/","label":"Home"},{"href":"/customers","label":"Customer"}]
  const brand = "Paging"
  const footer = "Built with SvGrid Studio"
</script>


<div class="sv-app sv-app--side">
  <aside class="sv-app__side">
    <a class="sv-app__brand" href="/">{brand}</a>
    <nav class="sv-app__links">
      {#each nav as item (item.href)}
        <a class="sv-app__link" class:is-active={$page.url.pathname === item.href} href={item.href}>{item.label}</a>
      {/each}
    </nav>
    <span class="sv-app__foot">{footer}</span>
  </aside>
  <main class="sv-app__main">
    {@render children()}
  </main>
</div>

<style>
  .sv-app--side { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
  .sv-app--side.sv-app--right { grid-template-columns: minmax(0, 1fr) 240px; }
  .sv-app--right .sv-app__side { order: 2; border-right: 0; border-left: 1px solid var(--sg-border, #e6e8ec); }
  .sv-app__side { display: flex; flex-direction: column; gap: 4px; padding: 20px 14px; border-right: 1px solid var(--sg-border, #e6e8ec); background: var(--sg-header-bg, #f8fafc); }
  .sv-app__links { display: flex; flex-direction: column; gap: 2px; }
  .sv-app__foot { margin-top: auto; padding-top: 14px; color: var(--sg-muted, #94a3b8); font-size: 12px; }
  .sv-app__brand { font-weight: 700; font-size: 15px; color: var(--sg-fg, #0f172a); text-decoration: none; padding: 4px 8px; }
  .sv-app__link { padding: 7px 10px; border-radius: 8px; color: var(--sg-fg, #334155); text-decoration: none; font-size: 14px; }
  .sv-app__link:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .sv-app__link.is-active { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent); color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .sv-app__main { padding: 24px 28px; min-width: 0; }
</style>
