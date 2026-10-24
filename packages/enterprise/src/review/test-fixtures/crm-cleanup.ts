/**
 * Seeded fixture: a cleanup agent's proposals over a synthetic CRM, 2,000 of
 * them, with 40 (2%) deliberately wrong. The dirt is the kind real CRM
 * exports carry: padded names, shouting contacts, mixed-case emails, phone
 * formats, "Inc." vs "Inc", country spellings, blank regions, revenue in
 * cents, day-first dates. The wrong proposals are the one-off mistakes an
 * agent makes: a digit typo, a wrong domain, a low-confidence wrong fill, a
 * wrong country, a revenue off by an odd factor.
 *
 * Deterministic: same seed, same proposals, so group counts can be asserted.
 */
import type { Proposal, ProposalSource } from '../types'

export const CLEANUP_SOURCE: ProposalSource = { kind: 'agent', id: 'cleanup-agent', label: 'Cleanup agent' }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['john', 'maria', 'wei', 'aisha', 'carlos', 'emma', 'liam', 'sofia', 'noah', 'yuki', 'omar', 'lena']
const LAST = ['smith', 'garcia', 'chen', 'khan', 'silva', 'mueller', 'rossi', 'novak', 'tanaka', 'okafor', 'dubois', 'berg']
const WORDS = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Wonka', 'Tyrell', 'Cyberdyne', 'Soylent', 'Aperture', 'Oscorp', 'Gringotts']
const SUFFIX = ['Corp', 'Group', 'Labs', 'Systems', 'Partners', 'Holdings']
const US_SPELLINGS = ['usa', 'USA.', 'U.S.', 'United States of America', 'US', 'U.S.A.']

export function crmCleanupFixture(seed = 20261024): { proposals: Proposal[]; wrongIds: Set<string> } {
  const r = rng(seed)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
  const proposals: Proposal[] = []
  const wrongIds = new Set<string>()
  let n = 0
  const add = (field: string, before: unknown, after: unknown, extra: Partial<Proposal> = {}, wrong = false) => {
    const id = `p${++n}`
    proposals.push({
      id, op: 'update', rowId: `r${int(1, 5000)}`, field, before, after,
      source: CLEANUP_SOURCE, createdAt: 0, status: 'pending', ...extra,
    })
    if (wrong) wrongIds.add(id)
  }
  const company = () => `${pick(WORDS)}${pick(['', ' ' + pick(WORDS)])} ${pick(SUFFIX)}`
  const person = () => `${pick(FIRST)} ${pick(LAST)}`
  const title = (s: string) => s.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())
  const phone = (): [number, number, number] => [int(200, 999), int(200, 999), int(1000, 9999)]

  // Correct cleanups: 1,960.
  for (let i = 0; i < 250; i++) { const c = company(); add('company', pick([`  ${c}`, `${c}  `, ` ${c} `, c.replace(' ', '   ')]), c) }
  for (let i = 0; i < 120; i++) { const c = `${pick(WORDS)} Inc`; add('company', `${c}.`, c) }
  for (let i = 0; i < 200; i++) { const p = person(); add('contact', p.toUpperCase(), title(p)) }
  for (let i = 0; i < 200; i++) { const p = person().replace(' ', '.'); const d = pick(WORDS).toLowerCase(); add('email', `${title(p)}@${title(d)}.COM`, `${p}@${d}.com`) }
  for (let i = 0; i < 250; i++) { const [a, b, c] = phone(); add('phone', `(${a}) ${b}-${c}`, `${a}-${b}-${c}`) }
  for (let i = 0; i < 100; i++) { const [a, b, c] = phone(); add('phone', `${a}.${b}.${c}`, `${a}-${b}-${c}`) }
  for (let i = 0; i < 150; i++) add('country', pick(US_SPELLINGS), 'United States')
  for (let i = 0; i < 200; i++) add('region', '', pick(['EMEA', 'AMER', 'APAC']), { confidence: 0.75 + r() * 0.25 })
  for (let i = 0; i < 150; i++) { const units = int(1000, 900000); add('revenue', units * 100, units) }
  for (let i = 0; i < 150; i++) {
    const d = int(1, 28), m = int(1, 12), y = int(2019, 2025)
    add('signupDate', `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`, `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  for (let i = 0; i < 80; i++) { const s = pick(['active', 'churned', 'trial', 'paused']); add('status', s, title(s)) }
  for (let i = 0; i < 110; i++) add('notes', `call back re ${pick(WORDS)} ${int(1, 99)}`, `Follow up: ${pick(WORDS)} renewal (${int(1, 99)})`)

  // Deliberately wrong: 40.
  for (let i = 0; i < 10; i++) { const [a, b, c] = phone(); add('phone', `(${a}) ${b}-${c}`, `${a}-${b}-${c === 9999 ? 1000 : c + 1}`, {}, true) }
  for (let i = 0; i < 8; i++) { const p = person().replace(' ', '.'); const d = pick(WORDS).toLowerCase(); add('email', `${title(p)}@${title(d)}.COM`, `${p}@${d}.co`, {}, true) }
  for (let i = 0; i < 8; i++) add('region', '', pick(['EMEA', 'AMER', 'APAC']), { confidence: 0.3 + r() * 0.25 }, true)
  for (let i = 0; i < 6; i++) add('country', pick(US_SPELLINGS), 'Canada', {}, true)
  for (let i = 0; i < 8; i++) { const units = int(1000, 900000); add('revenue', units * 100, Math.round(units * 100 * (0.003 + r() * 0.5))) }
  for (const p of proposals.slice(-8)) wrongIds.add(p.id)

  return { proposals, wrongIds }
}
