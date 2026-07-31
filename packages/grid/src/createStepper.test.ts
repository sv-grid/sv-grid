import { describe, expect, it, vi } from 'vitest'
import { createStepper } from './createStepper'

function make(over: Partial<{ current: number; count: number; linear: boolean }> = {}) {
  let current = over.current ?? 2
  const onChange = vi.fn((i: number) => (current = i))
  const st = createStepper({
    count: () => over.count ?? 5,
    current: () => current,
    onChange,
    linear: () => over.linear ?? true,
  })
  return { st, onChange }
}

describe('createStepper', () => {
  it('reports per-step status relative to the current step', () => {
    const { st } = make({ current: 2 })
    expect(st.statusOf(0)).toBe('complete')
    expect(st.statusOf(1)).toBe('complete')
    expect(st.statusOf(2)).toBe('active')
    expect(st.statusOf(3)).toBe('upcoming')
  })

  it('in linear mode only reached steps are clickable', () => {
    const { st } = make({ current: 2, linear: true })
    expect(st.clickable(1)).toBe(true) // complete
    expect(st.clickable(2)).toBe(true) // active
    expect(st.clickable(3)).toBe(false) // upcoming
  })

  it('in free mode every step is clickable', () => {
    const { st } = make({ current: 2, linear: false })
    expect(st.clickable(4)).toBe(true)
  })

  it('go() navigates only to clickable, different steps', () => {
    const { st, onChange } = make({ current: 2, linear: true })
    st.go(4) // upcoming, blocked in linear mode
    expect(onChange).not.toHaveBeenCalled()
    st.go(0) // reached
    expect(onChange).toHaveBeenLastCalledWith(0)
    st.go(2) // same as current
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('prev/next step through (relative to current)', () => {
    const fwd = make({ current: 2, linear: false })
    fwd.st.next()
    expect(fwd.onChange).toHaveBeenLastCalledWith(3)
    const back = make({ current: 2, linear: false })
    back.st.prev()
    expect(back.onChange).toHaveBeenLastCalledWith(1)
  })

  it('stepButtonProps marks the active step and disables unreachable ones', () => {
    const { st } = make({ current: 2, linear: true })
    expect(st.stepButtonProps(2)['aria-current']).toBe('step')
    expect(st.stepButtonProps(0)['aria-current']).toBeUndefined()
    expect(st.stepButtonProps(3).disabled).toBe(true)
  })
})
