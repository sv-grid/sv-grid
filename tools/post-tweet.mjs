#!/usr/bin/env node
/**
 * Automated Twitter/X posting for svgrid.com.
 *
 * Each run decides what to tweet (a new release, the blog post that went live
 * today, a curated feature highlight, or an AI-generated original), composes
 * the copy, renders a branded card image, and posts it to the @svgrid account.
 *
 * Usage:
 *   node tools/post-tweet.mjs                 # DRY RUN: print the tweet, save the
 *                                             #   card PNG, post nothing.
 *   node tools/post-tweet.mjs --post          # actually post to X (needs creds).
 *   TWEET_FORCE=highlight node tools/post-tweet.mjs
 *                                             # force a specific type: release |
 *                                             #   blog | highlight | ai.
 *
 * Env:
 *   Posting (required only with --post):
 *     X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *   AI copy (optional; templates are used if absent):
 *     ANTHROPIC_API_KEY, TWEET_MODEL (default claude-sonnet-4-6)
 *   Behaviour:
 *     TWEET_FORCE           - pin the topic type (see above)
 *     TWEET_RELEASE_WINDOW_H - hours a release counts as "recent" (default 26)
 *
 * The card PNG is always written to the scratch path below so a dry run (and CI
 * artifacts) can show exactly what would go out.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectContent } from './twitter/select-content.mjs'
import { compose, tweetLength } from './twitter/compose.mjs'
import { renderCard } from './twitter/render-card.mjs'
import { hasCredentials, verifyCredentials, uploadMedia, postTweet } from './twitter/x-client.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', '.tweet-out')
const CARD_PATH = join(OUT_DIR, 'card.png')

const POST = process.argv.includes('--post')
const VERIFY = process.argv.includes('--verify')

async function main() {
  // --verify: confirm the credentials and which handle they belong to, then
  // exit. Posts nothing. Run this before the first live tweet.
  if (VERIFY) {
    if (!hasCredentials()) {
      console.error('Missing X credentials. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.')
      process.exit(1)
    }
    const me = await verifyCredentials()
    console.log(`Credentials OK. Authenticated as @${me.username} (${me.name}, id ${me.id}).`)
    if (me.username?.toLowerCase() !== 'svgrid') {
      console.warn(`WARNING: expected @svgrid but got @${me.username}. Tweets would post to the wrong account.`)
    }
    return
  }

  const topic = await selectContent()
  if (!topic) {
    console.log('Nothing to tweet today (forced type produced no match). Exiting.')
    return
  }
  console.log(`Topic: ${topic.type}${topic.slug ? ` (${topic.slug})` : ''}${topic.version ? ` (${topic.pkg} ${topic.version})` : ''}`)

  const { text, replyText, card } = await compose(topic)
  console.log('\n--- Tweet (main) ---')
  console.log(text)
  console.log(`--- ${tweetLength(text)}/280 chars ---`)
  console.log('\n--- Reply (link) ---')
  console.log(replyText)
  console.log(`--- ${tweetLength(replyText)}/280 chars ---\n`)

  const png = await renderCard(card)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(CARD_PATH, png)
  console.log(`Card written to ${CARD_PATH} (${(png.length / 1024).toFixed(0)} KB)`)

  if (!POST) {
    console.log('\nDRY RUN - nothing posted. Re-run with --post to publish.')
    return
  }

  if (!hasCredentials()) {
    console.error('\n--post given but X credentials are missing. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.')
    process.exit(1)
  }

  console.log('\nUploading card...')
  const mediaId = await uploadMedia(png)
  console.log(`media_id: ${mediaId}`)

  // Main tweet: card image + copy, no link (avoids the per-link charge + the
  // link-in-body reach penalty).
  const id = await postTweet(text, { mediaId })
  console.log(`Posted: https://x.com/i/web/status/${id}`)

  // First reply carries the link.
  if (replyText) {
    const replyId = await postTweet(replyText, { replyToId: id })
    console.log(`Reply:  https://x.com/i/web/status/${replyId}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
