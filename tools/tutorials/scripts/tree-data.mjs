/**
 * Tutorial: tree data. Recorded on demo 426-tree-data.
 */
export default {
  id: 'tree-data',
  title: 'Tree data in SvGrid',
  description: 'Nest flat rows into an expandable hierarchy with the treeData prop: a parent field, a tree column, expanders with indent, and expand or collapse all.',
  demo: '426-tree-data',
  docsPage: 'docs/help/rows/tree-data.md',
  anchorAfter: '<div data-docs-demo="426-tree-data"',
  tags: ['tree data', 'tree grid', 'hierarchical rows', 'svelte tree table'],
  zoom: 1.4,
  gif: { beats: [1, 2] },

  async setup(page, h) {
    await h.gridReady(1)
    await h.focusGrid()
    await h.pause(700)
  },

  beats: [
    {
      say: 'Tree data is one prop. Point treeData at the parent field and name the tree column, and flat rows become a hierarchy.',
      lead: 600,
      async do(page, h) {
        await h.hover(page.locator('.sv-grid-tree-toggle').first())
      },
    },
    {
      say: 'Click an expander to open a branch. Children indent under their parent and keep every column.',
      lead: 200,
      async do(page, h) {
        const closed = page.locator('.sv-grid-tree-toggle[aria-expanded="false"]').first()
        await h.click(closed)
        await h.pause(700)
        await h.click(page.locator('.sv-grid-tree-toggle[aria-expanded="false"]').first())
      },
      hold: 600,
    },
    {
      say: 'Expand all and Collapse all walk the whole tree through the grid API.',
      lead: 200,
      async do(page, h) {
        await h.click(page.getByRole('button', { name: /^expand all$/i }))
        await h.pause(1500)
        await h.click(page.getByRole('button', { name: /^collapse all$/i }))
      },
      hold: 600,
    },
    {
      say: 'Nested objects work too: flatten them once with flattenTreeData, and the same prop takes it from there.',
      lead: 300,
      async do(page, h) {
        await h.click(page.getByRole('button', { name: /nested/i }))
        await h.gridReady(1)
        await h.pause(600)
        await h.click(page.locator('.sv-grid-tree-toggle[aria-expanded="false"]').first())
      },
      hold: 600,
    },
  ],

  async verify(page) {
    const open = await page.locator('.sv-grid-tree-toggle[aria-expanded="true"]').count()
    if (open < 1) throw new Error('no expanded branch at the end')
    return `${open} expanded branch(es)`
  },
}
