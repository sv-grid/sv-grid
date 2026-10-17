#!/usr/bin/env node
/**
 * Upload the "Deadline" promo to YouTube as a Short (vertical and under 60 s,
 * so YouTube files it under Shorts on its own).
 *
 *   node --env-file=.env tools/promo/deadline/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/deadline/publish.mjs --post    upload, public
 *
 * Uses the tutorial pipeline's YouTube client; the video is not a tutorial,
 * so it has no manifest entry, captions or custom thumbnail (no narration,
 * and Shorts pick their own frame). Writes the video id to
 * marketing/videos/deadline/youtube.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'deadline')

const meta = {
  title: "Svelte data grid due at 5:00: don't generate it, install it #shorts",
  description: [
    '4:52 PM. The grid is due at 5. Your manager wants it now.',
    'You can ask an AI to write a data grid from scratch and debug what comes back, or you can install one.',
    '',
    'SvGrid is a data grid for Svelte 5: sorting, filtering, editing, grouping and paging are props on one component. The grid on the laptop at the end is real SvGrid output, from the docs example the code on screen comes from.',
    '',
    'Install: npm install @svgrid/grid',
    'Docs: https://svgrid.com/docs/',
    'Live demos: https://svgrid.com/demos/',
    '',
    '#svelte #sveltejs #webdev #programming #developer #javascript',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svelte', 'svelte 5', 'svelte data grid', 'data grid', 'svgrid', 'web development', 'programming', 'developer humor', 'deadline', 'javascript', 'frontend', 'shorts'],
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
const bytes = readFileSync(join(DIR, 'deadline.mp4'))
process.stdout.write('uploading ...')
const id = await yt.uploadVideo(bytes, meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nvideo: https://www.youtube.com/watch?v=${id}\nshort: https://www.youtube.com/shorts/${id}`)
const status = await yt.videoStatus(id).catch(() => null)
if (status) console.log(`status: ${status.uploadStatus}, processing ${status.processing}, privacy ${status.privacy}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
