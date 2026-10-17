#!/usr/bin/env node
/**
 * Upload "Meet SvGrid Base" to YouTube, once SvGrid Base is on npm (the video
 * says `npm i @svgrid/enterprise`; until Base ships there it must not go out).
 *
 *   node --env-file=.env tools/promo/base-intro/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/base-intro/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/base-intro/youtube.json. The
 * description names Airtable, so it carries Airtable's trademark attribution,
 * as Airtable's trademark guidelines ask of anyone who refers to it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'base-intro')

export const ATTRIBUTION = 'Airtable is a registered trademark of Formagrid Inc dba Airtable. SvGrid is not affiliated with Airtable.'

const meta = {
  title: 'Meet SvGrid Base: an Airtable alternative inside your Svelte app',
  description: [
    'Zazo presents SvGrid Base: tables your team works in, inside your own Svelte app, on your own database.',
    '',
    'More than twenty field types (selects, people, dates, files, links, lookups, rollups, formulas), and every table as a grid, a Kanban board, a calendar, a gallery or a form. Filter, group, sort, color, and open any record with its comments.',
    '',
    'Point it at a Supabase project and it builds the app from your tables. Edits are written to your database, and other people\'s changes arrive through Supabase Realtime. Postgres, MySQL, SQLite, SQL Server and your own API work too, and a base designed in the page downloads as SQL that creates the tables.',
    '',
    'The footage is real: the Base demos, a real Postgres in the page, and a real Supabase project.',
    '',
    'Part of SvGrid Suite. Try it free: npm i @svgrid/grid @svgrid/enterprise',
    'Docs: https://svgrid.com/docs/help/base/quick-start/',
    '',
    ATTRIBUTION,
    '',
    '#svelte #sveltejs #airtable #supabase #nocode #webdev #javascript',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svgrid base', 'svelte', 'airtable alternative', 'supabase', 'table database', 'no-code', 'svelte 5', 'database app', 'programming'],
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
const id = await yt.uploadVideo(readFileSync(join(DIR, 'base-intro.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nvideo: https://www.youtube.com/watch?v=${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/watch?v=${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
