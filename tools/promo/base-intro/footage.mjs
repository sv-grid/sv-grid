/**
 * Real footage for "Meet SvGrid Base", one screenshot per video frame, from
 * the Base demos in the local gallery (pnpm dev, :5174) in full screen: the
 * workspace's packages/enterprise/src/fields, which is what ships as
 * @svgrid/enterprise/base. A drawn cursor drives each clip; each clip checks
 * the thing its line says, and fails the render when it does not happen.
 *
 * recordClip(browser, name, frames) -> { frames: [fileUrl], info }
 */
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const GALLERY = 'http://localhost:5174'
const W = 1280, H = 720

const CURSOR = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.8 21 L11.3 14 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'

async function openDemo(page, id) {
  await page.goto(`${GALLERY}/#/${id}`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' }) // a clean demo, not the last clip's state
  await page.getByRole('button', { name: 'Full screen' }).click()
  // Unlicensed, Base says so in a card once a session: close it, as a visitor would.
  await page.locator('[data-svgrid-enterprise-upgrade] button', { hasText: '×' }).click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  await page.evaluate((svg) => {
    const d = document.createElement('div')
    d.id = '__cursor'
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))'
    d.innerHTML = svg
    document.body.appendChild(d)
  }, CURSOR)
}

/** Run steps against frames: { f, aim?: () => locator | point, act?: (point) => Promise, each?: (f) => Promise }. */
async function film(page, name, frameCount, steps, check = {}) {
  const dir = join(tmpdir(), 'svgrid-base-intro', name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let cur = { x: W - 120, y: H - 90 }
  const put = (p) => page.evaluate(({ x, y }) => { document.getElementById('__cursor').style.transform = `translate(${x - 4}px, ${y - 3}px)` }, p)
  await put(cur)
  const center = async (t) => {
    if ('x' in t) return t
    const b = await t.boundingBox()
    if (!b) throw new Error(`${name}: a target is not on screen`)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  const MOVE = 12
  const moves = new Map()
  const frames = []
  for (let f = 0; f < frameCount; f++) {
    for (const s of steps) {
      if (s.aim && f >= s.f - MOVE && f <= s.f) {
        if (f === s.f - MOVE) moves.set(s, { from: cur, to: await center(await s.aim()) })
        const m = moves.get(s)
        const k = (f - (s.f - MOVE)) / MOVE
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        cur = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e }
        await put(cur)
      }
      if (f === s.f && s.act) { await s.act(moves.get(s)?.to); await page.waitForTimeout(150) }
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
const must = (cond, msg) => { if (!cond) throw new Error(msg) }

export async function recordClip(browser, name, frameCount) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const info = {}
  let frames

  if (name === 'fields') {
    // The project tracker's Tasks table, panned across its fields.
    await openDemo(page, '504-project-tracker')
    const scroller = await page.evaluateHandle(() =>
      [...document.querySelectorAll('.demo-stage *')].filter((e) => e.scrollWidth > e.clientWidth + 100 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)).sort((a, b) => b.clientWidth - a.clientWidth)[0])
    const max = await scroller.evaluate((e) => e.scrollWidth - e.clientWidth)
    must(max > 300, `fields: the table does not pan (${max}px)`)
    const span = Math.min(frameCount - 60, 260)
    frames = await film(page, name, frameCount, [
      { f: 30, len: span, each: (i) => scroller.evaluate((e, x) => { e.scrollLeft = x }, Math.round(max * (0.5 - 0.5 * Math.cos((Math.PI * i) / span)))) },
    ])
    info.headers = await page.locator('[role="columnheader"]').allInnerTexts()
  } else if (name === 'views') {
    // All tasks -> by status (Kanban) -> due dates (calendar) -> gallery -> the request form.
    await openDemo(page, '504-project-tracker')
    let current = 'All tasks'
    const pick = (f, view) => [
      { f, aim: () => page.locator('.sv-fvb-view').first(), act: click(page) },
      // The saved views, not the 'create a view of this type' list under them.
      { f: f + 18, aim: () => page.locator('.sv-fviews-pick', { hasText: view }).first(), act: async (p) => { await page.mouse.click(p.x, p.y); current = view } },
    ]
    const n = frameCount
    frames = await film(page, name, n, [...pick(14, 'By status'), ...pick(Math.round(n * 0.3), 'Due dates'), ...pick(Math.round(n * 0.52), 'Gallery'), ...pick(Math.round(n * 0.74), 'Request a task')], {
      [Math.round(n * 0.3) - 2]: async () => must(await page.locator('.sv-board-card').count() > 0, 'views: no Kanban cards'),
    })
    info.lastView = current
  } else if (name === 'records') {
    // Filter, then a record opened in full, with its comments.
    await openDemo(page, '504-project-tracker')
    frames = await film(page, name, frameCount, [
      { f: 14, aim: () => page.getByRole('button', { name: 'Filter', exact: true }), act: click(page) },
      // Closed by its own button: Escape would also leave full screen.
      { f: 70, aim: () => page.getByRole('button', { name: 'Filter', exact: true }), act: click(page) },
      { f: 104, aim: () => page.locator('.sv-frh-expand').nth(1), act: click(page) },
    ], {
      [130]: async () => { info.expanded = await page.getByRole('dialog').count() },
    })
  } else if (name === 'databases') {
    // Plain SQL in, an app out: real Postgres (PGlite) in the page.
    await openDemo(page, '519-base-from-database')
    frames = await film(page, name, frameCount, [
      { f: 14, aim: () => page.getByRole('tab', { name: 'Shop', exact: true }), act: click(page) },
      { f: 60, aim: () => page.getByRole('button', { name: 'Make the app' }), act: async (p) => { await page.mouse.click(p.x, p.y); await page.getByText(/Read \d+ tables/).waitFor({ timeout: 15000 }) } },
    ])
    info.read = (await page.getByText(/Read \d+ tables/).innerText()).trim()
    info.tabs = await page.getByRole('tab').allInnerTexts()
  } else if (name === 'sql') {
    // All tables -> Download as SQL: the file that creates the tables.
    await openDemo(page, '504-project-tracker')
    const download = page.waitForEvent('download', { timeout: 20000 })
    frames = await film(page, name, frameCount, [
      { f: 14, aim: () => page.getByRole('button', { name: 'All tables' }), act: click(page) },
      { f: 46, aim: () => page.getByRole('menuitem', { name: 'Download as SQL' }).or(page.getByText('Download as SQL')).first(), act: click(page) },
    ])
    const d = await download
    const path = join(tmpdir(), 'svgrid-base-intro', 'base.sql')
    await d.saveAs(path)
    info.sqlFile = path
    info.sqlName = d.suggestedFilename()
  } else if (name === 'automations') {
    await openDemo(page, '504-project-tracker')
    frames = await film(page, name, frameCount, [
      { f: 18, aim: () => page.getByRole('button', { name: /\d+ automations/ }), act: click(page) },
    ])
    info.dialogs = await page.getByRole('dialog').count()
  } else {
    throw new Error(`no clip called ${name}`)
  }

  if (errors.length) throw new Error(`${name}: page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return { frames, info }
}
