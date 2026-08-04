# SEO content plan - aim the machine you already built

**The honest diagnosis (2026-08-04).** You do not have a content problem. You have
**170 blog posts**, per-page SEO on every doc / demo / comparison / blog URL,
SoftwareApplication + Article + FAQ + Breadcrumb JSON-LD, a prerenderer that
emits individually-indexable static HTML, and a sitemap. That is a genuine SEO
*engine*, and most of it is more sophisticated than what competing libraries ship.

The problem is three things, none of which is "write more":

1. **The ranking structure was built but never shipped.** The internal-linking
   and pillar-hub tools ran locally; their output was never committed to the
   `sv-grid/website` repo. Verified: only **1 of 170 posts** actually contains a
   "Related reading" block, and the **3 pillar hubs are not committed**. So Google
   sees 170 near-orphan pages instead of 3 tight topic clusters. This is the
   single highest-leverage fix and it is nearly free.
2. **No evidence of measurement.** Without Google Search Console you are ranking
   blind - you cannot see which of the 170 posts already get impressions, where
   you sit on page 2 (one push from page 1), or which terms you are missing.
3. **Authority is the real ceiling.** 170 posts on a young domain rank slowly
   because nothing links to them. Backlinks - especially from jQWidgets /
   htmlelements.com - are what convert "indexed" into "ranked."

Do these in order. P0/P1 are days of work for outsized return; writing new
content is P4 and mostly unnecessary.

---

## P0 - Ship the ranking structure that already exists (this week)

Nearly zero authoring. Turns 170 orphans into 3 clusters Google can understand.

1. Regenerate the internal links and pillar hubs, then **commit + push them into
   the private `website/` submodule** (the step that was skipped):
   ```bash
   node tools/blog-internal-links.mjs      # inject "Related reading" into all 170 posts
   node tools/blog-pillars.mjs             # (re)build the 3 pillar hub pages
   # then INSIDE website/:
   git -C website add src/content/blog
   git -C website commit -m "SEO: internal linking + pillar hubs across all posts"
   git -C website push
   # bump the submodule pointer in the parent repo and let deploy-website.yml run
   ```
2. Verify after deploy: the 3 pillar URLs resolve
   (`/blog/svelte-data-grid-comparisons`, `-integrations`, `-guides`) and a
   sample of posts show a Related-reading block in the prerendered HTML
   (`curl -s https://svgrid.com/blog/<slug> | grep -i "related reading"`).
3. **Link the pillars from the top nav or footer.** A hub nothing links to is
   itself an orphan. The nav is the strongest internal signal you have - spend it
   on the 3 hubs + /demos + /pricing.

**Why first:** internal linking is the cheapest ranking lever in existence, and
right now essentially none of it is live despite the tooling being done.

---

## P1 - Measurement (this week, do in parallel with P0)

You cannot optimize what you cannot see.

1. **Google Search Console** - verify svgrid.com, submit `sitemap.xml`, capture a
   baseline screenshot of impressions/clicks/queries now. Do the same in **Bing
   Webmaster Tools** (feeds ChatGPT search).
2. After ~2 weeks of data, pull the **Performance report** and sort by
   impressions. Two goldmines:
   - **Page-2 keywords (positions 11-20):** posts one nudge from page 1. These
     are your highest-ROI optimization targets - deepen + interlink them first.
   - **High-impression / low-CTR pages:** the title/description is losing the
     click. Rewrite those `<title>`/meta in `seo.ts` or the post frontmatter.
3. Confirm indexation: `site:svgrid.com` in Google should show a few hundred
   URLs. If it shows ~10, indexation is broken (check the prerendered HTML is
   actually deploying and no `noindex` slipped in).

**Deliverable:** a one-page GSC baseline so every later move is measured, not
guessed.

---

## P2 - Win the head terms + kill cannibalization (weeks 2-4)

With 170 posts there is certain keyword overlap - multiple posts competing for
the same query means Google ranks none of them well.

