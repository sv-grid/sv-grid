import { describe, expect, it, vi } from 'vitest'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from '../sveltekit/in-memory'
import { createRelationLookup } from './relation-lookup'
import { withRelationLabels } from './with-relation-labels'

type User = { id: string; name: string }
type Post = { id: string; title: string; authorId: string; author?: string }

const userSchema: EntitySchema<User> = {
  name: 'users', idField: 'id',
  fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }],
}
const postSchema: EntitySchema<Post> = {
  name: 'posts', idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'title', type: 'text' },
    { field: 'authorId', type: 'relation', relation: { entity: 'users', labelField: 'name' } },
    { field: 'author', type: 'text', readonly: true },
  ],
}

function setup() {
  const users = createInMemoryDataSource<User>(
    [{ id: 'u1', name: 'Ada' }, { id: 'u2', name: 'Alan' }],
    userSchema,
  )
  const rawPosts = createInMemoryDataSource<Post>(
    [{ id: 'p1', title: 'A', authorId: 'u1' }, { id: 'p2', title: 'B', authorId: 'u2' }],
    postSchema,
  )
  const lookup = createRelationLookup<User>({ source: users, schema: userSchema, labelField: 'name' })
  const posts = withRelationLabels(rawPosts, [{ fk: 'authorId', lookup, as: 'author' }])
  return { posts }
}

describe('withRelationLabels', () => {
  it('decorates getRows with the related label', async () => {
    const { posts } = setup()
    const { rows } = await posts.getRows({ startRow: 0, endRow: 10, pageIndex: 0, pageSize: 10, sortModel: [], filterModel: {} })
    expect(rows.map((r) => r.author)).toEqual(['Ada', 'Alan'])
  })

  it('decorates the created / updated row (same shape from every method)', async () => {
    const { posts } = setup()
    const created = await posts.createRow!({ id: 'p3', title: 'C', authorId: 'u1' })
    expect(created.author).toBe('Ada')
    const updated = await posts.updateRow!('p3', { authorId: 'u2' })
    expect(updated.author).toBe('Alan')
  })

  it('is a no-op with no relations', () => {
    const raw = createInMemoryDataSource<Post>([], postSchema)
    expect(withRelationLabels(raw, [])).toBe(raw)
  })

  it('batches label resolution to one query per page (no N+1)', async () => {
    const users = createInMemoryDataSource<User>([{ id: 'u1', name: 'Ada' }, { id: 'u2', name: 'Alan' }], userSchema)
    const spy = vi.spyOn(users, 'getRows')
    const rawPosts = createInMemoryDataSource<Post>(
      [
        { id: 'p1', title: 'A', authorId: 'u1' },
        { id: 'p2', title: 'B', authorId: 'u2' },
        { id: 'p3', title: 'C', authorId: 'u1' },
      ],
      postSchema,
    )
    const lookup = createRelationLookup<User>({ source: users, schema: userSchema, labelField: 'name' })
    const posts = withRelationLabels(rawPosts, [{ fk: 'authorId', lookup, as: 'author' }])
    const { rows } = await posts.getRows({ startRow: 0, endRow: 10, pageIndex: 0, pageSize: 10, sortModel: [], filterModel: {} })
    expect(rows.map((r) => r.author)).toEqual(['Ada', 'Alan', 'Ada'])
    expect(spy).toHaveBeenCalledTimes(1) // 3 rows, 2 distinct authors -> ONE lookup query
  })
})
