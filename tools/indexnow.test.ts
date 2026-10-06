import { describe, expect, it } from 'vitest'
import { INDEXNOW_KEY, batches, changedUrls, pathKey, payload, sitemapUrls } from './indexnow.mjs'

const O = 'https://svgrid.com'

describe('indexnow', () => {
  it('reads every <loc> from a sitemap', () => {
    const xml = `<urlset><url><loc>${O}/</loc></url><url><loc> ${O}/docs/a/ </loc><lastmod>2026-10-06</lastmod></url></urlset>`
    expect(sitemapUrls(xml)).toEqual([`${O}/`, `${O}/docs/a/`])
  })

  it('keys URLs the way page-hashes.json does', () => {
    expect(pathKey(`${O}/`, O)).toBe('/')
    expect(pathKey(`${O}/docs/a`, O)).toBe('/docs/a/')
    expect(pathKey(`${O}/tools/csv-viewer/`, O)).toBe('/tools/csv-viewer/')
  })

  it('submits only new and changed pages when a live manifest exists', () => {
    const urls = [`${O}/`, `${O}/a/`, `${O}/b/`, `${O}/new/`]
    const next = { '/': 'h0', '/a/': 'h1', '/b/': 'CHANGED', '/new/': 'h9' }
    const live = { '/': 'h0', '/a/': 'h1', '/b/': 'h2', '/gone/': 'h3' }
    expect(changedUrls(urls, next, live, O)).toEqual([`${O}/b/`, `${O}/new/`])
  })

  it('submits everything when there is no live manifest', () => {
    const urls = [`${O}/`, `${O}/a/`]
    expect(changedUrls(urls, {}, null, O)).toEqual(urls)
  })

  it('submits a sitemap URL that has no hash rather than skipping it', () => {
    expect(changedUrls([`${O}/x/`], {}, { '/x/': 'h' }, O)).toEqual([`${O}/x/`])
  })

  it('splits at the protocol cap', () => {
    const list = Array.from({ length: 10001 }, (_, i) => `${O}/p${i}/`)
    expect(batches(list).map((b) => b.length)).toEqual([10000, 1])
  })

  it('builds the protocol payload with the hosted key location', () => {
    expect(payload([`${O}/`], O)).toEqual({
      host: 'svgrid.com',
      key: INDEXNOW_KEY,
      keyLocation: `${O}/${INDEXNOW_KEY}.txt`,
      urlList: [`${O}/`],
    })
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/)
  })
})
