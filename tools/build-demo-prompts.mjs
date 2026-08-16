#!/usr/bin/env node
/**
 * Generate one `prompt.md` sidecar per gallery demo under
 * `examples/src/demos/prompts/<demo-id>.md`. Each sidecar:
 *
 *   - Says what the demo PROVES (the one-line pitch from the demo's
 *     leading comment block).
 *   - Lists the imports + features registered.
 *   - Shows the column shape (field, header, editorType, width).
 *   - Lists the SvGridApi methods the demo calls.
 *   - Links back to the source path.
 *
 * Used as few-shot fodder for code-gen agents: drop the matching
 * prompt.md into your context window and the model writes idiomatic
 * sv-grid code that mirrors the demo's pattern.
 *
 * Run from repo root: `node tools/build-demo-prompts.mjs`.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const DEMOS_DIR   = join(process.cwd(), 'examples', 'src', 'demos')
const PROMPTS_DIR = join(DEMOS_DIR, 'prompts')

/**
 * Pull the leading `/** ... *\/` comment from a demo file (it's the
 * "what does this prove" pitch). Cheap regex; demos all follow the
 * same convention.
 */
function leadingComment(src) {
  const m = src.match(/\/\*\*\s*([\s\S]*?)\s*\*\//)
  if (!m) return ''
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
}

function imports(src) {
  return [...src.matchAll(/^import\s+(?:\{[\s\S]*?\}|[^;]+)\s+from\s+['"]([^'"]+)['"]/gm)]
    .map((m) => m[1])
    .filter((p, i, a) => a.indexOf(p) === i)
}

function featureRegistry(src) {
  const m = src.match(/tableFeatures\(\s*\{\s*([^}]+)\s*\}/)
  if (!m) return []
  return m[1].split(',').map((s) => s.trim()).filter(Boolean)
}

function columnShape(src) {
  // Pull a representative columns array. We look for the first
  // `field:` / `header:` chain so the consumer can see the typical
  // column shape this demo uses.
  const m = src.match(/columns\s*:\s*\[([\s\S]*?)\]/)
  if (!m) return ''
  // Keep up to 1.5kB of column text (enough for ~7 columns).
  const body = m[1].slice(0, 1500)
  return body.trim()
}

function apiCalls(src) {
  return [...src.matchAll(/\bapi[\.?]\.?([a-zA-Z]+)\(/g)]
    .map((m) => m[1])
    .filter((m) => /^[a-z]/.test(m))   // strip class names like Constructor
    .filter((p, i, a) => a.indexOf(p) === i)
    .sort()
}

async function main() {
  await mkdir(PROMPTS_DIR, { recursive: true })
  const files = (await readdir(DEMOS_DIR))
    .filter((f) => /^\d{2}-.*\.svelte$/.test(f))
    .sort()

  for (const f of files) {
    const id = f.replace(/\.svelte$/, '')
    const src = await readFile(join(DEMOS_DIR, f), 'utf-8')
    const pitch = leadingComment(src) || '(No leading comment yet.)'
    const deps  = imports(src)
    const feats = featureRegistry(src)
    const cols  = columnShape(src)
    const calls = apiCalls(src)

    const out = [
      `# Prompt: ${id}`,
      '',
      `Source: \`examples/src/demos/${f}\``,
      `Live:   https://svgrid.com/demos/${id}/`,
      '',
      '## What this demo proves',
      '',
      pitch,
      '',
      '## Imports',
      '',
      '```ts',
      ...deps.map((d) => `import {…} from '${d}'`),
      '```',
      '',
    ]

    if (feats.length > 0) {
      out.push('## Registered features', '', '```ts',
        `const features = tableFeatures({`,
        ...feats.map((s) => `  ${s},`),
        `})`, '```', '')
    }

    if (cols) {
      out.push('## Column shape', '',
        'A representative column array from this demo (truncated):',
        '', '```ts', `const columns = [`, cols, `]`, '```', '')
    }

    if (calls.length > 0) {
      out.push('## SvGridApi methods called', '',
        calls.map((m) => `- \`api.${m}(...)\``).join('\n'), '')
    }

    out.push('## How to use this prompt',
      '',
      'Drop this file into your LLM\'s context window when asking it to',
      'generate code matching this pattern. The MCP server exposes the',
      'same content via the `listDemos` tool. See',
      '[LLM grounding](../../../docs/help/llm-grounding.md) for details.',
      '')

    await writeFile(join(PROMPTS_DIR, `${id}.md`), out.join('\n'), 'utf-8')
  }
  process.stdout.write(`build-demo-prompts: wrote ${files.length} sidecars to examples/src/demos/prompts/\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
