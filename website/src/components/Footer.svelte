<script lang="ts">
  import Logo from './Logo.svelte'
</script>

<footer
  class="border-t mt-24"
  style="border-color: var(--sg-border); background: var(--sg-header-bg);"
>
  <div class="px-4 py-10 grid gap-8 md:grid-cols-5 text-sm">
    <div class="md:col-span-2">
      <div class="mb-3">
        <Logo size={26} />
      </div>
      <p style="color: var(--site-muted);">
        A modern Svelte 5 data grid. Headless-first engine plus a full render component. Built by
        <a class="underline hover:text-[color:var(--site-accent)]" style="color: var(--site-accent-2);" href="https://www.jqwidgets.com" target="_blank" rel="noopener noreferrer">jQWidgets</a>,
        the team behind
        <a class="underline hover:text-[color:var(--site-accent)]" style="color: var(--site-accent-2);" href="https://www.htmlelements.com" target="_blank" rel="noopener noreferrer">htmlelements.com</a>.
      </p>
      <p class="mt-3 text-xs" style="color: var(--site-muted);">
        This site is built with <a class="underline hover:text-[color:var(--site-accent)]" href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte 5</a>,
        Vite, and Tailwind CSS.
      </p>
    </div>

    <div>
      <h2 class="font-semibold mb-3">Product</h2>
      <ul class="space-y-2" style="color: var(--site-muted);">
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/demos">Demos</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/playground">Playground</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/docs">Docs</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/api">API</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/compare">Compare</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/blog">Blog</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/community">Community</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/mcp">MCP server</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/ai-prompts">AI Prompts</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/pricing">Pricing</a></li>
      </ul>
    </div>

    <div>
      <h2 class="font-semibold mb-3">Company</h2>
      <ul class="space-y-2" style="color: var(--site-muted);">
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/about">About us</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/faq">FAQ</a></li>
        <li><a class="hover:text-[color:var(--site-accent)]" href="#/contact">Contact us</a></li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://www.jqwidgets.com" target="_blank" rel="noopener noreferrer">jqwidgets.com</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://www.htmlelements.com" target="_blank" rel="noopener noreferrer">htmlelements.com</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://github.com/jqwidgets" target="_blank" rel="noopener noreferrer">jQWidgets on GitHub</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://github.com/HTMLElements" target="_blank" rel="noopener noreferrer">Smart UI on GitHub</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://www.facebook.com/jqwidgets" target="_blank" rel="noopener noreferrer">Facebook</a>
        </li>
      </ul>
    </div>

    <div>
      <h2 class="font-semibold mb-3">Resources</h2>
      <ul class="space-y-2" style="color: var(--site-muted);">
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://github.com/sv-grid/sv-grid" target="_blank" rel="noopener noreferrer">GitHub</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://www.npmjs.com/package/@svgrid/grid" target="_blank" rel="noopener noreferrer">npm</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://github.com/sv-grid/sv-grid/issues" target="_blank" rel="noopener noreferrer">Issues</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://github.com/sv-grid/sv-grid/discussions" target="_blank" rel="noopener noreferrer">Discussions</a>
        </li>
        <li>
          <a class="hover:text-[color:var(--site-accent)]" href="https://github.com/sv-grid/sv-grid/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">License</a>
        </li>
      </ul>
    </div>
  </div>

  <div
    class="border-t py-6 px-4 flex flex-wrap items-center justify-between gap-3 text-xs"
    style="border-color: var(--sg-border); color: var(--site-muted);"
  >
    <span>© {new Date().getFullYear()} jQWidgets. @svgrid/grid is MIT-licensed; @svgrid/enterprise is a paid companion package.</span>

    <span class="flex items-center gap-3">
      <a
        class="hover:text-[color:var(--site-accent)]"
        href="https://github.com/jqwidgets"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="jQWidgets on GitHub"
        title="jQWidgets on GitHub"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.8c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.8 1.3 2.6 1 .1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
      </a>
      <a
        class="hover:text-[color:var(--site-accent)]"
        href="https://github.com/HTMLElements"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Smart UI on GitHub"
        title="Smart UI on GitHub"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.8c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.8 1.3 2.6 1 .1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
      </a>
      <a
        class="hover:text-[color:var(--site-accent)]"
        href="https://www.facebook.com/jqwidgets"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="jQWidgets on Facebook"
        title="jQWidgets on Facebook"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/></svg>
      </a>
    </span>

    <span class="flex items-center gap-4">
      <a class="hover:text-[color:var(--site-accent)]" href="#/privacy">Privacy</a>
      <a class="hover:text-[color:var(--site-accent)]" href="#/terms">Terms</a>
      <a class="hover:text-[color:var(--site-accent)]" href="#/contact">Contact</a>
    </span>
  </div>
</footer>
