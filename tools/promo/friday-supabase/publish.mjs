#!/usr/bin/env node
/**
 * Upload "Friday, 5:47 PM" to YouTube as a Short.
 *
 *   node --env-file=.env tools/promo/friday-supabase/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/friday-supabase/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/friday-supabase/youtube.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'friday-supabase')

const meta = {
  title: 'Friday 5:47 PM: a Supabase admin panel by Monday? #shorts',
  description: [
    "Friday, 5:47 PM. The CEO wants an admin panel on the company's Supabase data by Monday morning: a list, a form and a record page for every table.",
    '',
    'One command instead: SvGrid Studio reads the Supabase tables and writes a SvelteKit 3 app. The terminal on the monitor is a real init run, and the app on screen is real footage of the generated app filtering and paging the live Supabase data, with the requests to Supabase counted on every frame.',
    '',
    'npx @svgrid/studio init --kit 3 --supabase-url <url> --supabase-key <anon key>',
    'Supabase guide: https://svgrid.com/docs/enterprise/studio/supabase/',
    'SvGrid Studio: https://svgrid.com/studio/',
    'SvGrid Studio ships with the SvGrid Enterprise Suite: https://svgrid.com/pricing/',
    '',
    '#sveltekit #supabase #svelte #webdev #javascript #programming #developer',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svgrid studio', 'supabase', 'sveltekit', 'sveltekit 3', 'svelte', 'svelte 5', 'admin panel', 'crud app', 'web development', 'programming', 'shorts'],
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
const id = await yt.uploadVideo(readFileSync(join(DIR, 'friday-supabase.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nshort: https://www.youtube.com/shorts/${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
