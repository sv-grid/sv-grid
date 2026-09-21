/**
 * record - make a 30-second tutorial from a gallery demo.
 *
 * For each tutorial script in tools/tutorials/scripts/: synthesize the
 * narration (ElevenLabs, cached), drive the demo in the running example
 * gallery while Playwright records the screen, then mux with ffmpeg into the
 * YouTube master, the muted docs cut, the poster, the GIF and the captions,
 * and record the result in tools/tutorials/manifest.json.
 *
 *   pnpm dev                                     # the gallery on :5174
 *   node tools/tutorials/record.mjs <id>[,<id>]  # or `all`
 *
 * A script records a gallery demo (`demo`), the recording stage
 * (`stage: true`, examples/stage.html: terminal, editor, browser frame, title
 * cards) or a website route (`site: 'studio/new'`). A longer cut lists
 * `segments`, each one of those with its own beats; they are recorded as
 * separate takes and joined. `kind: 'marketing'` skips the docs outputs and
 * the docs page: the result is the narrated master for YouTube plus the GIF,
 * captions and thumbnail.
 *
 * Flags
 *   --base <url>     gallery URL (default http://localhost:5174)
 *   --site <url>     website URL for `site` scripts (default http://localhost:5180)
 *   --serve          start the gallery (and the website when needed) when
 *                    unreachable, stop them after
 *   --dry            load and validate the scripts, print the beats, record nothing
 *   --skip-mux       record only; leave raw.webm + timeline.json in tutorials-out/<id>/
 *   --no-gif         skip the GIF export
 *   --budget-kb <n>  docs MP4 size budget (default 2560)
 *   --no-warm        skip the warm-up load of the demo before recording
 *
 * Env: ELEVENLABS_API_KEY (+ ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID), or
 * TTS_PROVIDER=silence to run the pipeline with silent narration. ffmpeg on
 * PATH or FFMPEG_PATH. After a successful run: `pnpm tutorials:embed`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { requireFfmpeg } from './lib/ffmpeg.mjs'
import { ttsConfig } from './lib/tts.mjs'
import { recordTutorial } from './lib/recorder.mjs'
import { muxTutorial, stitchSegments, DEFAULT_BUDGET_BYTES } from './lib/mux.mjs'
import { readManifest, writeManifest, upsertTutorial, ROOT, SCRIPTS_DIR, OUT_DIR, SITE_MEDIA_DIR } from './lib/manifest.mjs'
import { normalizeNarration } from '../lib/tutorial-media.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--base', '--site', '--budget-kb'].includes(args[i - 1])))

const BASE = opt('--base', 'http://localhost:5174')
const SITE_BASE = opt('--site', 'http://localhost:5180')
const DRY = flag('--dry')
const SERVE = flag('--serve')
const SKIP_MUX = flag('--skip-mux')
const NO_GIF = flag('--no-gif')
const WARM = !flag('--no-warm')
const BUDGET = Number(opt('--budget-kb', '')) * 1024 || DEFAULT_BUDGET_BYTES

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

/** Load tools/tutorials/scripts/<id>.mjs and check its shape. */
async function loadScript(id) {
  const file = join(SCRIPTS_DIR, `${id}.mjs`)
  if (!existsSync(file)) throw new Error(`no tutorial script ${file}`)
  const mod = await import(pathToFileURL(file).href)
  const def = mod.default
  if (!def || typeof def !== 'object') throw new Error(`${id}: default export must be an object`)
  const problems = []
  if (def.id !== id) problems.push(`id "${def.id}" must equal the file name "${id}"`)
  for (const k of ['title', 'description']) if (!def[k]) problems.push(`missing ${k}`)
  const marketing = def.kind === 'marketing'
  if (!marketing && !def.docsPage) problems.push('missing docsPage (or set kind: "marketing")')
  if (def.docsPage && !existsSync(join(ROOT, def.docsPage))) problems.push(`docsPage ${def.docsPage} does not exist`)
  // A script is one take (demo | stage | site + beats) or a list of them.
  const takes = Array.isArray(def.segments) ? def.segments : [def]
  if (Array.isArray(def.segments) && !def.segments.length) problems.push('segments must be a non-empty array')
  takes.forEach((t, i) => {
    const where = Array.isArray(def.segments) ? `segment ${i + 1}: ` : ''
    const targets = ['demo', 'stage', 'site'].filter((k) => t[k])
    if (targets.length !== 1) problems.push(`${where}needs exactly one of demo, stage, site (has ${targets.join(', ') || 'none'})`)
    if (t.demo && !existsSync(join(ROOT, 'examples', 'src', 'demos', `${t.demo}.svelte`))) problems.push(`${where}demo ${t.demo} does not exist`)
    if (!Array.isArray(t.beats) || !t.beats.length) problems.push(`${where}beats must be a non-empty array`)
  })
  if (def.description && def.description.length > 160) problems.push('description over 160 chars')
  const text = [def.title, def.description, ...allBeats(def).map((b) => b.say ?? '')].join(' ')
  if (/[\u2013\u2014]/.test(text)) problems.push('em/en dash in narration or title (use a hyphen)')
  if (!Array.isArray(def.tags)) problems.push('tags must be an array')
  if (problems.length) throw new Error(`${id}:\n  - ${problems.join('\n  - ')}`)
  return def
}

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Start the gallery for the run; returns a stop() that ends it. Vite's own
 * entry is spawned directly (no pnpm, no shell): through `pnpm dev` the
 * server is a grandchild behind a shell wrapper and outlives a tree kill on
 * Windows, which left a stray :5174 listener after the first run.
 */
