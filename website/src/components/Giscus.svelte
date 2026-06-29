<script lang="ts">
  import { onMount } from 'svelte'
  import { GISCUS, DISCUSSIONS_URL, giscusConfigured, giscusTheme } from '../lib/giscus'

  type Props = {
    /**
     * Stable discussion key (giscus `mapping="specific"`). Each unique term maps
     * to exactly one Discussion, so blog posts pass e.g. `blog/<slug>` and the
     * Community page passes a fixed term. Using a term (not pathname) keeps the
     * mapping stable across deploys / base-path changes.
     */
    term: string
    /** Optional heading rendered above the thread. */
    heading?: string
  }
  let { term, heading }: Props = $props()

  let container = $state<HTMLDivElement | null>(null)
  const configured = giscusConfigured()

  function currentTheme(): 'light' | 'dark' {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  }

  onMount(() => {
    if (!configured || !container) return

    const script = document.createElement('script')
    script.src = GISCUS.src
    script.async = true
    script.crossOrigin = 'anonymous'
    const attrs: Record<string, string> = {
      'data-repo': GISCUS.repo,
      'data-repo-id': GISCUS.repoId,
      'data-category': GISCUS.category,
      'data-category-id': GISCUS.categoryId,
      'data-mapping': 'specific',
      'data-term': term,
      'data-strict': '1',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
      'data-theme': giscusTheme(currentTheme()),
      'data-lang': 'en',
      'data-loading': 'lazy',
    }
    for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v)
    container.appendChild(script)

    // Keep the widget's theme in lockstep with the site's light/dark toggle by
    // posting to the giscus iframe whenever `<html data-theme>` flips.
    const sync = () => {
      const frame = container?.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
      frame?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: giscusTheme(currentTheme()) } } },
        GISCUS.origin,
      )
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  })
</script>

<section class="mt-12" aria-label="Comments">
  {#if heading}
    <h2 class="mb-5 text-xl font-bold" style="color: var(--sg-fg);">{heading}</h2>
  {/if}

  {#if configured}
    <div bind:this={container}></div>
  {:else}
    <!-- Shown until repo/category ids are filled in src/lib/giscus.ts. -->
    <div
      class="rounded-2xl border p-8 text-center"
      style="border-color: var(--sg-border); background: var(--sg-header-bg);"
    >
      <h3 class="text-lg font-bold" style="color: var(--sg-fg);">Join the discussion</h3>
      <p class="mt-2 text-sm" style="color: var(--site-muted);">
        Ask questions, share what you built, and follow announcements over on GitHub Discussions.
      </p>
      <a
        href={DISCUSSIONS_URL}
        target="_blank"
        rel="noopener external"
        class="btn btn-primary mt-5 inline-flex"
      >
        Open GitHub Discussions
      </a>
      <p class="mt-4 text-xs" style="color: var(--site-muted);">
        Maintainer note: set <code>repoId</code> / <code>categoryId</code> in
        <code>website/src/lib/giscus.ts</code> to embed the live comment thread here.
      </p>
    </div>
  {/if}
</section>
