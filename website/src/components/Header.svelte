<script lang="ts">
  import Logo from './Logo.svelte'

  type Theme = 'light' | 'dark'
  type Props = {
    active: string
    theme: Theme
    onToggleTheme: () => void
  }
  let { active, theme, onToggleTheme }: Props = $props()

  // Mobile nav: the desktop link row is `hidden md:flex`, so without this
  // hamburger there is no way to reach Demos / Docs / Pricing etc. on a
  // phone. The panel closes on any link tap (hashchange) - see below.
  let menuOpen = $state(false)

  $effect(() => {
    if (typeof window === 'undefined') return
    const close = () => (menuOpen = false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  })

  const links = [
    { id: 'demos', label: 'Demos', href: '#/demos' },
    { id: 'docs', label: 'Docs', href: '#/docs' },
    { id: 'api', label: 'API', href: '#/api' },
    { id: 'theme-builder', label: 'Theme Builder', href: '#/theme-builder' },
    { id: 'compare', label: 'Compare', href: '#/compare' },
    { id: 'blog', label: 'Blog', href: '#/blog' },
    { id: 'roadmap', label: 'Roadmap', href: '#/roadmap' },
    { id: 'mcp', label: 'MCP', href: '#/mcp' },
    { id: 'pricing', label: 'Pricing', href: '#/pricing' },
  ]
</script>

<header
  class="sticky top-0 z-40 border-b backdrop-blur"
  style="background: color-mix(in srgb, var(--site-bg) 80%, transparent); border-color: var(--sg-border);"
>
  <div class="flex h-16 items-center gap-8 px-4">
    <a href="#/" class="site-link" aria-label="SvGrid home">
      <Logo size={30} />
    </a>

    <nav class="hidden md:flex items-center gap-1">
      {#each links as link (link.id)}
        {@const isActive = active === link.id}
        <a
          href={link.href}
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style:color={isActive ? 'var(--site-accent)' : 'var(--site-fg)'}
          style:background={isActive ? 'color-mix(in srgb, var(--site-accent) 12%, transparent)' : 'transparent'}
        >
          {link.label}
        </a>
      {/each}
    </nav>

    <div class="ml-auto flex items-center gap-2">
      <button
        type="button"
        onclick={() => (menuOpen = !menuOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        class="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
        style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
      >
        {#if menuOpen}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        {/if}
      </button>

      <button
        type="button"
        onclick={onToggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        class="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
        style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
      >
        {#if theme === 'dark'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m4.93 19.07 1.41-1.41" />
            <path d="m17.66 6.34 1.41-1.41" />
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        {/if}
      </button>

      <a
        href="https://github.com/sv-grid/sv-grid"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
        style="border-color: var(--sg-border); color: var(--sg-fg);"
        aria-label="GitHub repository"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1-.02-1.95-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.23 2.78.11 3.07.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
          />
        </svg>
        <span class="hidden sm:inline">GitHub</span>
      </a>
    </div>
  </div>

  {#if menuOpen}
    <nav
      class="md:hidden border-t px-3 py-2"
      style="border-color: var(--sg-border); background: var(--site-bg);"
      aria-label="Mobile"
    >
      {#each links as link (link.id)}
        {@const isActive = active === link.id}
        <a
          href={link.href}
          onclick={() => (menuOpen = false)}
          class="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          style:color={isActive ? 'var(--site-accent)' : 'var(--site-fg)'}
          style:background={isActive ? 'color-mix(in srgb, var(--site-accent) 12%, transparent)' : 'transparent'}
        >
          {link.label}
        </a>
      {/each}
    </nav>
  {/if}
</header>
