#!/usr/bin/env node
/**
 * Draws the "tables and links" diagram of each SvGrid Base template in
 * docs/help/base/templates.md, as SVG in website/public/docs-media/.
 *
 *   node tools/base-template-diagrams.mjs
 *
 * Each template is described below by its tables, their fields and which
 * fields link where; the layout (cards side by side, a line from a link
 * field to the table it points at) and the light and dark colors are the
 * same for all, so the diagrams match each other and the other docs art.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'website', 'public', 'docs-media')

// field: [name, type label, link target table index or undefined, many?]
const TEMPLATES = {
  'bug-tracker': {
    title: 'Bug tracker',
    tables: [
      { name: 'Bugs', fields: [['Bug', 'text'], ['Severity', 'select'], ['Status', 'select'], ['Fix', 'button'], ['Areas', 'multiple select'], ['Assignee', 'person'], ['Release', 'link', 1], ['Reported', 'date'], ['Fixed on', 'date'], ['Steps to reproduce', 'long text']] },
      { name: 'Releases', fields: [['Version', 'text'], ['Ships', 'date'], ['Bugs', 'link', 0, true], ['Bug count', 'count'], ['Notes', 'long text']] },
    ],
  },
  'event-planning': {
    title: 'Event planning',
    tables: [
      { name: 'Attendees', fields: [['Name', 'text'], ['Event', 'link', 1], ['Ticket', 'select'], ['Email', 'email'], ['Company', 'text'], ['Checked in', 'checkbox']] },
      { name: 'Events', fields: [['Event', 'text'], ['Date', 'date'], ['Status', 'select'], ['Budget', 'currency'], ['Capacity', 'number'], ['Attendees', 'link', 0, true], ['Registered', 'count'], ['Seats left', 'formula'], ['Checklist', 'link', 2, true]] },
      { name: 'Checklist', fields: [['Item', 'text'], ['Event', 'link', 1], ['Team', 'select'], ['Due', 'date'], ['Done', 'checkbox']] },
    ],
  },
  okrs: {
    title: 'OKRs',
    tables: [
      { name: 'Key results', fields: [['Key result', 'text'], ['Objective', 'link', 1], ['Progress', 'formula'], ['Confidence', 'select'], ['Start', 'number'], ['Current', 'number'], ['Target', 'number'], ['Checked in', 'date']] },
      { name: 'Objectives', fields: [['Objective', 'text'], ['Quarter', 'select'], ['Owner', 'person'], ['Key results', 'link', 0, true], ['Progress', 'rollup (average)']] },
    ],
  },
  expenses: {
    title: 'Expense approvals',
    tables: [
      { name: 'Expenses', fields: [['Expense', 'text'], ['Amount', 'currency'], ['Category', 'link', 1], ['Status', 'select'], ['Review', 'button'], ['Date', 'date'], ['Spent by', 'person'], ['Receipt', 'attachment'], ['Approved by', 'person']] },
      { name: 'Budgets', fields: [['Category', 'text'], ['Monthly budget', 'currency'], ['Expenses', 'link', 0, true], ['Spent', 'rollup (sum)'], ['Left', 'formula']] },
    ],
  },
  onboarding: {
    title: 'Employee onboarding',
    tables: [
      { name: 'Checklist', fields: [['Item', 'text'], ['Person', 'link', 1], ['Owner', 'select'], ['Due', 'date'], ['Done', 'checkbox']] },
      { name: 'People', fields: [['Name', 'text'], ['Photo', 'attachment'], ['Status', 'select'], ['Ready', 'button'], ['Role', 'text'], ['Department', 'link', 2], ['Start date', 'date'], ['Manager', 'person'], ['Checklist', 'link', 0, true]] },
      { name: 'Departments', fields: [['Department', 'text'], ['Head', 'person'], ['People', 'link', 1, true], ['Headcount', 'count']] },
    ],
  },
}

const W = 880
const CARD_W = 220
const ROW = 22
const HEAD = 34
const TOP = 84

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function draw(id, t) {
  const n = t.tables.length
  const gap = (W - 56 - n * CARD_W) / Math.max(1, n - 1)
  const xOf = (i) => (n === 1 ? (W - CARD_W) / 2 : 28 + i * (CARD_W + gap))
  const height = TOP + HEAD + Math.max(...t.tables.map((x) => x.fields.length)) * ROW + 40
  const parts = []
  const lines = []
  t.tables.forEach((table, i) => {
    const x = xOf(i)
    const h = HEAD + table.fields.length * ROW + 8
    parts.push(`<rect x="${x}" y="${TOP}" width="${CARD_W}" height="${h}" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>`)
    parts.push(`<rect x="${x}" y="${TOP}" width="${CARD_W}" height="${HEAD - 4}" rx="10" fill="#eff4ff"/><rect x="${x}" y="${TOP + HEAD - 14}" width="${CARD_W}" height="10" fill="#eff4ff"/>`)
    parts.push(`<text x="${x + 14}" y="${TOP + 20}" font-size="13" font-weight="700" fill="#1d4ed8">${esc(table.name)}</text>`)
    table.fields.forEach(([name, type, target, many], j) => {
      const y = TOP + HEAD + j * ROW + 14
      const isLink = target !== undefined
      parts.push(`<text x="${x + 14}" y="${y}" font-size="11.5" fill="${isLink ? '#c2410c' : '#0f172a'}" font-weight="${j === 0 || isLink ? 700 : 400}">${esc(name)}</text>`)
      parts.push(`<text x="${x + CARD_W - 12}" y="${y}" font-size="10.5" fill="#64748b" text-anchor="end">${esc(isLink ? (many ? 'link to many' : 'link to one') : type)}</text>`)
      if (isLink && target > i) {
        // A line from this link field to the table it points at, to the right.
        const x1 = x + CARD_W
        const x2 = xOf(target)
        const y2 = TOP + HEAD / 2 - 2
        lines.push(`<path d="M${x1} ${y - 4} C ${x1 + gap / 2} ${y - 4}, ${x2 - gap / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="#c2410c" stroke-width="1.4" stroke-opacity="0.7" marker-end="url(#bt-${id}-arr)"/>`)
      }
      if (isLink && target < i) {
        const x1 = x
        const x2 = xOf(target) + CARD_W
        const y2 = TOP + HEAD / 2 - 2
        lines.push(`<path d="M${x1} ${y - 4} C ${x1 - gap / 2} ${y - 4}, ${x2 + gap / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="#c2410c" stroke-width="1.4" stroke-opacity="0.7" stroke-dasharray="4 3" marker-end="url(#bt-${id}-arr)"/>`)
      }
    })
  })
  const label = `${t.title}: ${t.tables.map((x) => `${x.name} (${x.fields.map((f) => f[0]).join(', ')})`).join('; ')}. Orange fields link to the table the line points at; the dashed line is the field that links back.`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="${esc(label)}">
<style>
@media (prefers-color-scheme: dark) {
  [fill="#ffffff"] { fill: #0d1526; }
  [fill="#f8fafc"] { fill: #141d33; }
  [fill="#eff4ff"] { fill: #12233f; }
  [fill="#0f172a"] { fill: #e6eaf2; }
  [fill="#64748b"] { fill: #97a3b6; }
  [fill="#1d4ed8"] { fill: #93b4ff; }
  [fill="#c2410c"] { fill: #fdba74; }
  [stroke="#c2410c"] { stroke: #fdba74; }
  [stroke="#e2e8f0"] { stroke: #2b3654; }
}
</style>
  <defs><marker id="bt-${id}-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#c2410c"/></marker></defs>
  <rect x="0" y="0" width="${W}" height="${height}" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="28" y="40" font-size="17" font-weight="700" fill="#0f172a">${esc(t.title)}: tables and links</text>
  <text x="28" y="61" font-size="12.5" fill="#64748b">Orange fields link to another table; the dashed line is the field there that links back.</text>
  ${lines.join('\n  ')}
  ${parts.join('\n  ')}
</svg>
`
}

for (const [id, t] of Object.entries(TEMPLATES)) {
  const file = join(OUT, `base-template-${id}.svg`)
  writeFileSync(file, draw(id, t))
  console.log('wrote', file)
}
