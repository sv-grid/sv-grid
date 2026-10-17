#!/usr/bin/env node
/**
 * Render a SvGrid short from a script in tools/promo/shorts/scripts/.
 *
 *   node --env-file=.env tools/promo/shorts/render.mjs <id> [--preview t1,t2,...]
 *
 * 1. Voices every beat with the host (ElevenLabs eleven_v3, audio tags for the
 *    performance), cached by text, and measures each take.
 * 2. Builds the cut around the takes: a beat lasts as long as its line plus a
 *    breath, so a dramatic read is never sped up.
 * 3. Records the browser beats from real running apps (see APPS), frame by
 *    frame, with the real URL of every frame for the address bar. A clip's
 *    assert() runs on the live page; a failed assert fails the render.
 * 4. Lip-syncs the host from the loudness of the takes, steps engine.html
 *    through every frame, mixes the voice over a ducked music bed, encodes.
 *
 * Out: marketing/videos/shorts/<id>/<id>.mp4, poster.jpg, caption.txt.
 */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const FPS = 30
const HOST_VOICE = 'TX3LPaxmHKxFdv7VOQHJ' // Liam: young, quick, the developer from "The Live Demo"
const MODEL = 'eleven_v3'
const CACHE = join(ROOT, 'marketing', 'videos', 'shorts', '.voice-cache')

/** Apps the browser beats are recorded from: production builds, served locally. */
const APPS = {
  // SvelteKit 3.0.1 + Vite 8 + @svgrid/grid 3.0.10, written for this series.
  kit3: { dir: join(ROOT, 'tutorials-out', 'app', 'kit3-orders'), port: 4321 },
  // The create-sv-grid SvelteKit 2 template after `npx sv migrate sveltekit-3`
  // and the two manual fixes the migrator listed.
  migrated: { dir: join(ROOT, 'tutorials-out', 'app', 'migrate-demo'), port: 4322 },
  // `npx @svgrid/studio@0.8.2 init --kit 3 --dataset customers-orders --title "Acme CRM" -y`
  // against the published @svgrid/enterprise 3.1.7, untouched. Its rows live in
  // the server's memory, so every render starts it fresh (see ensureApp).
  studio: { dir: join(ROOT, 'tutorials-out', 'app', 'st3-crm'), port: 4323, fresh: true },
  // The Studio visual designer, `npx svgrid-studio dev` from @svgrid/studio 0.8.2
  // (designer bundle from @svgrid/enterprise 3.1.7), on a project made by
  // `init --kit 3 --dataset customers-orders --title "Acme CRM" --dark -y`.
  // st3-designer-pristine is that project as init wrote it, without node_modules.
  designer: { dir: join(ROOT, 'tutorials-out', 'app', 'st3-designer'), pristine: join(ROOT, 'tutorials-out', 'app', 'st3-designer-pristine'), port: 4340, fresh: true },
  // The generated SvelteKit 3 app the same `studio dev` runs (Vite, hot reload).
  designerApp: { port: 4341, via: 'designer' },
}

const id = process.argv[2]
if (!id) throw new Error('usage: render.mjs <script-id> [--preview t1,t2]')
const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const script = (await import(pathToFileURL(join(HERE, 'scripts', `${id}.mjs`)).href)).default
const OUT = join(ROOT, 'marketing', 'videos', 'shorts', id)
mkdirSync(OUT, { recursive: true })
mkdirSync(CACHE, { recursive: true })

/* ----------------------------------------------------------------- voice */
async function synth(text) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set (run with node --env-file=.env)')
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${HOST_VOICE}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true } }),
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }))
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const msg = await res.text()
    if (res.status && res.status !== 429 && res.status < 500) throw new Error(`ElevenLabs ${res.status}: ${msg.slice(0, 300)}`)
  }
  throw new Error('ElevenLabs: gave up')
}
const probe = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())

