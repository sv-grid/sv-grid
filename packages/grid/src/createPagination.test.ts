import { describe, expect, it, vi } from 'vitest'
import { createPagination } from './createPagination'

function make(over: Partial<{ page: number; pageCount: number; disabled: boolean }> = {}) {
  let page = over.page ?? 5
  const onChange = vi.fn((p: number) => (page = p))
  const pg = createPagination({
    page: () => page,
    pageCount: () => over.pageCount ?? 20,
    onChange,
    disabled: () => over.disabled ?? false,
  })
  return { pg, onChange, getPage: () => page }
}

describe('createPagination', () => {
  it('builds the page/ellipsis sequence around the current page', () => {
    const { pg } = make({ page: 10, pageCount: 20 })
    expect(pg.items[0]).toBe(1)
    expect(pg.items).toContain(10)
    expect(pg.items.some((i) => i === 'ellipsis-left')).toBe(true)
    expect(pg.items.some((i) => i === 'ellipsis-right')).toBe(true)
    expect(pg.items.at(-1)).toBe(20)
  })

  it('clamps navigation to [1, pageCount] and only fires on a real change', () => {
    const { pg, onChange } = make({ page: 1, pageCount: 20 })
    pg.prev() // already at 1 -> clamped, no change
    expect(onChange).not.toHaveBeenCalled()
    pg.next()
    expect(onChange).toHaveBeenLastCalledWith(2)
    pg.last()
    expect(onChange).toHaveBeenLastCalledWith(20)
  })

  it('go() clamps out-of-range targets', () => {
    const { pg, onChange } = make({ page: 5, pageCount: 20 })
    pg.go(999)
    expect(onChange).toHaveBeenLastCalledWith(20)
    pg.go(-3)
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('canPrev/canNext reflect the edges', () => {
    expect(make({ page: 1, pageCount: 20 }).pg.canPrev()).toBe(false)
    expect(make({ page: 1, pageCount: 20 }).pg.canNext()).toBe(true)
    expect(make({ page: 20, pageCount: 20 }).pg.canNext()).toBe(false)
  })

  it('is inert while disabled', () => {
    const { pg, onChange } = make({ page: 5, pageCount: 20, disabled: true })
    pg.next()
    expect(onChange).not.toHaveBeenCalled()
    expect(pg.canPrev()).toBe(false)
    expect(pg.canNext()).toBe(false)
    expect(pg.pageButtonProps(3).disabled).toBe(true)
  })

  it('marks the active page in prop-getters', () => {
    const { pg } = make({ page: 5, pageCount: 20 })
    expect(pg.isActive(5)).toBe(true)
    expect(pg.pageButtonProps(5)['aria-current']).toBe('page')
    expect(pg.pageButtonProps(6)['aria-current']).toBeUndefined()
  })
})
