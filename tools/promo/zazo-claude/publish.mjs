#!/usr/bin/env node
/**
 * Upload "You're absolutely right" (Zazo, Claude and SvGrid) to YouTube as a Short.
 *
 *   node --env-file=.env tools/promo/zazo-claude/publish.mjs           DRY RUN
 *   node --env-file=.env tools/promo/zazo-claude/publish.mjs --post    upload, public
 *
 * Writes the video id to marketing/videos/zazo-claude/youtube.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, hasCredentials } from '../../tutorials/lib/youtube-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = join(ROOT, 'marketing', 'videos', 'zazo-claude')

const meta = {
  title: "\"You're absolutely right!\" Claude, a 2,040-line table, and the SvGrid MCP #shorts",
  description: [
    'Zazo asks Claude for a simple orders table and gets a 2,040-line enterprise-grade table framework, plugin system included. It doesn\'t sort. "You\'re absolutely right!"',
    '',
    'Then he gives it the SvGrid MCP server. Claude reads the docs, checks its own component with svgrid_check_code (the check catches a real mistake: `type` is not a column key, use cellDataType), and writes 13 lines that sort, filter and page.',
    '',
    'The chat is a cartoon. The check message and the footage at the end are real: that 13-line file running in a Vite + Svelte 5 app on the published @svgrid/grid.',
    '',
    'claude mcp add svgrid -- npx -y @svgrid/mcp',
    'MCP server: https://svgrid.com/mcp/',
    'Docs: https://svgrid.com/docs/',
    '',
    '#claude #claudecode #svelte #sveltejs #mcp #aicoding #programming #devhumor',
  ].join('\n').replace(/[<>]/g, ''),
  tags: ['svgrid', 'claude', 'claude code', 'mcp', 'model context protocol', 'ai coding', 'svelte', 'svelte 5', 'svelte data grid', 'data table', 'programming humor', 'shorts'],
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
const id = await yt.uploadVideo(readFileSync(join(DIR, 'zazo-claude.mp4')), meta, { onProgress: (d, t) => process.stdout.write(` ${Math.round((d / t) * 100)}%`) })
console.log(`\nshort: https://www.youtube.com/shorts/${id}`)
writeFileSync(join(DIR, 'youtube.json'), JSON.stringify({ id, url: `https://www.youtube.com/shorts/${id}`, publishedAt: new Date().toISOString().slice(0, 10), ...meta }, null, 2) + '\n')
