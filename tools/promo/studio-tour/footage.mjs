/**
 * Real footage for "SvGrid Studio, a tour": one screenshot per video frame of
 * the Studio designer on svgrid.com (the production build, so another
 * session's edits cannot hot-reload a dev page mid-take). STUDIO_URL points it
 * elsewhere. The site header is hidden for the take so the frame is Studio
 * alone. A drawn cursor drives each clip; each clip checks the thing its
 * caption says, and fails the render when it does not happen.
 *
 * recordClip(browser, name, frames) -> { frames: [fileUrl], info }
 */
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const STUDIO = process.env.STUDIO_URL ?? 'https://svgrid.com/studio/crm'
// 1680 css px is the narrowest width where the toolbar keeps Generate app on
// screen; the scale gives 1800 x 1012 frames for the 1600 x 900 card.
const W = 1680, H = 945, DSF = 1800 / 1680

const CURSOR = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.8 21 L11.3 14 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'

async function openStudio(page) {
  await page.goto(STUDIO, { waitUntil: 'networkidle' })
  // First visit opens the New app wizard; a visitor exploring the sample app closes it this way.
  await page.getByText('Explore the sample app').click({ timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
  await page.keyboard.press('Escape')
  await page.addStyleTag({ content: 'header.sticky.top-0 { display: none !important }' })
  await page.waitForTimeout(700)
  await page.evaluate((svg) => {
    const d = document.createElement('div')
    d.id = '__cursor'
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))'
    d.innerHTML = svg
    document.body.appendChild(d)
  }, CURSOR)
}

/** Steps against frames: { f, aim?: () => locator | point, act?: (point) => Promise, each?: (i) => Promise, len? }. */
async function film(page, name, frameCount, steps, check = {}) {
  const dir = join(tmpdir(), 'svgrid-studio-tour', name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let cur = { x: W - 140, y: H - 110 }
  const put = (p) => page.evaluate(({ x, y }) => { document.getElementById('__cursor').style.transform = `translate(${x - 4}px, ${y - 3}px)` }, p)
  await put(cur)
  const center = async (t) => {
    if ('x' in t) return t
    const b = await t.boundingBox()
    if (!b) throw new Error(`${name}: a target is not on screen`)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  const MOVE = 14
  const moves = new Map()
  const frames = []
  for (let f = 0; f < frameCount; f++) {
    for (const s of steps) {
      if (s.aim && f >= s.f - MOVE && f <= s.f) {
        if (f === s.f - MOVE || !moves.has(s)) moves.set(s, { from: cur, to: await center(await s.aim()) })
        const m = moves.get(s)
        const k = Math.min(1, (f - (s.f - MOVE)) / MOVE)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        cur = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e }
        await put(cur)
      }
      if (f === s.f && s.act) { await s.act(moves.get(s)?.to ?? cur); await page.waitForTimeout(160) }
      if (s.each && f >= s.f && f < s.f + (s.len ?? 1)) await s.each(f - s.f)
    }
    if (check[f]) await check[f]()
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 })
    frames.push(pathToFileURL(file).href)
  }
  return frames
}

const click = (page) => (p) => page.mouse.click(p.x, p.y)
const hover = (page) => (p) => page.mouse.move(p.x, p.y)
const must = (cond, msg) => { if (!cond) throw new Error(msg) }
const at = (n, k) => Math.round(n * k)

export const CLIPS = ['adddata', 'datamodel', 'overview', 'pipeline', 'forecast', 'deal360', 'themes', 'dark', 'code', 'preview', 'generate', 'deploy', 'samples']

