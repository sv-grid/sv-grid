#!/usr/bin/env node
/**
 * Upload "The Live Demo" promo to YouTube as a Short (vertical, under 60 s).
 *
 *   node --env-file=.env tools/promo/live-demo/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/live-demo/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/live-demo/youtube.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'live-demo')

const meta = {
  title: 'Live demo, 100,000 rows, the tab freezes: a Svelte data grid story #shorts',
  description: [
    'Live demo. Two hundred people. The CEO asks for all 100,000 orders, and a table that renders every row freezes the tab on the big screen.',
    '',
    'The fix on stage: swap the table for SvGrid, the data grid for Svelte 5. The grid on the projector is real footage of SvGrid scrolling and sorting 100,000 rows by 100 columns, and the row count in the DOM shown on screen was measured on every frame. Row and column virtualization are on by default.',
    '',
    'Install: npm install @svgrid/grid',
    'Try the 100k-row demo: https://svgrid.com/demos/06-large-dataset/',
    'Docs: https://svgrid.com/docs/',
    '',
    '#svelte #sveltejs #webdev #programming #javascript #performance',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svelte', 'svelte 5', 'svelte data grid', 'data grid', 'virtual scrolling', 'virtualization', 'svgrid', 'web performance', 'web development', 'programming', 'live demo', 'javascript', 'shorts'],
  categoryId: '28',
  privacyStatus: 'public',
}

console.log(`title:   ${meta.title} (${meta.title.length} chars)`)
console.log(`privacy: ${meta.privacyStatus}`)
console.log(`tags:    ${meta.tags.join(', ')}`)
console.log(`description:\n${meta.description.split('\n').map((l) => '  ' + l).join('\n')}`)

if (!process.argv.includes('--post')) {
  console.log('\n[dry run] pass --post to upload')
  process.exit(0)
}
if (!hasCredentials()) throw new Error('YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are required')

const yt = createClient()
const bytes = readFileSync(join(DIR, 'live-demo.mp4'))
process.stdout.write('uploading ...')
const id = await yt.uploadVideo(bytes, meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nvideo: https://www.youtube.com/watch?v=${id}\nshort: https://www.youtube.com/shorts/${id}`)
const status = await yt.videoStatus(id).catch(() => null)
if (status) console.log(`status: ${status.uploadStatus}, processing ${status.processing}, privacy ${status.privacy}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
