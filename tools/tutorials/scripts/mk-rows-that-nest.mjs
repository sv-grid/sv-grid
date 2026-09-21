/** Marketing cut: grouping, tree data and master detail. YouTube only, 1920x1080. */
export default {
  id: 'mk-rows-that-nest',
  kind: 'marketing',
  title: 'Groups, trees and detail rows',
  description: 'Three ways SvGrid nests rows: grouping with aggregates, tree data from a parent field, and master detail rows that open a nested grid.',
  tags: ['row grouping', 'tree data', 'master detail', 'svelte data grid', 'hierarchical grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Row hierarchy', title: 'Groups, trees and detail rows.', subtitle: 'Three props. One row model.' })
      },
      beats: [{ say: 'Flat rows are the exception. SvGrid nests them three ways.', lead: 200 }],
    },
    {
      demo: '07-grouping-aggregation',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Group by any column with a sum or an average per group, and switch the grouping at run time.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.gb-btn', { hasText: /^Country$/ }).first())
            await h.pause(1400)
            await h.click(page.locator('.gb-btn', { hasText: /^Department$/ }).first())
            await h.pause(1000)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '426-tree-data',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(1)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Tree data: point the grid at a parent field and rows become a hierarchy, with expanders and indent.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-grid-tree-toggle[aria-expanded="false"]').first())
            await h.pause(700)
            await h.click(page.locator('.sv-grid-tree-toggle[aria-expanded="false"]').first())
            await h.pause(700)
            await h.click(page.getByRole('button', { name: /^expand all$/i }))
          },
          hold: 600,
        },
      ],
    },
    {
      demo: '181-master-detail-grid',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Master detail: a row opens a detail row, here a nested grid with its own sorting.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-grid-detail-toggle[aria-expanded="false"]').first())
            await h.pause(1200)
            await h.click(page.locator('.sv-grid-detail-toggle[aria-expanded="false"]').first())
          },
          hold: 700,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'One row model', title: 'Group, nest, expand.', subtitle: 'Virtualized, keyboard-navigable, and the same on the server.', lines: ['groupBy · treeData · renderDetailRow', 'svgrid.com/docs/help/rows'] })
      },
      beats: [{ say: 'Three props on one row model, virtualized and keyboard-navigable. Details at svgrid.com.', lead: 200 }],
    },
  ],
}