export async function recordClip(browser, name, n) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF })
  if (name === 'dark') await ctx.addInitScript(() => { try { localStorage.setItem('sg-theme', 'dark') } catch { /* private mode */ } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const info = {}
  await openStudio(page)
  const pageItem = (label) => page.locator('button', { hasText: new RegExp(`^${label}\\s*/`) }).first()
  const text = (s) => page.locator('body').innerText().then((b) => b.includes(s))
  let frames

  if (name === 'adddata') {
    frames = await film(page, name, n, [
      { f: 18, aim: () => page.locator('button', { hasText: /Add\s*data/ }).first(), act: click(page) },
      { f: at(n, 0.42), aim: () => page.getByText('Import CSV').first(), act: hover(page) },
      { f: at(n, 0.62), aim: () => page.getByText('Get a database').first(), act: hover(page) },
      { f: at(n, 0.82), aim: () => page.getByText(/Import schema/).first(), act: hover(page) },
    ], { [at(n, 0.4)]: async () => must(await text('Import CSV'), 'adddata: the Add data menu did not open') })
  } else if (name === 'datamodel') {
    frames = await film(page, name, n, [
      { f: 18, aim: () => page.locator('button', { hasText: /Data\s*model/ }).first(), act: click(page) },
      { f: at(n, 0.55), aim: () => page.getByRole('dialog').getByText(/relationships/i).first(), act: hover(page) },
      { f: at(n, 0.8), aim: () => page.getByRole('dialog').getByText('companyId').first(), act: hover(page) },
    ], { [at(n, 0.5)]: async () => must(/relationships/i.test(await page.getByRole('dialog').first().innerText()), 'datamodel: no relationships in the dialog') })
  } else if (name === 'overview') {
    const canvas = await page.getByText('Pipeline value').first().boundingBox()
    must(canvas, 'overview: the Overview dashboard is not on screen')
    frames = await film(page, name, n, [
      { f: 20, aim: () => page.getByText('Pipeline value').first(), act: hover(page) },
      { f: at(n, 0.35), aim: () => page.getByText('Gauge', { exact: true }).first(), act: click(page) },
      { f: at(n, 0.62), aim: () => ({ x: 980, y: 640 }), act: hover(page) },
      { f: at(n, 0.66), len: at(n, 0.3), each: () => page.mouse.wheel(0, 9) },
    ], { [at(n, 0.5)]: async () => must(await text('$428,250'), 'overview: the pipeline KPI is missing') })
  } else if (name === 'pipeline') {
    frames = await film(page, name, n, [
      { f: 16, aim: () => pageItem('Pipeline'), act: click(page) },
      { f: at(n, 0.5), aim: () => page.getByText('Sam Rivera', { exact: true }).first(), act: click(page) },
      { f: at(n, 0.82), aim: () => page.getByText('All', { exact: true }).first(), act: click(page) },
    ], { [at(n, 0.45)]: async () => must(await text('QUALIFIED'), 'pipeline: the board did not render') })
  } else if (name === 'forecast') {
    frames = await film(page, name, n, [
      { f: 16, aim: () => pageItem('Forecast'), act: click(page) },
      { f: at(n, 0.6), aim: () => page.getByText('Largest deal').first(), act: hover(page) },
    ], { [at(n, 0.5)]: async () => must(await text('Largest deal'), 'forecast: the KPIs did not render') })
  } else if (name === 'deal360') {
    let sel
    frames = await film(page, name, n, [
      { f: 16, aim: () => pageItem('Deal 360'), act: click(page) },
      {
        f: at(n, 0.55),
        aim: async () => (sel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Globex platform rollout' }) }).first()),
        act: async () => {
          const opts = await sel.locator('option').allInnerTexts()
          info.picked = opts.find((o) => o.trim() && o.trim() !== 'Globex platform rollout')
          await sel.selectOption({ label: info.picked })
        },
      },
    ], { [n - 2]: async () => must(info.picked && (await text(info.picked)), `deal360: the record did not change (${info.picked})`) })
  } else if (name === 'themes' || name === 'dark') {
    // `dark` is the same picker with the visitor's dark preference set before
    // load (the site's own toggle stores it): every theme has a dark variant.
    let current = 'Salesforce'
    const pop = page.locator('.sv-studio__theme-pop')
    const item = (theme) => page.locator('.sv-studio__theme-name', { hasText: new RegExp(`^${theme}$`) }).first()
    const pick = (f, theme) => [
      { f, aim: () => page.locator('button', { hasText: current }).first(), act: async (p) => { if (!(await pop.isVisible())) await page.mouse.click(p.x, p.y) } },
      // Picked, then the picker closes so the restyled app fills the frame.
      { f: f + 20, aim: async () => { await item(theme).scrollIntoViewIfNeeded(); return item(theme) }, act: async (p) => { await page.mouse.click(p.x, p.y); current = theme; await page.waitForTimeout(150); await page.keyboard.press('Escape') } },
    ]
    const picks = name === 'dark' ? [...pick(14, 'Dracula'), ...pick(at(n, 0.55), 'Ember')] : [...pick(14, 'Ember'), ...pick(at(n, 0.38), 'Material 3'), ...pick(at(n, 0.7), 'Excel')]
    const last = name === 'dark' ? 'Ember' : 'Excel'
    frames = await film(page, name, n, picks, {
      [n - 2]: async () => {
        must(await page.locator('button', { hasText: last }).first().count(), `${name}: did not end on ${last}`)
        must(!(await pop.isVisible()), `${name}: the theme picker is still open`)
        if (name === 'dark') must(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'dark: the page is not in dark mode')
      },
    })
    info.last = current
  } else if (name === 'code') {
    let before = ''
    frames = await film(page, name, n, [
      { f: 16, aim: () => page.getByText('Code', { exact: true }).first(), act: async (p) => { await page.mouse.click(p.x, p.y); await page.locator('.cm-content').first().waitFor(); before = await page.locator('.cm-content').first().innerText() } },
      // The editor's own Insert row; the Add action list sits below the fold at this size.
      { f: at(n, 0.42), aim: () => page.locator('button', { hasText: /^Feed kpi1$/ }).first(), act: click(page) },
      { f: at(n, 0.72), aim: () => page.locator('button', { hasText: /^Export CSV$/ }).first(), act: click(page) },
    ], { [n - 2]: async () => { const after = await page.locator('.cm-content').first().innerText(); info.code = after.split('\n').slice(0, 4).join(' | '); must(after !== before && /ctx\.\w/.test(after), `code: no snippet was inserted (editor: ${JSON.stringify(after.slice(0, 200))})`) } })
  } else if (name === 'preview') {
    frames = await film(page, name, n, [
      { f: 16, aim: () => page.locator('button', { hasText: /^Preview$/ }).first(), act: click(page) },
      { f: at(n, 0.3), aim: () => page.getByRole('button', { name: /Tablet/ }).first(), act: click(page) },
      { f: at(n, 0.52), aim: () => page.getByRole('button', { name: /Mobile/ }).first(), act: click(page) },
      { f: at(n, 0.74), aim: () => page.getByRole('button', { name: /Desktop/ }).first(), act: click(page) },
      { f: at(n, 0.9), aim: () => page.getByText('Pipeline', { exact: true }).last(), act: click(page) },
    ], { [at(n, 0.25)]: async () => must(await text('Live preview'), 'preview: the preview did not open') })
  } else if (name === 'generate') {
    const dlg = () => page.getByRole('dialog').first()
    frames = await film(page, name, n, [
      { f: 16, aim: () => page.locator('button', { hasText: /Generate/ }).first(), act: async (p) => { await page.mouse.click(p.x, p.y); await page.getByText('Generated app').first().waitFor({ timeout: 20_000 }) } },
      { f: at(n, 0.32), aim: () => dlg().locator('button', { hasText: 'routes/login/+page.svelte' }).first(), act: click(page) },
      { f: at(n, 0.55), aim: () => dlg().locator('button', { hasText: '.github/workflows/ci.yml' }).first(), act: click(page) },
      { f: at(n, 0.76), aim: () => dlg().locator('button', { hasText: 'DEPLOY.md' }).first(), act: click(page) },
      { f: at(n, 0.93), aim: () => dlg().locator('button', { hasText: 'Open in StackBlitz' }).first(), act: hover(page) },
    ], { [n - 2]: async () => must(/Generated app/.test(await dlg().innerText()), 'generate: the Generated app dialog is not open') })
  } else if (name === 'deploy') {
    frames = await film(page, name, n, [
      { f: 16, aim: () => page.locator('button', { hasText: /^Deploy$/ }).first(), act: click(page) },
      { f: at(n, 0.5), aim: () => page.getByRole('dialog').locator('select').first(), act: hover(page) },
      { f: at(n, 0.8), aim: () => page.getByRole('dialog').locator('button', { hasText: /Generate app/ }).first(), act: hover(page) },
    ], { [at(n, 0.45)]: async () => must(/Deploy target/i.test(await page.getByRole('dialog').first().innerText()), 'deploy: the Deploy dialog did not open') })
  } else if (name === 'samples') {
    const span = at(n, 0.55)
    let body
    frames = await film(page, name, n, [
      { f: 16, aim: () => page.locator('button', { hasText: /Sample\s*apps/ }).first(), act: async (p) => { await page.mouse.click(p.x, p.y); body = page.locator('.sv-studio__gallery-body').first(); await body.waitFor() } },
      { f: at(n, 0.3), len: span, each: (i) => body.evaluate((e, k) => { e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * k))) }, i / span) },
    ], { [at(n, 0.25)]: async () => must(await text('E-commerce admin'), 'samples: the gallery did not open') })
  } else {
    throw new Error(`no clip called ${name}`)
  }

  if (errors.length) throw new Error(`${name}: page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return { frames, info }
}
