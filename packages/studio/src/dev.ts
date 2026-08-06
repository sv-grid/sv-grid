/**
 * `svgrid-studio dev` - the live loop: the visual designer AND the real generated
 * app's Vite dev server running side by side. Designer saves write real files
 * into the app folder (targeted, hash-guarded writes), Vite picks them up as
 * HMR - so the designer edits the actual running app, not a simulation.
 *
 * Dependency-free like the rest of the CLI: node:child_process + the existing
 * package-manager/driver plumbing.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { emitStudioAppBundle, parseProject } from '@svgrid/enterprise/studio'
import { readFile } from 'node:fs/promises'
import { writeBundle } from './designer-server.js'
import { detectPackageManager } from './driver-install.js'

export type AppServer = {
  url: string
  /** Re-check runtime deps (after a regenerate); installs + restarts when new
   *  deps appeared, otherwise leaves the running server alone (HMR covers it). */
  syncDeps: () => Promise<void>
  stop: () => void
}

const isWin = process.platform === 'win32'

/** Ensure the folder holds a generated app; generate from studio.config.json when
 *  it doesn't. Returns false when there's nothing to run yet (no app, no config). */
export async function ensureApp(outDir: string, configPath: string, log: (l: string) => void): Promise<boolean> {
  if (existsSync(join(outDir, 'package.json'))) return true
  if (!existsSync(configPath)) return false
  const project = parseProject(await readFile(configPath, 'utf8'))
  await mkdir(outDir, { recursive: true })
  const { written } = await writeBundle(outDir, emitStudioAppBundle(project))
  log(`  generated the app from ${configPath} (${written} files)`)
  return true
}

/** Deps declared in the app's package.json that aren't installed yet. Includes
 *  devDependencies - `vite`/`svelte-kit` live there and `dev` can't run without
 *  them (a wiped-then-partially-restored node_modules is a real scenario). */
export function missingDeps(outDir: string): string[] {
  try {
    const req = createRequire(join(resolve(outDir), 'package.json'))
    const pkg = req('./package.json') as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((dep) => {
      try {
        req.resolve(join(dep, 'package.json'))
        return false
      } catch {
        try {
          req.resolve(dep)
          return false
        } catch {
          return true
        }
      }
    })
  } catch {
    return []
  }
}

function install(outDir: string, log: (l: string) => void): void {
  const pm = detectPackageManager(outDir)
  log(`  installing dependencies (${pm} install)...`)
  const res = spawnSync(`${pm} install`, { cwd: outDir, stdio: 'inherit', shell: true })
  if (res.status !== 0) throw new Error(`${pm} install failed (exit ${res.status ?? 'signal'})`)
}

function spawnVite(outDir: string, port: number, log: (l: string) => void): ChildProcess {
  const pm = detectPackageManager(outDir)
  // `-- --port` threads through the package script to vite; strictPort so a
  // taken port errors loudly instead of silently drifting to another one.
  const child = spawn(`${pm} run dev -- --port ${port} --strictPort`, { cwd: outDir, shell: true })
  const prefix = (data: unknown) => {
    for (const line of String(data).split(/\r?\n/)) if (line.trim()) log(`  [app] ${line}`)
  }
  child.stdout?.on('data', prefix)
  child.stderr?.on('data', prefix)
  return child
}

/** Kill the dev-server process tree (shell:true leaves grandchildren on Windows). */
function killTree(child: ChildProcess): void {
  if (child.pid == null) return
  if (isWin) spawnSync(`taskkill /pid ${child.pid} /T /F`, { shell: true, stdio: 'ignore' })
  else child.kill('SIGTERM')
}

/** The `npm run dev` launcher must actually exist - a package can resolve while
 *  its .bin shim is gone (partially wiped node_modules), which fails with a
 *  cryptic "'vite' is not recognized". */
function viteBinMissing(outDir: string): boolean {
  const bin = join(outDir, 'node_modules', '.bin')
  return !existsSync(join(bin, 'vite')) && !existsSync(join(bin, 'vite.cmd')) && !existsSync(join(bin, 'vite.CMD'))
}

/** Start the generated app's dev server (installing first when needed). */
export async function startAppServer(opts: { outDir: string; port: number; log?: (l: string) => void }): Promise<AppServer> {
  const log = opts.log ?? ((l: string) => process.stdout.write(l + '\n'))
  const outDir = resolve(opts.outDir)
  if (!existsSync(join(outDir, 'node_modules')) || viteBinMissing(outDir) || missingDeps(outDir).length) install(outDir, log)

  let child = spawnVite(outDir, opts.port, log)
  let stopped = false
  child.on('exit', (code) => {
    if (!stopped && code !== 0 && code != null) log(`  [app] dev server exited with code ${code}`)
  })

  return {
    url: `http://localhost:${opts.port}`,
    async syncDeps() {
      const missing = missingDeps(outDir)
      if (!missing.length) return // nothing new - the running server HMRs the file writes
      log(`  new dependenc${missing.length === 1 ? 'y' : 'ies'} (${missing.join(', ')}) - installing + restarting the app server...`)
      killTree(child)
      install(outDir, log)
      child = spawnVite(outDir, opts.port, log)
    },
    stop() {
      stopped = true
      killTree(child)
    },
  }
}
