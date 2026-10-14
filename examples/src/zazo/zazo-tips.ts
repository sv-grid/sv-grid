/**
 * One thing to try in every demo, and what on the page it is about. Zazo
 * reads the tip aloud (tools/zazo-voice.mjs renders each one as
 * tip-<demo id>), looks at the target and rings it.
 *
 * The tips live in zazo-tips.json, one per gallery demo, each written against
 * that demo's live page: its target is something the page really shows. The
 * browser loads the file as its own chunk the first time Zazo appears.
 *
 * A target is found inside the demo stage: every visible match of `sel`,
 * narrowed to those whose aria-label, placeholder or text contains `text`,
 * then the `nth` (default 0). tests/e2e/zazo-tips.spec.ts opens the demos and
 * fails when a target no longer exists (a fixed sample in CI, every demo with
 * ZAZO_TIPS=all), and if one goes missing anyway he still says the tip, he
 * just has nothing to ring.
 */

export type TipTarget = { sel: string; text?: string; nth?: number }
export type Tip = { text: string; target: TipTarget }

/** Every tip, by demo id. */
export const loadTips = (): Promise<Record<string, Tip>> =>
  import('./zazo-tips.json').then((m) => m.default as Record<string, Tip>)

/** The tip's target in the demo stage, or null when it is not on screen. */
export function findTipTarget(stage: ParentNode, t: TipTarget): HTMLElement | null {
  const visible = (e: Element) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const label = (e: Element) => `${e.getAttribute('aria-label') ?? ''} ${(e as HTMLInputElement).placeholder ?? ''} ${e.textContent ?? ''}`
  let all: HTMLElement[]
  try {
    all = [...stage.querySelectorAll<HTMLElement>(t.sel)].filter(visible)
  } catch {
    return null // a selector the browser does not accept
  }
  const hits = t.text ? all.filter((e) => label(e).includes(t.text!)) : all
  return hits[t.nth ?? 0] ?? null
}
