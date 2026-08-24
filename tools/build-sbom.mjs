/**
 * Emit a CycloneDX 1.6 SBOM for every publishable package into `sbom/`.
 *
 * Why hand-rolled rather than cdxgen: the shipped packages declare zero runtime
 * dependencies, so the component graph is small enough to build exactly right,
 * and a generic scanner run from a pnpm workspace pulls in devDependencies and
 * names the component after its directory ("grid") instead of its package
 * ("@svgrid/grid"). Both are wrong in an artefact a buyer's security team reads.
 *
 * Scope: the DEPENDENCY graph of what we publish - runtime `dependencies` plus
 * `peerDependencies` (marked optional when `peerDependenciesMeta` says so).
 * Dev tooling is deliberately excluded: it is not present in the installed
 * package and listing it would overstate the attack surface.
 *
 * The EU Cyber Resilience Act (Regulation (EU) 2024/2847) requires an SBOM
 * covering at least top-level dependencies, machine-readable. This goes to full
 * declared depth, which is trivial here because that depth is mostly zero.
 *
 * Usage:
 *   node tools/build-sbom.mjs            # write sbom/*.cdx.json
 *   node tools/build-sbom.mjs --check    # verify only, non-zero exit on drift
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_DIR = join(ROOT, 'packages')
const OUT_DIR = join(ROOT, 'sbom')
const CHECK_ONLY = process.argv.includes('--check')

/** npm scopes must be percent-encoded in a purl: @svgrid/grid -> %40svgrid/grid */
const purlFor = (name, version) => `pkg:npm/${name.replace('@', '%40')}@${version}`

/**
 * CycloneDX wants an SPDX id when there is one and a free-text name otherwise.
 * "SEE LICENSE IN <file>" is valid npm but is not an SPDX identifier, so it has
 * to go in `name` - emitting it as `id` produces a document that fails schema
 * validation on any strict consumer.
 */
function licenseEntry(license) {
  if (!license) return []
  if (/^SEE LICENSE IN /i.test(license)) {
    return [{ license: { name: license } }]
  }
  return [{ license: { id: license } }]
}

function componentFor(name, version, opts = {}) {
  const c = {
    type: 'library',
    'bom-ref': purlFor(name, version),
    name,
    version,
    purl: purlFor(name, version),
    scope: opts.optional ? 'optional' : 'required',
  }
  if (opts.license) c.licenses = licenseEntry(opts.license)
  if (opts.description) c.description = opts.description
  return c
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(PKG_DIR, dir, 'package.json'), 'utf8'))
}

/**
 * A stable serial number. CycloneDX wants a urn:uuid; deriving it from the
 * package identity rather than randomness keeps regenerated SBOMs byte-identical
 * when nothing changed, so `--check` can detect real drift instead of noise.
 */
function serialFor(name, version) {
  const h = createHash('sha256').update(`${name}@${version}`).digest('hex')
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/**
 * A purl must carry a concrete version, not a semver range, so resolve what is
 * actually installed. Workspace siblings come from their own package.json;
 * everything else from node_modules (pnpm symlinks the real thing into place).
 * If a dependency is genuinely not installed we keep the range and say so on
 * the component rather than emitting a purl that lies.
 */
function resolveVersion(name, range, dir) {
  if (range.startsWith('workspace:')) {
    return { version: workspaceVersion(name) ?? range, resolved: workspaceVersion(name) != null }
  }
  for (const base of [join(PKG_DIR, dir, 'node_modules'), join(ROOT, 'node_modules')]) {
    try {
      const p = JSON.parse(readFileSync(join(base, ...name.split('/'), 'package.json'), 'utf8'))
      if (p.version) return { version: p.version, resolved: true }
    } catch {
      /* keep looking */
    }
  }
  return { version: range, resolved: false }
}

function buildSbom(pkg, dir) {
  const runtime = Object.entries(pkg.dependencies ?? {})
  const peers = Object.entries(pkg.peerDependencies ?? {})
  const peerMeta = pkg.peerDependenciesMeta ?? {}

  const components = []
  const dependsOn = []

  const add = (name, range, kind, optional) => {
    const { version, resolved } = resolveVersion(name, range, dir)
    const note = resolved
      ? `${kind} (declared range: ${range})`
      : `${kind}, not installed in this workspace - version shown is the declared range: ${range}`
    components.push(componentFor(name, version, { optional, description: note }))
    dependsOn.push(purlFor(name, version))
  }

  for (const [name, range] of runtime) add(name, range, 'Runtime dependency', false)
  for (const [name, range] of peers) {
    add(name, range, 'Peer dependency', peerMeta[name]?.optional === true)
  }

  const self = componentFor(pkg.name, pkg.version, { license: pkg.license, description: pkg.description })

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: serialFor(pkg.name, pkg.version),
    version: 1,
    metadata: {
      // No timestamp on purpose: it would make every regeneration a diff and
      // defeat `--check`. Provenance of the build lives in npm attestations.
      tools: {
        components: [
          { type: 'application', name: 'build-sbom.mjs', version: '1.0.0', description: 'SvGrid workspace SBOM generator' },
        ],
      },
      component: self,
    },
    components,
    dependencies: [
      { ref: self['bom-ref'], dependsOn },
      ...components.map((c) => ({ ref: c['bom-ref'], dependsOn: [] })),
    ],
  }
}

