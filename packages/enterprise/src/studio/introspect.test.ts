import { describe, expect, it } from 'vitest'
import { inferType, introspectDrizzle, introspectDrizzleAll, introspectJson } from './introspect'

describe('inferType', () => {
  it('classifies runtime values', () => {
    expect(inferType(true)).toBe('boolean')
    expect(inferType(42)).toBe('number')
    expect(inferType('hello')).toBe('text')
    expect(inferType('2026-06-21')).toBe('dateString')
    expect(inferType('2026-06-21T09:30:00Z')).toBe('datetime')
    expect(inferType({ a: 1 })).toBe('json')
    expect(inferType(null)).toBe('text')
  })
})

describe('introspectJson', () => {
  it('unions keys and infers types from the first non-null value', () => {
    const schema = introspectJson('customers', [
      { id: '1', name: 'Ann', age: 30, active: true },
      { id: '2', name: 'Bob', age: null, joined: '2026-01-02' },
    ])
    const byField = Object.fromEntries(schema.fields.map((f) => [f.field, f]))
    expect(schema.name).toBe('customers')
    expect(byField.name!.type).toBe('text')
    expect(byField.age!.type).toBe('number')
    expect(byField.active!.type).toBe('boolean')
    expect(byField.joined!.type).toBe('dateString')
  })

  it('marks an `id` field as the read-only primary key', () => {
    const schema = introspectJson('t', [{ id: 'x', v: 1 }])
    const id = schema.fields.find((f) => f.field === 'id')!
    expect(id.primaryKey).toBe(true)
    expect(id.readonly).toBe(true)
  })
})

describe('introspectDrizzle', () => {
  const source = `
    import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

    export const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      age: integer('age'),
      active: boolean('active').default(false),
      createdAt: timestamp('created_at').defaultNow(),
      meta: jsonb('meta'),
    })
  `

  it('parses the table name and fields with types', () => {
    const schema = introspectDrizzle(source)
    expect(schema.name).toBe('users')
    const byField = Object.fromEntries(schema.fields.map((f) => [f.field, f]))
    expect(byField.id!.type).toBe('number')
    expect(byField.name!.type).toBe('text')
    expect(byField.age!.type).toBe('number')
    expect(byField.active!.type).toBe('boolean')
    expect(byField.createdAt!.type).toBe('datetime')
    expect(byField.meta!.type).toBe('json')
  })

  it('reads primaryKey and notNull modifiers', () => {
    const schema = introspectDrizzle(source)
    const byField = Object.fromEntries(schema.fields.map((f) => [f.field, f]))
    expect(byField.id!.primaryKey).toBe(true)
    expect(byField.id!.readonly).toBe(true)
    expect(byField.name!.required).toBe(true)
    expect(byField.age!.required).toBeUndefined()
  })

  it('works for sqlite/mysql table builders too', () => {
    const s = introspectDrizzle(`export const t = sqliteTable('todos', { id: integer('id').primaryKey(), title: text('title') })`)
    expect(s.name).toBe('todos')
    expect(s.fields.map((f) => f.field)).toEqual(['id', 'title'])
  })

  it('throws when there is no table definition', () => {
    expect(() => introspectDrizzle('const x = 1')).toThrow(/no .*Table/)
  })

  it('reads a composite primary key from the table config (join table)', () => {
    const s = introspectDrizzle(
      `
      export const postsToTags = pgTable('posts_to_tags', {
        postId: integer('post_id').references(() => posts.id).notNull(),
        tagId: integer('tag_id').references(() => tags.id).notNull(),
      }, (t) => ({ pk: primaryKey({ columns: [t.postId, t.tagId] }) }))
    `,
      'posts_to_tags',
    )
    expect(s.idField).toBe('postId') // first composite member is the key
    // The other member stays a relation lookup.
    expect(s.fields.find((f) => f.field === 'tagId')?.type).toBe('relation')
  })

  it('reads an enum column (pgEnum + inline) as an enum field with options', () => {
    const s = introspectDrizzle(`
      export const roleEnum = pgEnum('role', ['admin', 'user'])
      export const members = pgTable('members', {
        id: serial('id').primaryKey(),
        role: roleEnum('role').notNull(),
        status: text('status', { enum: ['active', 'paused'] }),
      })
    `)
    const byField = Object.fromEntries(s.fields.map((f) => [f.field, f]))
    expect(byField.role!.type).toBe('enum')
    expect(byField.role!.options?.map((o) => o.value)).toEqual(['admin', 'user'])
    expect(byField.status!.type).toBe('enum')
    expect(byField.status!.options?.map((o) => o.value)).toEqual(['active', 'paused'])
  })

  it('captures the DB column name when it differs from the property key', () => {
    const s = introspectDrizzle(`
      export const users = pgTable('users', {
        id: serial('id').primaryKey(),
        createdAt: timestamp('created_at').defaultNow(),
        name: text('name'),
      })
    `)
    const byField = Object.fromEntries(s.fields.map((f) => [f.field, f]))
    expect(byField.createdAt!.dbColumn).toBe('created_at') // renamed -> captured
    expect(byField.name!.dbColumn).toBeUndefined() // same -> omitted
    expect(byField.id!.dbColumn).toBeUndefined()
  })

  it('turns a `.references()` column into a relation field', () => {
    const s = introspectDrizzle(
      `
      export const users = pgTable('users', { id: serial('id').primaryKey(), name: text('name') })
      export const posts = pgTable('posts', {
        id: serial('id').primaryKey(),
        authorId: integer('author_id').references(() => users.id).notNull(),
      })
    `,
      'posts',
    )
    const author = s.fields.find((f) => f.field === 'authorId')!
    expect(author.type).toBe('relation')
    expect(author.relation?.entity).toBe('users')
    expect(author.required).toBe(true)
  })
})

describe('introspectDrizzleAll', () => {
  const source = `
    export const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
    })
    export const posts = pgTable('posts', {
      id: serial('id').primaryKey(),
      title: text('title').notNull(),
      authorId: integer('author_id').references(() => users.id),
    })
  `

  it('returns every table as a schema', () => {
    const all = introspectDrizzleAll(source)
    expect(all.map((s) => s.name)).toEqual(['users', 'posts'])
  })

  it('links the relation label field from the related table', () => {
    const posts = introspectDrizzleAll(source).find((s) => s.name === 'posts')!
    const rel = posts.fields.find((f) => f.field === 'authorId')!
    expect(rel.type).toBe('relation')
    expect(rel.relation?.entity).toBe('users')
    // `users` has a `name` column, so the lookup shows it.
    expect(rel.relation?.labelField).toBe('name')
  })
})
