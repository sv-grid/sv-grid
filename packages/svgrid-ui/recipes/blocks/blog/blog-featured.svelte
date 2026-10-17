<script lang="ts" module>
  /**
   * Featured article block - the top of a blog index. A lead article with
   * large inline SVG cover art, a category SvBadge, the title, the excerpt and
   * an SvAvatar byline with the date and reading time sits beside a list of
   * the four most recent other posts (title, date, reading time) and a "View
   * all posts" link. The two columns stack on phones. Pure UI-kit, --sg-*
   * themed.
   *
   * Headless: createFeaturedPosts() below picks the lead and the recent posts,
   * formats dates, computes reading time from the word count and builds the
   * links with no markup. The component under it is one styled render of that
   * core; import createFeaturedPosts from this file (or `npx @svgrid/ui add
   * blog-featured --headless` for the core alone) to draw your own.
   */
  export type BlogTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  export type BlogPost = {
    slug: string; title: string; excerpt: string; category: string; author: string
    /** ISO date, YYYY-MM-DD. */
    date: string
    /** The post text (markdown is fine); the reading time counts its words. */
    body?: string
    /** A precomputed word count, for list pages that do not load the body. */
    words?: number
  }
  export type FeaturedPostsOptions = {
    posts?: BlogPost[]
    /** Slug of the lead article. Default: the newest post. */
    featured?: string
    /** How many recent posts to list beside it. Default 4. */
    recentCount?: number
    /** Badge tone per category name; unknown categories are neutral. */
    tones?: Record<string, BlogTone>
    wordsPerMinute?: number
    locale?: string
    /** Where a post links. Default `/blog/<slug>`. */
    href?: (post: BlogPost) => string
    /** The "View all posts" target. Default `/blog`. */
    allHref?: string
    /** Handle a plain click on a post yourself; the link's navigation is cancelled. */
    onOpen?: (post: BlogPost) => void
    /** Same, for "View all posts". */
    onViewAll?: () => void
  }

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
      excerpt: 'Column order, filters and pinned rows used to live in the browser. From 4.2 they are stored per workspace.' },
    { slug: 'postgres-job-queue', category: 'Engineering', author: 'Hana Okafor', date: '2026-09-24', words: 1730,
      title: 'Replacing our message broker with a Postgres queue',
      excerpt: 'SELECT ... FOR UPDATE SKIP LOCKED handles our peak of 3,100 jobs a second on one 8-vCPU instance.' },
    { slug: 'column-lineage-beta', category: 'Product', author: 'Daniel Brandt', date: '2026-09-17', words: 640,
      title: 'Column-level lineage is in beta',
      excerpt: 'Click a column on any dashboard to see every transform it passed through.' },
    { slug: 'monday-row-mismatch', category: 'Engineering', author: 'Sofia Marin', date: '2026-09-09', words: 2480,
      title: 'Tracking down a 0.3% row mismatch between two warehouses',
      excerpt: 'Two counts that should match drifted by 0.3% every Monday.' },
    { slug: 'usage-pricing-december', category: 'Product', author: 'Tom Reyes', date: '2026-08-28', words: 1020,
      title: 'Usage-based pricing: what changes on December 1',
      excerpt: 'Viewer seats go away. You pay for compute minutes on scheduled refreshes.' },
  ]

  export function createFeaturedPosts(opts: FeaturedPostsOptions = {}) {
    // Derived, so an opts getter over a prop (`get posts() { return data.posts }`) stays live.
    const posts = $derived([...(opts.posts ?? SAMPLE)].sort((a, b) => b.date.localeCompare(a.date)))
    const lead = $derived(posts.find((p) => p.slug === opts.featured) ?? posts[0])
    const recent = $derived(posts.filter((p) => p !== lead).slice(0, opts.recentCount ?? 4))
    const tones = opts.tones ?? { Engineering: 'info', Product: 'success', Customers: 'warning' }
    const wpm = opts.wordsPerMinute ?? 225
    const dateFmt = new Intl.DateTimeFormat(opts.locale ?? 'en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    const hrefOf = opts.href ?? ((p: BlogPost) => `/blog/${p.slug}`)
    // Plain left clicks only: Ctrl/Cmd/Shift-click keeps the browser's new tab or window.
    const plain = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)

    return {
      /** The lead article; undefined when there are no posts. */
      get lead() { return lead },
      get recent() { return recent },
      toneOf: (name: string): BlogTone => tones[name] ?? 'neutral',
      dateLabel: (p: BlogPost) => dateFmt.format(new Date(`${p.date}T00:00:00Z`)),
      readLabel: (p: BlogPost) => `${readingMinutes(p, wpm)} min read`,
      /** Spread on a post's <a>. */
      linkProps: (p: BlogPost) => ({
        href: hrefOf(p),
        onclick: (e: MouseEvent) => {
          if (!opts.onOpen || !plain(e)) return
          e.preventDefault()
          opts.onOpen(p)
        },
      }),
      /** Spread on the "View all posts" <a>. */
      viewAllProps: () => ({
        href: opts.allHref ?? '/blog',
        onclick: (e: MouseEvent) => {
          if (!opts.onViewAll || !plain(e)) return
          e.preventDefault()
          opts.onViewAll()
        },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const blog = createFeaturedPosts({
    // A real app drops these two and lets the links navigate.
    onOpen: (p) => toast(`Opening "${p.title}"`),
    onViewAll: () => toast('Opening the blog index'),
  })

  const TONE_VAR: Record<BlogTone, string> = {
    neutral: 'var(--sg-muted, #64748b)', info: 'var(--sg-info, #0284c7)', success: 'var(--sg-success, #16a34a)',
    warning: 'var(--sg-warning, #d97706)', danger: 'var(--sg-danger, #dc2626)',
  }
  const seed = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const bars = (s: string) => Array.from({ length: 9 }, (_, i) => 30 + ((seed(s) >> (i * 3)) & 7) * 14)
</script>

<section class="sv-blogfeat" aria-labelledby="sv-blogfeat-title">
  <h2 id="sv-blogfeat-title">Latest from the blog</h2>

  <div class="sv-blogfeat-layout">
    {#if blog.lead}
      {@const p = blog.lead}
      <article class="sv-blogfeat-lead">
        <svg class="sv-blogfeat-cover" viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="--sv-blogfeat-tone: {TONE_VAR[blog.toneOf(p.category)]}">
          <rect class="sv-blogfeat-art-bg" width="480" height="270" />
          {#each bars(p.slug) as h, i (i)}<rect class="sv-blogfeat-art-soft" x={60 + i * 42} y={230 - h} width="28" height={h} rx="4" />{/each}
          <polyline class="sv-blogfeat-art-line" points={bars(p.slug).map((h, i) => `${74 + i * 42},${214 - h}`).join(' ')} />
          <rect class="sv-blogfeat-art-panel" x="300" y="28" width="148" height="54" rx="8" />
          <rect class="sv-blogfeat-art-solid" x="316" y="44" width="56" height="8" rx="4" />
          <rect class="sv-blogfeat-art-soft" x="316" y="60" width="100" height="8" rx="4" />
        </svg>
        <div class="sv-blogfeat-lead-body">
          <SvBadge variant={blog.toneOf(p.category)} size="sm">{p.category}</SvBadge>
          <h3><a class="sv-blogfeat-lead-link" {...blog.linkProps(p)}>{p.title}</a></h3>
          <p class="sv-blogfeat-excerpt">{p.excerpt}</p>
          <div class="sv-blogfeat-byline">
            <SvAvatar name={p.author} />
            <div>
              <div class="sv-blogfeat-author">{p.author}</div>
              <div class="sv-blogfeat-muted"><time datetime={p.date}>{blog.dateLabel(p)}</time> · {blog.readLabel(p)}</div>
            </div>
          </div>
        </div>
      </article>
    {/if}

    <aside class="sv-blogfeat-recent" aria-labelledby="sv-blogfeat-recent-title">
      <h3 id="sv-blogfeat-recent-title">Recent posts</h3>
      <ul class="sv-blogfeat-list">
        {#each blog.recent as r (r.slug)}
          <li>
            <a class="sv-blogfeat-item" {...blog.linkProps(r)}>{r.title}</a>
            <div class="sv-blogfeat-muted"><time datetime={r.date}>{blog.dateLabel(r)}</time> · {blog.readLabel(r)}</div>
          </li>
        {/each}
      </ul>
      <a class="sv-blogfeat-all" {...blog.viewAllProps()}>
        View all posts
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </a>
    </aside>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-blogfeat {
    width: 100%; box-sizing: border-box; max-width: 1120px; margin: 0 auto; padding: 40px 32px;
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-blogfeat > h2 { margin: 0 0 20px; font-size: 26px; font-weight: 700; letter-spacing: -.015em; }
  .sv-blogfeat-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 32px; align-items: start; }
  .sv-blogfeat-muted { font-size: 12.5px; color: var(--sg-muted, #64748b); }

  .sv-blogfeat-lead {
    position: relative; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); background: var(--sg-bg, #fff);
  }
  .sv-blogfeat-lead:hover { border-color: color-mix(in srgb, var(--sg-fg, #0f172a) 28%, var(--sg-bg, #fff)); }
  .sv-blogfeat-lead:focus-within { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-blogfeat-cover { display: block; width: 100%; aspect-ratio: 16 / 9; height: auto; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-blogfeat-art-bg { fill: color-mix(in srgb, var(--sv-blogfeat-tone) 9%, var(--sg-bg, #fff)); }
  .sv-blogfeat-art-soft { fill: color-mix(in srgb, var(--sv-blogfeat-tone) 30%, var(--sg-bg, #fff)); }
  .sv-blogfeat-art-solid { fill: var(--sv-blogfeat-tone); }
  .sv-blogfeat-art-panel { fill: var(--sg-bg, #fff); stroke: color-mix(in srgb, var(--sv-blogfeat-tone) 45%, var(--sg-bg, #fff)); stroke-width: 1.5; }
  .sv-blogfeat-art-line { fill: none; stroke: var(--sv-blogfeat-tone); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }

  .sv-blogfeat-lead-body { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 20px 22px 22px; }
  .sv-blogfeat-lead-body h3 { margin: 0; font-size: 23px; font-weight: 700; line-height: 1.25; letter-spacing: -.015em; }
  .sv-blogfeat-lead-link { color: inherit; text-decoration: none; outline: none; }
  .sv-blogfeat-lead-link::after { content: ''; position: absolute; inset: 0; }
  .sv-blogfeat-lead:hover .sv-blogfeat-lead-link { text-decoration: underline; text-underline-offset: 4px; }
  .sv-blogfeat-excerpt { margin: 0; font-size: 14.5px; line-height: 1.6; color: var(--sg-muted, #64748b); }
  .sv-blogfeat-byline { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
  .sv-blogfeat-author { font-size: 13.5px; font-weight: 600; }

  .sv-blogfeat-recent h3 {
    margin: 0; padding-bottom: 10px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
    font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--sg-muted, #64748b);
  }
  .sv-blogfeat-list { list-style: none; margin: 0; padding: 0; }
  .sv-blogfeat-list li { display: flex; flex-direction: column; gap: 4px; padding: 14px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-blogfeat-item { color: var(--sg-fg, #0f172a); font-size: 15px; font-weight: 600; line-height: 1.4; text-decoration: none; }
  .sv-blogfeat-item:hover { text-decoration: underline; text-underline-offset: 3px; }
  .sv-blogfeat-item:focus-visible, .sv-blogfeat-all:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }
  .sv-blogfeat-all {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 16px;
    font-size: 13.5px; font-weight: 600; color: var(--sg-accent, #2563eb); text-decoration: none;
  }
  .sv-blogfeat-all:hover { text-decoration: underline; }
  .sv-blogfeat-all svg { display: block; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  @media (max-width: 760px) {
    .sv-blogfeat { padding: 24px 16px; }
    .sv-blogfeat > h2 { font-size: 22px; }
    .sv-blogfeat-layout { grid-template-columns: 1fr; gap: 24px; }
    .sv-blogfeat-lead-body { padding: 16px 16px 18px; }
    .sv-blogfeat-lead-body h3 { font-size: 20px; }
  }
</style>