let workspaceVersions = null
function workspaceVersion(name) {
  if (!workspaceVersions) {
    workspaceVersions = new Map()
    for (const dir of readdirSync(PKG_DIR)) {
      try {
        const p = readPkg(dir)
        workspaceVersions.set(p.name, p.version)
      } catch {
        /* not a package dir */
      }
    }
  }
  return workspaceVersions.get(name)
}

/** Structural checks that catch the mistakes a hand-built document invites. */
function validate(doc) {
  const errors = []
  if (doc.bomFormat !== 'CycloneDX') errors.push('bomFormat must be "CycloneDX"')
  if (doc.specVersion !== '1.6') errors.push('specVersion must be "1.6"')
  if (!/^urn:uuid:[0-9a-f-]{36}$/.test(doc.serialNumber)) errors.push(`bad serialNumber: ${doc.serialNumber}`)
  if (typeof doc.version !== 'number') errors.push('version must be a number')
  if (!doc.metadata?.component?.name) errors.push('metadata.component.name missing')
  if (!doc.metadata?.component?.purl?.startsWith('pkg:npm/')) errors.push('metadata.component.purl must be a pkg:npm purl')

  const refs = new Set([doc.metadata.component['bom-ref'], ...doc.components.map((c) => c['bom-ref'])])
  for (const c of doc.components) {
    if (!c.name || !c.version) errors.push(`component missing name/version: ${JSON.stringify(c)}`)
    if (c.licenses) {
      for (const l of c.licenses) {
        if (l.license?.id && /SEE LICENSE/i.test(l.license.id)) {
          errors.push(`non-SPDX value emitted as license.id on ${c.name}`)
        }
      }
    }
  }
  for (const d of doc.dependencies) {
    if (!refs.has(d.ref)) errors.push(`dependency ref not among components: ${d.ref}`)
    for (const on of d.dependsOn ?? []) {
      if (!refs.has(on)) errors.push(`dependsOn ref not among components: ${on}`)
    }
  }
  return errors
}

function main() {
  if (!CHECK_ONLY && !existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  let failed = false
  let drifted = 0
  const written = []

  for (const dir of readdirSync(PKG_DIR)) {
    let pkg
    try {
      pkg = readPkg(dir)
    } catch {
      continue
    }
    if (pkg.private) continue

    const doc = buildSbom(pkg, dir)
    const errors = validate(doc)
    if (errors.length) {
      failed = true
      console.error(`FAIL ${pkg.name}:`)
      for (const e of errors) console.error(`  - ${e}`)
      continue
    }

    const outFile = join(OUT_DIR, `${pkg.name.replace('@', '').replace('/', '-')}.cdx.json`)
    const json = JSON.stringify(doc, null, 2) + '\n'

    if (CHECK_ONLY) {
      const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null
      if (current !== json) {
        drifted += 1
        console.error(`DRIFT ${pkg.name}: ${existsSync(outFile) ? 'out of date' : 'missing'} - run \`pnpm sbom\``)
      }
    } else {
      writeFileSync(outFile, json)
    }
    written.push(`${pkg.name}@${pkg.version} (${doc.components.length} dependencies)`)
  }

  if (failed) process.exit(1)
  if (CHECK_ONLY && drifted) process.exit(1)

  console.log(`sbom: ${CHECK_ONLY ? 'verified' : 'wrote'} ${written.length} CycloneDX 1.6 documents`)
  for (const w of written) console.log(`  ${w}`)
}

main()
