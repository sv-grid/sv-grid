<script lang="ts">
  import { comparisons, findComparison } from '../lib/comparisons'
  import { router } from '../lib/router.svelte'

  type Props = { slug: string }
  let { slug }: Props = $props()

  const current = $derived(findComparison(slug))

  function go(s: string) {
    router.navigate(`compare/${s}`)
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  }
</script>

{#if current === null}
  <!-- Overview / index -->
  <section class="mx-auto max-w-6xl px-6 py-12">
    <header class="text-center mb-12">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
        Comparisons
      </p>
      <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
        How does SvGrid compare?
      </h1>
      <p class="mt-4 max-w-2xl mx-auto text-base md:text-lg" style="color: var(--site-muted);">
        Honest, side-by-side comparisons against the other data grids you might consider on a
        Svelte project. Pick the one that matches your stack - we will tell you when SvGrid is the
        wrong choice.
      </p>
    </header>

    <div class="grid gap-5 md:grid-cols-3">
      {#each comparisons as c}
        <button
          type="button"
          onclick={() => go(c.slug)}
          class="text-left rounded-2xl border p-6 transition-colors"
          style="border-color: var(--sg-border); background: var(--sg-header-bg);"
        >
          <h2 class="text-xl font-bold" style="color: var(--sg-fg);">SvGrid vs {c.competitor}</h2>
          <p class="mt-2 text-sm" style="color: var(--site-muted);">{c.tagline}</p>
          <p class="mt-4 text-sm font-semibold" style="color: var(--site-accent-2);">
            Read the comparison →
          </p>
        </button>
      {/each}
    </div>

    <section class="mt-16">
      <h2 class="text-2xl font-bold" style="color: var(--sg-fg);">Why we publish these</h2>
      <p class="mt-3 text-base" style="color: var(--sg-fg);">
        Most "X vs Y" pages are marketing fluff. Ours include the cases where the other library is
        the better pick - because if it is, you will figure it out anyway, and we would rather you
        learned it from us first. Every comparison page ends with two lists:
        <strong>"When to choose SvGrid"</strong> and <strong>"When to choose the alternative"</strong>.
      </p>
    </section>
  </section>
{:else}
  <!-- Single comparison page -->
  <section class="mx-auto max-w-5xl px-6 py-12">
    <nav class="mb-6 text-sm">
      <a href="#/compare" style="color: var(--site-accent-2);">← All comparisons</a>
    </nav>

    <header class="mb-10">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
        Comparison
      </p>
      <h1 class="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
        SvGrid vs {current.competitor}
      </h1>
      <p class="mt-3 text-base md:text-lg" style="color: var(--site-muted);">{current.tagline}</p>
      {#if current.url || current.npm}
        <p class="mt-2 text-sm" style="color: var(--site-muted);">
          {#if current.url}
            <a class="underline" style="color: var(--site-accent-2);" href={current.url} target="_blank" rel="noopener noreferrer">Project site</a>
          {/if}
          {#if current.npm}
            {' · '}<code>{current.npm}</code>
          {/if}
        </p>
      {/if}

      <div
        class="mt-6 rounded-lg border p-5"
        style="border-color: var(--site-accent); background: linear-gradient(135deg, rgba(59,130,246,0.10), rgba(34,211,238,0.05));"
      >
        <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
          One-line verdict
        </p>
        <p class="mt-1 text-base" style="color: var(--sg-fg);">{current.oneLineVerdict}</p>
      </div>

      {#if current.migrationSlug}
        <p class="mt-4 text-sm font-medium">
          <a href={`#/docs/help/${current.migrationSlug}`} style="color: var(--site-accent-2);">
            → Migration guide: moving from {current.competitor} to SvGrid
          </a>
        </p>
      {/if}
    </header>

    {#each current.intro as p}
      <p class="mt-4 text-base leading-relaxed" style="color: var(--sg-fg);">{p}</p>
    {/each}

    <h2 class="mt-12 mb-3 text-xl font-bold" style="color: var(--sg-fg);">What they have in common</h2>
    <ul class="space-y-2">
      {#each current.similarities as s}
        <li class="flex items-start gap-2 text-base" style="color: var(--sg-fg);">
          <span style="color: var(--sg-muted)">•</span>
          <span>{s}</span>
        </li>
      {/each}
    </ul>

    <div class="grid gap-6 md:grid-cols-2 mt-12">
      <div class="rounded-lg border p-5" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
        <h2 class="text-lg font-bold" style="color: var(--sg-fg);">Where SvGrid wins</h2>
        <ul class="mt-3 space-y-2 text-sm">
          {#each current.svgridAdvantages as a}
            <li class="flex items-start gap-2" style="color: var(--sg-fg);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="color: #4ade80; margin-top: 4px; flex-shrink: 0;" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>{a}</span>
            </li>
          {/each}
        </ul>
      </div>
      <div class="rounded-lg border p-5" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
        <h2 class="text-lg font-bold" style="color: var(--sg-fg);">Where {current.competitor} wins</h2>
        <ul class="mt-3 space-y-2 text-sm">
          {#each current.competitorAdvantages as a}
            <li class="flex items-start gap-2" style="color: var(--sg-fg);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="color: var(--site-accent-2); margin-top: 4px; flex-shrink: 0;" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>{a}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <h2 class="mt-12 mb-3 text-xl font-bold" style="color: var(--sg-fg);">Feature-by-feature</h2>
    <div class="overflow-x-auto rounded-lg border" style="border-color: var(--sg-border);">
      <table class="w-full text-sm">
        <thead>
          <tr style="background: var(--sg-row-alt-bg);">
            <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Feature</th>
            <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">SvGrid</th>
            <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">{current.competitor}</th>
          </tr>
        </thead>
        <tbody>
          {#each current.features as r, i}
            <tr
              style:background={i % 2 === 0 ? 'var(--sg-header-bg)' : 'var(--sg-bg)'}
              style="border-top: 1px solid var(--sg-border)"
            >
              <td class="p-3 font-semibold" style="color: var(--sg-fg);">{r.feature}</td>
              <td class="p-3" style:color={r.svgridBetter ? '#4ade80' : 'var(--sg-fg)'} style:font-weight={r.svgridBetter ? '600' : '400'}>
                {r.svgrid}
              </td>
              <td class="p-3" style="color: var(--sg-fg);">{r.competitor}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="grid gap-6 md:grid-cols-2 mt-12">
      <div class="rounded-lg border p-5" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
        <h2 class="text-lg font-bold" style="color: var(--sg-fg);">When to choose SvGrid</h2>
        <ul class="mt-3 space-y-2 text-sm">
          {#each current.whenToChooseSvGrid as a}
            <li class="flex items-start gap-2" style="color: var(--sg-fg);">
              <span style="color: var(--site-accent-2)">▸</span>
              <span>{a}</span>
            </li>
          {/each}
        </ul>
      </div>
      <div class="rounded-lg border p-5" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
        <h2 class="text-lg font-bold" style="color: var(--sg-fg);">When to choose {current.competitor}</h2>
        <ul class="mt-3 space-y-2 text-sm">
          {#each current.whenToChooseCompetitor as a}
            <li class="flex items-start gap-2" style="color: var(--sg-fg);">
              <span style="color: var(--site-accent-2)">▸</span>
              <span>{a}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    {#if current.bottomLine}
      <section class="mt-12">
        <h2 class="mb-3 text-xl font-bold" style="color: var(--sg-fg);">The bottom line</h2>
        <p class="text-base leading-relaxed" style="color: var(--sg-fg);">{current.bottomLine}</p>
      </section>
    {/if}

    {#if current.faq.length}
      <section class="mt-12">
        <h2 class="mb-4 text-xl font-bold" style="color: var(--sg-fg);">Frequently asked questions</h2>
        <div class="space-y-5">
          {#each current.faq as f}
            <div>
              <h3 class="text-base font-semibold" style="color: var(--sg-fg);">{f.question}</h3>
              <p class="mt-1 text-sm leading-relaxed" style="color: var(--site-muted);">{f.answer}</p>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <div class="mt-16 rounded-2xl border p-8 text-center"
      style="border-color: var(--sg-border); background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,211,238,0.08));">
      <h2 class="text-xl font-bold" style="color: var(--sg-fg);">Ready to try SvGrid?</h2>
      <p class="mt-2 text-sm" style="color: var(--site-muted);">
        Browse the 20 examples or jump straight into the docs.
      </p>
      <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a href="#/demos" class="btn btn-primary">View demos</a>
        <a href="#/docs/getting-started" class="btn btn-ghost">Read docs</a>
      </div>
    </div>
  </section>
{/if}
