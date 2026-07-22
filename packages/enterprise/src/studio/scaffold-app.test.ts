import { describe, expect, it } from 'vitest'
import { compile } from 'svelte/compiler'
import type { EntitySchema } from '../schema'
import { MANAGED_START, MANAGED_END } from './scaffold'
import { scaffoldApp } from './scaffold-app'

const companies: EntitySchema = {
  name: 'companies', label: 'Companies', idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
  ],
}
const contacts: EntitySchema = {
  name: 'contacts', label: 'Contacts', idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true, readonly: true },
    { field: 'full_name', type: 'text', required: true },
    // FK with a placeholder labelField - scaffoldApp should resolve it to 'name'.
    { field: 'company_id', type: 'relation', relation: { entity: 'companies', foreignKey: 'company_id', labelField: 'xxx' } },
  ],
}

describe('scaffoldApp', () => {
  const { files } = scaffoldApp([companies, contacts], { appTitle: 'CRM' })
  const byPath = Object.fromEntries(files.map((f) => [f.path, f]))

  it('emits every entity screen plus a layout and home page', () => {
    for (const p of [
      'src/lib/companies.schema.ts', 'src/routes/companies/+page.svelte', 'src/routes/api/companies/+server.ts',
      'src/lib/contacts.schema.ts', 'src/routes/contacts/+page.svelte', 'src/routes/api/contacts/+server.ts',
      'src/routes/+layout.svelte', 'src/routes/+page.svelte',
    ]) {
      expect(byPath[p], p).toBeDefined()
    }
  })

  it('the layout links every entity and renders the routed page', () => {
    const layout = byPath['src/routes/+layout.svelte']!.contents
    expect(layout).toContain('"href":"/companies"')
    expect(layout).toContain('"href":"/contacts"')
    expect(layout).toContain('{@render children?.()}')
    expect(layout).toContain('CRM')
  })

  it('the sidebar is collapsible and starts collapsed on tablet / phone', () => {
    const layout = byPath['src/routes/+layout.svelte']!.contents
    // Off-canvas drawer driven by a collapse toggle + a <= 1024px media query.
    expect(layout).toContain('matchMedia')
    expect(layout).toContain('max-width: 1024px')
    expect(layout).toContain('function toggleNav')
    expect(layout).toContain('class:is-drawer={drawer}')
    expect(layout).toContain('app-shell__burger')
  })

  it('the home page lists the entities', () => {
    const home = byPath['src/routes/+page.svelte']!.contents
    expect(home).toContain('"label":"Companies"')
    expect(home).toContain('"label":"Contacts"')
  })

  it('resolves relation labelFields across the app (linkRelationLabels)', () => {
    const schema = byPath['src/lib/contacts.schema.ts']!.contents
    // The placeholder 'xxx' is replaced by the related companies schema's 'name'.
    expect(schema).toContain('"labelField":"name"')
    expect(schema).not.toContain('"labelField":"xxx"')
  })

  it('the contacts page wires a lookup to the companies route', () => {
    const page = byPath['src/routes/contacts/+page.svelte']!.contents
    expect(page).toContain('createRelationLookup')
    expect(page).toContain('endpoint: "/api/companies"')
  })

  it('layout and home are valid Svelte (compile)', () => {
    for (const p of ['src/routes/+layout.svelte', 'src/routes/+page.svelte']) {
      expect(() => compile(byPath[p]!.contents, { filename: p, generate: 'client' }), p).not.toThrow()
    }
  })

  it('wraps shell files in managed markers', () => {
    for (const p of ['src/routes/+layout.svelte', 'src/routes/+page.svelte']) {
      expect(byPath[p]!.contents).toContain(MANAGED_START)
      expect(byPath[p]!.contents).toContain(MANAGED_END)
    }
  })

  it('throws with no schemas', () => {
    expect(() => scaffoldApp([])).toThrow(/no schemas/)
  })
})
