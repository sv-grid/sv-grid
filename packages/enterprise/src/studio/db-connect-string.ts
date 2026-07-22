/**
 * Connection-string helpers for the Studio "connect your database" flow. A
 * guided form collects host / port / database / user / password / SSL and
 * `buildConnectionString` assembles the driver-ready URL, so users never have to
 * hand-write `postgresql://user:pass@host:5432/db`. `parseConnectionString` does
 * the reverse (best-effort) to pre-fill the form from a pasted URL, and
 * `redactConnectionString` masks the password for display / logs.
 *
 * Pure and node-safe (no driver, no node APIs) - shared by the designer server,
 * the CLI, and the (private) designer SPA, which imports it from
 * `@svgrid/enterprise/studio`.
 */
import type { SqlDialectName } from './introspect-db.js'

export type SqlConnectionParts = {
  host?: string
  port?: number | string
  database?: string
  user?: string
  password?: string
  /** Require TLS (adds the dialect's SSL query param). */
  ssl?: boolean
  /** SQLite only: path to the `.db` file (host / user / etc are ignored). */
  file?: string
}

/** The npm driver package each dialect needs installed to connect. */
export const DRIVER_PACKAGE: Record<SqlDialectName, string> = {
  postgres: 'pg',
  supabase: 'pg',
  mysql: 'mysql2',
  mssql: 'mssql',
  sqlite: 'better-sqlite3',
}

/** The default TCP port per dialect (null for the file-based SQLite). */
export const DEFAULT_PORT: Record<SqlDialectName, number | null> = {
  postgres: 5432,
  supabase: 5432,
  mysql: 3306,
  mssql: 1433,
  sqlite: null,
}

/** SQLite is a file on disk - the form shows a path field, not host/port/auth. */
export function isFileDialect(dialect: SqlDialectName): boolean {
  return dialect === 'sqlite'
}

function urlScheme(dialect: SqlDialectName): string {
  if (dialect === 'mysql') return 'mysql'
  if (dialect === 'mssql') return 'mssql'
  return 'postgresql' // postgres + supabase
}

function sslQuery(dialect: SqlDialectName, ssl?: boolean): string {
  if (!ssl) return ''
  if (dialect === 'mysql') return `?ssl=${encodeURIComponent('{"rejectUnauthorized":true}')}`
  if (dialect === 'mssql') return '?encrypt=true&trustServerCertificate=true'
  return '?sslmode=require' // postgres + supabase
}

/**
 * Assemble a driver-ready connection string from the guided-form fields. SQLite
 * returns the bare file path (what better-sqlite3 expects); every other dialect
 * returns a URL with the credentials percent-encoded so passwords containing
 * `@`, `:` or `/` don't corrupt it.
 */
export function buildConnectionString(dialect: SqlDialectName, parts: SqlConnectionParts): string {
  if (isFileDialect(dialect)) {
    const file = (parts.file ?? parts.database ?? '').trim()
    if (!file) throw new Error('buildConnectionString: SQLite needs a database file path')
    return file
  }
  const host = (parts.host ?? '').trim() || 'localhost'
  const portRaw = parts.port != null && `${parts.port}`.trim() !== '' ? Number(parts.port) : DEFAULT_PORT[dialect]
  const port = Number.isFinite(portRaw as number) ? (portRaw as number) : null
  const db = (parts.database ?? '').trim()
  const user = (parts.user ?? '').trim()
  const pass = parts.password ?? ''
  const auth = user
    ? `${encodeURIComponent(user)}${pass ? `:${encodeURIComponent(pass)}` : ''}@`
    : ''
  const hostPort = port ? `${host}:${port}` : host
  const dbPath = db ? `/${encodeURIComponent(db)}` : ''
  return `${urlScheme(dialect)}://${auth}${hostPort}${dbPath}${sslQuery(dialect, parts.ssl)}`
}

/**
 * Best-effort inverse of `buildConnectionString` - split a pasted URL back into
 * form fields so the guided form can pre-fill. Returns `{}` when the input isn't
 * a parseable URL (the caller keeps whatever the user typed).
 */
export function parseConnectionString(dialect: SqlDialectName, value: string): SqlConnectionParts {
  const raw = (value ?? '').trim()
  if (!raw) return {}
  if (isFileDialect(dialect)) return { file: raw }
  try {
    const u = new URL(raw)
    const parts: SqlConnectionParts = {}
    if (u.hostname) parts.host = u.hostname
    if (u.port) parts.port = Number(u.port)
    const db = u.pathname.replace(/^\//, '')
    if (db) parts.database = decodeURIComponent(db)
    if (u.username) parts.user = decodeURIComponent(u.username)
    if (u.password) parts.password = decodeURIComponent(u.password)
    const q = u.searchParams
    if (q.get('sslmode') === 'require' || q.has('ssl') || q.get('encrypt') === 'true') parts.ssl = true
    return parts
  } catch {
    return {}
  }
}

/** Mask the password in a connection string for display / logging. */
export function redactConnectionString(value: string): string {
  const raw = (value ?? '').trim()
  if (!raw) return raw
  try {
    const u = new URL(raw)
    if (!u.password) return raw
    u.password = '***'
    return u.toString()
  } catch {
    // key=value strings (e.g. mssql "Password=...") and bare paths.
    return raw.replace(/(password|pwd)=([^;&\s]+)/gi, '$1=***')
  }
}
