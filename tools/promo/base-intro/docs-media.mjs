#!/usr/bin/env node
/**
 * Put "Meet SvGrid Base" on the Base docs: a web copy of the render
 * (960 x 540), its poster and captions under website/public/tutorials/, and
 * the manifest entry tools/tutorials/embed.mjs places on
 * docs/help/base/quick-start.md. The captions come from the same take
 * timings the render used, so they match the voice.
 *
 *   node --env-file=.env tools/promo/base-intro/docs-media.mjs
 *   node tools/tutorials/embed.mjs
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareVoices, timeline } from './voice.mjs'
import { toVtt } from '../../lib/tutorial-media.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const SRC = join(ROOT, 'marketing', 'videos', 'base-intro')
const PUB = join(ROOT, 'website', 'public', 'tutorials')
const ID = 'mk-meet-svgrid-base'

const voices = await prepareVoices(join(SRC, '.voice-cache'))
const { at, end } = timeline(Object.fromEntries(voices.map((v) => [v.id, v.dur])))
const r2 = (x) => Math.round(x * 100) / 100
const transcript = voices.map((v) => ({ start: r2(at[v.id]), end: r2(at[v.id] + v.dur), text: `Zazo: ${v.text.replace(/\[[^\]]*\]\s*/g, '').trim()}` }))

const mp4 = join(PUB, `${ID}.mp4`)
const poster = join(PUB, `${ID}.poster.webp`)
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(SRC, 'base-intro.mp4'), '-vf', 'scale=960:540', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', mp4])
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(SRC, 'poster.jpg'), '-vf', 'scale=960:540', '-quality', '78', poster])
writeFileSync(join(PUB, `${ID}.vtt`), toVtt(transcript))

const manifestPath = join(ROOT, 'tools', 'tutorials', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const entry = {
  id: ID,
  kind: 'marketing',
  player: true,
  title: 'Meet SvGrid Base: tables inside your Svelte app, on your own database',
  description: 'Zazo presents SvGrid Base: field types, views, records, automations, and an app built from a Supabase project or any SQL database.',
  demo: null,
  docsPage: 'docs/help/base/quick-start.md',
  anchor: '![From a database to an app',
  tags: ['svgrid base', 'airtable alternative', 'svelte database app', 'supabase', 'table database', 'no-code tables'],
  duration: r2(end),
  width: 960,
  height: 540,
  recordedAt: new Date().toISOString().slice(0, 10),
  files: { mp4: `/tutorials/${ID}.mp4`, poster: `/tutorials/${ID}.poster.webp`, vtt: `/tutorials/${ID}.vtt` },
  bytes: { mp4: statSync(mp4).size, poster: statSync(poster).size, master: statSync(join(SRC, 'base-intro.mp4')).size },
  transcript,
}
const list = manifest.tutorials
const i = list.findIndex((t) => t.id === ID)
if (i >= 0) list[i] = entry
else list.push(entry)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`${ID}: ${(entry.bytes.mp4 / 1048576).toFixed(2)} MB mp4, ${Math.round(entry.bytes.poster / 1024)} KB poster, ${transcript.length} cues, ${entry.duration}s`)
