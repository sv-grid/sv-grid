import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createScrollSync } from './scroll-sync'

// ---------------------------------------------------------------------------
// Fake controller `ctx` for the scroll-sync handlers. As with the other
// controller-slice tests, the handlers read/write everything through `ctx`,
// so a hand-rolled stub drives every branch. Where the handler reads real DOM
// geometry (tooltip placement, scroll offsets) we build genuine elements and
// stub getBoundingClientRect / scroll metrics.
// ---------------------------------------------------------------------------

function makeCtx(overrides: Record<string, unknown> = {}) {
  const ctx: any = {
    tooltip: null,
    tooltipTimer: null,
    scrollSyncRaf: null,
    scrollVersion: 0,
    pendingScrollTop: 0,
    pendingScrollLeft: 0,
    rowVirtualizationEnabled: false,
    columnVirtualizationEnabled: false,
    scrollBottomArmed: true,
    columnMenuFor: null,
    operatorMenuFor: null,
    closeMenus: vi.fn(),
    domToLogicalRowOffset: (n: number) => n,
    virtualizer: { setScrollOffset: vi.fn() },
    columnVirtualizer: { setHorizontalOffset: vi.fn() },
    props: {},
    ...overrides,
  }
  return ctx
}

const syncFor = (overrides?: Record<string, unknown>) => {
  const ctx = makeCtx(overrides)
  return { ctx, ss: createScrollSync(ctx) }
}

describe('showTooltipFor / hideTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function anchorEl(rect: Partial<DOMRect>) {
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect
    return el
  }

  it('does nothing when there is no text', () => {
    const { ctx, ss } = syncFor()
    ss.showTooltipFor(anchorEl({}), '')
    expect(ctx.tooltipTimer).toBeNull()
    vi.runAllTimers()
    expect(ctx.tooltip).toBeNull()
  })

  it('schedules a tooltip after the debounce, positioned below the anchor', () => {
    const { ctx, ss } = syncFor()
    // Anchor near the top of a tall viewport -> tooltip appears below.
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
    const el = anchorEl({ left: 100, right: 140, top: 50, bottom: 70 })
    ss.showTooltipFor(el, 'hello')
    expect(ctx.tooltipTimer).not.toBeNull()
    expect(ctx.tooltip).toBeNull() // not yet flushed
    vi.advanceTimersByTime(250)
    expect(ctx.tooltip).toEqual({
      text: 'hello',
      x: 106, // left + 6, within clamp range
      y: 76, // bottom + 6 since "below"
      below: true,
    })
  })

  it('flips above the anchor when there is no room below', () => {
    const { ctx, ss } = syncFor()
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 200)
    // bottom + 64 is NOT < 200, so the tooltip renders above.
    const el = anchorEl({ left: 100, right: 140, top: 150, bottom: 170 })
    ss.showTooltipFor(el, 'world')
    vi.advanceTimersByTime(250)
    expect(ctx.tooltip.below).toBe(false)
    expect(ctx.tooltip.y).toBe(144) // top - 6
  })

  it('clamps x so a wide tooltip stays inside the viewport', () => {
    const { ctx, ss } = syncFor()
    vi.stubGlobal('innerWidth', 300)
    vi.stubGlobal('innerHeight', 800)
    const el = anchorEl({ left: 280, right: 300, top: 10, bottom: 30 })
    ss.showTooltipFor(el, 'edge')
    vi.advanceTimersByTime(250)
    // x clamped to vw - 290 = 10.
    expect(ctx.tooltip.x).toBe(10)
  })

  it('clears a pending timer before scheduling a new tooltip', () => {
    const { ctx, ss } = syncFor()
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    const el = anchorEl({ left: 10, right: 30, top: 10, bottom: 30 })
    ss.showTooltipFor(el, 'first')
    ss.showTooltipFor(el, 'second')
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('hideTooltip clears the pending timer and the tooltip', () => {
    const { ctx, ss } = syncFor()
    const el = anchorEl({ left: 10, right: 30, top: 10, bottom: 30 })
    ss.showTooltipFor(el, 'gone')
    ctx.tooltip = { text: 'x', x: 0, y: 0, below: true }
    ss.hideTooltip()
    expect(ctx.tooltipTimer).toBeNull()
    expect(ctx.tooltip).toBeNull()
  })

  it('hideTooltip is safe when no timer is pending', () => {
    const { ctx, ss } = syncFor()
    ctx.tooltip = { text: 'x', x: 0, y: 0, below: true }
    ss.hideTooltip()
    expect(ctx.tooltip).toBeNull()
  })
})

