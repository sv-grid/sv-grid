#!/usr/bin/env node
/**
 * Put "Friday, 5:47 PM" on its docs page: writes the web cut (540x960, under
 * the 2.5 MB tutorial budget), a WebP poster and VTT captions to
 * website/public/tutorials/, and the manifest entry that embed.mjs renders.
 * The captions come from the voice takes and the cut voice.mjs builds, so
 * they line up with the published video.
 *
 *   node --env-file=.env tools/promo/friday-supabase/docs-media.mjs
 *   node tools/tutorials/embed.mjs
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cuesFromBeats, toVtt } from '../../lib/tutorial-media.mjs'
import { placeVoices, prepareVoices, timeline } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const SRC = join(ROOT, 'marketing', 'videos', 'friday-supabase')
const PUB = join(ROOT, 'website', 'public', 'tutorials')
const ID = 'mk-studio-supabase-friday'

const takes = await prepareVoices(join(SRC, '.voice-cache'))
const { T, at } = timeline(Object.fromEntries(takes.map((v) => [v.id, v.dur])))
const WHO = { narrator: '', ceo: 'CEO: ', dev: 'Developer: ' }
// The audio tags ([dramatic, low] ...) are performance notes, not words.
const words = (s) => s.replace(/\[[^\]]*\]\s*/g, '').replace(/\.\.\./g, '...').trim()
const cues = cuesFromBeats(placeVoices(takes, at).map((v) => ({ start: v.at, audioDuration: v.dur, text: WHO[v.who] + words(v.text) })))

const mp4 = join(PUB, `${ID}.mp4`)
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(SRC, 'friday-supabase.mp4'),
  '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', mp4])
const poster = join(PUB, `${ID}.poster.webp`)
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(SRC, 'poster.jpg'), '-vf', 'scale=540:960', '-quality', '78', poster])
writeFileSync(join(PUB, `${ID}.vtt`), toVtt(cues))

const yt = JSON.parse(readFileSync(join(SRC, 'youtube.json'), 'utf8'))
const manifestPath = join(ROOT, 'tools', 'tutorials', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const entry = {
  id: ID,
  kind: 'marketing',
  player: true,
  title: 'Friday, 5:47 PM: a Supabase admin panel by Monday',
  description: 'An animated short: SvGrid Studio reads a Supabase project and writes a SvelteKit 3 app, shown running on the live Northwind sample data.',
  demo: null,
  docsPage: 'docs/enterprise/studio/supabase.md',
  anchor: '**All the Supabase pages, one map.**',
  tags: ['supabase admin panel', 'sveltekit supabase', 'svgrid studio', 'sveltekit 3', 'crud app generator', 'supabase'],
  duration: Math.round(T.end * 10) / 10,
  width: 540,
  height: 960,
  recordedAt: '2026-10-11',
  youtubeId: yt.id,
  publishedAt: yt.publishedAt,
  files: { mp4: `/tutorials/${ID}.mp4`, poster: `/tutorials/${ID}.poster.webp`, vtt: `/tutorials/${ID}.vtt` },
  bytes: { mp4: statSync(mp4).size, poster: statSync(poster).size, master: statSync(join(SRC, 'friday-supabase.mp4')).size },
  transcript: cues.map((c) => ({ start: Math.round(c.start * 100) / 100, end: Math.round(c.end * 100) / 100, text: c.text })),
}
const i = manifest.tutorials.findIndex((t) => t.id === ID)
if (i >= 0) manifest.tutorials[i] = entry
else manifest.tutorials.push(entry)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`${ID}: mp4 ${Math.round(entry.bytes.mp4 / 1024)} KB, poster ${Math.round(entry.bytes.poster / 1024)} KB, ${cues.length} cues, ${entry.duration} s`)
for (const c of entry.transcript) console.log(`  ${c.start.toFixed(2)}-${c.end.toFixed(2)}  ${c.text}`)
