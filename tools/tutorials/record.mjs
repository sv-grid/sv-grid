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
 *   --mux-only       re-cut from the timeline.json already in tutorials-out/<id>/:
 *                    no browser, no TTS. Use when only the outputs changed
 *                    (a cut gained a docsPage, a budget moved) and the take is good.
 *   --no-gif         skip the GIF export
 *   --budget-kb <n>  docs MP4 size budget (default 2560)
 *   --no-warm        skip the warm-up load of the demo before recording
 *
 * Env: ELEVENLABS_API_KEY (+ ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID), or
 * TTS_PROVIDER=silence to run the pipeline with silent narration. ffmpeg on
 * PATH or FFMPEG_PATH. After a successful run: `pnpm tutorials:embed`.
 */
import { existsSync, readdirSync, statSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { requireFfmpeg } from './lib/ffmpeg.mjs'
import { ttsConfig } from './lib/tts.mjs'
import { recordTutorial } from './lib/recorder.mjs'
import { muxTutorial, stitchSegments, DEFAULT_BUDGET_BYTES } from './lib/mux.mjs'
import { readManifest, writeManifest, upsertTutorial, ROOT, SCRIPTS_DIR, OUT_DIR, SITE_MEDIA_DIR } from './lib/manifest.mjs'
import { normalizeNarration } from '../lib/tutorial-media.mjs'
import { ROUTE_SEO } from '../lib/route-seo.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--base', '--site', '--budget-kb', '--app-dir', '--app-port'].includes(args[i - 1])))

const BASE = opt('--base', 'http://localhost:5174')
const SITE_BASE = opt('--site', 'http://localhost:5180')
const DRY = flag('--dry')
const SERVE = flag('--serve')
const APP_PORT = Number(opt('--app-port', '5190'))
const APP_DIR = opt('--app-dir', '')  || undefined
const SKIP_MUX = flag('--skip-mux')
const MUX_ONLY = flag('--mux-only')
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
    const targets = ['demo', 'stage', 'site', 'app'].filter((k) => t[k])
    if (targets.length !== 1) problems.push(`${where}needs exactly one of demo, stage, site, app (has ${targets.join(', ') || 'none'})`)
    if (t.demo && !existsSync(join(ROOT, 'examples', 'src', 'demos', `${t.demo}.svelte`))) problems.push(`${where}demo ${t.demo} does not exist`)
    if (t.app && !def.appScaffold && !process.argv.includes('--app-dir')) problems.push(`${where}app target needs appScaffold on the script, or --app-dir`)
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
 * End a dev server and everything it spawned.
 *
 * child.kill() signals only the process we started. On Windows that is the
 * npm or node shim; vite and its esbuild service keep running, keep a handle
 * inside node_modules, and the next run fails to delete the app directory
 * with EPERM - after leaking a dev server per take. taskkill /T ends the
 * tree. Elsewhere a plain kill reaches the group.
 */
function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      child.kill()
    }
  } else {
    child.kill()
  }
}

/**
 * Start the gallery for the run; returns a stop() that ends it. Vite's own
 * entry is spawned directly (no pnpm, no shell): through `pnpm dev` the
 * server is a grandchild behind a shell wrapper and outlives a tree kill on
 * Windows, which left a stray :5174 listener after the first run.
 */
/**
 * Scaffold a real app, install it, and run its dev server, so a script with
 * `app: '/customers'` records the thing a user would actually get rather than
 * a mock of it. Two sources:
 *
 *   appScaffold: { studio: 'customers-orders' }      svgrid-studio init --dataset
 *   appScaffold: { template: 'sveltekit' }           npm create @svgrid@latest
 *
 * `npm install` dominates the runtime, so the directory is reused across a run
 * and `--app-dir <path>` skips scaffolding entirely for a dir you already have.
 * On failure the directory is left in place: a scaffolded app that will not
 * boot is the interesting artifact, not something to clean up.
 */
