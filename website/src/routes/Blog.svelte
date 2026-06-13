<script lang="ts">
  import { Marked } from 'marked'
  import { blogPosts, findPost, formatPostDate, relatedPosts } from '../lib/blog'
  import { router } from '../lib/router.svelte'

  type Props = { slug: string }
  let { slug }: Props = $props()

  const current = $derived(findPost(slug))

  // Per-post hero / social image, generated at build time by the prerenderer
  // into /og/blog/<slug>.{png,svg}. The post hero uses the PNG raster (favored
  // by image search); the lighter SVG is used for the index thumbnails. In dev
  // these files do not exist, so hide the <img> on error rather than show a
  // broken icon.
  const base = import.meta.env.BASE_URL || '/'
  const heroSrc = (s: string) => `${base}og/blog/${s}.png`
  const thumbSrc = (s: string) => `${base}og/blog/${s}.svg`
  function hideOnError(e: Event) {
    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  // Render the post markdown to HTML with heading ids (so the in-page table of
  // contents and deep links work). Rebuilt per post; it's just an option bag.
  const html = $derived.by(() => {
    if (!current) return ''
    const m = new Marked()
    m.use({
      renderer: {
        heading({ tokens, depth }) {
          const text = this.parser.parseInline(tokens)
          const plain = tokens.map((t) => ('text' in t ? t.text : '')).join('').trim()
          return `<h${depth} id="${slugify(plain)}">${text}</h${depth}>`
        },
      },
    })
    return m.parse(current.markdown, { async: false }) as string
  })

  const related = $derived(current ? relatedPosts(current, 3) : [])

  function go(s: string) {
    router.navigate(`blog/${s}`)
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  }
</script>

{#if current === null}
  <!-- Blog index -->
  <section class="mx-auto max-w-6xl px-6 py-12">
    <header class="text-center mb-12">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
        Blog
      </p>
      <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
        SvGrid tips &amp; guides
      </h1>
      <p class="mt-4 max-w-2xl mx-auto text-base md:text-lg" style="color: var(--site-muted);">
        Practical, copy-paste tips for building fast, accessible data grids in Svelte 5 - sorting,
        filtering, virtualization, editing, server-side data, theming, and more.
      </p>
    </header>

    <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {#each blogPosts as p (p.slug)}
        <button
          type="button"
          onclick={() => go(p.slug)}
          class="flex flex-col text-left rounded-2xl border overflow-hidden transition-colors h-full"
          style="border-color: var(--sg-border); background: var(--sg-header-bg);"
        >
          <img
            src={thumbSrc(p.slug)}
            onerror={hideOnError}
            width="1200"
            height="630"
            loading="lazy"
            alt={`${p.title} - SvGrid blog illustration`}
            class="w-full aspect-[1200/630] object-cover border-b"
            style="border-color: var(--sg-border);"
          />
          <div class="flex flex-col p-6 flex-1">
          <div class="flex items-center gap-2 text-xs" style="color: var(--site-accent-2);">
            <span class="font-semibold uppercase tracking-wider">{p.category}</span>
            <span style="color: var(--site-muted);">· {p.readingMinutes} min read</span>
          </div>
          <h2 class="mt-3 text-lg font-bold leading-snug" style="color: var(--sg-fg);">{p.title}</h2>
          <p class="mt-2 text-sm flex-1" style="color: var(--site-muted);">{p.description}</p>
          <p class="mt-4 text-xs" style="color: var(--site-muted);">{formatPostDate(p.date)}</p>
          </div>
        </button>
      {/each}
    </div>
  </section>
{:else}
  <!-- Single post -->
  <article class="mx-auto max-w-3xl px-6 py-12">
    <nav class="mb-6 text-sm">
      <a href="#/blog" style="color: var(--site-accent-2);">← All posts</a>
    </nav>

    <img
      src={heroSrc(current.slug)}
      onerror={hideOnError}
      width="1200"
      height="630"
      loading="eager"
      alt={`${current.title} - SvGrid blog illustration`}
      class="mb-8 w-full aspect-[1200/630] rounded-2xl border object-cover"
      style="border-color: var(--sg-border);"
    />

    <header class="mb-8">
      <div class="flex items-center gap-2 text-xs" style="color: var(--site-accent-2);">
        <span class="font-semibold uppercase tracking-wider">{current.category}</span>
        <span style="color: var(--site-muted);">· {current.readingMinutes} min read</span>
      </div>
      <h1 class="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
        {current.title}
      </h1>
      <p class="mt-3 text-base md:text-lg" style="color: var(--site-muted);">{current.description}</p>
      <p class="mt-4 text-sm" style="color: var(--site-muted);">
        By {current.author} · {formatPostDate(current.date)}
      </p>
      {#if current.tags.length}
        <div class="mt-4 flex flex-wrap gap-2">
          {#each current.tags as tag}
            <span
              class="rounded-full border px-2.5 py-0.5 text-xs"
              style="border-color: var(--sg-border); color: var(--site-muted);"
            >{tag}</span>
          {/each}
        </div>
      {/if}
    </header>

    <!-- eslint-disable-next-line svelte/no-at-html-tags - trusted local markdown -->
    <div class="prose">{@html html}</div>

    {#if related.length}
      <section class="mt-16 border-t pt-8" style="border-color: var(--sg-border);">
        <h2 class="text-xl font-bold mb-5" style="color: var(--sg-fg);">Keep reading</h2>
        <div class="grid gap-4 sm:grid-cols-3">
          {#each related as r (r.slug)}
            <button
              type="button"
              onclick={() => go(r.slug)}
              class="text-left rounded-xl border p-4 transition-colors h-full"
              style="border-color: var(--sg-border); background: var(--sg-header-bg);"
            >
              <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">{r.category}</p>
              <h3 class="mt-2 text-sm font-bold leading-snug" style="color: var(--sg-fg);">{r.title}</h3>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <div class="mt-16 rounded-2xl border p-8 text-center"
      style="border-color: var(--sg-border); background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,211,238,0.08));">
      <h2 class="text-xl font-bold" style="color: var(--sg-fg);">Build it with SvGrid</h2>
      <p class="mt-2 text-sm" style="color: var(--site-muted);">
        A modern Svelte 5 data grid - free and MIT-licensed. Browse the demos or read the docs.
      </p>
      <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a href="#/demos" class="btn btn-primary">View demos</a>
        <a href="#/docs/getting-started" class="btn btn-ghost">Read docs</a>
      </div>
    </div>
  </article>
{/if}
