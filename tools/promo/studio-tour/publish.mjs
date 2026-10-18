#!/usr/bin/env node
/**
 * Upload "SvGrid Studio, a tour" to YouTube, with its captions and poster.
 *
 *   node --env-file=.env tools/promo/studio-tour/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/studio-tour/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/studio-tour/youtube.json. The
 * chapter times are the section starts of the 3:10 cut (the render's shot
 * plan); YouTube ignores every chapter when one is under 10 s, so Logic and
 * Preview share one.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'studio-tour')

const meta = {
  title: 'SvGrid Studio: from your database to a SvelteKit app',
  description: [
    'SvGrid Studio designs the screens for your data and writes them as a SvelteKit app you own.',
    '',
    'Start from Postgres, MySQL, SQL Server, SQLite, Supabase, a REST API, an OpenAPI spec or a CSV file. Lay out dashboards, grids, boards and record pages on a canvas, restyle the app with 20 themes in light and dark, add logic in TypeScript, and preview it on a desktop, a tablet and a phone. Then generate a SvelteKit project with routes, typed schemas with tests, sign-in and a CI workflow, and deploy it to Vercel, Netlify or Cloudflare.',
    '',
    'The footage is the real Studio at svgrid.com/studio, running its CRM sample app.',
    '',
    'Try it in your browser: https://svgrid.com/studio/',
    'Docs: https://svgrid.com/docs/enterprise/studio/',
    'SvGrid Studio is part of SvGrid Enterprise Suite. 30-day free trial: https://svgrid.com/pricing/',
    '',
    '0:00 SvGrid Studio',
    '0:45 Data model',
    '0:58 Screens',
    '1:25 Themes',
    '1:39 Logic and preview',
    '2:00 Generate and deploy',
    '2:27 What you get',
    '2:54 Try it',
    '',
    '#svelte #sveltekit #sveltejs #webdev #lowcode #internaltools #typescript',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svgrid studio', 'sveltekit', 'svelte', 'svelte 5', 'app builder', 'crud generator', 'admin panel', 'internal tools', 'low code', 'data grid'],
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
const id = await yt.uploadVideo(readFileSync(join(DIR, 'studio-tour.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nvideo: https://www.youtube.com/watch?v=${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/watch?v=${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
await yt.insertCaption(id, readFileSync(join(DIR, 'studio-tour.srt'), 'utf8')).then(() => console.log('captions: uploaded'), (e) => console.log(`captions: ${e.message}`))
await yt.setThumbnail(id, readFileSync(join(DIR, 'poster.jpg'))).then(() => console.log('thumbnail: set'), (e) => console.log(`thumbnail: ${e.message}`))
