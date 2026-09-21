/**
 * youtube - publish a recorded tutorial's narrated master to YouTube.
 *
 *   node tools/tutorials/youtube.mjs --auth                 one-time consent, prints YT_REFRESH_TOKEN
 *   node tools/tutorials/youtube.mjs --verify               prints the channel the token belongs to
 *   node tools/tutorials/youtube.mjs upload <id>            DRY RUN: prints the metadata, writes <id>.youtube.json
 *   node tools/tutorials/youtube.mjs upload <id> --post     really uploads (video + captions + thumbnail)
 *       [--privacy unlisted|private|public] [--playlist <playlistId>] [--no-captions] [--no-thumbnail]
 *   node tools/tutorials/youtube.mjs link <id> <videoId>    after a manual upload from YouTube Studio
 *
 * Inputs come from `pnpm tutorials <id>`: tutorials-out/<id>/<id>.youtube.mp4,
 * <id>.srt and <id>.thumb.jpg. A successful upload (or `link`) writes the
 * video id into tools/tutorials/manifest.json; run `pnpm tutorials:embed`
 * afterwards so the docs figcaption links the narrated copy and the
 * VideoObject gains its embedUrl.
 *
 * Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN; optional YT_PLAYLIST_ID,
 * YT_PRIVACY (default unlisted).
 *
 * Google locks videos uploaded through an OAuth project that has not passed
 * the YouTube API Services compliance audit to PRIVATE, whatever privacy the
 * request asked for. Until the audit is approved, upload by hand from YouTube
 * Studio using the files above and <id>.youtube.json, then run `link`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, authorizeInteractive, credentials, hasCredentials, QUOTA } from './lib/youtube-client.mjs'
import { readManifest, writeManifest, upsertTutorial, findTutorial, OUT_DIR } from './lib/manifest.mjs'
import { normalizeNarration } from '../lib/tutorial-media.mjs'

const SITE = 'https://svgrid.com'
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--privacy', '--playlist'].includes(args[i - 1])))

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

/** Title, description and tags for a manifest entry. Straight quotes, no dashes. */
export function youtubeMeta(t, { privacy = 'unlisted' } = {}) {
  const suffix = ' - SvGrid, the Svelte 5 data grid'
  const title = normalizeNarration(t.title.length + suffix.length <= 100 ? `${t.title}${suffix}` : t.title).slice(0, 100)
  const slug = t.docsPage ? t.docsPage.replace(/^docs\//, '').replace(/\.md$/, '') : null
  const description = [
    normalizeNarration(t.description),
    '',
    ...t.transcript.map((c) => normalizeNarration(c.text)),
    '',
    ...(slug ? [`Docs: ${SITE}/docs/${slug}/`] : [`Docs: ${SITE}/docs/`]),
    ...(t.demo ? [`Live demo: ${SITE}/demos/${t.demo}/`] : [`Live demos: ${SITE}/demos/`]),
    'Install: npm i @svgrid/grid',
    '',
    '#Svelte #SvelteKit #DataGrid',
  ].join('\n')
  const tags = []
  for (const tag of [...t.tags, 'svelte', 'svelte 5', 'sveltekit', 'svelte data grid', 'svelte table', 'svgrid']) {
    const clean = normalizeNarration(tag).toLowerCase()
    if (!clean || tags.includes(clean)) continue
    if (tags.join(',').length + clean.length + 1 > 480) break
    tags.push(clean)
  }
  return { title, description, tags, categoryId: '28', privacyStatus: privacy }
}

async function main() {
  if (flag('--auth')) {
    const { clientId, clientSecret } = credentials()
    const refresh = await authorizeInteractive({ clientId, clientSecret })
    console.log('\nRefresh token (store it as the YT_REFRESH_TOKEN secret, it is not saved anywhere):\n')
    console.log(refresh)
    return
  }

  if (flag('--verify')) {
    if (!hasCredentials()) fail('YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are required')
    const c = await createClient().myChannel()
    console.log(`channel: ${c.title} (${c.id}), ${c.subscribers ?? '?'} subscribers, ${c.videos ?? '?'} videos`)
    return
  }

  const [cmd, id, videoId] = positional
  const manifest = readManifest()

  if (cmd === 'link') {
    if (!id || !videoId) fail('usage: youtube.mjs link <id> <videoId>')
    const t = findTutorial(manifest, id)
    if (!t) fail(`no tutorial "${id}" in the manifest`)
    writeManifest(upsertTutorial(manifest, { ...t, youtubeId: videoId, publishedAt: new Date().toISOString().slice(0, 10) }))
    console.log(`${id} -> https://www.youtube.com/watch?v=${videoId}\nnext: pnpm tutorials:embed`)
    return
  }

  if (cmd !== 'upload' || !id) fail('usage: youtube.mjs upload <id> [--post] | link <id> <videoId> | --auth | --verify')
  const t = findTutorial(manifest, id)
  if (!t) fail(`no tutorial "${id}" in the manifest (record it first: pnpm tutorials ${id})`)

  const dir = join(OUT_DIR, id)
  const files = { mp4: join(dir, `${id}.youtube.mp4`), srt: join(dir, `${id}.srt`), thumb: join(dir, `${id}.thumb.jpg`) }
  const missing = Object.entries(files).filter(([, p]) => !existsSync(p)).map(([k]) => k)
  if (missing.includes('mp4')) fail(`${files.mp4} is missing: run pnpm tutorials ${id} first (tutorials-out/ is not committed)`)

  const privacy = opt('--privacy', process.env.YT_PRIVACY || 'unlisted')
  const playlist = opt('--playlist', process.env.YT_PLAYLIST_ID || '')
  const meta = youtubeMeta(t, { privacy })
  const plan = {
    id,
    file: files.mp4,
    bytes: readFileSync(files.mp4).length,
    captions: !flag('--no-captions') && !missing.includes('srt'),
    thumbnail: !flag('--no-thumbnail') && !missing.includes('thumb'),
    playlist: playlist || null,
    quotaUnits: QUOTA.videosInsert + (flag('--no-captions') ? 0 : QUOTA.captionsInsert) + (flag('--no-thumbnail') ? 0 : QUOTA.thumbnailsSet) + (playlist ? QUOTA.playlistItemsInsert : 0),
    ...meta,
  }
  writeFileSync(join(dir, `${id}.youtube.json`), JSON.stringify(plan, null, 2) + '\n', 'utf-8')

  console.log(`title:       ${plan.title}`)
  console.log(`privacy:     ${plan.privacyStatus}`)
  console.log(`tags:        ${plan.tags.join(', ')}`)
  console.log(`video:       ${Math.round(plan.bytes / 1024)} KB, captions ${plan.captions ? 'yes' : 'no'}, thumbnail ${plan.thumbnail ? 'yes' : 'no'}${playlist ? `, playlist ${playlist}` : ''}`)
  console.log(`quota:       ~${plan.quotaUnits} of 10,000 daily units`)
  console.log(`description:\n${plan.description.split('\n').map((l) => '  ' + l).join('\n')}`)
  console.log(`\nmetadata written to ${join(dir, `${id}.youtube.json`)}`)

  if (!flag('--post')) {
    console.log('\n[dry run] pass --post to upload. Note: an OAuth project that has not passed the YouTube API compliance audit gets its uploads locked to private.')
    return
  }
  if (!hasCredentials()) fail('YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are required to --post')

  const yt = createClient()
  const bytes = readFileSync(files.mp4)
  process.stdout.write('uploading ...')
  const newId = await yt.uploadVideo(bytes, meta, {
    onProgress: (done, total) => process.stdout.write(` ${Math.round((done / total) * 100)}%`),
  })
  console.log(`\nvideo: https://www.youtube.com/watch?v=${newId}`)

  if (plan.captions) {
    try {
      await yt.insertCaption(newId, readFileSync(files.srt))
      console.log('captions: uploaded')
    } catch (err) {
      console.error(`captions: FAILED (${err.message.split('\n')[0]})`)
    }
  }
  if (plan.thumbnail) {
    try {
      await yt.setThumbnail(newId, readFileSync(files.thumb))
      console.log('thumbnail: set')
    } catch (err) {
      console.error(`thumbnail: not set (${err.message.split('\n')[0]}); YouTube needs a phone-verified channel for custom thumbnails`)
    }
  }
  if (playlist) {
    try {
      await yt.addToPlaylist(playlist, newId)
      console.log(`playlist: added to ${playlist}`)
    } catch (err) {
      console.error(`playlist: FAILED (${err.message.split('\n')[0]})`)
    }
  }
  const status = await yt.videoStatus(newId).catch(() => null)
  if (status) {
    console.log(`status: ${status.uploadStatus}, processing ${status.processing}, privacy ${status.privacy}`)
    if (status.privacy === 'private' && privacy !== 'private') {
      console.log('NOTE: the video is private although a different privacy was requested. This is what YouTube does for API projects that have not passed the compliance audit; switch it in YouTube Studio or apply for the audit.')
    }
  }

  writeManifest(upsertTutorial(readManifest(), { ...t, youtubeId: newId, publishedAt: new Date().toISOString().slice(0, 10) }))
  console.log('manifest updated; next: pnpm tutorials:embed')
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/tutorials/youtube.mjs')) {
  main().catch((err) => fail(String(err.stack ?? err)))
}
