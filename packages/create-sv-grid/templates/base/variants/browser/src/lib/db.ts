/**
 * The database: Postgres running in this browser tab (PGlite), kept in
 * IndexedDB so your changes are still there after a reload. The first visit
 * creates the tables from db/schema.sql.
 *
 * To move to a real server later, keep db/schema.sql and switch to the
 * "postgres" setup: `npm create @svgrid@latest -- -t base --data postgres`.
 */
import { PGlite } from '@electric-sql/pglite'
import schema from '../../db/schema.sql?raw'

// One IndexedDB database per project, named after it by `npm create @svgrid`,
// so two bases on localhost:5173 do not share their tables.
const DB_NAME = 'idb://svgrid-base-__project__'

let db: Promise<PGlite> | null = null

function open(): Promise<PGlite> {
  db ??= (async () => {
    const pg = new PGlite(DB_NAME)
    const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`)
    if (!rows[0]?.n) await pg.exec(schema)
    return pg
  })()
  return db
}

/** Runs one statement: what `baseFromDatabase` reads and writes with. */
export async function execute(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  return (await (await open()).query(sql, params)).rows as Record<string, unknown>[]
}
