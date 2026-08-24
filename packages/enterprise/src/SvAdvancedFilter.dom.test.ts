import { describe, it, expect, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvAdvancedFilter from './SvAdvancedFilter.svelte'
import ExpressionEditorHarness from './ExpressionEditorHarness.svelte'
import SvExpressionEditorDirect from './SvExpressionEditor.svelte'
import type { PredicateExpr } from './expressions/expression-types'

/**
 * Covers the two behaviours phase 2 exists to get right:
 *
 *   1. The editor RE-SEEDS when `value` is assigned from outside. Without this,
 *      loading a saved filter or clicking a preset updated the grid while the
 *      editor kept showing the previous conditions - fatal for a panel driven
 *      by saved views.
 *   2. The panel holds a DRAFT and only touches the grid on Apply, so typing
 *      does not re-run the filter pipeline per keystroke.
 */

const columns = [
  { id: 'region', name: 'Region', type: 'text' as const },
  { id: 'amount', name: 'Amount', type: 'number' as const },
]

const gridColumns = [
  { id: 'region', header: 'Region', visible: true, editorType: 'text' },
  { id: 'amount', header: 'Amount', visible: true, editorType: 'number' },
  { id: 'hidden', header: 'Hidden', visible: false, editorType: 'text' },
  { id: '__select', header: '', visible: true },
]

function makeApi(initial: PredicateExpr | null = null, active = true) {
  let current = initial
  return {
    setAdvancedFilter: vi.fn((e: unknown) => {
      current = e as PredicateExpr | null
    }),
    getAdvancedFilter: () => current,
    isAdvancedFilterActive: () => active && current != null,
    getColumns: () => gridColumns,
    getData: () => [
      { region: 'EMEA', amount: 100 },
      { region: 'APAC', amount: 200 },
    ],
  }
}

function mountCmp(Cmp: never, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Cmp, { target, props: props as never })
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const buttonByText = (target: HTMLElement, label: string) =>
  [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

describe('SvExpressionEditor re-seeds from an external value', () => {
  const initial: PredicateExpr = { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' }
  const preset: PredicateExpr = { kind: 'cmp', column: 'amount', op: 'greaterThan', value: '500' }

  it('picks up an expression assigned by its parent', () => {
    const { target, destroy } = mountCmp(ExpressionEditorHarness as never, {
      columns,
      initial,
      preset,
    })
    try {
      flushSync()
      const el = target as HTMLElement
      const text = () => (el.textContent ?? '').replace(/\s+/g, ' ')
      const inputs = () => [...el.querySelectorAll('input')].map((i) => i.value)

      // Seeded state: the Region / Equals / EMEA condition.
      expect(text()).toContain('Region')
      expect(text()).toContain('Equals')
      expect(inputs()).toContain('EMEA')

      // Simulate a preset button / saved-filter load replacing the expression.
      ;(el.querySelector('[data-testid="apply-preset"]') as HTMLButtonElement).click()
      flushSync()

      // Before the fix the editor ignored this entirely and kept showing the
      // old condition, so the panel and the grid disagreed about the filter.
      expect(text()).toContain('Amount')
      expect(text()).toContain('Greater than')
      expect(text()).not.toContain('Region')
      expect(inputs()).toContain('500')
      expect(inputs()).not.toContain('EMEA')
    } finally {
      destroy()
    }
  })

  it('does not emit spuriously on mount', () => {
    const onChange = vi.fn()
    const { destroy } = mountCmp(ExpressionEditorHarness as never, {
      columns,
      initial,
      preset,
      onChange,
    })
    try {
      flushSync()
      // A re-seed loop would show up here as phantom emissions.
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      destroy()
    }
  })
})

describe('SvAdvancedFilter panel', () => {
  it('does not touch the grid until Apply', () => {
    const api = makeApi()
    const { target, destroy } = mountCmp(SvAdvancedFilter as never, { api })
    try {
      flushSync()
      expect(api.setAdvancedFilter).not.toHaveBeenCalled()
      expect(buttonByText(target as HTMLElement, 'Apply')).toBeTruthy()
    } finally {
      destroy()
    }
  })

  it('Apply is disabled until the draft differs from what is applied', () => {
    const api = makeApi()
    const { target, destroy } = mountCmp(SvAdvancedFilter as never, { api })
    try {
      flushSync()
      const apply = buttonByText(target as HTMLElement, 'Apply') as HTMLButtonElement
      expect(apply.disabled).toBe(true)
    } finally {
      destroy()
    }
  })

  it('Clear pushes null to the grid', () => {
    const api = makeApi({ kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' })
    const { target, destroy } = mountCmp(SvAdvancedFilter as never, { api })
    try {
      flushSync()
      const clear = buttonByText(target as HTMLElement, 'Clear') as HTMLButtonElement
      expect(clear.disabled).toBe(false)
      clear.click()
      flushSync()
      expect(api.setAdvancedFilter).toHaveBeenCalledWith(null)
    } finally {
      destroy()
    }
  })

  it('warns when a filter is set but no engine is registered', () => {
    const api = makeApi({ kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' }, false)
    const { target, destroy } = mountCmp(SvAdvancedFilter as never, { api })
    try {
      flushSync()
      expect((target as HTMLElement).textContent).toContain('no advanced-filter engine')
    } finally {
      destroy()
    }
  })

  it('shows no warning when the filter is actually running', () => {
    const api = makeApi({ kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' }, true)
    const { target, destroy } = mountCmp(SvAdvancedFilter as never, { api })
    try {
      flushSync()
      expect((target as HTMLElement).textContent).not.toContain('no advanced-filter engine')
    } finally {
      destroy()
    }
  })
})

describe('Builder tab availability', () => {
  const mountEditor = (value: unknown, mode = 'text') =>
    mountCmp(SvExpressionEditorDirect as never, { columns, value, mode })

  const builderBtn = (t: HTMLElement) =>
    [...t.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Builder') as
      | HTMLButtonElement
      | undefined

  it('is disabled, with a reason, for an expression the builder cannot show', () => {
    // Column maths / aggregates have no flat-condition representation. Letting
    // the user click and then refusing with a red error reads as a bug; the
    // refusal is a property of the expression, so say so up front.
    const { target, destroy } = mountEditor({
      kind: 'scalarCmp',
      left: { kind: 'col', id: 'amount' },
      op: '>',
      right: { kind: 'agg', fn: 'avg', column: 'amount' },
    })
    try {
      flushSync()
      const b = builderBtn(target as HTMLElement)!
      expect(b.disabled).toBe(true)
      expect(b.title).toMatch(/cannot represent column maths/i)
    } finally {
      destroy()
    }
  })

  it('is enabled for the empty expression, so a cleared filter is editable', () => {
    // This is the case that looked broken: Clear leaves `true` in the box.
    const { target, destroy } = mountEditor({ kind: 'const', value: true })
    try {
      flushSync()
      expect(builderBtn(target as HTMLElement)!.disabled).toBe(false)
    } finally {
      destroy()
    }
  })

  it('is enabled for a plain condition', () => {
    const { target, destroy } = mountEditor({
      kind: 'cmp',
      column: 'region',
      op: 'equals',
      value: 'EMEA',
    })
    try {
      flushSync()
      expect(builderBtn(target as HTMLElement)!.disabled).toBe(false)
    } finally {
      destroy()
    }
  })
})