/** Loudness per video frame, 0..1, for the host's mouth. */
function envelope(file) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], { maxBuffer: 1 << 28 })
  const per = Math.round(16000 / FPS)
  const out = []
  for (let i = 0; i + 1 < pcm.length; i += per * 2) {
    let s = 0, n = 0
    for (let j = i; j < Math.min(pcm.length - 1, i + per * 2); j += 2) { const v = pcm.readInt16LE(j) / 32768; s += v * v; n++ }
    out.push(Math.sqrt(s / Math.max(1, n)))
  }
  const sorted = [...out].sort((a, b) => a - b)
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1
  return out.map((v) => Math.min(1, Math.max(0, (v / ref - 0.12) / 0.88)))
}

const beats = []
for (const b of script.beats) {
  const beat = { ...b }
  if (b.say) {
    const file = join(CACHE, `${createHash('sha256').update(`${HOST_VOICE}|${MODEL}|${b.say}`).digest('hex').slice(0, 16)}.mp3`)
    if (!existsSync(file)) {
      console.log(`  tts: ${b.say}`)
      writeFileSync(file, await synth(b.say))
    }
    beat.voice = { file, dur: probe(file) }
  }
  beats.push(beat)
}

/* -------------------------------------------------------------- timeline */
let t = 0
for (const [i, b] of beats.entries()) {
  b.start = t
  const lead = b.lead ?? (i === 0 ? 0.3 : 0.22)
  if (b.voice) {
    b.voiceAt = t + lead
    b.end = b.voiceAt + b.voice.dur + (b.hold ?? 0.3)
  } else {
    b.end = t + (b.dur ?? 3)
  }
  t = b.end
}
const T = { end: t }
for (const b of beats) console.log(`  ${b.start.toFixed(2)}-${b.end.toFixed(2)}s  ${b.kind.padEnd(8)} ${b.say ?? ''}`)
console.log(`cut: ${T.end.toFixed(2)} s`)

// The mouth track for the whole video.
const mouth = new Array(Math.ceil(T.end * FPS)).fill(0)
for (const b of beats) {
  if (!b.voice) continue
  const env = envelope(b.voice.file)
  const f0 = Math.round(b.voiceAt * FPS)
  env.forEach((v, i) => { if (f0 + i < mouth.length) mouth[f0 + i] = v })
}

