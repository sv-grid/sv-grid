/**
 * Record one tutorial (or one segment of a longer cut): drive the page beat
 * by beat while Playwright's screencast captures it, and write a timeline the
 * muxer places the narration on.
 *
 * Three kinds of page can be recorded, named by the script:
 *   demo:  '05-inline-editing'   a gallery demo (examples, :5174, #/<id>)
 *   stage: true                  the recording stage (examples/stage.html):
 *                                title cards, a terminal, an editor, a browser
 *                                frame around the real component
 *   site:  'studio/new'          a route of the website (:5180)
 *
 * Timing model. The narration for every beat is synthesized (and measured)
 * BEFORE anything is recorded, so a beat is held on screen for at least the
 * length of its audio. The screencast starts at context creation, long before
 * the page is ready, so the recorder paints a black "sync flash" right before
 * the intro hold; the muxer finds it with blackdetect and trims there. Every
 * beat's `start` is measured from the moment the flash was removed, on the
 * same clock, so the trim and the audio offsets share one origin.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { cachedSynthesize, ttsConfig } from './tts.mjs'
import { ffprobeDuration } from './ffmpeg.mjs'
import { createHelpers, HIDE_CHROME, HIDE_SITE_CHROME, HIDE_WATERMARK } from './drive.mjs'
import { CURSOR_INIT_SCRIPT } from './cursor.mjs'

export const VIEW = { width: 1280, height: 720 }
const INTRO_HOLD = 1.2
const OUTRO_HOLD = 1.0
const AUDIO_TAIL = 0.3

/** Fail loudly when pointed at the website instead of the gallery. */
async function assertGallery(page, url) {
  const text = await page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 200))
  if (/page not found|match any route/i.test(text)) {
    throw new Error(`route not found at ${url}: the recorder wants the EXAMPLES GALLERY (pnpm dev, :5174), not the website`)
  }
}

/** A take that a Vite hot update or reload interrupted; the caller retries. */
export class TaintedTakeError extends Error {
  constructor(events) {
    super(`the dev server hot-updated the page during the take (${events[0]})`)
    this.name = 'TaintedTakeError'
    this.events = events
  }
}

/** Which page a script (or segment) records, and the URL for it. */
export function targetOf(def, { base, siteBase }) {
  if (def.site) return { kind: 'site', url: `${siteBase.replace(/\/$/, '')}/${String(def.site).replace(/^\//, '')}` }
  if (def.stage) return { kind: 'stage', url: `${base.replace(/\/$/, '')}/stage.html` }
  if (def.demo) return { kind: 'demo', url: `${base.replace(/\/$/, '')}/#/${def.demo}` }
  throw new Error(`${def.id ?? 'segment'}: needs one of demo, stage or site`)
}

/**
 * @param {object} def the tutorial script's default export, or one segment of it
 * @param {{ base: string, siteBase?: string, outDir: string, view?: {width:number,height:number}, log?: (s: string) => void, warm?: boolean, tts?: ReturnType<typeof ttsConfig>, attempts?: number }} opts
 */
export async function recordTutorial(def, { base, siteBase = 'http://localhost:5180', outDir, view = VIEW, log = () => {}, warm = true, tts = ttsConfig(), attempts = 3 }) {
  // The gallery is a Vite dev server: any edit under examples/ or the aliased
  // package sources hot-swaps the demo component mid-take, which resets its
  // state and leaves a video of two different sessions. The take watches the
  // Vite client's console line for that and is redone from scratch.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await recordTake(def, { base, siteBase, outDir, view, log, warm: warm && attempt === 1, tts })
    } catch (err) {
      if (!(err instanceof TaintedTakeError) || attempt >= attempts) throw err
      log(`take ${attempt} discarded: ${err.message}; recording again`)
    }
  }
}

