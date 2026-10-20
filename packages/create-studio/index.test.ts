/**
 * `npm create @svgrid/studio -- --from <schema>` replaces the starter's
 * entities with the schema's. The scaffolded app failed `npm run check` (a
 * starter screen still imported `productSchema`) and `vite build` (the layout
 * imported a custom.css nothing wrote). This only scaffolds; installing and
 * building is `pnpm verify:app --from prisma`.
 *
 *   pnpm exec vitest run packages/create-studio/index.test.ts
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
const cli = join(here, 'index.mjs')
const starterRoutes = readdirSync(join(here, 'templates', 'default', 'src', 'routes'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)

const prisma = `model Account {
  id       Int       @id @default(autoincrement())
  name     String
  invoices Invoice[]
}

model Invoice {
  id        Int     @id @default(autoincrement())
  number    String
  account   Account @relation(fields: [accountId], references: [id])
  accountId Int
}
`

const work = mkdtempSync(join(tmpdir(), 'svgrid-create-studio-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

function scaffoldFrom(schema: string): string {
  const schemaPath = join(work, 'schema.prisma')
  writeFileSync(schemaPath, schema)
  const app = join(work, 'app')
  execFileSync(process.execPath, [cli, app, '--from', schemaPath, '--force'], { cwd: work, stdio: 'pipe' })
  return app
}

describe('create-studio --from', () => {
  const app = scaffoldFrom(prisma)

  it('drops every starter entity route', () => {
    expect(starterRoutes).toEqual(expect.arrayContaining(['customers', 'orders', 'products']))
    for (const route of starterRoutes) expect(existsSync(join(app, 'src', 'routes', route)), route).toBe(false)
    expect(existsSync(join(app, 'src', 'routes', 'Account', '+page.svelte'))).toBe(true)
    expect(existsSync(join(app, 'src', 'routes', 'Invoice', '+page.svelte'))).toBe(true)
  })

  it('writes every stylesheet the generated layout imports', () => {
    const layout = readFileSync(join(app, 'src', 'routes', '+layout.svelte'), 'utf8')
    const imported = [...layout.matchAll(/import '\.\.\/([\w.-]+\.css)'/g)].map((m) => m[1])
    expect(imported).toContain('custom.css')
    for (const css of imported) expect(existsSync(join(app, 'src', css!)), css).toBe(true)
  })

  it('no generated file imports a schema the generated schemas.ts does not export', () => {
    const schemas = readFileSync(join(app, 'src', 'lib', 'schemas.ts'), 'utf8')
    const exported = new Set([...schemas.matchAll(/export const (\w+)/g)].map((m) => m[1]))
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    for (const file of walk(join(app, 'src', 'routes')).filter((f) => f.endsWith('.svelte'))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/import \{([^}]+)\} from '\$lib\/schemas'/g)) {
        for (const name of m[1]!.split(',').map((s) => s.trim().replace(/^type\s+/, '')).filter(Boolean)) {
          if (/Schema$/.test(name)) expect(exported.has(name), `${file}: ${name}`).toBe(true)
        }
      }
    }
  })
})
