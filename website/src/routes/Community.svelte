<script lang="ts">
  import { DISCUSSIONS_URL } from '../lib/giscus'
  import {
    discussionsData,
    discussionCategories,
    discussionsTotal,
    discussions,
    countsByCategory,
    newDiscussionUrl,
    relativeTime,
    selectDiscussions,
    type SortKey,
    type AnsweredFilter,
  } from '../lib/discussions'

  // Client-side browse state over the build-time dataset (mirrors the GitHub
  // Discussions UI: category sidebar + searchable, sortable list).
  let activeCategory = $state<string>('') // '' = View all discussions
  let query = $state('')
  let sort = $state<SortKey>('updated')
  let answeredFilter = $state<AnsweredFilter>('all')

  const counts = countsByCategory()
  const hasData = discussions.length > 0
  const answered = discussions.filter((d) => d.answered).length
  // Announcement-category threads, surfaced in a strip on the "View all" view.
  const announcements = discussions
    .filter((d) => d.category?.slug === 'announcements')
    .slice(0, 3)
  const visible = $derived(selectDiscussions(activeCategory, query, sort, answeredFilter))
  const activeCat = $derived(
    discussionCategories.find((c) => c.slug === activeCategory) ?? null,
  )

  /** Small avatar URL (GitHub supports ?s= sizing). */
  function avatarSrc(url: string): string {
    return url + (url.includes('?') ? '&' : '?') + 's=40'
  }
  function hideImg(e: Event) {
    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
  }

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'updated', label: 'Latest activity' },
    { key: 'created', label: 'Newest' },
    { key: 'comments', label: 'Most commented' },
  ]

  function categoryHref(slug: string): string {
    return slug ? `${DISCUSSIONS_URL}/categories/${slug}` : DISCUSSIONS_URL
  }
</script>

