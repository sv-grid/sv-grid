#!/usr/bin/env node
/**
 * Upload "300,000 rows, live" to YouTube as a Short.
 *
 *   node --env-file=.env tools/promo/tm-live/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/tm-live/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/tm-live/youtube.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'tm-live')

const meta = {
  title: '300,000 rows, live, grouped: a Svelte data grid under load #shorts',
  description: [
    'A test and measurement team moves its results grid to Svelte: 300,000 records grouped by station, and every second 600 new results arrive, 600 old ones leave and 3,000 values change.',
    '',
    'The footage is real: the published @svgrid/grid in a plain Vite + Svelte 5 app, one api.applyTransaction batch per second with grouping applied. The numbers on screen are measured in the browser on every frame: 300,000 rows held, each batch applied and painted in a few hundred milliseconds.',
    '',
    'npm install @svgrid/grid',
    'Real-time data in SvGrid: https://svgrid.com/docs/help/real-time/',
    'Docs: https://svgrid.com/docs/',
    '',
    '#svelte #sveltejs #datagrid #webdev #javascript #performance #programming',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svelte', 'svelte 5', 'svelte data grid', 'data grid', 'real-time data', 'grouping', 'large dataset', 'test and measurement', 'web performance', 'programming', 'shorts'],
  categoryId: '28',
  privacyStatus: 'public',
}

console.log(`title:   ${meta.title} (${meta.title.length} chars)`)
console.log(`description:\n${meta.description.split('\n').map((l) => '  ' + l).join('\n')}`)
if (!process.argv.includes('--post')) {
  console.log('\n[dry run] pass --post to upload')
  process.exit(0)
}
if (existsSync(join(DIR, 'youtube.json'))) throw new Error('already uploaded (youtube.json exists)')
if (!hasCredentials()) throw new Error('YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are required')

const yt = createClient()
process.stdout.write('uploading ...')
const id = await yt.uploadVideo(readFileSync(join(DIR, 'tm-live.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nshort: https://www.youtube.com/shorts/${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
