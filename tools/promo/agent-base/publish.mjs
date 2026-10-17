#!/usr/bin/env node
/**
 * Upload "An AI agent and your team, one table" to YouTube.
 *
 *   node --env-file=.env tools/promo/agent-base/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/agent-base/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/agent-base/youtube.json, and
 * refuses to upload twice.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'agent-base')
const { speed } = JSON.parse(readFileSync(join(DIR, 'timeline.json'), 'utf8'))

const meta = {
  title: 'An AI agent and your team, one table: Claude Code, Supabase and SvGrid Base',
  description: [
    'AI agents now edit the same data your team works in. When one changes a table, what did it touch, what was there before, and who checks it?',
    '',
    'Zazo shows SvGrid Base on a support inbox in a real Supabase project. Claude Code, connected through the Supabase MCP server, triages ten tickets with one SQL UPDATE each. The base hears every write through Supabase Realtime: the cells the agent changed are tinted until someone opens the record, the view bar counts them, and each record\'s activity names the agent and shows what every field held before.',
    '',
    'Then a person takes over: opens a ticket, changes the priority (written to the same table under their own name), and approves the rest from a Needs review view with one click.',
    '',
    `Nothing is staged: a real Claude Code run (headless, Supabase MCP server, execute_sql only) on a real Supabase project, and the review in the same page afterwards. The agent part is sped up ${speed.toFixed(1)}x.`,
    '',
    'SvGrid Base is part of SvGrid Suite. Try it free: npm i @svgrid/grid @svgrid/enterprise',
    'Docs: https://svgrid.com/docs/help/base/data/',
    '',
    '#svelte #sveltejs #supabase #claudecode #aiagents #mcp #webdev #javascript',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'svgrid base', 'svelte', 'supabase', 'claude code', 'ai agent', 'mcp', 'supabase mcp', 'human in the loop', 'svelte 5', 'programming'],
  categoryId: '28',
  privacyStatus: 'public',
}

console.log(`title:   ${meta.title} (${meta.title.length} chars)`)
console.log(`description:\n${meta.description.split('\n').map((l) => '  ' + l).join('\n')}`)
if (!process.argv.includes('--post')) {
  console.log('\n[dry run] pass --post to upload')
  process.exit(0)
}
if (existsSync(join(DIR, 'youtube.json'))) throw new Error('already uploaded (youtube.json exists)')
if (!hasCredentials()) throw new Error('YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are required')

const yt = createClient()
process.stdout.write('uploading ...')
const id = await yt.uploadVideo(readFileSync(join(DIR, 'agent-base.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nvideo: https://www.youtube.com/watch?v=${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/watch?v=${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
