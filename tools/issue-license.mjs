#!/usr/bin/env node
// Issue a @svgrid/enterprise license file for a paying customer.
//
// Produces two artifacts in tools/licenses/ (gitignored):
//   - sv-grid-license-<slug>.ts   — email this to the customer
//   - audit.jsonl                 — append-only audit log of every issued key
//
// The audit log is your only record of what you've sold, and tools/licenses/ is
// gitignored - nothing in this repo protects it. Back it up off-machine after
// every issuance, e.g.:
//
//   git -C tools/licenses add -A && git -C tools/licenses commit -m "issue: <tenant>"
//   git -C tools/licenses push                 # a PRIVATE remote, never this repo
//
// (Initialise once with: git -C tools/licenses init && git -C tools/licenses
// remote add origin <private-url>.) A cloud-synced folder works too; the only
// unacceptable state is a single un-backed-up copy on one laptop. Losing it
// means losing the ability to answer "who bought what, and has it expired".
//
// Usage:
//   node tools/issue-license.mjs --tenant "ACME Corp" --seats 5 --expires 2027-05
//   node tools/issue-license.mjs --help

import { randomBytes } from 'node:crypto'
import { mkdirSync, existsSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT_DIR = join(__dirname, 'licenses')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      args.help = true
      continue
    }
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    let key, val
    if (eq !== -1) {
      key = a.slice(2, eq)
      val = a.slice(eq + 1)
    } else {
      key = a.slice(2)
      val = argv[i + 1]
      i++
    }
    args[key] = val
  }
  return args
}

function usage() {
  process.stdout.write(`
@svgrid/enterprise license issuer

Usage:
  node tools/issue-license.mjs --tenant <NAME> --seats <N> --expires <YYYY-MM>

Required:
  --tenant   Customer / company name (free text — used in the file header
             and slugified into the key)
  --seats    Number of developer seats (positive integer)
  --expires  Expiry, either YYYY-MM (end of that month, for subscriptions)
             or YYYY-MM-DD (end of that day - use this for trials, e.g. a
             30-day eval)

Optional:
  --kind     One of: prod (default), eval, dev, oss. Picks the key prefix.
              prod  - paid production key (no console notice, no watermark)
              eval  - 30-day trial (console notice on first use)
              dev   - local development / internal (console notice)
              oss   - free key for open-source projects (no notice, no watermark);
                      see https://svgrid.com/pricing#oss for the policy
  --out      Output directory. Defaults to tools/licenses/

Examples:
  node tools/issue-license.mjs --tenant "ACME Corp" --seats 5 --expires 2027-05
  node tools/issue-license.mjs --tenant Globex --seats 1 --expires 2026-06-14 --kind eval
  node tools/issue-license.mjs --tenant "github.com/foo/bar" --seats 1 --expires 2027-05 --kind oss

After issuance:
  Email tools/licenses/sv-grid-license-<slug>.ts to the customer with:
    1. Place it at src/sv-grid-license.ts in your project
    2. Add  import './sv-grid-license'  to your main.ts (or app entry)

To revoke a previously issued key:
  grep the key out of tools/licenses/audit.jsonl, then add it to
  packages/enterprise/src/revoked.ts (after running
  git update-index --skip-worktree on that file so your edits stay local).
`)
}

function slugify(name) {
  const cleaned = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 24)
  return cleaned || 'TENANT'
}

