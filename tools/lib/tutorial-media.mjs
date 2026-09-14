/**
 * 30-second tutorials: the pure, dependency-free half of tools/tutorials/.
 *
 * A tutorial is a short screen recording of a gallery demo with a spoken
 * narration. The recorder (tools/tutorials/record.mjs) writes a muted MP4, a
 * poster and a VTT caption file into website/public/tutorials/ and one entry
 * into tools/tutorials/manifest.json. Everything that then has to agree on how
 * a tutorial looks on a docs page lives here:
 *
 *   - tools/tutorials/embed.mjs renders `tutorialBlock()` into the docs page,
 *   - tools/prerender-site.mjs and website/src/lib/seo.ts both emit the same
 *     `videoObjectLd()` so the static and hydrated heads cannot drift (the
 *     route-seo.mjs rule),
 *   - the recorder writes captions with `toSrt()` / `toVtt()`.
 *
 * Dependency-free so Vite can bundle it into the site.
 */

/** The generated block on a docs page is fenced by these two comments. */
export const TUTORIAL_RE = /<!-- tutorial:([a-z0-9-]+) -->[\s\S]*?<!-- \/tutorial:\1 -->/g

/** Text -> HTML text/attribute value. */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Narration text as it should reach a caption, a transcript or an API: one
 * space between words, plain hyphens, straight quotes. The repo has a house
 * rule against em-dashes, and a curly quote in a YouTube title is a tell.
 */
