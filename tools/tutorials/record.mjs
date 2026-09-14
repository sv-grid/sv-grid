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
 * Flags
 *   --base <url>     gallery URL (default http://localhost:5174)
 *   --serve          start the gallery when the base is unreachable, stop it after
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
import { spawn } from 'node:child_process'
import { requireFfmpeg } from './lib/ffmpeg.mjs'
import { ttsConfig } from './lib/tts.mjs'
import { recordTutorial } from './lib/recorder.mjs'
import { muxTutorial, DEFAULT_BUDGET_BYTES } from './lib/mux.mjs'
import { readManifest, writeManifest, upsertTutorial, ROOT, SCRIPTS_DIR, OUT_DIR, SITE_MEDIA_DIR } from './lib/manifest.mjs'
import { normalizeNarration } from '../lib/tutorial-media.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--base', '--budget-kb'].includes(args[i - 1])))

const BASE = opt('--base', 'http://localhost:5174')
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
  for (const k of ['title', 'description', 'demo', 'docsPage']) if (!def[k]) problems.push(`missing ${k}`)
  if (!existsSync(join(ROOT, 'examples', 'src', 'demos', `${def.demo}.svelte`))) problems.push(`demo ${def.demo} does not exist`)
  if (def.docsPage && !existsSync(join(ROOT, def.docsPage))) problems.push(`docsPage ${def.docsPage} does not exist`)
  if (!Array.isArray(def.beats) || !def.beats.length) problems.push('beats must be a non-empty array')
  if (def.description && def.description.length > 160) problems.push('description over 160 chars')
  const text = [def.title, def.description, ...(def.beats ?? []).map((b) => b.say ?? '')].join(' ')
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

function wordsOf(def) {
  return def.beats.map((b) => normalizeNarration(b.say ?? '').split(' ').filter(Boolean).length).reduce((a, b) => a + b, 0)
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
      console.log(`\n${def.id}  (${def.demo} -> ${def.docsPage})`)
      console.log(`  "${def.title}"  ${def.beats.length} beats, ${words} words (~${Math.round((words / 150) * 60)} s of speech)`)
      def.beats.forEach((b, i) => console.log(`  ${i + 1}. ${b.say ?? '(silent)'}${b.do ? '' : '  [no action]'}`))
    }
    return
  }

  requireFfmpeg()
  const tts = ttsConfig()
  console.log(`tts: ${tts.provider}${tts.provider === 'elevenlabs' ? ` (voice ${tts.voiceId}, ${tts.modelId})` : ''}`)
  if (tts.provider === 'silence') console.log('  no ELEVENLABS_API_KEY: narration will be silent, captions still written')

  let stop = null
  if (!(await reachable(BASE))) {
    if (!SERVE) fail(`gallery not reachable at ${BASE}: run \`pnpm dev\` or pass --serve`)
    stop = await serveGallery(BASE)
  }

  const results = []
  let manifest = readManifest()
  try {
    for (const def of defs) {
      const outDir = join(OUT_DIR, def.id)
      const log = (m) => console.log(`    ${m}`)
      console.log(`\n${def.id}  (${def.demo})`)
      try {
        const timeline = await recordTutorial(def, { base: BASE, outDir, log, warm: WARM, tts })
        if (SKIP_MUX) {
          results.push({ id: def.id, ok: true, note: 'recorded (mux skipped)' })
          continue
        }
        const m = await muxTutorial({
          id: def.id, outDir, siteDir: SITE_MEDIA_DIR, timeline, budgetBytes: BUDGET,
          gif: !NO_GIF, gifBeats: def.gif?.beats, log,
        })
        const previous = manifest.tutorials.find((t) => t.id === def.id)
        const entry = {
          id: def.id,
          title: def.title,
          description: def.description,
          demo: def.demo,
          docsPage: def.docsPage,
          ...(def.anchor ? { anchor: def.anchor } : {}),
          ...(def.anchorAfter ? { anchorAfter: def.anchorAfter } : {}),
          tags: def.tags,
          duration: Math.round(m.duration * 10) / 10,
          width: m.width,
          height: m.height,
          recordedAt: new Date().toISOString().slice(0, 10),
          youtubeId: previous?.youtubeId ?? null,
          publishedAt: previous?.publishedAt ?? null,
          files: {
            mp4: `/tutorials/${def.id}.mp4`,
            poster: `/tutorials/${def.id}.poster.webp`,
            vtt: `/tutorials/${def.id}.vtt`,
          },
          bytes: { mp4: m.docsBytes, poster: m.posterBytes },
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
    if (stop) stop()
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
  if (!failed && !SKIP_MUX) console.log('\nnext: node tools/tutorials/embed.mjs   (puts the blocks on the docs pages and rebuilds the indexes)')
  if (failed) process.exit(1)
}

main().catch((err) => fail(String(err.stack ?? err)))