<section class="mx-auto max-w-6xl px-6 py-12">
  <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
        Community
      </p>
      <h1 class="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
        Discussions
      </h1>
      <p class="mt-2 text-sm md:text-base" style="color: var(--site-muted);">
        Questions, ideas, and show-and-tell - powered by GitHub Discussions. Read here, post with your GitHub account.
      </p>
      {#if hasData}
        <p class="mt-2 text-xs" style="color: var(--site-muted);">
          {discussionsTotal} discussion{discussionsTotal === 1 ? '' : 's'}{answered ? ` · ${answered} answered` : ''} · synced {relativeTime(discussionsData.generatedAt)}
        </p>
      {/if}
    </div>
    <a href={newDiscussionUrl(activeCategory || undefined)} target="_blank" rel="noopener external" class="btn btn-primary">
      New discussion
    </a>
  </header>

  <div class="grid gap-8 md:grid-cols-[240px_1fr]">
    <!-- Category sidebar -->
    <aside class="md:sticky md:top-6 self-start">
      <h2 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider" style="color: var(--site-muted);">
        Categories
      </h2>
      {#snippet extLink(href: string, label: string)}
        <a
          {href}
          target="_blank"
          rel="noopener external"
          class="flex flex-none items-center px-2 py-2 opacity-45 transition-opacity hover:opacity-100"
          style="color: var(--site-muted);"
          aria-label={label}
          title="Open on GitHub"
          onclick={(e) => e.stopPropagation()}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </a>
      {/snippet}

      <nav class="flex flex-col gap-0.5">
        <div
          class="flex items-center rounded-lg transition-colors"
          style:background={activeCategory === '' ? 'color-mix(in srgb, var(--site-accent) 12%, transparent)' : 'transparent'}
        >
          <button
            type="button"
            onclick={() => (activeCategory = '')}
            class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
            style:color={activeCategory === '' ? 'var(--site-accent)' : 'var(--site-fg)'}
          >
            <span aria-hidden="true" class="flex-none">💬</span>
            <span class="min-w-0 flex-1 truncate">View all</span>
            <span class="flex-none pl-1 tabular-nums" style="color: var(--site-muted);">{discussionsTotal || discussions.length}</span>
          </button>
          {@render extLink(DISCUSSIONS_URL, 'Open all discussions on GitHub')}
        </div>

        {#each discussionCategories as c (c.slug)}
          {@const active = activeCategory === c.slug}
          <div
            class="flex items-center rounded-lg transition-colors"
            style:background={active ? 'color-mix(in srgb, var(--site-accent) 12%, transparent)' : 'transparent'}
          >
            <button
              type="button"
              onclick={() => (activeCategory = c.slug)}
              class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
              style:color={active ? 'var(--site-accent)' : 'var(--site-fg)'}
            >
              <span aria-hidden="true" class="flex-none">{c.emoji}</span>
              <span class="min-w-0 flex-1 truncate">{c.name}</span>
              <span class="flex-none pl-1 tabular-nums" style="color: var(--site-muted);">{counts[c.slug] ?? 0}</span>
            </button>
            {@render extLink(categoryHref(c.slug), `Open ${c.name} on GitHub`)}
          </div>
        {/each}
      </nav>
      <a
        href={DISCUSSIONS_URL}
        target="_blank"
        rel="noopener external"
        class="mt-3 block px-3 text-xs font-medium"
        style="color: var(--site-accent-2);"
      >Browse all on GitHub →</a>
    </aside>

    <!-- Discussion list -->
    <div>
      {#if hasData}
        <!-- Pinned announcements strip (only on the unfiltered "View all"). -->
        {#if activeCategory === '' && !query.trim() && announcements.length}
          <div
            class="mb-4 rounded-2xl border p-4"
            style="border-color: color-mix(in srgb, var(--site-accent) 35%, var(--sg-border)); background: color-mix(in srgb, var(--site-accent) 6%, transparent);"
          >
            <div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent);">
              <span aria-hidden="true">📣</span> Announcements
            </div>
            <ul class="flex flex-col gap-1.5">
              {#each announcements as a (a.number)}
                <li class="min-w-0">
                  <a href={a.url} target="_blank" rel="noopener external" class="text-sm font-semibold hover:underline" style="color: var(--sg-fg);">{a.title}</a>
                  <span class="text-xs" style="color: var(--site-muted);"> · {relativeTime(a.updatedAt)}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            bind:value={query}
            placeholder="Search discussions"
            class="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
            style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);"
          />
          <label class="flex items-center gap-2 text-sm" style="color: var(--site-muted);">
            Status
            <select
              bind:value={answeredFilter}
              class="rounded-lg border px-2 py-2 text-sm"
              style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);"
            >
              <option value="all">All</option>
              <option value="answered">Answered</option>
              <option value="open">Unanswered</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm" style="color: var(--site-muted);">
            Sort
            <select
              bind:value={sort}
              class="rounded-lg border px-2 py-2 text-sm"
              style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);"
            >
              {#each SORTS as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
            </select>
          </label>
        </div>

        <ul class="overflow-hidden rounded-2xl border" style="border-color: var(--sg-border);">
          {#each visible as d (d.number)}
            <li class="border-b last:border-b-0" style="border-color: var(--sg-border);">
              <a
                href={d.url}
                target="_blank"
                rel="noopener external"
                class="flex items-start gap-3 p-4 transition-colors hover:[background:var(--sg-header-bg)]"
              >
                <span class="mt-0.5 text-lg leading-none" aria-hidden="true">{d.category?.emoji ?? '💬'}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="truncate font-semibold" style="color: var(--sg-fg);">{d.title}</span>
                    {#if d.answered}
                      <span class="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style="background: color-mix(in srgb, #16a34a 18%, transparent); color: #16a34a;">Answered</span>
                    {/if}
                  </span>
                  <span class="mt-1 flex items-center gap-1 text-xs" style="color: var(--site-muted);">
                    {#if d.category}<span style="color: var(--site-accent-2);">{d.category.name}</span> <span aria-hidden="true">·</span> {/if}
                    {#if d.author}
                      {#if d.author.avatarUrl}
                        <img src={avatarSrc(d.author.avatarUrl)} alt="" width="14" height="14" loading="lazy" onerror={hideImg} class="inline-block h-3.5 w-3.5 flex-none rounded-full" />
                      {/if}
                      <span>{d.author.login}</span> <span aria-hidden="true">·</span>
                    {/if}
                    <span>updated {relativeTime(d.updatedAt)}</span>
                  </span>
                </span>
                <span class="flex flex-shrink-0 items-center gap-3 text-xs" style="color: var(--site-muted);">
                  {#if d.reactions}<span>♥ {d.reactions}</span>{/if}
                  <span>💬 {d.comments}</span>
                </span>
              </a>
            </li>
          {/each}
        </ul>

        {#if visible.length === 0}
          <div class="rounded-2xl border p-8 text-center" style="border-color: var(--sg-border);">
            {#if query.trim()}
              <p class="text-sm" style="color: var(--site-muted);">No discussions match "{query.trim()}".</p>
            {:else if activeCat}
              <p class="text-sm" style="color: var(--site-muted);">
                No discussions in {activeCat.emoji} {activeCat.name} yet.
              </p>
              <a href={newDiscussionUrl(activeCat.slug)} target="_blank" rel="noopener external" class="btn btn-primary mt-4 inline-flex">
                Start one in {activeCat.name}
              </a>
            {:else}
              <p class="text-sm" style="color: var(--site-muted);">No discussions yet.</p>
            {/if}
          </div>
        {/if}
      {:else}
        <!-- No baked data yet (empty repo discussions, or a no-token build). -->
        <div class="rounded-2xl border p-10 text-center" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
          <div class="text-3xl" aria-hidden="true">💬</div>
          <h2 class="mt-3 text-lg font-bold" style="color: var(--sg-fg);">There are no discussions here yet</h2>
          <p class="mx-auto mt-2 max-w-md text-sm" style="color: var(--site-muted);">
            Ask a question, propose an idea, or share what you built. Start the first discussion and it will appear here on the next site build.
          </p>
          <a href={newDiscussionUrl()} target="_blank" rel="noopener external" class="btn btn-primary mt-5 inline-flex">
            Start a discussion
          </a>
        </div>
      {/if}
    </div>
  </div>
</section>
