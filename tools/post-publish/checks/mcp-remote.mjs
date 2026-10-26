/**
 * The hosted MCP server at mcp.svgrid.com, the one the Claude Code plugin
 * installs. It is deployed separately from npm, and on 2026-10-26 it was still
 * checking code against @svgrid/grid 3.0.22 a release after 3.0.23 shipped,
 * with tool names the plugin's own Skill did not use. Nothing noticed, because
 * every other check runs the npm package.
 */
export const name = 'mcp-remote'
export const description = 'mcp.svgrid.com serves the published grid version and the tool names the Skill uses'

const URL = 'https://mcp.svgrid.com/mcp'
/** What skills/svgrid/SKILL.md tells a model to call on the hosted server. */
const SKILL_TOOLS = ['search', 'fetch', 'svgrid_check_code']

async function rpc(method, params = {}) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(`${method}: ${body.error.message}`)
  return body.result
}

export async function run(ctx) {
  const grid = ctx.versions.grid

  await ctx.step(`checks against @svgrid/grid@${grid}`, async () => {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'post-publish', version: '1' } })
    if (init.serverInfo?.version !== grid) {
      throw new Error(`serverInfo.version is ${init.serverInfo?.version}; npm has ${grid}. Deploy workers/svgrid-mcp (pnpm run deploy).`)
    }
    if (!/svgrid_check_code/.test(init.instructions ?? '')) throw new Error('initialize sends no instructions naming svgrid_check_code')
    return `serverInfo ${init.serverInfo.version}`
  })

  await ctx.step('lists the tools the Skill names', async () => {
    const { tools } = await rpc('tools/list')
    const names = tools.map((t) => t.name)
    const missing = SKILL_TOOLS.filter((n) => !names.includes(n))
    if (missing.length) throw new Error(`not listed: ${missing.join(', ')} (listed: ${names.join(', ')})`)
    return names.join(', ')
  })

  await ctx.step('compiles and returns a fixed copy', async () => {
    const source = "<script>\n  import { SvGrid } from '@svgrid/grid'\n  let columns = [{ key: 'a' }]\n</script>\n<SvGrid data={[]} {columns} />\n"
    const result = await rpc('tools/call', { name: 'svgrid_check_code', arguments: { source } })
    const body = JSON.parse(result.content[0].text)
    if (body.compiler !== 'svelte') throw new Error(`compiler: ${body.compiler} (COMPILE is off, or the bundled svelte failed to load)`)
    if (!body.fixed?.includes("field: 'a'")) throw new Error('no fixed copy with key -> field')
    return `checkedAgainst ${body.checkedAgainst}`
  })
}
