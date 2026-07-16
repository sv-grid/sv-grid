/**
 * Connect to a live database by dynamically importing the matching driver, and
 * return a neutral `execute(sql, params)` the Studio introspection core uses.
 *
 * The driver is an optional peer - it must be installed in the project running
 * the CLI (`pg` / `mysql2` / `mssql` / `better-sqlite3`). The module specifier
 * is held in a variable so it isn't a hard dependency of this package. Shared by
 * the `add --db` command and the `designer` connect wizard (`/api/introspect`).
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import type { DbExecute, SqlDialectName } from '@svgrid/enterprise/studio'

/**
 * Load a driver from the *project's* node_modules (the current working
 * directory), not this CLI's. In an `npx`/global install the CLI lives in a
 * cache far from the user's project, so resolving relative to `import()` would
 * miss a driver the user installed. Resolving from cwd finds it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadDriver(spec: string): Promise<any> {
  const requireFromCwd = createRequire(pathToFileURL(join(process.cwd(), 'noop.js')))
  const resolved = requireFromCwd.resolve(spec)
  return import(pathToFileURL(resolved).href)
}

export async function connect(dialect: SqlDialectName, url: string): Promise<DbExecute> {
  if (dialect === 'postgres' || dialect === 'supabase') {
    const pg = await loadDriver('pg')
    const Client = pg.Client ?? pg.default?.Client
    const client = new Client({ connectionString: url })
    await client.connect()
    return async (sql, params) => (await client.query(sql, params)).rows
  }
  if (dialect === 'mysql') {
    const mysql = await loadDriver('mysql2/promise')
    const conn = await mysql.createConnection(url)
    return async (sql, params) => {
      const [rows] = await conn.execute(sql, params)
      return rows as Array<Record<string, unknown>>
    }
  }
  if (dialect === 'mssql') {
    const mod = await loadDriver('mssql')
    const mssql = mod.default ?? mod
    const pool = await mssql.connect(url)
    return async (text, params) => {
      const req = pool.request()
      params.forEach((p: unknown, i: number) => req.input(`p${i + 1}`, p))
      return (await req.query(text)).recordset as Array<Record<string, unknown>>
    }
  }
  // sqlite (better-sqlite3, synchronous)
  const mod = await loadDriver('better-sqlite3')
  const Database = mod.default ?? mod
  const db = new Database(url)
  return async (sql, params) => db.prepare(sql).all(...params) as Array<Record<string, unknown>>
}
