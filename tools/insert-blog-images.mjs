#!/usr/bin/env node
/**
 * Insert real demo screenshots into the matching blog posts, right after the
 * intro paragraph. Images live in website/public/blog-media/ (captured by
 * tools/blog-screenshots.mjs) and are served at /blog-media/<name>.png.
 * Idempotent: a post that already references its image is skipped.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')

// slug -> { name (file in /blog-media), alt, caption }
const MAP = {
  'lazy-loading-master-detail-content': { name: 'lazy-tree', alt: 'Lazy-loaded tree branches in SvGrid', caption: 'Lazy-loaded branches: detail data fetched only on expand.' },
  'building-grouping-trees-master-detail': { name: 'org-chart', alt: 'An org-chart tree in SvGrid', caption: 'Grouping, trees, and master-detail on one expansion model.' },
  'svelte-data-grid-sveltekit-supabase': { name: 'server-side', alt: 'Server-side data from Supabase in SvGrid', caption: 'Server-side sorting, filtering, and paging - here backed by Supabase.' },
  'svelte-data-grid-tanstack-query': { name: 'server-row-model', alt: 'Server-paged data with TanStack Query in SvGrid', caption: 'Cached, server-paged data driving a SvGrid grid.' },
  'svelte-data-grid-prisma': { name: 'server-side-2', alt: 'Server-side data from Prisma in SvGrid', caption: 'A Prisma-backed server row model in SvGrid.' },
  'svelte-data-grid-drizzle-orm': { name: 'server-side-2', alt: 'Server-side data from Drizzle in SvGrid', caption: 'A Drizzle-backed, fully typed server grid.' },
  'server-side-data-and-the-headless-core': { name: 'server-side', alt: 'Server-side data in SvGrid', caption: 'The grid records state; the server returns the page.' },
  'saas-billing-usage-table': { name: 'export', alt: 'A billing grid exported from SvGrid', caption: 'A billing/usage grid - formatted, totalled, and exportable.' },
  'conditional-row-styling': { name: 'anomaly', alt: 'Conditional row highlighting in SvGrid', caption: 'Row-level conditional styling driven by the data.' },
  'autocomplete-cell-editor': { name: 'custom-cell-editors', alt: 'Custom cell editors in SvGrid', caption: 'Custom, typed cell editors in SvGrid.' },
}

async function main() {
  const files = new Set(await readdir(BLOG_DIR))
  let inserted = 0
  for (const [slug, { name, alt, caption }] of Object.entries(MAP)) {
    const file = `${slug}.md`
    if (!files.has(file)) { process.stdout.write(`miss ${slug} (no file)\n`); continue }
    const path = join(BLOG_DIR, file)
    let text = await readFile(path, 'utf-8')
    if (text.includes(`/blog-media/${name}.png`)) { process.stdout.write(`skip ${slug} (already has image)\n`); continue }

    // Find the end of frontmatter, then the end of the first body paragraph.
    const fmEnd = text.indexOf('\n---', 4)
    const bodyStart = text.indexOf('\n', fmEnd + 1) + 1
    const afterIntro = text.indexOf('\n\n', bodyStart)
    if (fmEnd === -1 || afterIntro === -1) { process.stdout.write(`miss ${slug} (parse)\n`); continue }

    const img = `\n\n![${alt}](/blog-media/${name}.png)\n*${caption}*`
    text = text.slice(0, afterIntro) + img + text.slice(afterIntro)
    await writeFile(path, text)
    inserted += 1
    process.stdout.write(`image -> ${slug}\n`)
  }
  process.stdout.write(`\ninserted ${inserted} images\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