async function recordTake(def, { base, siteBase, outDir, view, log, warm, tts }) {
  mkdirSync(outDir, { recursive: true })
  const rawDir = join(outDir, 'raw')
  mkdirSync(rawDir, { recursive: true })

  // 1. Narration first, so each beat's screen time is known.
  const beats = []
  for (let i = 0; i < def.beats.length; i += 1) {
    const b = def.beats[i]
    const entry = { index: i, text: b.say ?? '', audio: null, audioDuration: 0 }
    if (b.say) {
      const { path, cached } = await cachedSynthesize(b.say, tts)
      entry.audio = path
      entry.audioDuration = await ffprobeDuration(path)
      log(`beat ${i + 1}: ${entry.audioDuration.toFixed(2)} s narration${cached ? ' (cached)' : ''}`)
    }
    beats.push(entry)
  }

  const target = targetOf(def, { base, siteBase })
  const { url } = target
  // Demos are laid out for ~1000 css px and get enlarged; the stage and the
  // site are designed for the frame (the stage scales itself to the viewport).
  const zoom = def.zoom ?? (target.kind === 'demo' ? 1.25 : 1)
  const readySelector = target.kind === 'stage'
    ? 'body'
    : target.kind === 'site'
      ? '#root main'
      : 'main .sv-grid-body, main .sv-grid-container, main svg, main canvas'
  const browser = await chromium.launch()
  try {
    // 2. Warm-up in a throwaway context: Vite compiles the page on first hit
    //    and the recorded context should not capture that.
    if (warm) {
      const ctx0 = await browser.newContext({ viewport: view })
      const p0 = await ctx0.newPage()
      await p0.goto(url, { waitUntil: 'domcontentloaded' })
      await p0.waitForSelector(readySelector, { timeout: 60_000 }).catch(() => {})
      if (target.kind === 'stage') await p0.waitForFunction(() => Boolean(window.__stage), null, { timeout: 60_000 }).catch(() => {})
      if (target.kind === 'demo') await assertGallery(p0, url)
      await ctx0.close()
    }

    // 3. The recorded context.
    const ctx = await browser.newContext({
      viewport: view,
      deviceScaleFactor: 1,
      recordVideo: { dir: rawDir, size: view },
      reducedMotion: 'no-preference',
    })
    const contextCreatedAt = Date.now()
    await ctx.addInitScript(
      ({ theme, preset }) => {
        try {
          localStorage.setItem('sg-theme', theme)
          localStorage.setItem('sg-preset', preset)
          // The website keeps its own keys.
          localStorage.setItem('svgrid-theme', theme)
          localStorage.setItem('svgrid-preset', preset)
        } catch {
          /* storage blocked */
        }
      },
      { theme: def.theme ?? 'dark', preset: def.preset ?? 'ember' },
    )
    await ctx.addInitScript(CURSOR_INIT_SCRIPT)
    // Drop the Vite error overlay the moment it is inserted: hidden by CSS it
    // still steals focus from an editor typing under it.
    await ctx.addInitScript(() => {
      const drop = () => document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove())
      document.addEventListener('DOMContentLoaded', () => {
        drop()
        new MutationObserver(drop).observe(document.body, { childList: true })
      })
    })
    const page = await ctx.newPage()
    const h = createHelpers(page, log)
    let failedShot = null
    const hmr = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (!/^\[vite\]/.test(text) || !/hot updated|page reload|invalidate|reloading/i.test(text)) return
      // A hot update of ANOTHER demo's file reaches this page too (the gallery
      // globs every demo), but that component is not mounted here, so the
      // take is intact. Anything else (this demo, a package source, the
      // stage, a full reload) restarts it.
      const other = text.match(/hot updated: \/src\/demos\/([^/\s]+)\.svelte/)
      if (other && def.demo && other[1] !== def.demo && !/reload/i.test(text)) return
      hmr.push(text)
    })
    page.on('load', () => hmr.push('full page load'))

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.addStyleTag({ content: HIDE_WATERMARK })
      if (target.kind === 'demo') {
        await page.addStyleTag({ content: HIDE_CHROME })
        // CSS zoom, not deviceScaleFactor: the screencast frame is the viewport
        // size either way, so DSF only costs compositor work. Applied before any
        // measurement so boxes and clicks agree (capture-launch-assets proved it).
        if (zoom !== 1) await page.addStyleTag({ content: `.demo-page > main { zoom: ${zoom}; }` })
        await assertGallery(page, url)
        if (def.hideIntro) await h.hideIntro(def.hideIntro)
      } else if (target.kind === 'site') {
        await page.addStyleTag({ content: HIDE_SITE_CHROME })
        if (zoom !== 1) await page.addStyleTag({ content: `#root main { zoom: ${zoom}; }` })
        await page.waitForSelector(readySelector, { timeout: 60_000 })
      } else {
        await page.waitForFunction(() => Boolean(window.__stage), null, { timeout: 60_000 })
      }
      if (def.setup) await def.setup(page, h)
      await h.park(undefined, undefined, { ms: 1 })
      await page.waitForTimeout(300)

      // 4. Sync flash, then the clock starts. Hot updates before this point
      //    only delayed setup; from here on they invalidate the take.
      await h.flashSync(150)
      hmr.length = 0
      const t0 = Date.now()
      const now = () => (Date.now() - t0) / 1000
      await page.waitForTimeout((def.introHold ?? INTRO_HOLD) * 1000)

      // 5. Beats.
      for (const b of beats) {
        const spec = def.beats[b.index]
        b.start = now()
        await page.waitForTimeout(spec.lead ?? 300)
        if (spec.do) {
          try {
            await spec.do(page, h)
          } catch (err) {
            // A hot update explains most action failures (the element the
            // script measured was replaced); redo the take before blaming it.
            if (hmr.length) throw new TaintedTakeError(hmr)
            failedShot = join(outDir, `FAILED-beat-${b.index + 1}.png`)
            await page.screenshot({ path: failedShot }).catch(() => {})
            throw new Error(`beat ${b.index + 1} failed: ${String(err).split('\n')[0]}`, { cause: err })
          }
        }
        const minEnd = b.start + b.audioDuration + AUDIO_TAIL
        const remaining = minEnd - now()
        if (remaining > 0) await page.waitForTimeout(remaining * 1000)
        await page.waitForTimeout(spec.hold ?? 400)
        b.end = now()
        log(`beat ${b.index + 1}: ${b.start.toFixed(2)} -> ${b.end.toFixed(2)} s`)
        // TUTORIAL_DEBUG=1 keeps a frame per beat next to the recording, which
        // is the fastest way to see where a script's pointer actually landed.
        if (process.env.TUTORIAL_DEBUG) await page.screenshot({ path: join(outDir, `debug-beat-${b.index + 1}.png`) }).catch(() => {})
      }

      await page.waitForTimeout((def.outroHold ?? OUTRO_HOLD) * 1000)
      const duration = now()
      if (hmr.length) throw new TaintedTakeError(hmr)
      // The overlay is hidden by HIDE_CHROME, but its presence means the dev
      // server had an error during the take; say so, the frames may be stale.
      if (await page.locator('vite-error-overlay').count()) log('WARNING: the Vite error overlay appeared during the recording (removed); check the dev server output')
      if (def.verify) {
        const detail = await def.verify(page, h)
        if (detail) log(`verified: ${detail}`)
      }

      // 6. Close to flush the webm, then move it next to the timeline.
      const video = page.video()
      await ctx.close()
      const tmp = video ? await video.path() : null
      if (!tmp) throw new Error('no video was recorded')
      const raw = join(outDir, 'raw.webm')
      renameSync(tmp, raw)

      const timeline = {
        id: def.id,
        target: target.kind,
        demo: def.demo ?? null,
        rawVideo: 'raw.webm',
        view,
        // Where the flash should be, from the context clock: the muxer picks
        // the black interval nearest this and trims to its end.
        flashEstimate: (t0 - contextCreatedAt) / 1000,
        introHold: def.introHold ?? INTRO_HOLD,
        outroHold: def.outroHold ?? OUTRO_HOLD,
        duration,
        beats: beats.map((b) => ({
          start: b.start,
          end: b.end,
          text: b.text,
          audio: b.audio,
          audioDuration: b.audioDuration,
        })),
      }
      writeFileSync(join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2) + '\n')
      return timeline
    } catch (err) {
      // Setup and verify failures get a frame too, not only beat failures.
      if (!failedShot && !(err instanceof TaintedTakeError)) {
        failedShot = join(outDir, 'FAILED.png')
        await page.screenshot({ path: failedShot }).catch(() => (failedShot = null))
      }
      await ctx.close().catch(() => {})
      if (failedShot) err.screenshot = failedShot
      throw err
    }
  } finally {
    await browser.close()
  }
}