async function serveApp(scaffold, { port = 5190, dir } = {}) {
  // The look is part of the directory name: a dark scaffold and a light one
  // are different apps, and reusing one path meant the second run tried to
  // delete a tree a previous dev server still held open.
  const slug = [scaffold.studio ?? scaffold.template ?? 'app', scaffold.theme, scaffold.dark ? 'dark' : null, scaffold.kit ? `kit${scaffold.kit}` : null]
    .filter(Boolean)
    .join('-')
  // `appScaffold.dir` records a directory that already exists in the repo
  // rather than a freshly scaffolded app - the web component package serves its
  // own demo page, and there is nothing to generate. Nothing is deleted or
  // installed in that case: it is the working tree.
  const existing = scaffold.dir ? join(ROOT, scaffold.dir) : null
  const appDir = dir ?? existing ?? join(OUT_DIR, 'app', slug)
  // A package that serves itself picks its own port in its own script, so the
  // script can say which one to talk to instead of being handed one.
  const servePort = scaffold.port ?? port
  const base = `http://localhost:${servePort}`
  if (!dir && !existing) {
    // maxRetries, not a bare rm: on Windows a previous run's dev server, the
    // file indexer or a virus scanner can still hold a handle inside
    // node_modules for a moment, and the delete fails with EPERM. Node backs
    // off and retries for exactly this case. Without it a second take of an
    // `app:` script dies before it records anything.
    rmSync(appDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
    mkdirSync(dirname(appDir), { recursive: true })
    // `theme` / `dark` reach both scaffolders: a video shot against the light
    // default looks nothing like the dark demos it sits next to.
    const look = [...(scaffold.theme ? ['--theme', scaffold.theme] : []), ...(scaffold.dark ? ['--dark'] : [])]
    if (scaffold.studio) {
      console.log(`scaffolding a Studio app (${scaffold.studio}${scaffold.dark ? ', dark' : ''}) ...`)
      const cli = join(ROOT, 'packages', 'studio', 'dist', 'cli.js')
      if (!existsSync(cli)) throw new Error(`${cli} not found: run \`pnpm --filter @svgrid/studio build\``)
      // kit: 3 scaffolds the opt-in SvelteKit 3 shape through the same CLI flag a
      // user would pass, so the recorded app is what `init --kit 3` produces.
      const kitArgs = scaffold.kit ? ['--kit', String(scaffold.kit)] : []
      run(process.execPath, [cli, 'init', '--dataset', scaffold.studio, '--out', appDir, ...look, ...kitArgs, '-y'])
    } else {
      console.log(`scaffolding the ${scaffold.template} template ...`)
      run('npm', ['create', '@svgrid@latest', appDir, '--', '--template', scaffold.template, ...look, '--force'])
    }
    console.log('  npm install ...')
    run('npm', ['install', '--no-audit', '--no-fund'], appDir)
  }

  // A scaffolded app is served by `dev` and told which port to use. A package
  // that serves itself names its own script and pins its own port, so passing
  // --port again would fight --strictPort.
  const script = scaffold.script ?? 'dev'
  const portArgs = scaffold.port ? [] : ['--', '--port', String(servePort), '--strictPort']
  console.log(`starting the app on :${servePort} (npm run ${script}) ...`)
  const child = spawn('npm', ['run', script, ...portArgs], {
    cwd: appDir,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    windowsHide: true,
  })
  const stop = () => {
    killTree(child)
  }
  const started = Date.now()
  while (Date.now() - started < 180_000) {
    if (child.exitCode !== null) throw new Error(`the app exited with code ${child.exitCode} (is :${servePort} taken?)`)
    // Probe a path the server actually serves. A scaffolded app answers at
    // /, but a package serving its own folder may have no index.html there -
    // grid-wc has demo.html and nothing else, so / is a 404 and the app looks
    // dead forever.
    if (await reachable(base + (scaffold.readyPath ?? ''))) return { stop, base, appDir }
    await new Promise((r) => setTimeout(r, 1000))
  }
  stop()
  throw new Error(`the scaffolded app did not come up on ${base} within 180 s (left in ${appDir})`)
}

/** Run a command to completion, throwing with its output on failure. */
function run(cmd, args, cwd = ROOT) {
  // Windows needs a shell to resolve `npm` -> `npm.cmd`, but a shell also
  // splits an absolute path on its spaces: `C:\Program Files\nodejs\node.exe`
  // became `'C:\Program' is not recognized`. Shell only for bare commands.
  const shell = process.platform === 'win32' && !isAbsolute(cmd)
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell, windowsHide: true })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}):\n${(r.stderr || r.stdout || '').slice(-1200)}`)
  }
  return r.stdout
}

async function serveGallery(base) {
  const port = new URL(base).port || '5174'
  const examples = join(ROOT, 'examples')
  const vite = join(examples, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(vite)) throw new Error(`${vite} not found: run pnpm install`)
  console.log(`starting the gallery on :${port} ...`)
  const child = spawn(process.execPath, [vite, '--port', port, '--strictPort'], { cwd: examples, stdio: 'ignore', windowsHide: true })
  const stop = () => {
    killTree(child)
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
    killTree(child)
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
  const one = (t) => (t.demo ? t.demo : t.site ? `site:${t.site}` : t.app ? `app:${t.app}` : 'stage')
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
  if (!MUX_ONLY && !(await reachable(BASE))) {
    if (!SERVE) fail(`gallery not reachable at ${BASE}: run \`pnpm dev\` or pass --serve`)
    stops.push(await serveGallery(BASE))
  }
  if (!MUX_ONLY && defs.some(needsSite) && !(await reachable(SITE_BASE))) {
    if (!SERVE) fail(`website not reachable at ${SITE_BASE}: run \`pnpm --filter svgrid-website dev\` or pass --serve`)
    stops.push(await serveSite(SITE_BASE))
  }
  // A script that records a real scaffolded app declares how to build it.
  // One app per run: scaffolding and `npm install` dominate the runtime.
  let appBase
  const wantsApp = MUX_ONLY ? null : defs.find((d) => d.appScaffold)
  if (wantsApp) {
    const served = await serveApp(wantsApp.appScaffold, { port: APP_PORT, dir: APP_DIR })
    appBase = served.base
    stops.push(served.stop)
    console.log(`  app on ${served.base} (${served.appDir})`)
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
        if (MUX_ONLY) {
          // The take is already on disk. stitchSegments wrote the whole
          // timeline, beat audio paths included, so the mux needs nothing else.
          const saved = join(outDir, 'timeline.json')
          if (!existsSync(saved)) throw new Error(`--mux-only: no timeline.json in ${outDir}`)
          timeline = JSON.parse(readFileSync(saved, 'utf-8'))
          log(`re-cutting from ${timeline.duration.toFixed(1)} s already recorded`)
        } else if (Array.isArray(def.segments)) {
          const recorded = []
          for (let i = 0; i < def.segments.length; i += 1) {
            const seg = { id: `${def.id}-${i + 1}`, theme: def.theme, preset: def.preset, today: def.today, ...def.segments[i] }
            const dir = join(outDir, `seg-${i + 1}`)
            console.log(`  segment ${i + 1}/${def.segments.length}: ${targetLabel(seg)}`)
            const t = await recordTutorial(seg, { base: BASE, siteBase: SITE_BASE, appBase, outDir: dir, view, log, warm: WARM, tts })
            recorded.push({ dir, timeline: t })
          }
          if (SKIP_MUX) {
            results.push({ id: def.id, ok: true, note: 'recorded (mux skipped)' })
            continue
          }
          timeline = await stitchSegments({ id: def.id, outDir, segments: recorded, log })
        } else {
          timeline = await recordTutorial(def, { base: BASE, siteBase: SITE_BASE, appBase, outDir, view, log, warm: WARM, tts })
          if (SKIP_MUX) {
            results.push({ id: def.id, ok: true, note: 'recorded (mux skipped)' })
            continue
          }
        }
        // A cut gets docs-sized outputs when it lands on a page. That is every
        // tutorial, and a marketing cut that names a docsPage. One predicate,
        // because the mux and the manifest files{} have to agree: they drifted
        // once and left an mp4 on disk that no page could reference.
        // A hand-written route can name a cut in tools/lib/route-seo.mjs
        // instead of embedding it in markdown, and it needs the same
        // docs-sized outputs. Checked here so the route table stays the one
        // place that decides, rather than a second flag on the script.
        const onARoute = Object.values(ROUTE_SEO).some((r) => r.video === def.id)
        const onAPage = !marketing || !!def.docsPage || onARoute
        const m = await muxTutorial({
          id: def.id, outDir, siteDir: SITE_MEDIA_DIR, timeline, budgetBytes: BUDGET,
          gif: !NO_GIF, gifBeats: def.gif?.beats, posterBeat: def.poster?.beat ?? null, docs: onAPage, player: onAPage && !!def.player, log,
        })
        const previous = manifest.tutorials.find((t) => t.id === def.id)
        const entry = {
          id: def.id,
          ...(def.kind ? { kind: def.kind } : {}),
          ...(onAPage && def.player ? { player: true } : {}),
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
          files: !onAPage
            ? { mp4: null, poster: null, vtt: null }
            : {
                mp4: `/tutorials/${def.id}.mp4`,
                poster: `/tutorials/${def.id}.poster.webp`,
                vtt: `/tutorials/${def.id}.vtt`,
              },
          bytes: { mp4: m.docsBytes, poster: m.posterBytes, master: statSync(m.master).size },
          transcript: m.cues.map((c) => ({ start: Math.round(c.start * 100) / 100, end: Math.round(c.end * 100) / 100, text: c.text })),
        }
        if (!def.internal) {
          manifest = upsertTutorial(manifest, entry)
          writeManifest(manifest)
        } else {
          log('internal: outputs written, manifest left alone')
        }
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