function randomSuffix(len = 6) {
  // Crockford-style alphabet — no ambiguous 0/O/I/1/L. Keys get read off
  // emails and screenshots; pick characters people won't mis-transcribe.
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

function die(msg) {
  process.stderr.write(`error: ${msg}\n\nRun with --help for usage.\n`)
  process.exit(1)
}

function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    usage()
    process.exit(0)
  }
  if (!args.tenant || !args.seats || !args.expires) {
    usage()
    process.exit(1)
  }

  const tenant = String(args.tenant).trim()
  if (!tenant) die('--tenant must not be empty')

  const slug = slugify(tenant)

  const seats = Number.parseInt(args.seats, 10)
  if (!Number.isInteger(seats) || seats < 1) {
    die(`--seats must be a positive integer (got: ${args.seats})`)
  }

  // Two widths, both understood by parseLicenseExpiry() in
  // packages/enterprise/src/license-core.ts:
  //   YYYY-MM     -> compact YYYYMM,   expires end of that month (subscriptions)
  //   YYYY-MM-DD  -> compact YYYYMMDD, expires end of that day   (trials)
  // A 30-day trial needs the day form; the month form would hand out the rest
  // of the calendar month instead.
  const expiresMatch = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(args.expires))
  if (!expiresMatch) {
    die(`--expires must be YYYY-MM or YYYY-MM-DD (got: ${args.expires})`)
  }
  const [, expYear, expMonth, expDay] = expiresMatch
  const expMonthNum = Number.parseInt(expMonth, 10)
  if (expMonthNum < 1 || expMonthNum > 12) {
    die(`--expires month must be 01-12 (got: ${expMonth})`)
  }
  if (expDay != null) {
    const dayNum = Number.parseInt(expDay, 10)
    const daysInMonth = new Date(Date.UTC(Number(expYear), expMonthNum, 0)).getUTCDate()
    if (dayNum < 1 || dayNum > daysInMonth) {
      die(`--expires day must be 01-${String(daysInMonth).padStart(2, '0')} for ${expYear}-${expMonth} (got: ${expDay})`)
    }
  }
  const expiresCompact = expYear + expMonth + (expDay ?? '')

  const kind = (args.kind ?? 'prod').toLowerCase()
  // These MUST stay in sync with VALID_PREFIX and the status checks in
  // packages/enterprise/src/license-core.ts. A key that does not start with
  // "SVENTERPRISE-" is classified 'invalid', and license.ts THROWS on it - so a
  // mismatch here does not degrade gracefully, it breaks the customer's app.
  const PREFIX = {
    prod: 'SVENTERPRISE',
    eval: 'SVENTERPRISE-EVAL',
    dev: 'SVENTERPRISE-DEV',
    oss: 'SVENTERPRISE-OSS',
  }
  if (!(kind in PREFIX)) {
    die(`--kind must be one of: prod, eval, dev, oss (got: ${args.kind})`)
  }
  const prefix = PREFIX[kind]

  const random = randomSuffix()
  const key = `${prefix}-${slug}-${seats}-${expiresCompact}-${random}`

  const issued = new Date()
  const issuedYMD = issued.toISOString().slice(0, 10)

  const outDir = args.out ? resolve(process.cwd(), args.out) : DEFAULT_OUT_DIR
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const filename = `sv-grid-license-${slug.toLowerCase()}.ts`
  const filepath = join(outDir, filename)

  const fileContent =
    `// sv-grid-license.ts\n` +
    `//\n` +
    `// Issued to: ${tenant}\n` +
    `// Kind:      ${kind}\n` +
    `// Seats:     ${seats}\n` +
    `// Issued:    ${issuedYMD}\n` +
    `// Expires:   ${args.expires}\n` +
    `// Key:       ${key}\n` +
    `//\n` +
    `// Provided by jQWidgets. Do NOT commit this file to public repositories.\n` +
    `// Contact boikom@jqwidgets.com to add seats or renew.\n` +
    `//\n` +
    `// Usage in your app:\n` +
    `//   1. Place this file at src/sv-grid-license.ts\n` +
    `//   2. Add  import './sv-grid-license'  at the top of your main.ts\n` +
    `\n` +
    `import { setLicenseKey } from '@svgrid/enterprise'\n` +
    `\n` +
    `setLicenseKey('${key}')\n`

  writeFileSync(filepath, fileContent, 'utf8')

  const auditPath = join(outDir, 'audit.jsonl')
  const auditEntry =
    JSON.stringify({
      ts: issued.toISOString(),
      key,
      tenant,
      tenantSlug: slug,
      kind,
      seats,
      expires: args.expires,
      file: filename,
    }) + '\n'
  appendFileSync(auditPath, auditEntry, 'utf8')

  process.stdout.write(`\nIssued ${kind} license for "${tenant}"\n`)
  process.stdout.write(`  Key:    ${key}\n`)
  process.stdout.write(`  Seats:  ${seats}\n`)
  process.stdout.write(`  Expires: ${args.expires}\n`)
  process.stdout.write(`  File:   ${filepath}\n`)
  process.stdout.write(`  Audit:  ${auditPath}\n\n`)
  process.stdout.write(
    `Next: email the .ts file to the customer with the instructions in its header.\n\n`,
  )
}

main()
