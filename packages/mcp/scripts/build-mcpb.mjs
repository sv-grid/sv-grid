#!/usr/bin/env node
// Builds a self-contained MCP Bundle (.mcpb) for Smithery and any desktop
// client that installs local servers with one click.
//
// The bundle has to carry its own node_modules, so it cannot be assembled from
// the pnpm workspace: the workspace copy of @svgrid/enterprise is a symlink,
// and a symlink zips into a broken bundle. Instead we stage a directory, write
// a package.json pinned to the PUBLISHED dependency versions, and run a real
// `npm install --omit=dev` inside it. That means this script requires the
// current version of @svgrid/enterprise to already be on npm.
//
// Run after `pnpm build`, since it packages dist/ as-is.

import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Drives the freshly staged server over stdio and returns its real tool list.
function readToolsFromServer(entry) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'ignore'] })
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error('server did not answer tools/list within 60s'))
    }, 60_000)
    const send = (msg) => proc.stdin.write(JSON.stringify(msg) + '\n')
    let buf = ''
    proc.on('error', reject)
    proc.stdout.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim().startsWith('{')) continue
        const msg = JSON.parse(line)
        if (msg.id === 1) {
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
        } else if (msg.id === 2) {
          clearTimeout(timer)
          proc.kill()
          resolve(msg.result.tools.map((t) => ({ name: t.name, description: t.description })))
        }
      }
    })
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'build-mcpb', version: '1' },
      },
    })
  })
}

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const repoRoot = join(pkgRoot, '..', '..')
const stage = join(pkgRoot, '.mcpb-stage')
const outDir = join(pkgRoot, 'dist-mcpb')

const pkg = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8'))

// Resolve workspace: ranges to the real published version. npm cannot install
// `workspace:^`, and a bundle that fails to install is worse than no bundle.
const deps = {}
for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
  if (!range.startsWith('workspace:')) {
    deps[name] = range
    continue
  }
  const local = join(repoRoot, 'packages', name.replace('@svgrid/', ''))
  const localPkg = JSON.parse(await readFile(join(local, 'package.json'), 'utf8'))
  deps[name] = `^${localPkg.version}`
  console.log(`  resolved ${name} ${range} -> ${deps[name]}`)
}

await rm(stage, { recursive: true, force: true })
await mkdir(join(stage, 'server'), { recursive: true })
await mkdir(outDir, { recursive: true })

await cp(join(pkgRoot, 'dist'), join(stage, 'server'), { recursive: true })
await cp(join(pkgRoot, 'README.md'), join(stage, 'README.md'))
await cp(join(pkgRoot, 'LICENSE'), join(stage, 'LICENSE'))

const icon = join(repoRoot, 'website', 'public', 'brand', 'svgrid-icon-400.png')
if (existsSync(icon)) await cp(icon, join(stage, 'icon.png'))
else console.warn('  no icon found, bundle will ship without one')

await writeFile(
  join(stage, 'package.json'),
  JSON.stringify(
    { name: pkg.name, version: pkg.version, private: true, type: 'module', dependencies: deps },
    null,
    2,
  ) + '\n',
)

console.log('  installing production dependencies into the bundle...')
execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], {
  cwd: stage,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

// Declared so clients can show the tool list before the server is ever run.
// Read off the built server rather than hand-maintained, so it cannot drift.
// tools_generated stays true: this is a hint, the server remains the authority.
const tools = await readToolsFromServer(join(stage, 'server', 'index.js'))

const manifest = {
  manifest_version: '0.3',
  name: 'svgrid',
  display_name: 'SvGrid',
  version: pkg.version,
  description: pkg.description,
  long_description:
    'Gives an AI client accurate, version-pinned APIs for SvGrid, a Svelte 5 data grid: ' +
    'real prop, method and event names, plus the source of every live demo as grounding, ' +
    'so generated code runs instead of calling invented methods. Also exposes Studio tools ' +
    'an agent can drive end to end to generate a runnable SvelteKit CRUD app.',
  author: { name: 'jQWidgets', email: 'sales@jqwidgets.com', url: 'https://svgrid.com' },
  repository: { type: 'git', url: 'https://github.com/sv-grid/sv-grid.git' },
  homepage: 'https://svgrid.com',
  documentation: 'https://svgrid.com/docs/help/mcp-server/',
  icon: 'icon.png',
  compatibility: {
    platforms: ['darwin', 'win32', 'linux'],
    runtimes: { node: '>=18.0.0' },
  },
  server: {
    type: 'node',
    entry_point: 'server/index.js',
    mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'] },
  },
  tools,
  tools_generated: true,
}

await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

execFileSync('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'validate', join(stage, 'manifest.json')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

const out = join(outDir, `svgrid-${pkg.version}.mcpb`)
execFileSync('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'pack', stage, out], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

await rm(stage, { recursive: true, force: true })
const { size } = await stat(out)
console.log(`\n  ${out}`)
console.log(`  ${(size / 1024 / 1024).toFixed(1)} MB, ${tools.length} tools declared`)
