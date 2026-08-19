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
 * Make sure the dialect's driver is installed and actually resolvable, installing
 * it if needed. Shared by `add --db` and the guided `init`, so a user connecting
 * to Postgres never has to know `pg` must be present first.
 *
 * Never rejects: reports `{ ok: false, message }` the caller can print.
 */
export async function ensureDriverInstalled(
  dialect: SqlDialectName,
  cwd: string,
  log: (line: string) => void = () => {},
): Promise<{ ok: boolean; message?: string }> {
  if (isDriverInstalled(dialect, cwd)) return { ok: true }
  const driver = DRIVER_FOR[dialect]
  log(`Installing ${driver} (needed to connect to ${dialect})...`)
  const result = await installDriver(dialect, cwd)
  if (!result.ok) {
    return {
      ok: false,
      message: `Could not install "${driver}" automatically.\n${result.output}\nRun \`${result.manager} install ${driver}\` yourself and try again.`,
    }
  }
  log(`Installed ${driver}.`)

  // The install child process can report success before the new module is
  // reliably resolvable (seen on Windows - antivirus/file-sync tools can briefly
  // hold the just-written files). Poll rather than racing straight into
  // connect(), which would resolve the driver too early and crash.
  const deadline = Date.now() + 5000
  while (!isDriverInstalled(dialect, cwd) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!isDriverInstalled(dialect, cwd)) {
    return {
      ok: false,
      message: `Installed "${driver}" but it's still not resolvable from this directory.\nSomething (antivirus, a file-sync tool) may be holding a lock on the new files. Try running the command again.`,
    }
  }
  return { ok: true }
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