/* ------------------------------------------------------------ the apps */
async function reachable(url) {
  try { return (await fetch(url)).status < 500 } catch { return false }
}
const running = []
async function ensureApp(name) {
  const app = APPS[name]
  const base = `http://localhost:${app.port}`
  if (app.started) return base
  // Served by another app's process (the generated app `studio dev` runs).
  if (app.via) {
    await ensureApp(app.via)
    for (let i = 0; i < 120 && !(await reachable(base + '/')); i++) await new Promise((r) => setTimeout(r, 1000))
    app.started = true
    return base
  }
  if (await reachable(base + '/')) {
    // A stateful app left running from an earlier take still holds that take's rows.
    if (app.fresh) throw new Error(`${name}: something already serves ${base}; stop it so this render starts the app fresh`)
    return base
  }
  app.started = true
  let child
  if (app.pristine) {
    // The designer auto-saves every edit into the project, so each render puts
    // back the project as `init` wrote it (node_modules stay) before starting.
    console.log(`  restoring + starting ${name} ...`)
    for (const f of readdirSync(app.dir)) if (f !== 'node_modules') rmSync(join(app.dir, f), { recursive: true, force: true })
    cpSync(app.pristine, app.dir, { recursive: true })
    const env = { ...process.env }
    delete env.SVGRID_LICENSE_KEY // film what a visitor without a key gets
    child = spawn('npx', ['svgrid-studio', 'dev', '--port', String(app.port), '--no-open'], { cwd: app.dir, stdio: 'ignore', shell: true, windowsHide: true, env })
  } else {
    console.log(`  building + serving ${name} ...`)
    execFileSync('npm', ['run', 'build'], { cwd: app.dir, stdio: 'ignore', shell: true })
    child = spawn('npm', ['run', 'preview', '--', '--port', String(app.port), '--strictPort'], { cwd: app.dir, stdio: 'ignore', shell: true, windowsHide: true })
  }
  running.push(child)
  for (let i = 0; i < 120; i++) {
    if (await reachable(base + '/')) return base
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${name} did not start on ${base}`)
}
function killTree(child) {
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

/**
 * The part of the page a frame shows, like a screencast zoom: `crop` is one
 * { x, y, w } box or keyframes [{ at, x, y, w }] eased between, in CSS px of
 * the page. The height follows the window's 960:936 aspect.
 */
function cropAt(crop, t, viewportW, viewportH) {
  if (!crop) return null
  const keys = Array.isArray(crop) ? crop : [{ at: 0, ...crop }]
  let i = 0
  while (i + 1 < keys.length && keys[i + 1].at <= t) i++
  const a = keys[i], b = keys[i + 1] ?? keys[i]
  const span = b.at - a.at
  const u = span > 0 ? Math.min(1, Math.max(0, (t - a.at) / span)) : 0
  const e = u * u * (3 - 2 * u)
  const lerp = (p, q) => p + (q - p) * e
  const w = lerp(a.w, b.w)
  const x = Math.max(0, Math.min(viewportW - w, lerp(a.x, b.x)))
  const h = (w * 936) / 960
  const y = Math.max(0, Math.min(viewportH - h, lerp(a.y, b.y)))
  return { x, y, width: w, height: h }
}

/** Record one browser beat: actions fire at their time, one frame per 1/30 s. */
async function recordClip(browser, spec, seconds, name) {
  // Frames go to disk and the engine loads them by URL: a clip of 2x frames is
  // hundreds of MB as data URLs, more than one page.evaluate can carry.
  const dir = join(tmpdir(), 'svgrid-short-clips', id, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const base = await ensureApp(spec.app)
  // A wider app is filmed in a wider window at the same aspect, so the frame
  // scales down instead of cropping the page's right edge.
  const width = spec.viewport ?? 960
  // `height` makes a taller page for a crop to pan over (a panel far below the canvas).
  const height = spec.height ?? Math.round((width * 936) / 960)
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: spec.scale ?? 1, javaScriptEnabled: spec.js !== false, colorScheme: spec.colorScheme ?? 'dark' })
  const page = await ctx.newPage()
  // Server calls made before the page loads (a row created over the API, say).
  if (spec.setup) await spec.setup(base)
  if (spec.login) {
    await page.goto(base + '/login', { waitUntil: 'networkidle' })
    await page.fill('#email', spec.login.email)
    await page.fill('#password', spec.login.password)
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 }), page.click('button[type="submit"]')])
  }
  await page.goto(base + spec.path, { waitUntil: 'networkidle' })
  try {
    await page.waitForSelector(spec.waitFor ?? '[data-svgrid-row]', { timeout: 30_000 })
  } catch {
    // A Vite dev app that a designer save just rewrote can still be
    // re-optimizing its dependencies; one reload gets the finished page.
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector(spec.waitFor ?? '[data-svgrid-row]', { timeout: 60_000 })
  }
  if (spec.css) await page.addStyleTag({ content: spec.css })
  // Real clicks made before the first frame (collapsing the app's sidebar, say).
  if (spec.prepare) await spec.prepare(page)
  await page.waitForTimeout(300)
  const frames = []
  const urls = []
  const actions = [...(spec.actions ?? [])].sort((a, b) => a.at - b.at)
  const count = Math.ceil(seconds * FPS)
  let still = null
  for (let f = 0; f < count; f++) {
    const time = f / FPS
    while (actions.length && actions[0].at <= time) {
      await actions.shift().run(page)
      still = null
    }
    if (spec.js === false && still) { frames.push(still); urls.push(page.url()); continue }
    if (spec.js !== false) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const clip = cropAt(spec.crop, time, width, height)
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88, ...(clip ? { clip } : {}) })
    const jpg = pathToFileURL(file).href
    frames.push(jpg)
    urls.push(page.url())
    if (spec.js === false) still = jpg
  }
  if (spec.assert) await spec.assert(page)
  await ctx.close()
  return { frames, urls, fps: FPS }
}

/* ----------------------------------------------------------------- music */
const RATE = 44100
function musicBed() {
  const n = Math.ceil(T.end * RATE)
  const L = new Float32Array(n)
  const add = (at, len, fn) => { const s0 = Math.floor(at * RATE); for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += fn(i / RATE) }
  let seed = 5
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, x) => Math.sin(2 * Math.PI * f * x)
  const BEAT = 60 / 100
  const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]]
  for (let bar = 0, t0 = 0; t0 < T.end; bar++, t0 += BEAT * 4) {
    const c = chords[bar % 4]
    add(t0, BEAT * 4, (x) => 0.045 * c.reduce((s, f) => s + sin(f, x) + sin(f * 1.004, x), 0) * Math.min(1, x * 2) * Math.min(1, (BEAT * 4 - x) * 3))
    for (let b = 0; b < 4; b++) {
      add(t0 + b * BEAT, 0.3, (x) => 0.55 * Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-x * 30)) * x) * Math.exp(-x * 10))
      add(t0 + b * BEAT + BEAT / 2, 0.04, (x) => 0.06 * noise() * Math.exp(-x * 120))
      add(t0 + b * BEAT, BEAT * 0.9, (x) => 0.18 * sin(c[0] / 2, x) * Math.exp(-x * 3))
    }
  }
  // A whoosh into every cut.
  for (const b of beats.slice(1)) add(Math.max(0, b.start - 0.18), 0.32, (x) => 0.18 * noise() * Math.sin((Math.PI * x) / 0.32))
  // Fade out with the picture.
  for (let i = 0; i < n; i++) { const x = i / RATE; if (x > T.end - 1.2) L[i] *= Math.max(0, (T.end - x) / 1.2) }
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.tanh(L[i]) * 30000), i * 2)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/* ---------------------------------------------------------------- render */
const browser = await chromium.launch()
try {
  const clips = {}
  for (const [i, b] of beats.entries()) {
    if (b.kind !== 'browser') continue
    const key = `b${i}`
    console.log(`recording ${b.clip} for beat ${i + 1} (${(b.end - b.start).toFixed(1)} s) ...`)
    clips[key] = await recordClip(browser, script.clips[b.clip], b.end - b.start, key)
    b.clip = key
  }

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'engine.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const forScene = beats.map(({ voice, ...rest }) => rest)
  await page.evaluate((s) => window.__setShort(s), { beats: forScene, T, clips, mouth, series: script.series })
  const settle = () => page.evaluate(() => Promise.all([...document.images].map((img) => (img.complete ? 0 : new Promise((r) => { img.onload = r; img.onerror = r })))))

  if (previewAt) {
    for (const x of previewAt) {
      await page.evaluate((v) => window.__seek(v), x)
      await settle()
      await page.screenshot({ path: join(OUT, `preview-${String(x).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const frames = join(tmpdir(), `svgrid-short-${id}`)
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((v) => window.__seek(v), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 150 === 0) console.log(`  frame ${f}/${total}`)
    }
    const posterBeat = beats[script.posterBeat ?? 1]
    await page.evaluate((v) => window.__seek(v), (posterBeat.start + posterBeat.end) / 2)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const wav = join(frames, 'music.wav')
    writeFileSync(wav, musicBed())
    const voiced = beats.filter((b) => b.voice)
    const inputs = ['-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), '-i', wav]
    for (const b of voiced) inputs.push('-i', b.voice.file)
    const parts = voiced.map((b, i) => {
      const ms = Math.round(b.voiceAt * 1000)
      return `[${i + 2}:a]aformat=sample_rates=44100:channel_layouts=mono,volume=1.35,adelay=${ms}|${ms}[v${i}]`
    })
    const graph = [
      ...parts,
      `${voiced.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voiced.length}:normalize=0,asplit=2[vox][key]`,
      `[1:a]aformat=sample_rates=44100:channel_layouts=mono[bed]`,
      `[bed][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[ducked]`,
      `[ducked][vox]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=7,aresample=44100[aout]`,
    ].join(';')
    const mp4 = join(OUT, `${id}.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', graph,
      '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    writeFileSync(join(OUT, 'caption.txt'), `${script.caption.trim()}\n\n${script.hashtags.map((h) => `#${h}`).join(' ')}\n`)
    rmSync(frames, { recursive: true, force: true })
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  for (const c of running) killTree(c)
}
