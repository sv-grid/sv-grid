<script lang="ts">
  import '../app.css'
  import { page } from '$app/stores'

  let { children } = $props()

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/customers', label: 'Customers' },
    { href: '/orders', label: 'Orders' },
    { href: '/products', label: 'Products' },
  ]
</script>

<div class="app">
  <aside class="app__nav">
    <a class="app__brand" href="/">My Studio App</a>
    <nav class="app__links">
      {#each nav as item (item.href)}
        <a class="app__link" class:is-active={$page.url.pathname === item.href} href={item.href}>{item.label}</a>
      {/each}
    </nav>
    <span class="app__foot">Built with SvGrid Studio</span>
  </aside>
  <main class="app__main">
    {@render children()}
  </main>
</div>
