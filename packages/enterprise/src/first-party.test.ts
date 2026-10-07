// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFirstPartySite } from './first-party'
import { dismissUpgradePrompt, showUpgradePrompt } from './upgrade-prompt'

const CARD = '[data-svgrid-enterprise-upgrade]'

describe('svgrid.com runs the Enterprise demos without the nudges', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    dismissUpgradePrompt()
    document.body.innerHTML = ''
  })

  it('recognises only svgrid.com and www.svgrid.com', () => {
    for (const [host, expected] of [
      ['svgrid.com', true],
      ['www.svgrid.com', true],
      ['SVGRID.COM', true],
      ['localhost', false],
      ['svgrid.com.evil.example', false],
      ['notsvgrid.com', false],
      ['mcp.svgrid.com', false],
    ] as const) {
      vi.stubGlobal('location', { hostname: host })
      expect(isFirstPartySite(), host).toBe(expected)
    }
  })

  it('shows no upgrade card on svgrid.com, and does elsewhere', () => {
    vi.stubGlobal('location', { hostname: 'svgrid.com' })
    showUpgradePrompt('Export')
    expect(document.querySelector(CARD)).toBeNull()

    vi.stubGlobal('location', { hostname: 'customer.example' })
    showUpgradePrompt('Export')
    expect(document.querySelector(CARD)).not.toBeNull()
  })
})
