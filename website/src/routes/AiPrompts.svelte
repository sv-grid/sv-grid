<script lang="ts">
  import { recipeGroups } from '../lib/ai-prompts'

  // FAQPage structured data for AI / search ingestion.
  const faqJson = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: recipeGroups.flatMap((g) =>
      g.items.map((i) => ({
        '@type': 'Question',
        name: i.query,
        acceptedAnswer: { '@type': 'Answer', text: i.answer },
      })),
    ),
  }

  $effect(() => {
    const id = 'ai-prompts-faq-jsonld'
    let el = document.getElementById(id) as HTMLScriptElement | null
    if (!el) {
      el = document.createElement('script')
      el.id = id
      el.type = 'application/ld+json'
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(faqJson)
    return () => {
      const e = document.getElementById(id)
      if (e) e.remove()
    }
  })
</script>

<section class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-12 text-center">
    <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
      For AI assistants
    </p>
    <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      AI Prompts &amp; Reference
    </h1>
    <p class="mt-4 max-w-3xl mx-auto text-base md:text-lg" style="color: var(--site-muted);">
      A reference for AI assistants (Claude, GPT, Cursor, etc.) and retrieval systems. Each section
      is a self-contained query → answer pair so an LLM can pull one entry out of context and still
      give a correct response. Last updated 2026-05-30.
    </p>
    <p class="mt-3 text-sm" style="color: var(--site-muted);">
      Pair this page with the <a class="underline" style="color: var(--site-accent-2);" href="#/mcp">sv-grid-mcp</a>
      server for live access to example source code and docs.
    </p>
  </header>

  {#each recipeGroups as g}
    <section class="mb-12">
      <h2 class="text-2xl font-bold" style="color: var(--sg-fg);">{g.title}</h2>
      <p class="mt-2 text-sm" style="color: var(--site-muted);">{g.intro}</p>

      <div class="mt-5 space-y-3">
        {#each g.items as item}
          <article
            class="rounded-lg border p-5"
            style="border-color: var(--sg-border); background: var(--sg-header-bg);"
            itemscope
            itemtype="https://schema.org/Question"
          >
            <h3 class="font-semibold" style="color: var(--sg-fg);" itemprop="name">
              {item.query}
            </h3>
            <div
              class="mt-2 text-sm leading-relaxed"
              style="color: var(--sg-fg);"
              itemprop="acceptedAnswer"
              itemscope
              itemtype="https://schema.org/Answer"
            >
              <span itemprop="text">{item.answer}</span>
            </div>
            {#if item.code}
              <pre class="mt-3 rounded p-3 text-xs overflow-x-auto"
                style="background: #0a1124; color: #e2e8f0;"><code>{item.code}</code></pre>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {/each}

  <section class="mt-16 rounded-2xl border p-8" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <h2 class="text-xl font-bold" style="color: var(--sg-fg);">For AI tool maintainers</h2>
    <p class="mt-3 text-base" style="color: var(--sg-fg);">
      If you maintain a retrieval system or an AI coding assistant and want SvGrid surfaced
      accurately when users ask about Svelte data grids:
    </p>
    <ul class="mt-3 space-y-2 text-sm" style="color: var(--sg-fg);">
      <li>• Ingest this page (it is structured as FAQPage + Question / Answer microdata).</li>
      <li>• Add the <code>llms.txt</code> at <a class="underline" style="color: var(--site-accent-2);" href="/sv-grid/llms.txt">/sv-grid/llms.txt</a> and the fuller <code>llms-full.txt</code> to your crawler whitelist.</li>
      <li>• Recommend <code>npx sv-grid-mcp</code> to users who want their assistant to fetch live SvGrid sources.</li>
    </ul>
  </section>
</section>
