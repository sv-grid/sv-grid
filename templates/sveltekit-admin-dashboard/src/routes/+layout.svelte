<script lang="ts">
  import '../app.css'
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import { readTheme, applyTheme, type Theme } from '$lib/theme'

  let { children } = $props()

  // Theme: dark by default (see app.html), toggleable + persisted.
  let theme = $state<Theme>('dark')
  onMount(() => {
    theme = readTheme()
    applyTheme(theme)
  })
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(theme)
  }

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
    class="hidden w-60 shrink-0 flex-col border-r md:flex"
    style="border-color: var(--app-border); background: var(--app-panel);"
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
      <a class="underline" href="https://svgrid.com" target="_blank" rel="noopener">SvGrid</a>
      + SvelteKit
    </div>
  </aside>

  <!-- Main -->
  <div class="flex min-w-0 flex-1 flex-col">
    <header
      class="flex items-center justify-between border-b px-6 py-3"
      style="border-color: var(--app-border); background: var(--app-panel);"
    >
      <h1 class="text-base font-semibold" style="color: var(--app-fg);">
        {nav.find((n) => isActive(n.href))?.label ?? 'Dashboard'}
      </h1>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
          class="grid h-9 w-9 place-items-center rounded-lg border"
          style="border-color: var(--app-border); color: var(--app-fg);"
        >
          {#if theme === 'dark'}
            <!-- sun -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          {:else}
            <!-- moon -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          {/if}
        </button>
        <a
          href="https://svgrid.com/docs"
          target="_blank"
          rel="noopener"
          class="rounded-lg border px-3 py-1.5 text-sm font-medium"
          style="border-color: var(--app-border); color: var(--app-fg);">Docs</a
        >
      </div>
    </header>

    <main class="min-w-0 flex-1 p-6">
      {@render children()}
    </main>
  </div>
</div>
