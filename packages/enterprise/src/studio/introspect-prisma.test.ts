import { describe, expect, it } from 'vitest'
import { introspectPrisma, introspectPrismaAll } from './introspect-prisma'

const SCHEMA = `
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

enum Role {
  ADMIN
  USER
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  views    Int    @default(0)
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}
`

describe('introspectPrisma', () => {
  it('maps scalar types and marks the @id as the read-only key', () => {
    const s = introspectPrisma(SCHEMA, 'User')
    const byField = Object.fromEntries(s.fields.map((f) => [f.field, f]))
    expect(s.name).toBe('User')
    expect(byField.id!.primaryKey).toBe(true)
    expect(byField.id!.readonly).toBe(true)
    expect(byField.email!.type).toBe('text')
    expect(byField.createdAt!.type).toBe('datetime')
  })

  it('treats a missing `?` as required and `?` as optional', () => {
    const byField = Object.fromEntries(introspectPrisma(SCHEMA, 'User').fields.map((f) => [f.field, f]))
    expect(byField.email!.required).toBe(true)
    expect(byField.name!.required).toBeUndefined()
  })

  it('reads an enum field with its options', () => {
    const role = introspectPrisma(SCHEMA, 'User').fields.find((f) => f.field === 'role')!
    expect(role.type).toBe('enum')
    expect(role.options?.map((o) => o.value)).toEqual(['ADMIN', 'USER'])
  })

  it('turns a @relation FK into a relation field and skips the navigation field', () => {
    const s = introspectPrisma(SCHEMA, 'Post')
    const fieldNames = s.fields.map((f) => f.field)
    expect(fieldNames).toContain('authorId')
    expect(fieldNames).not.toContain('author') // navigation field is virtual
    const rel = s.fields.find((f) => f.field === 'authorId')!
    expect(rel.type).toBe('relation')
    expect(rel.relation?.entity).toBe('User')
  })

  it('defaults to the first model when none is named', () => {
    expect(introspectPrisma(SCHEMA).name).toBe('User')
  })

  it('throws when there is no model', () => {
    expect(() => introspectPrisma('generator client {}')).toThrow(/no .*model/)
  })
})

describe('composite primary key (join table)', () => {
  const JOIN = `
    model PostTag {
      postId Int
      tagId  Int
      post   Post @relation(fields: [postId], references: [id])
      tag    Tag  @relation(fields: [tagId], references: [id])
      @@id([postId, tagId])
    }
    model Post { id Int @id }
    model Tag { id Int @id }
  `
  it('keys off the first @@id member and keeps the other as a relation', () => {
    const s = introspectPrisma(JOIN, 'PostTag')
    expect(s.idField).toBe('postId')
    expect(s.fields.find((f) => f.field === 'tagId')?.type).toBe('relation')
  })
})

describe('introspectPrismaAll', () => {
  it('returns every model, linked', () => {
    const all = introspectPrismaAll(SCHEMA)
    expect(all.map((s) => s.name)).toEqual(['User', 'Post'])
    const rel = all.find((s) => s.name === 'Post')!.fields.find((f) => f.field === 'authorId')!
    expect(rel.relation?.entity).toBe('User')
  })
})
