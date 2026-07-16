import { describe, expect, it } from 'vitest'
import { introspectDrizzle } from './introspect'
import { scaffold } from './scaffold'

/**
 * The end-to-end generator flow the MCP tools expose: a Drizzle schema file
 * becomes an EntitySchema, which becomes runnable SvelteKit files. This proves
 * introspect output feeds scaffold cleanly.
 */
describe('introspect -> scaffold pipeline', () => {
  const drizzle = `
    import { pgTable, serial, text, integer, boolean } from 'drizzle-orm/pg-core'
    export const products = pgTable('products', {
      id: serial('id').primaryKey(),
      title: text('title').notNull(),
      price: integer('price'),
      inStock: boolean('in_stock').default(true),
    })
  `

  it('drizzle source -> schema -> scaffolded files', () => {
    const schema = introspectDrizzle(drizzle)
    const { files } = scaffold(schema)
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]))

    // schema module reflects the parsed table + fields
    const schemaFile = byPath['src/lib/products.schema.ts']!.contents
    expect(schemaFile).toContain('export const productsSchema: EntitySchema<ProductsRow>')
    expect(schemaFile).toContain('title: string')
    expect(schemaFile).toContain('price: number')
    expect(schemaFile).toContain('inStock: boolean')
    expect(schemaFile).toContain('field: "id", type: "number", primaryKey: true, readonly: true')

    // page + server route are wired to the products endpoint
    expect(byPath['src/routes/products/+page.svelte']!.contents).toContain(
      "createKitDataSource<ProductsRow>({ endpoint: '/api/products' })",
    )
    expect(byPath['src/routes/api/products/+server.ts']!.contents).toContain(
      'createKitHandlers({ schema: productsSchema, source })',
    )
  })
})
