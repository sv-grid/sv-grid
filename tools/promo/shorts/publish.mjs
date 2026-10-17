#!/usr/bin/env node
/**
 * Upload rendered shorts to YouTube, in the order given.
 *
 *   node --env-file=.env tools/promo/shorts/publish.mjs <id> [<id> ...]          DRY RUN
 *   node --env-file=.env tools/promo/shorts/publish.mjs <id> [<id> ...] --post   upload, public
 *
 * The description is the short's own caption (scripts/<id>.mjs) plus links and
 * its hashtags. A short that already has marketing/videos/shorts/<id>/youtube.json
 * is skipped, so a run stopped by the daily upload quota can simply be repeated.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')

/** Title and the docs page each short points at. */
const VIDEOS = {
  'st3-studio-init': { title: 'A SvelteKit 3 CRUD app in one command', link: ['Studio CLI', 'https://svgrid.com/docs/enterprise/studio/cli/'] },
  'st3-studio-real-code': { title: 'Is generated code real SvelteKit 3? Opening a Studio app', link: ['Studio CLI', 'https://svgrid.com/docs/enterprise/studio/cli/'] },
  'st3-studio-server-rules': { title: 'Your form validates. Does your server? SvelteKit 3', link: ['Server rules', 'https://svgrid.com/docs/enterprise/studio/business-logic/'] },
  'sd-themes': { title: '20 design systems, one click: SvGrid Studio designer', link: ['The designer', 'https://svgrid.com/docs/enterprise/studio/app-designer/'] },
  'sd-samples': { title: 'A whole app in one click: 18 sample apps in SvGrid Studio', link: ['The designer', 'https://svgrid.com/docs/enterprise/studio/app-designer/'] },
  'sd-field': { title: 'Add a field, ship it: SvGrid Studio + SvelteKit 3', link: ['The designer', 'https://svgrid.com/docs/enterprise/studio/app-designer/'] },
  'sd-rules': { title: 'A server rule without writing code: SvGrid Studio', link: ['Server rules', 'https://svgrid.com/docs/enterprise/studio/business-logic/'] },
  'sd-code': { title: 'Is a visual app builder a black box? SvGrid Studio', link: ['Code behind', 'https://svgrid.com/docs/enterprise/studio/code-behind/'] },
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const post = process.argv.includes('--post')
if (!ids.length) throw new Error('usage: publish.mjs <id> [<id> ...] [--post]')

const plans = []
for (const id of ids) {
  const v = VIDEOS[id]
  if (!v) throw new Error(`no title for ${id}; add it to VIDEOS`)
  const dir = join(ROOT, 'marketing', 'videos', 'shorts', id)
  const file = join(dir, `${id}.mp4`)
  if (!existsSync(file)) throw new Error(`${id}: not rendered (${file})`)
  const script = (await import(pathToFileURL(join(HERE, 'scripts', `${id}.mjs`)).href)).default
  const meta = {
    title: `${v.title} #shorts`,
    description: [
      script.caption,
      '',
      `${v.link[0]}: ${v.link[1]}`,
      'SvGrid Studio: https://svgrid.com/studio/',
      'Pricing: https://svgrid.com/pricing/',
      '',
      script.hashtags.map((h) => `#${h}`).join(' '),
    ].join('\n').replace(/[<>]/g, ''),
    tags: ['svgrid', 'svgrid studio', 'svelte', 'sveltekit', 'sveltekit 3', 'svelte 5', 'data grid', 'crud app', 'web development', 'programming', 'shorts', ...script.hashtags],
    categoryId: '28',
    privacyStatus: 'public',
  }
  if (meta.title.length > 100) throw new Error(`${id}: title is ${meta.title.length} chars`)
  plans.push({ id, dir, file, meta, done: existsSync(join(dir, 'youtube.json')) })
}

for (const p of plans) console.log(`${p.done ? 'skip (already up)' : 'upload'}  ${p.id}: ${p.meta.title}`)
if (!post) {
  console.log(`\nfirst description:\n${plans[0].meta.description.split('\n').map((l) => '  ' + l).join('\n')}`)
  console.log('\n[dry run] pass --post to upload')
  process.exit(0)
}
if (!hasCredentials()) throw new Error('YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are required')

const yt = createClient()
for (const p of plans) {
  if (p.done) continue
  process.stdout.write(`${p.id}: uploading ...`)
  let id
  try {
    id = await yt.uploadVideo(readFileSync(p.file), p.meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
  } catch (e) {
    console.log(`\n${p.id}: FAILED - ${e.message}`)
    if (/quota/i.test(e.message)) { console.log('daily upload quota reached; rerun the same command tomorrow'); break }
    throw e
  }
  console.log(`\n${p.id}: https://www.youtube.com/shorts/${id}`)
  writeFileSync(join(p.dir, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...p.meta }, null, 2) + '\n')
}
