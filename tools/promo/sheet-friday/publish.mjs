#!/usr/bin/env node
/**
 * Upload "Excel by Friday" to YouTube as a Short.
 *
 *   node --env-file=.env tools/promo/sheet-friday/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/sheet-friday/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/sheet-friday/youtube.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'sheet-friday')

const meta = {
  title: 'Excel in your Svelte app by Friday: SvGrid Spreadsheet #shorts',
  description: [
    'Finance wants their spreadsheet inside the company app, formulas and all, by Friday. A table shows formulas as text, a homemade parser throws #REF!, pasting loses the formats. SvGrid Spreadsheet is one Svelte component: the ribbon, the formula bar, the Excel keyboard.',
    '',
    'The office is a cartoon. The footage is real: a plain Vite + Svelte 5 app whose page is one <SvSheet /> on the published @svgrid/enterprise, with no license key. A formula is typed, a figure changes and the totals follow, Ctrl+B bolds the total row.',
    '',
    'Try it free: npm i @svgrid/grid @svgrid/enterprise',
    'Every feature runs; a small watermark shows until you add a license key.',
    '',
    'Get started: https://svgrid.com/docs/help/sheet/start/',
    'Live demo: https://svgrid.com/demos/207-blank-sheet/',
    'Licensing: https://svgrid.com/docs/enterprise/licensing/',
    '',
    '#svelte #sveltejs #spreadsheet #excel #webdev #javascript #programming',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svelte', 'svelte 5', 'svelte spreadsheet', 'spreadsheet component', 'excel in the browser', 'excel', 'formulas', 'web spreadsheet', 'javascript spreadsheet', 'programming', 'shorts'],
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
const id = await yt.uploadVideo(readFileSync(join(DIR, 'sheet-friday.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nshort: https://www.youtube.com/shorts/${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
