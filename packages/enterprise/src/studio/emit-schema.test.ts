import { describe, expect, it } from 'vitest'
import { compile } from 'svelte/compiler'
import type { EntitySchema } from '../schema'
import { emitStudioApp } from './emit-schema'

const schemas: EntitySchema[] = [
  {
    name: 'users',
    label: 'User',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', required: true },
      { field: 'active', type: 'boolean' },
    ],
  },
  {
    name: 'posts',
    label: 'Post',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'title', type: 'text', required: true },
      { field: 'authorId', type: 'relation', relation: { entity: 'users', foreignKey: 'authorId', labelField: 'name' } },
    ],
  },
]

describe('emitStudioApp', () => {
  const files = emitStudioApp(schemas)
  const byPath = (p: string) => files.find((f) => f.path === p)

  it('emits schemas, data, a route per entity, and the shell', () => {
    const paths = files.map((f) => f.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        'src/lib/schemas.ts',
        'src/lib/data.ts',
        'src/routes/users/+page.svelte',
        'src/routes/posts/+page.svelte',
        'src/routes/+layout.svelte',
        'src/routes/+page.svelte',
      ]),
    )
  })

  it('generates a row type + schema const per entity, incl. a relation display column', () => {
    const schemasTs = byPath('src/lib/schemas.ts')!.contents
    expect(schemasTs).toContain('export type Users = {')
    expect(schemasTs).toContain('export const usersSchema: EntitySchema<Users>')
    expect(schemasTs).toContain('export const postsSchema: EntitySchema<Posts>')
    // posts.authorId FK is hidden from the grid; an `author` display column is added.
    expect(schemasTs).toContain('author?: string') // row type gains the (optional) display field
    expect(schemasTs).toMatch(/"field":\s*"author"/) // schema gains the display column
  })

  it('wires base stores, a lookup per relation, and label-decorated exported sources', () => {
    const dataTs = byPath('src/lib/data.ts')!.contents
    expect(dataTs).toContain('const usersStore = createInMemoryDataSource<Users>(')
    expect(dataTs).toContain('export const usersSource = usersStore') // no relations -> passthrough
    // posts.authorId -> a lookup over the users store + label decoration
    expect(dataTs).toContain('postsAuthorIdLookup')
    expect(dataTs).toContain('source: usersStore')
    expect(dataTs).toContain("withRelationLabels(postsStore, [{ fk: 'authorId', lookup: postsAuthorIdLookup, as: 'author' }])")
    expect(dataTs).toContain('withRelationLabels') // imported
  })

  it('seeds each store with sample rows (valid ids + FK references) and advances nextId past them', () => {
    const dataTs = byPath('src/lib/data.ts')!.contents
    expect(dataTs).toContain('"id":"u1"') // seeded string id
    expect(dataTs).toMatch(/"name":"Ada \w+"/) // realistic full name (not "name 1")
    expect(dataTs).toMatch(/"authorId":"u[1-6]"/) // FK references a seeded user id
    expect(dataTs).toContain('let seq = 6') // nextId continues after the 6 seeded rows
  })

  it('marks relation display columns optional in the row type', () => {
    expect(byPath('src/lib/schemas.ts')!.contents).toContain('author?: string')
  })

  it('passes lookups to EntityScreen only for entities with relations', () => {
    expect(byPath('src/routes/posts/+page.svelte')!.contents).toContain('lookups={{ authorId: postsAuthorIdLookup }}')
    expect(byPath('src/routes/users/+page.svelte')!.contents).not.toContain('lookups=')
  })

  it('every emitted .svelte file compiles', () => {
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('throws on an empty entity set', () => {
    expect(() => emitStudioApp([])).toThrow(/no schemas/)
  })

  it('types a chips/tags field as string[] (it holds + seeds an array)', () => {
    const files = emitStudioApp([
      {
        name: 'contacts',
        label: 'Contact',
        idField: 'id',
        fields: [
          { field: 'id', type: 'text', primaryKey: true },
          { field: 'tags', type: 'text', input: { editorType: 'chips' } },
        ],
      },
    ])
    const schemas = files.find((f) => f.path === 'src/lib/schemas.ts')!.contents
    expect(schemas).toMatch(/tags: string\[\]/)
    expect(schemas).not.toMatch(/tags: string(?!\[)/) // not the scalar `string`
  })
})
