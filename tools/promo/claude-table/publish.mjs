#!/usr/bin/env node
/**
 * Upload "A thousand lines of table" to YouTube as a Short.
 *
 *   node --env-file=.env tools/promo/claude-table/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/claude-table/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/claude-table/youtube.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'claude-table')

const meta = {
  title: 'A thousand lines of table, or 41 with SvGrid: a SvelteKit 3 tree table #shorts',
  description: [
    'A new SvelteKit 3 app needs a table. Asked for one, Claude writes it from scratch. Then HR wants it as a tree by manager, with editing, and every request adds more code to own and debug. Asked what to do, Claude points to a grid that already does trees and editing.',
    '',
    'The chat and the broken table are a cartoon. The footage at the end is real: a SvelteKit 3 app made with sv create, on the published @svgrid/grid, whose 41-line page shows 77 employees as a tree three levels deep. A salary is edited on camera and the change sticks.',
    '',
    'npm install @svgrid/grid',
    'Tree data: https://svgrid.com/docs/help/rows/tree-data/',
    'SvelteKit: https://svgrid.com/docs/getting-started/sveltekit/',
    'Docs: https://svgrid.com/docs/',
    '',
    '#svelte #sveltekit #sveltejs #datagrid #webdev #javascript #claude #programming',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svelte', 'sveltekit', 'sveltekit 3', 'svelte 5', 'svelte data grid', 'tree table', 'tree grid', 'org chart', 'editable table', 'claude', 'ai coding', 'programming', 'shorts'],
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
const id = await yt.uploadVideo(readFileSync(join(DIR, 'claude-table.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nshort: https://www.youtube.com/shorts/${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
