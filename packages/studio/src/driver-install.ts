/**
 * Install the database driver a dialect needs, into the *user's* project. Powers
 * the designer's "Install driver" button and the CLI's auto-offer, so a user
 * connecting to Postgres never has to know they must `npm i pg` first - Studio
 * detects the project's package manager and runs it for them.
 *
 * Node-only (spawns the package manager); kept out of the Svelte-free enterprise
 * bundle. The driver package names mirror `DRIVER_PACKAGE` in
 * `@svgrid/enterprise/studio`.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join as joinNative } from 'node:path'
import { pathToFileURL as toFileURL } from 'node:url'
import type { SqlDialectName } from '@svgrid/enterprise/studio'

/** The npm driver package each dialect connects through. */
export const DRIVER_FOR: Record<SqlDialectName, string> = {
  postgres: 'pg',
  supabase: 'pg',
  mysql: 'mysql2',
  mssql: 'mssql',
  sqlite: 'better-sqlite3',
}

export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm'

/** Pick the package manager from the project's lockfile (npm is the fallback). */
export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(joinNative(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(joinNative(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(joinNative(cwd, 'bun.lockb')) || existsSync(joinNative(cwd, 'bun.lock'))) return 'bun'
  return 'npm'
}

/**
 * The install args to add `pkg` as a regular dependency for a given manager.
 * A regular dependency, not dev - the generated `+server.ts` imports the
 * driver at module scope (see `DRIVERS` in `@svgrid/enterprise/studio`'s
 * `scaffold.ts`), so it must survive a production `--omit=dev` install.
 */
export function installArgs(pm: PackageManager, pkg: string): string[] {
  switch (pm) {
    case 'pnpm':
      return ['add', pkg]
    case 'yarn':
      return ['add', pkg]
    case 'bun':
      return ['add', pkg]
    default:
      return ['install', '--save', pkg]
  }
}

/** Is the driver already resolvable from the project? (skip a needless install). */
export function isDriverInstalled(dialect: SqlDialectName, cwd: string): boolean {
  const pkg = DRIVER_FOR[dialect]
  try {
    const requireFromCwd = createRequire(toFileURL(joinNative(cwd, 'noop.js')))
    requireFromCwd.resolve(pkg)
    return true
  } catch {
    return false
  }
}

export type InstallResult = {
  ok: boolean
  /** True when the driver was already present (nothing was run). */
  alreadyInstalled: boolean
  manager: PackageManager
  package: string
  output: string
}

/**
 * Install the dialect's driver into `cwd`. No-ops (ok:true) when it's already
 * present. Never rejects: a failed install resolves with `ok:false` and the
 * captured output so the UI can show it.
 */
export function installDriver(dialect: SqlDialectName, cwd: string): Promise<InstallResult> {
  const pkg = DRIVER_FOR[dialect]
  const manager = detectPackageManager(cwd)
  if (isDriverInstalled(dialect, cwd)) {
    return Promise.resolve({ ok: true, alreadyInstalled: true, manager, package: pkg, output: '' })
  }
  return new Promise((resolve) => {
    let output = ''
    // shell:true on Windows so `npm`/`pnpm` (.cmd shims) resolve on PATH.
    const child = spawn(manager, installArgs(manager, pkg), {
      cwd,
      shell: process.platform === 'win32',
    })
    const capture = (buf: Buffer) => {
      output += buf.toString()
      if (output.length > 8000) output = output.slice(-8000)
    }
    child.stdout?.on('data', capture)
    child.stderr?.on('data', capture)
    child.on('error', (err) =>
      resolve({ ok: false, alreadyInstalled: false, manager, package: pkg, output: `${output}\n${String(err)}`.trim() }),
    )
    child.on('close', (code) =>
      resolve({ ok: code === 0, alreadyInstalled: false, manager, package: pkg, output: output.trim() }),
    )
  })
}
