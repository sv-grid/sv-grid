import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createProject, updateBlock, emitStudioProject } from '@svgrid/enterprise/studio'
const customers = { name: 'customers', label: 'Customer', idField: 'id', fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }, { field: 'mrr', type: 'number' }] }
let p = createProject([customers], { title: 'Paging' })
const gid = p.screens[0].blocks[0].id
p = updateBlock(p, 'customers', gid, { config: { paginationPosition: 'both', pageSizeOptions: [20, 40, 80] } })
const files = emitStudioProject(p)
const root = '.studio-check'; rmSync(root, { recursive: true, force: true })
for (const f of files) { const full = join(root, f.path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, f.contents) }
console.log('grid props:'); console.log(files.find((f) => f.path.endsWith('customers/+page.svelte')).contents.split('\n').filter((l) => /paginationPosition|pageSizeOptions|showPagination/.test(l)).join('\n'))
