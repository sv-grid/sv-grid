/**
 * The database connection. Only the server reads DATABASE_URL; the page talks
 * to /api/base, never to the database.
 */
import pg from 'pg'
import { env } from '$env/dynamic/private'

const pool = new pg.Pool({ connectionString: env.DATABASE_URL })

/** Runs one parameterized statement. */
export async function execute(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  return (await pool.query(sql, params)).rows
}