export function normalizeNarration(text) {
  return String(text)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function pad(n, w) {
  return String(n).padStart(w, '0')
}

/** Seconds -> `HH:MM:SS,mmm` (SRT) or `HH:MM:SS.mmm` (VTT). */
export function captionTime(seconds, sep = ',') {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${sep}${pad(ms % 1000, 3)}`
}

/**
 * Caption cues from beat timings. A beat's cue runs from the moment its audio
 * starts until the audio ends plus a beat of silence, but never into the next
 * cue: overlapping cues are legal in WebVTT and a mess in players.
 * @param {Array<{ start: number, audioDuration?: number, end?: number, text: string }>} beats
 */
export function cuesFromBeats(beats, { tail = 0.3, gap = 0.05 } = {}) {
  const out = []
  for (let i = 0; i < beats.length; i += 1) {
    const b = beats[i]
    if (!b.text) continue
    const next = beats.slice(i + 1).find((n) => n.text)
    const natural = b.start + (b.audioDuration ?? Math.max(0, (b.end ?? b.start) - b.start)) + tail
    const end = next ? Math.min(natural, next.start - gap) : natural
    out.push({ start: b.start, end: Math.max(b.start + 0.2, end), text: normalizeNarration(b.text) })
  }
  return out
}

/** @param {Array<{ start: number, end: number, text: string }>} cues */
export function toSrt(cues) {
  return cues
    .map((c, i) => `${i + 1}\n${captionTime(c.start, ',')} --> ${captionTime(c.end, ',')}\n${c.text}\n`)
    .join('\n')
}

/** @param {Array<{ start: number, end: number, text: string }>} cues */
export function toVtt(cues) {
  const body = cues
    .map((c, i) => `${i + 1}\n${captionTime(c.start, '.')} --> ${captionTime(c.end, '.')}\n${c.text}\n`)
    .join('\n')
  return `WEBVTT\n\n${body}`
}

/** 31.6 -> "PT32S", 90 -> "PT1M30S", 3661 -> "PT1H1M1S". Schema.org duration. */
export function iso8601Duration(seconds) {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  let out = 'PT'
  if (h) out += `${h}H`
  if (m) out += `${m}M`
  if (s || out === 'PT') out += `${s}S`
  return out
}

/**
 * The docs-page block for one manifest entry. Rules that matter:
 *   - no blank line anywhere inside: marked ends a raw HTML block at the first
 *     blank line and would wrap the rest in <p>,
 *   - one <p> per transcript cue, each on its own line starting with `<`, so
 *     the page summary extractors (which stop at `<`) never pick narration,
 *   - no `autoplay` and no `controls`: preload="none" plus autoplay would
 *     fetch every video on page open; Docs.svelte starts playback on scroll,
 *   - the YouTube line appears only once the video has an id.
 * @param {import('./tutorial-media.d.mts').TutorialEntry} t
 */
export function tutorialBlock(t) {
  const title = escapeHtml(t.title)
  const secs = Math.round(t.duration)
  const yt = t.youtubeId
    ? ` <a href="https://www.youtube.com/watch?v=${escapeHtml(t.youtubeId)}" rel="noopener">Watch with narration on YouTube</a>`
    : ''
  const cues = (t.transcript ?? []).map((c) => `<p>${escapeHtml(normalizeNarration(c.text))}</p>`)
  return [
    `<!-- tutorial:${t.id} -->`,
    `<figure class="docs-tutorial" id="tutorial-${t.id}" data-docs-tutorial="${t.id}">`,
    `<video class="docs-tutorial-video" src="${t.files.mp4}" poster="${t.files.poster}" width="${t.width}" height="${t.height}" muted loop playsinline preload="none" aria-label="${title}, ${secs} second tutorial">` +
      `<track kind="captions" srclang="en" label="English" src="${t.files.vtt}" default>` +
      `Your browser does not play embedded video. <a href="${t.files.mp4}">Download the MP4</a>.</video>`,
    `<figcaption><strong>${title}</strong> (${secs} s, silent).${yt}</figcaption>`,
    `<details class="docs-tutorial-transcript"><summary>Transcript</summary>`,
    ...cues,
    `</details>`,
    `</figure>`,
    `<!-- /tutorial:${t.id} -->`,
  ].join('\n')
}

/** Headings a block is inserted above when the tutorial names no anchor. */
const DEFAULT_ANCHORS = ['## See also', '## Frequently asked questions']

/**
 * Insert or refresh one tutorial block in a page (LF text in, LF text out).
 * An existing block for the id is replaced in place, so re-running after the
 * manifest changed touches only the block. A new block goes above `anchor`
 * (first line containing it), after `anchorAfter` (the line containing it),
 * else above "## See also", else above the FAQ, else at the end - "See also"
 * has to stay the last section (tools/demo-doc-coverage.test.ts).
 */
export function upsertBlock(pageText, id, block, { anchor, anchorAfter } = {}) {
  const re = new RegExp(`<!-- tutorial:${id} -->[\\s\\S]*?<!-- /tutorial:${id} -->`)
  if (re.test(pageText)) {
    const text = pageText.replace(re, () => block)
    return { text, changed: text !== pageText, inserted: false }
  }
  const lines = pageText.split('\n')
  const find = (needle) => (needle ? lines.findIndex((l) => l.includes(needle)) : -1)

  let at = -1
  let after = false
  const explicitAfter = find(anchorAfter)
  if (explicitAfter >= 0) {
    at = explicitAfter
    after = true
  } else {
    for (const needle of [anchor, ...DEFAULT_ANCHORS]) {
      const i = find(needle)
      if (i >= 0) {
        at = i
        break
      }
    }
  }

  const chunk = block.split('\n')
  if (at < 0) {
    const trimmed = pageText.replace(/\s+$/, '')
    return { text: `${trimmed}\n\n${block}\n`, changed: true, inserted: true }
  }
  if (after) {
    // Skip the blank line that follows the anchor line, if any, so the block
    // sits directly under the element it was anchored to.
    let i = at + 1
    while (i < lines.length && lines[i].trim() === '') i += 1
    lines.splice(i, 0, ...chunk, '')
    return { text: lines.join('\n'), changed: true, inserted: true }
  }
  // Above the anchor heading: strip the blank lines before it and re-add one
  // on each side of the block.
  let i = at
  while (i > 0 && lines[i - 1].trim() === '') i -= 1
  lines.splice(i, at - i, '', ...chunk, '')
  return { text: lines.join('\n'), changed: true, inserted: true }
}

/**
 * Schema.org VideoObject for a tutorial on a docs page. `contentUrl` points at
 * the silent docs cut that is actually on the page (Google requires the video
 * it indexes to be embedded there); `embedUrl` is the narrated YouTube copy.
 * @param {import('./tutorial-media.d.mts').TutorialEntry} t
 * @param {{ origin: string, pageUrl: string }} ctx origin without trailing slash
 */
export function videoObjectLd(t, { origin, pageUrl }) {
  const base = origin.replace(/\/$/, '')
  const date = t.publishedAt ?? t.recordedAt
  const node = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: t.title,
    description: t.description,
    thumbnailUrl: [`${base}${t.files.poster}`],
    uploadDate: /T/.test(date) ? date : `${date}T00:00:00Z`,
    duration: iso8601Duration(t.duration),
    contentUrl: `${base}${t.files.mp4}`,
    url: `${pageUrl}#tutorial-${t.id}`,
    inLanguage: 'en',
    isFamilyFriendly: true,
    transcript: (t.transcript ?? []).map((c) => normalizeNarration(c.text)).join(' '),
    publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
  }
  if (t.youtubeId) node.embedUrl = `https://www.youtube.com/embed/${t.youtubeId}`
  return node
}

/** Every tutorial id a page embeds, in page order. */
export function tutorialIdsIn(markdown) {
  return [...new Set([...markdown.matchAll(/data-docs-tutorial="([^"]+)"/g)].map((m) => m[1]))]
}
