import { describe, expect, it } from 'vitest'
import { keepOnScreen } from './keep-on-screen'

const vp = { width: 1280, height: 720 }
const menu = { width: 180, height: 110 }

describe('keepOnScreen', () => {
  it('leaves a panel that fits where the pointer is', () => {
    expect(keepOnScreen({ x: 100, y: 100 }, menu, vp)).toEqual({ x: 100, y: 100 })
  })

  it('opens above the pointer when it would run off the bottom', () => {
    expect(keepOnScreen({ x: 100, y: 700 }, menu, vp)).toEqual({ x: 100, y: 590 })
  })

  it('pulls back from the right edge', () => {
    expect(keepOnScreen({ x: 1276, y: 100 }, menu, vp)).toEqual({ x: 1280 - 180 - 8, y: 100 })
  })

  it('never goes above or left of the padding on a tiny viewport', () => {
    expect(keepOnScreen({ x: 50, y: 60 }, { width: 400, height: 300 }, { width: 300, height: 200 })).toEqual({ x: 8, y: 8 })
  })

  it('is stable: its own output comes back unchanged', () => {
    const once = keepOnScreen({ x: 1276, y: 716 }, menu, vp)
    expect(keepOnScreen(once, menu, vp)).toEqual(once)
  })
})