async function serveGallery(base) {
  const port = new URL(base).port || '5174'
  const examples = join(ROOT, 'examples')
  const vite = join(examples, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(vite)) throw new Error(`${vite} not found: run pnpm install`)
  console.log(`starting the gallery on :${port} ...`)
  const child = spawn(process.execPath, [vite, '--port', port, '--strictPort'], { cwd: examples, stdio: 'ignore', windowsHide: true })
  const stop = () => {
    if (!child.killed) child.kill()
  }
  const started = Date.now()
  while (Date.now() - started < 120_000) {
    if (child.exitCode !== null) throw new Error(`the gallery exited with code ${child.exitCode} (is :${port} taken?)`)
    if (await reachable(base)) return stop
    await new Promise((r) => setTimeout(r, 1000))
  }
  stop()
  throw new Error(`gallery did not come up on ${base} within 120 s`)
}

/** Every beat of a script, across its segments. */
function allBeats(def) {
  return (Array.isArray(def.segments) ? def.segments : [def]).flatMap((t) => t.beats ?? [])
}

/**
 * Start the website for a `site` script. Its predev index builders run
 * first (the dev server reads docs-index.json and friends), then Vite's own
 * entry, spawned like the gallery's.
 */
async function serveSite(base) {
  const port = new URL(base).port || '5180'
  const website = join(ROOT, 'website')
  const vite = join(website, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(vite)) throw new Error(`${vite} not found: is the website submodule checked out and installed?`)
  console.log(`starting the website on :${port} ...`)
  for (const script of ['tools/build-blog-index.mjs', 'tools/build-docs-page-index.mjs', 'tools/build-demo-search-index.mjs']) {
    const r = spawnSync(process.execPath, [join(ROOT, script)], { cwd: ROOT, stdio: 'ignore', windowsHide: true })
    if (r.status !== 0) throw new Error(`${script} exited ${r.status}`)
  }
  const child = spawn(process.execPath, [vite, '--port', port, '--strictPort'], { cwd: website, stdio: 'ignore', windowsHide: true })
  const stop = () => {
    if (!child.killed) child.kill()
  }
  const started = Date.now()
  while (Date.now() - started < 180_000) {
    if (child.exitCode !== null) throw new Error(`the website exited with code ${child.exitCode} (is :${port} taken?)`)
    if (await reachable(base)) return stop
    await new Promise((r) => setTimeout(r, 1000))
  }
  stop()
  throw new Error(`website did not come up on ${base} within 180 s`)
}

