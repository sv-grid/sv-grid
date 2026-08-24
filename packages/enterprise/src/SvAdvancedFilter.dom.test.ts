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

describe('nested groups in the builder', () => {
  const mountEditor = (value: unknown) =>
    mountCmp(SvExpressionEditorDirect as never, { columns, value, mode: 'builder' })

  const buttons = (t: HTMLElement, label: string) =>
    [...t.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label)

  const nested: PredicateExpr = {
    kind: 'or',
    parts: [
      { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' },
      {
        kind: 'and',
        parts: [
          { kind: 'cmp', column: 'amount', op: 'greaterThan', value: '300' },
          { kind: 'cmp', column: 'region', op: 'equals', value: 'APAC' },
        ],
      },
    ],
  }

  it('opens in the builder for an expression that used to force text mode', () => {
    // Before the tree this fell back to text and the Builder tab was disabled.
    const { target, destroy } = mountEditor(nested)
    try {
      flushSync()
      const el = target as HTMLElement
      expect(el.querySelector('.sx-group')).not.toBeNull()
      const builder = [...el.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Builder',
      ) as HTMLButtonElement
      expect(builder.disabled).toBe(false)
    } finally {
      destroy()
    }
  })

  it('renders one nested group with its own combinator', () => {
    const { target, destroy } = mountEditor(nested)
    try {
      flushSync()
      const el = target as HTMLElement
      expect(el.querySelectorAll('.sx-group')).toHaveLength(1)
      // Outer "any" plus inner "all" means two combinator rows, not one.
      expect(el.querySelectorAll('.sx-combinator')).toHaveLength(2)
    } finally {
      destroy()
    }
  })

  it('emits a nested expression once the group holds more than one condition', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountCmp(SvExpressionEditorDirect as never, {
      columns,
      value: { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' },
      mode: 'builder',
      onChange,
    })
    try {
      flushSync()
      const el = target as HTMLElement
      buttons(el, '+ Add group')[0]!.click()
      flushSync()
      // A group of one is the same expression as that one condition, so it
      // serializes flat on purpose - the AST stays minimal. The group is still
      // there in the UI, waiting for a second condition.
      expect(el.querySelectorAll('.sx-group')).toHaveLength(1)

      // Scope to the group rather than indexing: the nested group's actions
      // sit inside the root's rows, so it comes FIRST in document order.
      const group = el.querySelector('.sx-group') as HTMLElement
      buttons(group, '+ Add condition')[0]!.click()
      flushSync()

      const emitted = onChange.mock.lastCall?.[0] as PredicateExpr
      expect(emitted.kind).toBe('and')
      const parts = (emitted as { parts: PredicateExpr[] }).parts
      // Now it is a real nested node rather than a flattened sibling.
      expect(parts.some((p) => p.kind === 'or')).toBe(true)
    } finally {
      destroy()
    }
  })

  it('keeps an added group on screen instead of rebuilding it away', () => {
    // Regression: the editor compared the incoming `value` to its own last
    // emit by reference. `value` is $bindable, so the object coming back was
    // never the object sent, the check never matched, and every edit re-seeded
    // the tree from the emitted AST. A group of one collapses in that AST, so
    // adding a group looked like it did nothing at all.
    const { target, destroy } = mountEditor({
      kind: 'cmp',
      column: 'region',
      op: 'equals',
      value: 'EMEA',
    })
    try {
      flushSync()
      const el = target as HTMLElement
      buttons(el, '+ Add group')[0]!.click()
      flushSync()
      expect(el.querySelectorAll('.sx-group')).toHaveLength(1)
    } finally {
      destroy()
    }
  })

  it('defaults a nested group to the opposite combinator', () => {
    // Nesting an "all" inside an "all" is a no-op the user would have to undo.
    const { target, destroy } = mountEditor({
      kind: 'and',
      parts: [
        { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' },
        { kind: 'cmp', column: 'amount', op: 'greaterThan', value: '1' },
      ],
    })
    try {
      flushSync()
      buttons(target as HTMLElement, '+ Add group')[0]!.click()
      flushSync()
      const group = (target as HTMLElement).querySelector('.sx-group')
      expect(group).not.toBeNull()
      expect(group!.textContent).toContain('any')
    } finally {
      destroy()
    }
  })

  it('negates a group with the NOT toggle', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountCmp(SvExpressionEditorDirect as never, {
      columns,
      value: nested,
      mode: 'builder',
      onChange,
    })
    try {
      flushSync()
      const not = [...(target as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'NOT',
      ) as HTMLButtonElement
      expect(not.getAttribute('aria-pressed')).toBe('false')
      not.click()
      flushSync()
      const emitted = onChange.mock.lastCall?.[0] as PredicateExpr
      const parts = (emitted as { parts: PredicateExpr[] }).parts
      expect(parts.some((p) => p.kind === 'not')).toBe(true)
    } finally {
      destroy()
    }
  })

  it('keeps an editable row after the root is emptied', () => {
    // Removing the last root child must not leave a builder with nowhere
    // to type.
    const { target, destroy } = mountEditor({
      kind: 'cmp',
      column: 'region',
      op: 'equals',
      value: 'EMEA',
    })
    try {
      flushSync()
      const el = target as HTMLElement
      ;(el.querySelector('.sx-del') as HTMLButtonElement).click()
      flushSync()
      expect(el.querySelectorAll('.sx-row').length).toBeGreaterThan(0)
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