describe('scheduleScrollSync / flushScheduledScrollSync', () => {
  let rafCb: FrameRequestCallback | null = null
  let rafCalls = 0
  beforeEach(() => {
    rafCb = null
    rafCalls = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      rafCalls += 1
      return 42
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records the pending offsets and schedules a single rAF', () => {
    const { ctx, ss } = syncFor()
    ss.scheduleScrollSync(120, 45)
    expect(ctx.pendingScrollTop).toBe(120)
    expect(ctx.pendingScrollLeft).toBe(45)
    expect(ctx.scrollSyncRaf).toBe(42)
    expect(rafCalls).toBe(1)
  })

  it('coalesces back-to-back calls into one frame (latest position wins)', () => {
    const { ctx, ss } = syncFor()
    ss.scheduleScrollSync(10, 0)
    ss.scheduleScrollSync(200, 5) // raf already pending, must not re-schedule
    expect(rafCalls).toBe(1)
    expect(ctx.pendingScrollTop).toBe(200)
    expect(ctx.pendingScrollLeft).toBe(5)
  })

  it('flush bumps scrollVersion and clears the raf handle', () => {
    const { ctx, ss } = syncFor()
    ss.scheduleScrollSync(50, 50)
    rafCb?.(0)
    expect(ctx.scrollVersion).toBe(1)
    expect(ctx.scrollSyncRaf).toBeNull()
  })

  it('flush pushes the row offset through domToLogicalRowOffset when row virtualization is on', () => {
    const setScrollOffset = vi.fn()
    const { ss } = syncFor({
      rowVirtualizationEnabled: true,
      domToLogicalRowOffset: (n: number) => n * 2,
      virtualizer: { setScrollOffset },
    })
    ss.scheduleScrollSync(30, 0)
    rafCb?.(0)
    expect(setScrollOffset).toHaveBeenCalledWith(60)
  })

  it('flush pushes the horizontal offset when column virtualization is on', () => {
    const setHorizontalOffset = vi.fn()
    const { ss } = syncFor({
      columnVirtualizationEnabled: true,
      columnVirtualizer: { setHorizontalOffset },
    })
    ss.scheduleScrollSync(0, 88)
    rafCb?.(0)
    expect(setHorizontalOffset).toHaveBeenCalledWith(88)
  })

  it('flush skips both virtualizers when neither is enabled', () => {
    const { ctx, ss } = syncFor()
    ss.scheduleScrollSync(5, 5)
    rafCb?.(0)
    expect(ctx.virtualizer.setScrollOffset).not.toHaveBeenCalled()
    expect(ctx.columnVirtualizer.setHorizontalOffset).not.toHaveBeenCalled()
  })
})