function wordsOf(def) {
  return allBeats(def).map((b) => normalizeNarration(b.say ?? '').split(' ').filter(Boolean).length).reduce((a, b) => a + b, 0)
}

/** What a script records, for the log line. */
function targetLabel(def) {
  const one = (t) => (t.demo ? t.demo : t.site ? `site:${t.site}` : 'stage')
  return Array.isArray(def.segments) ? def.segments.map(one).join(' + ') : one(def)
}

function needsSite(def) {
  return (Array.isArray(def.segments) ? def.segments : [def]).some((t) => t.site)
}

async function main() {
  if (!positional.length) fail('usage: node tools/tutorials/record.mjs <id>[,<id>] | all  [--base url] [--serve] [--dry]')
  const ids = positional.join(',') === 'all'
    ? readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')).sort()
    : positional.flatMap((p) => p.split(',')).map((s) => s.trim()).filter(Boolean)
  if (!ids.length) fail('no tutorial scripts found')

  const defs = []
  for (const id of ids) defs.push(await loadScript(id))

  if (DRY) {
    for (const def of defs) {
      const words = wordsOf(def)
      const beats = allBeats(def)
      console.log(`\n${def.id}  (${targetLabel(def)} -> ${def.docsPage ?? (def.kind === 'marketing' ? 'YouTube only' : '?')})`)
      console.log(`  "${def.title}"  ${beats.length} beats, ${words} words (~${Math.round((words / 150) * 60)} s of speech)`)
      beats.forEach((b, i) => console.log(`  ${i + 1}. ${b.say ?? '(silent)'}${b.do ? '' : '  [no action]'}`))
    }
    return
  }

  requireFfmpeg()
  const tts = ttsConfig()
  console.log(`tts: ${tts.provider}${tts.provider === 'elevenlabs' ? ` (voice ${tts.voiceId}, ${tts.modelId})` : ''}`)
  if (tts.provider === 'silence') console.log('  no ELEVENLABS_API_KEY: narration will be silent, captions still written')

  const stops = []
  if (!(await reachable(BASE))) {
    if (!SERVE) fail(`gallery not reachable at ${BASE}: run \`pnpm dev\` or pass --serve`)
    stops.push(await serveGallery(BASE))
  }
  if (defs.some(needsSite) && !(await reachable(SITE_BASE))) {
    if (!SERVE) fail(`website not reachable at ${SITE_BASE}: run \`pnpm --filter svgrid-website dev\` or pass --serve`)
    stops.push(await serveSite(SITE_BASE))
  }

  const results = []
  let manifest = readManifest()
  try {
    for (const def of defs) {
      const outDir = join(OUT_DIR, def.id)
      const log = (m) => console.log(`    ${m}`)
      console.log(`\n${def.id}  (${targetLabel(def)})`)
      const marketing = def.kind === 'marketing'
      const view = def.view ?? (marketing ? { width: 1920, height: 1080 } : undefined)
      try {
        let timeline
        if (Array.isArray(def.segments)) {
          const recorded = []
          for (let i = 0; i < def.segments.length; i += 1) {
            const seg = { id: `${def.id}-${i + 1}`, theme: def.theme, preset: def.preset, ...def.segments[i] }
            const dir = join(outDir, `seg-${i + 1}`)
            console.log(`  segment ${i + 1}/${def.segments.length}: ${targetLabel(seg)}`)
            const t = await recordTutorial(seg, { base: BASE, siteBase: SITE_BASE, outDir: dir, view, log, warm: WARM, tts })
            recorded.push({ dir, timeline: t })
          }
          if (SKIP_MUX) {
            results.push({ id: def.id, ok: true, note: 'recorded (mux skipped)' })
            continue
          }
          timeline = await stitchSegments({ id: def.id, outDir, segments: recorded, log })
        } else {
          timeline = await recordTutorial(def, { base: BASE, siteBase: SITE_BASE, outDir, view, log, warm: WARM, tts })
          if (SKIP_MUX) {
            results.push({ id: def.id, ok: true, note: 'recorded (mux skipped)' })
            continue
          }
        }
        const m = await muxTutorial({
          id: def.id, outDir, siteDir: SITE_MEDIA_DIR, timeline, budgetBytes: BUDGET,
          gif: !NO_GIF, gifBeats: def.gif?.beats, posterBeat: def.poster?.beat ?? null, docs: !marketing, log,
        })
        const previous = manifest.tutorials.find((t) => t.id === def.id)
        const entry = {
          id: def.id,
          ...(marketing ? { kind: 'marketing' } : {}),
          title: def.title,
          description: def.description,
          demo: def.demo ?? timeline.demo ?? null,
          docsPage: def.docsPage ?? null,
          ...(def.anchor ? { anchor: def.anchor } : {}),
          ...(def.anchorAfter ? { anchorAfter: def.anchorAfter } : {}),
          tags: def.tags,
          duration: Math.round(m.duration * 10) / 10,
          width: m.width,
          height: m.height,
          recordedAt: new Date().toISOString().slice(0, 10),
          youtubeId: previous?.youtubeId ?? null,
          publishedAt: previous?.publishedAt ?? null,
          files: marketing
            ? { mp4: null, poster: null, vtt: null }
            : {
                mp4: `/tutorials/${def.id}.mp4`,
                poster: `/tutorials/${def.id}.poster.webp`,
                vtt: `/tutorials/${def.id}.vtt`,
              },
          bytes: { mp4: m.docsBytes, poster: m.posterBytes, master: statSync(m.master).size },
          transcript: m.cues.map((c) => ({ start: Math.round(c.start * 100) / 100, end: Math.round(c.end * 100) / 100, text: c.text })),
        }
        manifest = upsertTutorial(manifest, entry)
        writeManifest(manifest)
        results.push({
          id: def.id, ok: true,
          duration: entry.duration, mp4: m.docsBytes, poster: m.posterBytes,
          gif: m.gif ? statSync(m.gif).size : 0, master: statSync(m.master).size,
        })
      } catch (err) {
        console.error(`    FAILED: ${String(err.message ?? err).split('\n').join('\n    ')}`)
        if (err.screenshot) console.error(`    see ${err.screenshot}`)
        results.push({ id: def.id, ok: false, note: String(err.message ?? err).split('\n')[0] })
      }
    }
  } finally {
    for (const stop of stops) stop()
  }

  const kb = (n) => `${Math.round(n / 1024)} KB`
  console.log('\nid                            ok   dur     docs mp4   poster   gif       master')
  for (const r of results) {
    if (!r.ok) {
      console.log(`${r.id.padEnd(30)}FAIL ${r.note}`)
      continue
    }
    if (r.note) {
      console.log(`${r.id.padEnd(30)}ok   ${r.note}`)
      continue
    }
    console.log(`${r.id.padEnd(30)}ok   ${String(r.duration).padEnd(7)} ${kb(r.mp4).padEnd(10)} ${kb(r.poster).padEnd(8)} ${kb(r.gif).padEnd(9)} ${kb(r.master)}`)
  }
  const failed = results.filter((r) => !r.ok).length
  if (!failed && !SKIP_MUX && defs.some((d) => d.kind !== 'marketing')) console.log('\nnext: node tools/tutorials/embed.mjs   (puts the blocks on the docs pages and rebuilds the indexes)')
  if (!failed && !SKIP_MUX && defs.some((d) => d.kind === 'marketing')) console.log('\nmarketing cuts: tutorials-out/<id>/<id>.youtube.mp4 (+ .srt, .thumb.jpg, .gif); publish with tools/tutorials/youtube.mjs upload <id>')
  if (failed) process.exit(1)
}

main().catch((err) => fail(String(err.stack ?? err)))
