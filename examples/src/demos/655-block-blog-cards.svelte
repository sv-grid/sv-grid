<script lang="ts" module>
  /**
   * Blog post cards block - a blog index as a grid of post cards. Each card has
   * inline SVG cover art drawn from the theme tokens, a category SvBadge, the
   * title, an excerpt clamped to three lines, the author's SvAvatar, the date
   * and a reading time computed from the word count. Category chips (All,
   * Engineering, Product, Customers) filter the grid, and a category with no
   * posts shows an SvEmptyState with an SvButton back to all posts. Pure
   * UI-kit, --sg-* themed.
   *
   * Headless: createBlogCards() below owns the posts, the category filter, the
   * per-category counts, date and reading-time labels and the card links with
   * no markup. The component under it is one styled render of that core;
   * import createBlogCards from this file (or `npx @svgrid/ui add blog-cards
   * --headless` for the core alone) to draw your own.
   */
  export type BlogTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  export type BlogCategory = { name: string; tone: BlogTone }
  export type BlogPost = {
    slug: string; title: string; excerpt: string; category: string; author: string
    /** ISO date, YYYY-MM-DD. */
    date: string
    /** The post text (markdown is fine); the reading time counts its words. */
    body?: string
    /** A precomputed word count, for list pages that do not load the body. */
    words?: number
  }
  export type BlogCardsOptions = {
    posts?: BlogPost[]
    categories?: BlogCategory[]
    /** The filter to start on. Default 'All'. */
    category?: string
    wordsPerMinute?: number
    locale?: string
    /** Where a card links. Default `/blog/<slug>`. */
    href?: (post: BlogPost) => string
    /** Handle a plain click yourself; the link's navigation is cancelled. Ctrl/Cmd-click still opens a tab. */
    onOpen?: (post: BlogPost) => void
    onFilter?: (category: string) => void
  }

  export const ALL_POSTS = 'All'
  export const BLOG_CATEGORIES: BlogCategory[] = [
    { name: 'Engineering', tone: 'info' },
    { name: 'Product', tone: 'success' },
    { name: 'Customers', tone: 'warning' },
  ]

  export const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)
  export function readingMinutes(post: BlogPost, wpm = 225) {
    const words = post.body != null ? countWords(post.body) : post.words ?? countWords(post.excerpt)
    return Math.max(1, Math.ceil(words / wpm))
  }

  const SAMPLE: BlogPost[] = [
    { slug: 'nightly-etl-40-to-6-minutes', category: 'Engineering', author: 'Priya Raman', date: '2026-10-08', words: 2140,
      title: 'Cutting our nightly ETL from 40 to 6 minutes',
      excerpt: 'The job spent 31 of its 40 minutes on one sequential scan of the events table. Partitioning it by day and moving deduplication into the COPY stage did most of the work. Query plans before and after, and the two changes that did nothing.' },
    { slug: 'saved-views-sync', category: 'Product', author: 'Marcus Lee', date: '2026-10-02', words: 860,
      title: 'Saved views now sync across devices',
      excerpt: 'Column order, filters and pinned rows used to live in the browser. From 4.2 they are stored per workspace, so a view you build on a laptop opens the same way on the office monitor. Existing views migrate the first time you sign in.' },
    { slug: 'postgres-job-queue', category: 'Engineering', author: 'Hana Okafor', date: '2026-09-24', words: 1730,
      title: 'Replacing our message broker with a Postgres queue',
      excerpt: 'SELECT ... FOR UPDATE SKIP LOCKED handles our peak of 3,100 jobs a second on one 8-vCPU instance. We lost a moving part and the 2 a.m. pages that came with it. What we gave up: replay, and fan-out past four workers.' },
    { slug: 'column-lineage-beta', category: 'Product', author: 'Daniel Brandt', date: '2026-09-17', words: 640,
      title: 'Column-level lineage is in beta',
      excerpt: 'Click a column on any dashboard to see every transform it passed through, down to the source table and the commit that last changed it. The beta covers SQL models; Python models follow in Q1.' },
    { slug: 'monday-row-mismatch', category: 'Engineering', author: 'Sofia Marin', date: '2026-09-09', words: 2480,
      title: 'Tracking down a 0.3% row mismatch between two warehouses',
      excerpt: 'Two counts that should match drifted by 0.3% every Monday. A timezone cast in one join turned Sunday 23:30 UTC into Monday for the APAC region. How a per-partition hash diff found it in an afternoon.' },
    { slug: 'usage-pricing-december', category: 'Product', author: 'Tom Reyes', date: '2026-08-28', words: 1020,
      title: 'Usage-based pricing: what changes on December 1',
      excerpt: 'Viewer seats go away. You pay for compute minutes on scheduled refreshes, and every plan includes 2,000 minutes a month. The rate card and a calculator for your current usage are inside.' },
  ]

  export function createBlogCards(opts: BlogCardsOptions = {}) {
    // Derived, so an opts getter over a prop (`get posts() { return data.posts }`) stays live.
    const posts = $derived([...(opts.posts ?? SAMPLE)].sort((a, b) => b.date.localeCompare(a.date)))
    const categories = opts.categories ?? BLOG_CATEGORIES
    const wpm = opts.wordsPerMinute ?? 225
    const dateFmt = new Intl.DateTimeFormat(opts.locale ?? 'en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    const hrefOf = opts.href ?? ((p: BlogPost) => `/blog/${p.slug}`)
    let category = $state(opts.category ?? ALL_POSTS)

    const visible = $derived(category === ALL_POSTS ? posts : posts.filter((p) => p.category === category))
    const count = (name: string) => (name === ALL_POSTS ? posts.length : posts.filter((p) => p.category === name).length)

    function setCategory(name: string) {
      if (name === category) return
      category = name
      opts.onFilter?.(name)
    }

    return {
      get category() { return category },
      set category(v: string) { setCategory(v) },
      setCategory,
      /** 'All' followed by the configured categories. */
      filters: [ALL_POSTS, ...categories.map((c) => c.name)],
      get posts() { return visible },
      get isEmpty() { return visible.length === 0 },
      count,
      toneOf: (name: string): BlogTone => categories.find((c) => c.name === name)?.tone ?? 'neutral',
      dateLabel: (p: BlogPost) => dateFmt.format(new Date(`${p.date}T00:00:00Z`)),
      readLabel: (p: BlogPost) => `${readingMinutes(p, wpm)} min read`,
      /** Spread on a filter <button>. */
      chipProps: (name: string) => ({
        type: 'button' as const,
        'aria-pressed': category === name,
        onclick: () => setCategory(name),
      }),
      /** Spread on the post's <a>. */
      linkProps: (p: BlogPost) => ({
        href: hrefOf(p),
        onclick: (e: MouseEvent) => {
          if (!opts.onOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          opts.onOpen(p)
        },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvBadge, SvEmptyState, SvButton, SvToaster, toast } from '@svgrid/grid'

  const blog = createBlogCards({
    // A real app drops onOpen and lets the link navigate to /blog/<slug>.
    onOpen: (p) => toast(`Opening "${p.title}"`),
  })

  const TONE_VAR: Record<BlogTone, string> = {
    neutral: 'var(--sg-muted, #64748b)', info: 'var(--sg-info, #0284c7)', success: 'var(--sg-success, #16a34a)',
    warning: 'var(--sg-warning, #d97706)', danger: 'var(--sg-danger, #dc2626)',
  }
  // A stable number per post, so each cover gets its own bar heights and offsets.
  const seed = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const bars = (s: string) => Array.from({ length: 7 }, (_, i) => 34 + ((seed(s) >> (i * 3)) & 7) * 13)
</script>

{#snippet cover(p: BlogPost)}
  {@const n = seed(p.slug)}
  <svg class="sv-blogcards-cover" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="--sv-blogcards-tone: {TONE_VAR[blog.toneOf(p.category)]}">
    <rect class="sv-blogcards-art-bg" width="320" height="180" />
    {#if p.category === 'Engineering'}
      {@const hs = bars(p.slug)}
      {#each hs as h, i (i)}<rect class="sv-blogcards-art-soft" x={48 + i * 34} y={150 - h} width="22" height={h} rx="3" />{/each}
      <polyline class="sv-blogcards-art-line" points={hs.map((h, i) => `${59 + i * 34},${138 - h}`).join(' ')} />
    {:else if p.category === 'Product'}
      <rect class="sv-blogcards-art-panel" x={40 + (n % 30)} y="34" width="190" height="122" rx="8" />
      <path class="sv-blogcards-art-line" d="M{40 + (n % 30)} 56h190" />
      <rect class="sv-blogcards-art-soft" x={56 + (n % 30)} y="70" width="110" height="10" rx="5" />
      <rect class="sv-blogcards-art-soft" x={56 + (n % 30)} y="90" width="150" height="10" rx="5" />
      <rect class="sv-blogcards-art-panel" x={170 + (n % 24)} y="76" width="112" height="76" rx="8" />
      <circle class="sv-blogcards-art-solid" cx={200 + (n % 24)} cy="114" r="14" />
    {:else}
      <circle class="sv-blogcards-art-soft" cx={110 + (n % 40)} cy="90" r="48" />
      <circle class="sv-blogcards-art-panel" cx={190 + (n % 30)} cy="96" r="36" />
      <circle class="sv-blogcards-art-solid" cx={190 + (n % 30)} cy="96" r="10" />
    {/if}
  </svg>
{/snippet}

<section class="sv-blogcards" aria-labelledby="sv-blogcards-title">
  <header class="sv-blogcards-top">
    <h2 id="sv-blogcards-title">The Lumen blog</h2>
    <p class="sv-blogcards-muted">How we build a warehouse-native analytics tool, and what ships each month.</p>
  </header>

  <div class="sv-blogcards-filters" role="group" aria-label="Filter posts by category">
    {#each blog.filters as name (name)}
      <button class="sv-blogcards-chip" {...blog.chipProps(name)}>
        {name}<span class="sv-blogcards-chip-count">{blog.count(name)}</span>
      </button>
    {/each}
  </div>
  <p class="sv-blogcards-status" aria-live="polite">
    {blog.posts.length} {blog.posts.length === 1 ? 'post' : 'posts'}{blog.category === ALL_POSTS ? '' : ` in ${blog.category}`}
  </p>

  {#if blog.isEmpty}
    <div class="sv-blogcards-empty">
      <SvEmptyState title={`No posts in ${blog.category} yet`} description="Nothing has been published in this category. The other categories have posts you can read now.">
        <SvButton variant="outline" onclick={() => blog.setCategory(ALL_POSTS)}>Show all posts</SvButton>
      </SvEmptyState>
    </div>
  {:else}
    <ul class="sv-blogcards-grid">
      {#each blog.posts as p (p.slug)}
        <li class="sv-blogcards-post">
          {@render cover(p)}
          <div class="sv-blogcards-body">
            <div class="sv-blogcards-tags">
              <SvBadge variant={blog.toneOf(p.category)} size="sm">{p.category}</SvBadge>
              <span class="sv-blogcards-muted">{blog.readLabel(p)}</span>
            </div>
            <h3><a class="sv-blogcards-link" {...blog.linkProps(p)}>{p.title}</a></h3>
            <p class="sv-blogcards-excerpt">{p.excerpt}</p>
            <div class="sv-blogcards-byline">
              <SvAvatar name={p.author} size="sm" />
              <span class="sv-blogcards-author">{p.author}</span>
              <time class="sv-blogcards-muted" datetime={p.date}>{blog.dateLabel(p)}</time>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-blogcards {
    width: 100%; box-sizing: border-box; max-width: 1120px; margin: 0 auto; padding: 40px 32px;
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-blogcards-top h2 { margin: 0 0 4px; font-size: 26px; font-weight: 700; letter-spacing: -.015em; }
  .sv-blogcards-muted { margin: 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-blogcards-top .sv-blogcards-muted { font-size: 14px; }

  .sv-blogcards-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
  .sv-blogcards-chip {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 999px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font: inherit; font-size: 13px; font-weight: 550; cursor: pointer;
  }
  .sv-blogcards-chip:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-blogcards-chip:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-blogcards-chip[aria-pressed='true'] {
    border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb);
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 12%, transparent);
  }
  .sv-blogcards-chip-count { font-size: 11.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-blogcards-status { margin: 12px 0 16px; font-size: 12.5px; color: var(--sg-muted, #64748b); }

  .sv-blogcards-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
  .sv-blogcards-post {
    position: relative; display: flex; flex-direction: column; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: var(--sg-bg, #fff); transition: border-color .15s;
  }
  .sv-blogcards-post:hover { border-color: color-mix(in srgb, var(--sg-fg, #0f172a) 28%, var(--sg-bg, #fff)); }
  .sv-blogcards-post:focus-within { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-blogcards-cover { display: block; width: 100%; aspect-ratio: 16 / 9; height: auto; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-blogcards-art-bg { fill: color-mix(in srgb, var(--sv-blogcards-tone) 9%, var(--sg-bg, #fff)); }
  .sv-blogcards-art-soft { fill: color-mix(in srgb, var(--sv-blogcards-tone) 30%, var(--sg-bg, #fff)); }
  .sv-blogcards-art-solid { fill: var(--sv-blogcards-tone); }
  .sv-blogcards-art-panel { fill: var(--sg-bg, #fff); stroke: color-mix(in srgb, var(--sv-blogcards-tone) 45%, var(--sg-bg, #fff)); stroke-width: 1.5; }
  .sv-blogcards-art-line { fill: none; stroke: var(--sv-blogcards-tone); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

  .sv-blogcards-body { display: flex; flex-direction: column; gap: 10px; flex: 1; padding: 16px 18px 18px; }
  .sv-blogcards-tags { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sv-blogcards-body h3 { margin: 0; font-size: 16.5px; font-weight: 650; line-height: 1.35; letter-spacing: -.01em; }
  .sv-blogcards-link { color: inherit; text-decoration: none; outline: none; }
  .sv-blogcards-link::after { content: ''; position: absolute; inset: 0; }
  .sv-blogcards-post:hover .sv-blogcards-link { text-decoration: underline; text-underline-offset: 3px; }
  .sv-blogcards-excerpt {
    margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--sg-muted, #64748b);
    display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .sv-blogcards-byline { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 4px; min-width: 0; }
  .sv-blogcards-author { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sv-blogcards-byline time { margin-left: auto; white-space: nowrap; }
  .sv-blogcards-empty { border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }

  @media (max-width: 640px) {
    .sv-blogcards { padding: 24px 16px; }
    .sv-blogcards-top h2 { font-size: 22px; }
    .sv-blogcards-grid { grid-template-columns: 1fr; gap: 16px; }
  }
</style>
