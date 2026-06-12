<script lang="ts">
  import '../app.css'
  import { page } from '$app/state'

  let { children } = $props()

  const nav = [
    { href: '/', label: 'Overview', icon: '▦' },
    { href: '/orders', label: 'Orders', icon: '🧾' },
    { href: '/customers', label: 'Customers', icon: '👥' },
  ]

  function isActive(href: string): boolean {
    return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href)
  }
</script>

<div class="flex h-full min-h-screen">
  <!-- Sidebar -->
  <aside
    class="hidden w-60 shrink-0 flex-col border-r bg-white md:flex"
    style="border-color: var(--app-border);"
  >
    <div class="flex items-center gap-2 px-5 py-4">
      <span
        class="grid h-8 w-8 place-items-center rounded-lg font-bold text-white"
        style="background: var(--app-accent);">S</span
      >
      <div class="leading-tight">
        <p class="text-sm font-bold" style="color: var(--app-fg);">SvGrid Admin</p>
        <p class="text-[11px]" style="color: var(--app-muted);">Dashboard starter</p>
      </div>
    </div>

    <nav class="mt-2 flex-1 px-3">
      {#each nav as item}
        <a
          href={item.href}
          class="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={isActive(item.href)
            ? 'background: var(--app-accent); color: #fff;'
            : 'color: var(--app-fg);'}
        >
          <span class="w-5 text-center">{item.icon}</span>
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="px-5 py-4 text-[11px]" style="color: var(--app-muted);">
      Built with
      <a class="underline" href="https://www.svgrid.com" target="_blank" rel="noopener">SvGrid</a>
      + SvelteKit
    </div>
  </aside>

  <!-- Main -->
  <div class="flex min-w-0 flex-1 flex-col">
    <header
      class="flex items-center justify-between border-b bg-white px-6 py-3"
      style="border-color: var(--app-border);"
    >
      <h1 class="text-base font-semibold" style="color: var(--app-fg);">
        {nav.find((n) => isActive(n.href))?.label ?? 'Dashboard'}
      </h1>
      <a
        href="https://www.svgrid.com/docs"
        target="_blank"
        rel="noopener"
        class="rounded-lg border px-3 py-1.5 text-sm font-medium"
        style="border-color: var(--app-border); color: var(--app-fg);">Docs</a
      >
    </header>

    <main class="min-w-0 flex-1 p-6">
      {@render children()}
    </main>
  </div>
</div>
