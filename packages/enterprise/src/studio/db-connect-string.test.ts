import { describe, expect, it } from 'vitest'
import {
  buildConnectionString,
  parseConnectionString,
  redactConnectionString,
  isFileDialect,
  DEFAULT_PORT,
  DRIVER_PACKAGE,
} from './db-connect-string'

describe('buildConnectionString', () => {
  it('builds a postgres URL with the default port', () => {
    expect(buildConnectionString('postgres', { host: 'db.example.com', database: 'app', user: 'admin', password: 'secret' }))
      .toBe('postgresql://admin:secret@db.example.com:5432/app')
  })

  it('percent-encodes credentials with reserved characters', () => {
    const url = buildConnectionString('postgres', { host: 'h', database: 'd', user: 'a@b', password: 'p:w/d?' })
    expect(url).toBe('postgresql://a%40b:p%3Aw%2Fd%3F@h:5432/d')
    // ...and round-trips back to the raw values.
    const parts = parseConnectionString('postgres', url)
    expect(parts.user).toBe('a@b')
    expect(parts.password).toBe('p:w/d?')
  })

  it('treats supabase as postgres', () => {
    expect(buildConnectionString('supabase', { host: 'x', database: 'd', user: 'u', password: 'p' }))
      .toBe('postgresql://u:p@x:5432/d')
  })

  it('uses mysql / mssql schemes and default ports', () => {
    expect(buildConnectionString('mysql', { host: 'h', database: 'd', user: 'u', password: 'p' }))
      .toBe('mysql://u:p@h:3306/d')
    expect(buildConnectionString('mssql', { host: 'h', database: 'd', user: 'u', password: 'p' }))
      .toBe('mssql://u:p@h:1433/d')
  })

  it('honours a custom port and omits empty auth / db', () => {
    expect(buildConnectionString('postgres', { host: 'h', port: 6543 })).toBe('postgresql://h:6543')
    expect(buildConnectionString('postgres', { host: 'h', port: '5432', user: 'u' })).toBe('postgresql://u@h:5432')
  })

  it('adds the correct SSL param per dialect', () => {
    expect(buildConnectionString('postgres', { host: 'h', database: 'd', ssl: true })).toContain('?sslmode=require')
    expect(buildConnectionString('mssql', { host: 'h', database: 'd', ssl: true })).toContain('encrypt=true')
    expect(buildConnectionString('mysql', { host: 'h', database: 'd', ssl: true })).toContain('ssl=')
  })

  it('returns a bare file path for sqlite', () => {
    expect(buildConnectionString('sqlite', { file: './data/app.db' })).toBe('./data/app.db')
    expect(buildConnectionString('sqlite', { database: 'app.db' })).toBe('app.db')
    expect(() => buildConnectionString('sqlite', {})).toThrow(/file path/)
  })
})

describe('parseConnectionString', () => {
  it('splits a URL back into form fields', () => {
    expect(parseConnectionString('postgres', 'postgresql://u:p@host:5432/mydb?sslmode=require')).toEqual({
      host: 'host', port: 5432, database: 'mydb', user: 'u', password: 'p', ssl: true,
    })
  })
  it('treats a sqlite value as a file path', () => {
    expect(parseConnectionString('sqlite', '/var/data/app.db')).toEqual({ file: '/var/data/app.db' })
  })
  it('returns {} for unparseable input', () => {
    expect(parseConnectionString('postgres', 'not a url')).toEqual({})
    expect(parseConnectionString('postgres', '')).toEqual({})
  })
})

describe('redactConnectionString', () => {
  it('masks the password in a URL', () => {
    expect(redactConnectionString('postgresql://u:secret@h:5432/d')).toBe('postgresql://u:***@h:5432/d')
  })
  it('masks password= tokens in key/value strings', () => {
    expect(redactConnectionString('Server=h;Database=d;User Id=u;Password=secret;'))
      .toBe('Server=h;Database=d;User Id=u;Password=***;')
  })
  it('leaves passwordless strings untouched', () => {
    expect(redactConnectionString('postgresql://h:5432/d')).toBe('postgresql://h:5432/d')
    expect(redactConnectionString('./app.db')).toBe('./app.db')
  })
})

describe('metadata tables', () => {
  it('maps every dialect to a driver + default port', () => {
    expect(DRIVER_PACKAGE.postgres).toBe('pg')
    expect(DRIVER_PACKAGE.sqlite).toBe('better-sqlite3')
    expect(DEFAULT_PORT.mysql).toBe(3306)
    expect(DEFAULT_PORT.sqlite).toBeNull()
    expect(isFileDialect('sqlite')).toBe(true)
    expect(isFileDialect('postgres')).toBe(false)
  })
})
