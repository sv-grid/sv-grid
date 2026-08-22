// Product-led-growth (PLG) upgrade nudge, shown at the *moment of intent*: the
// instant a developer actually calls a Pro feature (export / import / print /
// AI) without a license key set. Unlike the passive corner watermark
// (watermark.ts), this is a one-click contextual card that names the feature
// they just used and links straight to a free trial.
//
// Rules of the road:
//   - Soft, never blocking. The feature already ran; this only nudges.
//   - Shows once per session (SPA lifetime). Once shown - whether the user
//     acts on it or closes it - it stays quiet for the rest of the session.
//     Calling setLicenseKey() silences it before it ever appears.
//   - Storage-free: no cookies, no localStorage, no sessionStorage. State is
//     a single in-memory flag, so the library keeps its "zero web storage"
//     promise (see docs/help/security.md). A hard reload may show it once
//     more - by design; that's still a moment-of-intent nudge.
//   - SSR-safe: every DOM access is guarded. On the server it's a no-op.
//   - Zero dependencies, inline styles - no CSS file to import, nothing to
//     bundle, works in any host app regardless of its styling.

const CARD_ATTR = 'data-svgrid-enterprise-upgrade'
const PRICING_URL = 'https://svgrid.com/pricing'
// ?ref=in-app lets us measure how many trials start from this exact prompt
// vs. the pricing page itself - the whole point of a moment-of-intent CTA.
const TRIAL_URL = 'https://svgrid.com/pricing?ref=in-app&utm_source=svgrid-enterprise&utm_medium=upgrade-prompt'

let shownThisSession = false

/** Human-readable labels for the Pro surfaces that gate behind a license. */
export type EnterpriseFeatureLabel =
  | 'Export'
  | 'Import'
  | 'Print'
  | 'AI assistant'
  | 'Pivot'
  | 'Studio'

/**
 * Show the contextual upgrade prompt for `feature`. No-ops if one has already
 * been shown this session, a card is already up, or we're on the server. Safe
 * to call on every Pro feature invocation - it self-throttles.
 */
export function showUpgradePrompt(
  feature?: EnterpriseFeatureLabel | string,
  opts?: { expired?: boolean },
): void {
  if (shownThisSession) return
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (document.querySelector(`[${CARD_ATTR}]`)) return
  shownThisSession = true

  const card = buildCard(feature, opts?.expired === true)
  document.body.appendChild(card)
  // Animate in on the next frame so the transition actually runs.
  requestAnimationFrame(() => {
    card.style.opacity = '1'
    card.style.transform = 'translateY(0)'
  })
}

/**
 * Remove the card if present and re-arm the once-per-session flag so a later
 * `showUpgradePrompt()` can show again. Mainly for hosts that want to control
 * the nudge themselves (and for tests).
 */
export function dismissUpgradePrompt(): void {
  shownThisSession = false
  if (typeof document === 'undefined') return
  document.querySelectorAll(`[${CARD_ATTR}]`).forEach((el) => el.remove())
}

// User closed or clicked through the card. Remove it, but leave
// `shownThisSession` set so it does not reappear for the rest of the session.
function close(card: HTMLElement): void {
  card.style.opacity = '0'
  card.style.transform = 'translateY(8px)'
  window.setTimeout(() => card.remove(), 220)
}

function buildCard(feature?: EnterpriseFeatureLabel | string, expired = false): HTMLElement {
  const card = document.createElement('div')
  card.setAttribute(CARD_ATTR, '1')
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-label', expired ? 'Your trial has ended' : 'Unlock SvGrid Pro')
  Object.assign(card.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '2147483646', // one below the watermark so they never collide
    width: '320px',
    maxWidth: 'calc(100vw - 32px)',
    boxSizing: 'border-box',
    padding: '16px 16px 14px',
    background: '#0f172a',
    color: '#e2e8f0',
    borderRadius: '12px',
    border: '1px solid rgba(99,102,241,0.4)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
    fontFamily: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '13px',
    lineHeight: '1.45',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 220ms ease, transform 220ms ease',
  } as Partial<CSSStyleDeclaration> as CSSStyleDeclaration)

  const featureName = feature ? String(feature) : 'This'
  const featurePhrase = feature
    ? `<strong style="color:#fff">${escapeHtml(featureName)}</strong> is a Pro feature.`
    : `You just used a <strong style="color:#fff">Pro</strong> feature.`

  // An expired trial is a different message from "you never had a licence":
  // they already evaluated, so the ask is to convert, not to start over.
  const badge = expired ? 'TRIAL ENDED' : 'PRO'
  const heading = expired ? 'Your trial has ended' : 'Unlock SvGrid Pro'
  const body = expired
    ? `${featurePhrase} Your evaluation period is over - everything still works,
       but this notice stays until a licence key is set.`
    : `${featurePhrase} It runs in evaluation with a watermark - start a free trial
       to remove it and ship to production.`
  const cta = expired ? 'Buy a licence' : 'Start free trial'

  card.innerHTML = `
    <button type="button" data-act="x" aria-label="Dismiss"
      style="position:absolute;top:8px;right:8px;width:24px;height:24px;display:flex;
      align-items:center;justify-content:center;background:transparent;border:0;
      color:#94a3b8;font-size:18px;line-height:1;cursor:pointer;border-radius:6px;">&times;</button>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="display:inline-block;background:${expired ? '#b45309' : '#4f46e5'};color:#fff;font-size:10px;
        font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:999px;">${badge}</span>
      <span style="font-weight:700;color:#fff;">${heading}</span>
    </div>
    <p style="margin:0 0 12px;color:#cbd5e1;">
      ${body}
    </p>
    <div style="display:flex;gap:8px;align-items:center;">
      <a data-act="trial" href="${TRIAL_URL}" target="_blank" rel="noopener noreferrer"
        style="flex:1;text-align:center;background:#6366f1;color:#fff;font-weight:600;
        text-decoration:none;padding:8px 12px;border-radius:8px;">${cta}</a>
      <a data-act="pricing" href="${PRICING_URL}" target="_blank" rel="noopener noreferrer"
        style="color:#a5b4fc;text-decoration:none;padding:8px 6px;font-weight:600;">Pricing</a>
    </div>
    <p style="margin:10px 0 0;font-size:11px;color:#64748b;">
      Already licensed? Call <code style="color:#94a3b8;">setLicenseKey()</code> at startup to hide this.
    </p>
  `

  card.querySelector('[data-act="x"]')?.addEventListener('click', () => close(card))
  // Clicking through to a trial / pricing also counts as "handled" - close the
  // card, but let the link open in its new tab first.
  card.querySelector('[data-act="trial"]')?.addEventListener('click', () => close(card))
  card.querySelector('[data-act="pricing"]')?.addEventListener('click', () => close(card))

  return card
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
