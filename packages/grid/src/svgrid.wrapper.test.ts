import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import SvGrid from './SvGrid.svelte'

describe('SvGrid wrapper', () => {
  it('exports a production wrapper component', () => {
    expect(SvGrid).toBeDefined()
  })

  it('contains full-wrapper controls and aria-activedescendant wiring', () => {
    // The wrapper spans SvGrid.svelte plus its extracted sibling modules
    // (types + pure helpers); read them together so these "contains X"
    // assertions hold wherever the code physically lives.
    const source = [
      './SvGrid.svelte',
      './SvGrid.controller.svelte.ts',
      './GridMenus.svelte',
      './GridFooter.svelte',
      './SvGrid.types.ts',
      './SvGrid.helpers.ts',
      './filter-operators.ts',
      './facet-buckets.ts',
      './cell-values.ts',
      './clipboard.ts',
      './build-api.ts',
      './columns.ts',
      './selection.ts',
      './editing.ts',
      './cell-render.ts',
      './menus.ts',
      './summaries.ts',
      './keyboard-handlers.ts',
      './scroll-sync.ts',
      './features.ts',
    ]
      .map((p) => readFileSync(resolve(__dirname, p), 'utf-8'))
      .join('\n')
    expect(source).toContain('Filter all rows')
    expect(source).toContain('Previous')
    expect(source).toContain('role="status"')
    expect(source).toContain('role="alert"')
    expect(source).toContain('activeDescendantId')
    expect(source).toContain('getGridRootA11yProps')
    expect(source).toContain('data-svgrid-header-col')
    expect(source).toContain('data-svgrid-row')
    expect(source).toContain('createSvelteVirtualizer')
    expect(source).toContain('props.virtualization ?? true')
    expect(source).toContain('virtualizer.getVirtualItems()')
    expect(source).toContain('createColumnVirtualizer')
    expect(source).toContain('data-selected-range')
    expect(source).toContain('enableInlineEditing')
    expect(source).toContain('showFilterMenu')
    expect(source).toContain('<tfoot')
    expect(source).toContain('editorType === "number"')
    expect(source).toContain('editorType === "date"')
    expect(source).toContain('editorType === "checkbox"')
    expect(source).toContain('applyExcelFilter')
    expect(source).toContain('showFilterRow')
  })
})