describe('onBodyScroll', () => {
  let rafCb: FrameRequestCallback | null = null
  beforeEach(() => {
    rafCb = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      return 7
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function scrollEvent(container: HTMLElement | null) {
    return { currentTarget: container } as unknown as Event
  }

  function scroller(props: Partial<{
    scrollTop: number
    scrollLeft: number
    scrollHeight: number
    clientHeight: number
  }>) {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollTop', { value: props.scrollTop ?? 0, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: props.scrollLeft ?? 0, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: props.scrollHeight ?? 0, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: props.clientHeight ?? 0, configurable: true })
    return el
  }

  it('does nothing when there is no current target', () => {
    const { ctx, ss } = syncFor()
    ss.onBodyScroll(scrollEvent(null))
    expect(ctx.pendingScrollTop).toBe(0)
  })

  it('records the container scroll offsets via scheduleScrollSync', () => {
    const { ctx, ss } = syncFor()
    const el = scroller({ scrollTop: 90, scrollLeft: 12 })
    ss.onBodyScroll(scrollEvent(el))
    expect(ctx.pendingScrollTop).toBe(90)
    expect(ctx.pendingScrollLeft).toBe(12)
    expect(ctx.scrollSyncRaf).toBe(7)
  })

  it('closes open column/operator menus on scroll', () => {
    const closeMenus = vi.fn()
    const { ss } = syncFor({ columnMenuFor: 'x', closeMenus })
    ss.onBodyScroll(scrollEvent(scroller({})))
    expect(closeMenus).toHaveBeenCalled()
  })

  it('closes menus when an operator menu is open', () => {
    const closeMenus = vi.fn()
    const { ss } = syncFor({ operatorMenuFor: 'op', closeMenus })
    ss.onBodyScroll(scrollEvent(scroller({})))
    expect(closeMenus).toHaveBeenCalled()
  })

  it('does not close menus when none are open', () => {
    const closeMenus = vi.fn()
    const { ss } = syncFor({ closeMenus })
    ss.onBodyScroll(scrollEvent(scroller({})))
    expect(closeMenus).not.toHaveBeenCalled()
  })

  it('fires onScrollBottomReached once when the scroll reaches the bottom', () => {
    const onScrollBottomReached = vi.fn()
    const { ctx, ss } = syncFor({
      props: { onScrollBottomReached },
      scrollBottomArmed: true,
    })
    // scrollTop + clientHeight >= scrollHeight - 32 -> at bottom.
    const el = scroller({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 })
    ss.onBodyScroll(scrollEvent(el))
    expect(onScrollBottomReached).toHaveBeenCalledWith({
      scrollTop: 600,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    expect(ctx.scrollBottomArmed).toBe(false) // disarmed so it won't refire
  })

  it('does not refire onScrollBottomReached while still at the bottom (disarmed)', () => {
    const onScrollBottomReached = vi.fn()
    const { ss } = syncFor({
      props: { onScrollBottomReached },
      scrollBottomArmed: false,
    })
    const el = scroller({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 })
    ss.onBodyScroll(scrollEvent(el))
    expect(onScrollBottomReached).not.toHaveBeenCalled()
  })

  it('re-arms the trigger after scrolling away from the bottom', () => {
    const onScrollBottomReached = vi.fn()
    const { ctx, ss } = syncFor({
      props: { onScrollBottomReached },
      scrollBottomArmed: false,
    })
    // Not at bottom: scrollTop + clientHeight < scrollHeight - 32.
    const el = scroller({ scrollTop: 100, clientHeight: 400, scrollHeight: 1000 })
    ss.onBodyScroll(scrollEvent(el))
    expect(ctx.scrollBottomArmed).toBe(true)
    expect(onScrollBottomReached).not.toHaveBeenCalled()
  })

  it('skips the bottom-reached logic entirely when no callback is registered', () => {
    const { ctx, ss } = syncFor({ scrollBottomArmed: true })
    const el = scroller({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 })
    ss.onBodyScroll(scrollEvent(el))
    // Armed flag is untouched when there is no callback.
    expect(ctx.scrollBottomArmed).toBe(true)
  })
})

describe('createScrollSync wiring', () => {
  it('exposes the documented handler surface', () => {
    const { ss } = syncFor()
    expect(Object.keys(ss).sort()).toEqual(
      ['flushScheduledScrollSync', 'hideTooltip', 'onBodyScroll', 'scheduleScrollSync', 'showTooltipFor'],
    )
  })
})
