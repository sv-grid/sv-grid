/**
 * The MCP tool names skills/svgrid/SKILL.md tells a model to call, per server.
 *
 * The Skill's grounding table has one column for the npm server and one for
 * the hosted one. tools/mcp-tools.test.ts and tools/mcp-worker.test.ts check
 * each column against that server's tools/list: a client can only call a
 * listed tool, so a name that is not listed sends the model nowhere.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** @returns {{ npm: string[], hosted: string[] }} */
export function skillToolNames() {
  const skill = readFileSync(join(ROOT, 'skills', 'svgrid', 'SKILL.md'), 'utf8')
  const rows = skill.split(/\r?\n/).filter((l) => /^\|[^|]+\|\s*`[a-z_]+`\s*\|\s*`[a-z_]+`\s*\|\s*$/.test(l))
  const cell = (l, i) => /`([a-z_]+)`/.exec(l.split('|')[i])[1]
  return { npm: rows.map((l) => cell(l, 2)), hosted: rows.map((l) => cell(l, 3)) }
}
