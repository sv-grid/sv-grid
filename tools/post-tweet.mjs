#!/usr/bin/env node
/**
 * Automated Twitter/X posting for svgrid.com.
 *
 * Each run decides what to tweet (a new release, the blog post that went live
 * today, a curated feature highlight, or an AI-generated original), composes the
 * copy, attaches an image, and posts it to the @svgrid account.
 *
 * The BLOG tweet uses the post's own hero image (from /blog-media in the cloned
 * website) as the media, with the AI-written blurb as the text and the link in a
 * first reply. Other types use a rendered branded card.
 *
 * Usage:
 *   node tools/post-tweet.mjs                 # DRY RUN: print + save media, post nothing
 *   node tools/post-tweet.mjs --post          # actually post (needs creds)
 *   node tools/post-tweet.mjs --verify        # print which @handle the creds belong to
 *   TWEET_FORCE=blog node tools/post-tweet.mjs
 *
 * Env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (posting);
 *      ANTHROPIC_API_KEY, TWEET_MODEL (AI copy); TWEET_FORCE, TWEET_RELEASE_WINDOW_H.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectContent } from './twitter/select-content.mjs'
import { compose, tweetLength } from './twitter/compose.mjs'
import { renderCard } from './twitter/render-card.mjs'
import { hasCredentials, verifyCredentials, uploadMedia, postTweet } from './twitter/x-client.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', '.tweet-out')

const POST = process.argv.includes('--post')
const VERIFY = process.argv.includes('--verify')

async function main() {
  if (VERIFY) {
    if (!hasCredentials()) {
      console.error('Missing X credentials. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.')
      process.exit(1)
    }
    const me = await verifyCredentials()
    console.log(`Credentials OK. Authenticated as @${me.username} (${me.name}, id ${me.id}).`)
    if (me.username?.toLowerCase() !== 'svgrid') console.warn(`WARNING: expected @svgrid but got @${me.username}.`)
    return
  }

  const topic = await selectContent()
  if (!topic) { console.log('Nothing to tweet today. Exiting.'); return }
  console.log(`Topic: ${topic.type}${topic.slug ? ` (${topic.slug})` : ''}${topic.version ? ` (${topic.pkg} ${topic.version})` : ''}`)

  const { text, replyText, card, image } = await compose(topic)
  console.log('\n--- Tweet (main) ---')
  console.log(text)
  console.log(`--- ${tweetLength(text)}/280 chars ---`)
  console.log('\n--- Reply (link) ---')
  console.log(replyText)

  // Media: prefer the blog post's own hero image; otherwise render a card.
  let media // { buffer, mime }
  if (image?.path) {
    media = { buffer: readFileSync(image.path), mime: image.mime }
    console.log(`\nMedia: blog hero image ${image.url} (${(media.buffer.length / 1024).toFixed(0)} KB)`)
  } else {
    media = { buffer: await renderCard(card), mime: 'image/png' }
    console.log(`\nMedia: rendered card (${(media.buffer.length / 1024).toFixed(0)} KB)`)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, media.mime === 'image/jpeg' ? 'media.jpg' : 'media.png')
  writeFileSync(outPath, media.buffer)
  console.log(`Saved preview -> ${outPath}`)

  if (!POST) { console.log('\nDRY RUN - nothing posted. Re-run with --post to publish.'); return }
  if (!hasCredentials()) {
    console.error('\n--post given but X credentials are missing.')
    process.exit(1)
  }

  console.log('\nUploading media...')
  const mediaId = await uploadMedia(media.buffer, media.mime)
  const id = await postTweet(text, { mediaId })
  console.log(`Posted: https://x.com/i/web/status/${id}`)
  if (replyText) {
    const replyId = await postTweet(replyText, { replyToId: id })
    console.log(`Reply:  https://x.com/i/web/status/${replyId}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