1. **Map money keywords to ONE canonical page each.** The commercial head terms,
   roughly by intent:

   | Keyword cluster | Canonical page | Notes |
   | --- | --- | --- |
   | `svelte data grid`, `svelte 5 data grid` | Home / `/` | Your primary term |
   | `svelte table`, `svelte table component` | a dedicated deep guide | high volume, winnable |
   | `svelte datagrid` / `sveltekit data grid` | home or a KIT-specific guide | |
   | `svelte kanban board` | a Kanban guide/demo page | you own a strong feature here |
   | `svelte pivot table` | a pivot guide | low competition |
   | `sveltekit crud app` / `svelte admin dashboard` | Studio + the admin-dashboard post | commercial intent |
   | `svelte excel export` / `export to xlsx svelte` | the export post | commercial intent |
   | `ag grid svelte` / `ag grid alternative svelte` | the comparison + alternatives posts | already written |
   | `svelte virtual table` / `svelte 100k rows` | virtualization post | |

2. For each cluster: pick the strongest page as canonical, make it the **deepest**
   (aim 1,800-2,500 words, real code, a live demo embed, an FAQ block for the
   FAQPage schema you already emit), and point the sibling posts *at* it via the
   internal-link tool. Consolidate, do not duplicate.
3. Make sure each canonical page's `<title>` leads with the exact query and the
   H1 matches. Check `seo.ts` route titles and post frontmatter.

**Why:** ranking #1 for "svelte table" (thin competition) is worth more than 50
new long-tail posts.

---

## P3 - Authority / backlinks (ongoing - the real ceiling)

Indexed != ranked. Links are the difference. In rough order of leverage:

1. **jQWidgets / htmlelements.com cross-links (your unfair advantage).** Permanent
   contextual links from those aged, high-authority domains to svgrid.com pass
   real link equity a young domain cannot otherwise get. A "Building in Svelte?
   Use SvGrid" placement + a few in-content links from relevant jQWidgets grid
   pages is worth more than months of outreach. **(This is deliverable (b) - do
   it.)**
2. **The discovery lists** in `discovery-lists.md` (awesome-svelte,
   awesome-mcp-servers, MCP registries) - each is a followable link + referral.
3. **Guest / syndicated content** on dev.to, Hashnode, Medium with a canonical
   link back (or original posts that link back). Syndicate your best existing
   posts, do not write new ones.
4. **Get the demos referenced.** 280+ live demos are linkable assets; a "built
   with SvGrid" showcase and Stack Overflow answers that link a relevant demo
   both earn contextual links.
5. **Svelte Society / newsletters / podcasts** - a mention in "This Week in
   Svelte" or on a Svelte podcast is a quality link + audience.

---

## P4 - New content, but only for genuine gaps (ongoing, low priority)

You have covered most topics. Only write when GSC (P1) shows a real query with
impressions and no strong page. Likely genuine gaps to check:

- **Framework-comparison landing pages for people arriving from other ecosystems**
  ("data grid for SvelteKit vs React", migration intent) - you have some; audit
  coverage against GSC.
- **"How to" head terms** surfaced by GSC that are not yet a dedicated page.
- **YouTube** (technically not blog SEO, but the highest-ROI untapped search
  surface): one 8-12 min "build a data grid in SvelteKit" tutorial ranks in
  Google + YouTube for years and earns embeds/links. Worth more than 20 posts.

Do NOT keep the daily blog drip running just to publish volume - past a point it
dilutes crawl budget and creates cannibalization. Quality + structure now beats
quantity.

---

## The 30-day sequence

- **Week 1:** P0 (ship internal links + pillars + nav) and P1 (GSC/Bing +
  baseline). These two alone should move rankings within weeks because the
  content is already indexed - you are adding structure, not starting over.
- **Week 2:** read GSC, list page-2 keywords + low-CTR pages, start the jQWidgets
  backlink placement (P3.1).
- **Weeks 3-4:** deepen the top 5 money pages (P2), fix the worst title/meta CTR
  losers, submit the discovery-list PRs.
- **Ongoing:** one authority action/week (P3), new content only where GSC proves
  a gap (P4), and film one YouTube tutorial.

## Honest expectation

SEO compounds over 3-12 months; there is no switch that skips it. But your
starting position is unusually strong - the engine and the content exist, they
are just unstructured and unmeasured. Shipping P0+P1 is the difference between
170 posts that sit there and 170 posts that rank as three authoritative clusters.
That, plus jQWidgets backlinks, is a realistic path from a few-hundred/day toward
low-thousands/day for a Svelte-focused tool. Breaking past that is the
multi-framework decision, which is a separate conversation.
