#!/usr/bin/env node
/**
 * IndexNow: tell Bing (and the other IndexNow engines, Yandex, Seznam, Naver)
 * which svgrid.com pages changed, right after a deploy, instead of waiting for
 * the next crawl. Bing's index is what ChatGPT search reads, so this is the
 * cheapest lever on whether a new page shows up there.
 *
 * Two steps, run by .github/workflows/deploy-website.yml:
 *
 *   node tools/indexnow.mjs plan --dist website/dist --out indexnow-urls.json
 *     Before the deploy, while the OLD site is still live. Writes the key file
 *     into dist, then compares dist/page-hashes.json (written by
 *     tools/prerender-site.mjs) with the copy on the live site and keeps the
 *     sitemap URLs that are new or whose content hash changed. No live copy
 *     (the first run, or a fetch failure) means every sitemap URL.
 *
 *   node tools/indexnow.mjs submit --in indexnow-urls.json [--dry-run]
 *     After the deploy. Waits until the key file is served, then posts the
 *     list in batches.
 *
 * Neither step fails the deploy: a search-engine hiccup is logged and the run
 * exits 0. The key is not a secret; the protocol publishes it at /<key>.txt.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const INDEXNOW_KEY = 'e89498b6d02a325c9047d18275bb1c11'
export const ENDPOINT = 'https://api.indexnow.org/indexnow'
/** The protocol's per-request cap. */
export const BATCH = 10000

const ORIGIN = (process.env.SVGRID_SITE_ORIGIN || 'https://svgrid.com').replace(/\/$/, '')

/** Every <loc> in a sitemap, in order. */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
}

/** "https://svgrid.com/docs/x/" -> "/docs/x/", the key page-hashes.json uses. */
export function pathKey(url, origin = ORIGIN) {
  const path = url.startsWith(origin) ? url.slice(origin.length) || '/' : new URL(url).pathname
  return path.endsWith('/') ? path : `${path}/`
}

/**
 * Sitemap URLs that are new or changed since the live build. A null `live`
 * (no previous manifest) returns every URL. A page with no hash in the new
 * manifest is submitted too: better one extra ping than a missed page.
 */
export function changedUrls(urls, next, live, origin = ORIGIN) {
  if (!live) return [...urls]
  return urls.filter((u) => {
    const k = pathKey(u, origin)
    return !next[k] || next[k] !== live[k]
  })
}

export function batches(list, size = BATCH) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function payload(urlList, origin = ORIGIN, key = INDEXNOW_KEY) {
  return { host: new URL(origin).host, key, keyLocation: `${origin}/${key}.txt`, urlList }
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function plan() {
  const dist = arg('--dist') || 'website/dist'
  const out = arg('--out') || 'indexnow-urls.json'
  writeFileSync(join(dist, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY)

  const sitemapFile = join(dist, 'sitemap.xml')
  const hashFile = join(dist, 'page-hashes.json')
  if (!existsSync(sitemapFile) || !existsSync(hashFile)) {
    console.warn(`indexnow: ${!existsSync(sitemapFile) ? 'sitemap.xml' : 'page-hashes.json'} missing from ${dist}; nothing planned.`)
    writeFileSync(out, JSON.stringify({ urls: [], reason: 'missing build output' }) + '\n')
    return
  }
  const urls = sitemapUrls(readFileSync(sitemapFile, 'utf-8'))
  const next = JSON.parse(readFileSync(hashFile, 'utf-8'))
  const all = process.argv.includes('--all')
  const live = all ? null : await fetchJson(`${ORIGIN}/page-hashes.json?t=${Date.now()}`)
  const list = changedUrls(urls, next, live)
  const reason = all ? 'forced --all' : live ? 'changed since the live build' : 'no live manifest: first run, every URL'
  writeFileSync(out, JSON.stringify({ urls: list, reason }, null, 2) + '\n')
  console.log(`indexnow: ${list.length} of ${urls.length} sitemap URLs to submit (${reason}).`)
  for (const u of list.slice(0, 20)) console.log(`  ${u}`)
  if (list.length > 20) console.log(`  ... ${list.length - 20} more`)
}

/** The key file has to be live before a ping, or the engines reject it (403). */
async function keyIsLive(tries = 12, waitMs = 10000) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${ORIGIN}/${INDEXNOW_KEY}.txt?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } })
      if (res.ok && (await res.text()).trim() === INDEXNOW_KEY) return true
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, waitMs))
  }
  return false
}

async function submit() {
  const file = arg('--in') || 'indexnow-urls.json'
  const dry = process.argv.includes('--dry-run')
  const { urls = [], reason = '' } = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : {}
  if (!urls.length) {
    console.log('indexnow: nothing changed; no submission.')
    return
  }
  if (dry) {
    console.log(`indexnow (dry run): would submit ${urls.length} URLs (${reason}) in ${batches(urls).length} request(s).`)
    console.log(JSON.stringify(payload(urls.slice(0, 3)), null, 2))
    return
  }
  if (!(await keyIsLive())) {
    console.warn(`indexnow: ${ORIGIN}/${INDEXNOW_KEY}.txt is not being served yet; skipping this submission. The next deploy will include these pages again.`)
    return
  }
  for (const list of batches(urls)) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload(list)),
      })
      // 200 = accepted, 202 = accepted and key validation pending. Anything
      // else is logged, never fatal.
      const note = { 400: 'bad request', 403: 'key not valid for this host', 422: 'URLs not on this host', 429: 'too many requests' }[res.status] ?? ''
      console.log(`indexnow: submitted ${list.length} URLs -> HTTP ${res.status}${note ? ` (${note})` : ''}`)
      if (res.status >= 400) console.warn(await res.text().catch(() => ''))
    } catch (err) {
      console.warn(`indexnow: request failed: ${err.message}`)
    }
  }
}

const cmd = process.argv[2]
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('indexnow.mjs')
if (isMain) {
  const run = cmd === 'plan' ? plan : cmd === 'submit' ? submit : null
  if (!run) {
    console.error('usage: node tools/indexnow.mjs plan --dist website/dist --out indexnow-urls.json [--all]\n       node tools/indexnow.mjs submit --in indexnow-urls.json [--dry-run]')
    process.exit(1)
  }
  run().catch((err) => {
    // Never fail the deploy over a search-engine ping.
    console.warn(`indexnow: ${err?.message ?? err}`)
  })
}
