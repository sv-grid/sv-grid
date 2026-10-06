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
 *   - no `autoplay`: preload="none" plus autoplay would fetch every video on
 *     page open; Docs.svelte starts a silent clip on scroll,
 *   - a `player` entry (an install walkthrough, watched once with sound) is
 *     the narrated cut with native controls, not muted and not looped, and
 *     Docs.svelte leaves it alone; a feature clip has no controls and reads
 *     like a GIF,
 *   - the YouTube line appears only once the video has an id.
 * @param {import('./tutorial-media.d.mts').TutorialEntry} t
 */
export function tutorialBlock(t) {
  const title = escapeHtml(t.title)
  const secs = Math.round(t.duration)
  const yt = t.youtubeId
    ? ` <a href="https://www.youtube.com/watch?v=${escapeHtml(t.youtubeId)}" rel="noopener">${t.player ? 'Watch on YouTube' : 'Watch with narration on YouTube'}</a>`
    : ''
  const cues = (t.transcript ?? []).map((c) => `<p>${escapeHtml(normalizeNarration(c.text))}</p>`)
  const playback = t.player ? 'controls playsinline preload="none"' : 'muted loop playsinline preload="none"'
  return [
    `<!-- tutorial:${t.id} -->`,
    `<figure class="docs-tutorial${t.player ? ' docs-tutorial-player' : ''}" id="tutorial-${t.id}" data-docs-tutorial="${t.id}">`,
    `<video class="docs-tutorial-video" src="${t.files.mp4}" poster="${t.files.poster}" width="${t.width}" height="${t.height}" ${playback} aria-label="${title}, ${secs} second tutorial">` +
      `<track kind="captions" srclang="en" label="English" src="${t.files.vtt}"${t.player ? '' : ' default'}>` +
      `Your browser does not play embedded video. <a href="${t.files.mp4}">Download the MP4</a>.</video>`,
    `<figcaption><strong>${title}</strong> (${captionDuration(t.duration)}, ${t.player ? 'with narration' : 'silent'}).${yt}</figcaption>`,
    // A silent clip's only text is this block, so it keeps it. A narrated one
    // says the same words out loud and carries a captions track the player can
    // turn on, so the visible copy is a third telling of the same thing and it
    // reads as clutter under the video. The full text stays machine-readable in
    // the page's VideoObject either way.
    ...(t.player ? [] : [`<details class="docs-tutorial-transcript"><summary>Transcript</summary>`, ...cues, `</details>`]),
    `</figure>`,
    `<!-- /tutorial:${t.id} -->`,
  ].join('\n')
}

/** The generated course table's fence. */
export const COURSE_RE = /<!-- course:learn -->[\s\S]*?<!-- \/course:learn -->/

/**
 * Duration as a figure caption says it. Seconds read fine for a short clip;
 * past a minute "129 s" makes a reader do arithmetic, so it becomes "2:09".
 * Shared with the route video component so the same cut cannot show one
 * duration on a docs page and another on the homepage.
 */
export function captionDuration(seconds) {
  const s = Math.round(seconds)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "2 min 21 s", or "48 s" under a minute. */
export function runtime(seconds) {
  const s = Math.round(seconds)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

/** `docs/getting-started/2-first-grid.md` -> `./2-first-grid.md`, from getting-started. */
function relativeTo(fromDir, docsPage) {
  const parts = docsPage.replace(/^docs\//, '').replace(/\.md$/, '').split('/')
  const from = fromDir.replace(/^docs\//, '').split('/')
  let i = 0
  while (i < from.length && i < parts.length - 1 && from[i] === parts[i]) i += 1
  const up = from.length - i
  const rest = parts.slice(i).join('/')
  return `${up ? '../'.repeat(up) : './'}${rest}.md`
}

/**
 * The course contents table, generated so the running times are measured
 * rather than typed. Markdown rather than raw HTML: a table needs no blank
 * line to survive `marked`, and relative `.md` links get rewritten to routes
 * the same way the hand-written ones on every other page do.
 *
 * Each row points at the lesson's anchor on the page that already embeds it,
 * because a tutorial may be embedded exactly once (tools/tutorials.test.ts).
 * @param {Array<import('./tutorial-media.d.mts').TutorialEntry>} lessons
 * @param {string} fromDir directory of the page holding the table
 */
export function courseBlock(lessons, fromDir = 'docs/getting-started') {
  const ordered = [...lessons].sort(
    (a, b) => Number(a.id.match(/\d+/)?.[0] ?? 0) - Number(b.id.match(/\d+/)?.[0] ?? 0),
  )
  const rows = ordered.map((t, i) => {
    // Titles read "Learn SvGrid 4: editing rows, and validating them"; the
    // number is already the first column and the prefix is dead weight.
    const title = t.title.replace(/^Learn SvGrid \d+:\s*/, '')
    // Descriptions are written for search results and open "Lesson four of
    // the SvGrid course: ..." (or just "Lesson ten: ..."); the number is
    // already the first column.
    const what = t.description.replace(/^Lesson \w+(?: of the SvGrid course)?:\s*/i, '')
    const href = `${relativeTo(fromDir, t.docsPage)}#tutorial-${t.id}`
    return `| ${i + 1} | [${title.charAt(0).toUpperCase()}${title.slice(1)}](${href}) | ${what.charAt(0).toUpperCase()}${what.slice(1)} | ${runtime(t.duration)} |`
  })
  const total = ordered.reduce((n, t) => n + t.duration, 0)
  return [
    '<!-- course:learn -->',
    '',
    '| # | Lesson | What it covers | Length |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `Ten lessons, ${runtime(total)} in all.`,
    '',
    '<!-- /course:learn -->',
  ].join('\n')
}

/** Insert or refresh the course table (LF text in, LF text out). */
export function upsertCourseBlock(pageText, block) {
  if (COURSE_RE.test(pageText)) {
    const next = pageText.replace(COURSE_RE, block)
    return { text: next, changed: next !== pageText, inserted: false }
  }
  return { text: `${pageText.replace(/\s*$/, '')}\n\n${block}\n`, changed: true, inserted: true }
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
 * the docs cut that is actually on the page (Google requires the video it
 * indexes to be embedded there; silent, or narrated for a `player` entry);
 * `embedUrl` is the YouTube copy.
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
