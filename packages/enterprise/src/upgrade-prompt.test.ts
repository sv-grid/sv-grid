/**
 * Tests for the moment-of-intent PLG upgrade prompt. Unlike the passive
 * watermark, this card is triggered when an Enterprise feature is actually
 * invoked unlicensed, names that feature, links to the plans and to how
 * evaluation works, and shows at most once per session.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showUpgradePrompt, dismissUpgradePrompt } from './upgrade-prompt'

const CARD_ATTR = 'data-svgrid-enterprise-upgrade'

function card(): HTMLElement | null {
  return document.querySelector(`[${CARD_ATTR}]`)
}

describe('upgrade prompt (moment-of-intent PLG nudge)', () => {
  beforeEach(() => {
    dismissUpgradePrompt()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    dismissUpgradePrompt()
  })

  it('renders a card naming the feature, with a plans CTA', () => {
    showUpgradePrompt('Export')
    const el = card()
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('Export')
    expect(el!.textContent).toContain('SvGrid Enterprise')

    const plans = el!.querySelector('a[data-act="plans"]') as HTMLAnchorElement
    expect(plans).not.toBeNull()
    expect(plans.href).toContain('svgrid.com/pricing')
    expect(plans.href).toContain('ref=in-app')
    expect(plans.target).toBe('_blank')

    const evaluation = el!.querySelector('a[data-act="evaluation"]') as HTMLAnchorElement
    expect(evaluation.href).toContain('svgrid.com/docs/enterprise/evaluation/')
  })

  // The one-key license has no trial keys: unlicensed use runs with a
  // watermark. A card promising a "free trial" sent people looking for one.
  it('promises no trial and does not use the old Pro name', () => {
    showUpgradePrompt('Export')
    const text = card()!.textContent ?? ''
    expect(text).not.toMatch(/trial/i)
    expect(text).not.toMatch(/\bPro\b/)
    expect(text).toContain('watermark')
  })

  it('shows at most once per session', () => {
    showUpgradePrompt('Export')
    expect(card()).not.toBeNull()
    // A second feature call must not stack a second card.
    showUpgradePrompt('Import')
    expect(document.querySelectorAll(`[${CARD_ATTR}]`).length).toBe(1)
  })

  it('removes the card on close and does not re-show for the session', () => {
    vi.useFakeTimers()
    try {
      showUpgradePrompt('Print')
      const closeBtn = card()!.querySelector('[data-act="x"]') as HTMLButtonElement
      closeBtn.click()
      // close animates out, then removes the node after the fade.
      vi.advanceTimersByTime(300)
      expect(card()).toBeNull()
      // A later feature call must not bring it back this session (the flag
      // stays set; only dismissUpgradePrompt() re-arms it).
      showUpgradePrompt('AI assistant')
      expect(card()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to a generic message when no feature is named', () => {
    showUpgradePrompt()
    expect(card()!.textContent).toContain('SvGrid Enterprise feature')
  })
})
