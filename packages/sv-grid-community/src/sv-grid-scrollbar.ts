type Orientation = 'horizontal' | 'vertical'

const ARROW_SIZE = 16
const HOLD_DELAY_MS = 280
const HOLD_INTERVAL_MS = 50
const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Build the chevron icon as real DOM nodes so the component is compatible
 * with strict Content Security Policies / Trusted Types (no innerHTML).
 */
function createChevronSvg(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '3')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M6 9l6 6 6-6')
  svg.appendChild(path)
  return svg
}

/**
 * Each visible part of the scrollbar reads from a CSS custom property so
 * applications can theme it (e.g. a dark theme) without forking the
 * component. The fallbacks are the original light-mode palette so existing
 * embedders keep their look without changes.
 */
const STYLE_TEMPLATE = `
  :host {
    display: flex;
    user-select: none;
    background: var(--sg-scrollbar-bg, #eef2f8);
    box-shadow: inset 0 0 0 1px var(--sg-scrollbar-border, rgba(15, 23, 42, 0.04));
    /* Start hidden + non-interactive - viewport/content sizes are 0 until
       after the first layout pass, so without this default the scrollbar
       paints visible for one frame and then JS hides it on mount. That
       flicker is what shows up as a "flashing horizontal scrollbar"
       every time a demo first renders. updateGeometry() switches us to
       opacity 1 the moment the grid genuinely has overflow. */
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }
  :host([orientation="vertical"]) {
    flex-direction: column;
    width: ${ARROW_SIZE}px;
  }
  :host([orientation="horizontal"]) {
    flex-direction: row;
    height: ${ARROW_SIZE}px;
  }
  .arrow {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${ARROW_SIZE}px;
    height: ${ARROW_SIZE}px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--sg-scrollbar-arrow, #64748b);
    cursor: pointer;
    transition: background-color 100ms ease, color 100ms ease;
  }
  .arrow:hover {
    background: var(--sg-scrollbar-arrow-hover-bg, #dde4ee);
    color: var(--sg-scrollbar-arrow-hover, #1f2937);
  }
  .arrow:active {
    background: var(--sg-scrollbar-arrow-active-bg, #c7d1df);
    color: var(--sg-scrollbar-arrow-active, #0f172a);
  }
  .arrow:disabled {
    color: var(--sg-scrollbar-arrow-disabled, #cbd5e1);
    cursor: default;
  }
  .arrow:disabled:hover {
    background: transparent;
  }
  .arrow svg {
    width: 10px;
    height: 10px;
    display: block;
  }
  :host([orientation="vertical"]) .arrow-start svg {
    transform: rotate(180deg);
  }
  :host([orientation="horizontal"]) .arrow-start svg {
    transform: rotate(90deg);
  }
  :host([orientation="horizontal"]) .arrow-end svg {
    transform: rotate(-90deg);
  }
  .track {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
  }
  .thumb {
    position: absolute;
    border-radius: var(--sg-scrollbar-thumb-radius, 6px);
    background: var(--sg-scrollbar-thumb, #b1bccd);
    cursor: pointer;
    transition: background-color 100ms ease;
  }
  .thumb:hover {
    background: var(--sg-scrollbar-thumb-hover, #8693a7);
  }
  .thumb:active {
    background: var(--sg-scrollbar-thumb-active, #64748b);
  }
  :host([orientation="vertical"]) .thumb {
    left: 3px;
    right: 3px;
  }
  :host([orientation="horizontal"]) .thumb {
    top: 3px;
    bottom: 3px;
  }
`

class SvGridScrollbarElement extends HTMLElement {
  static get observedAttributes() {
    return ['orientation', 'viewport-size', 'content-size', 'value', 'step']
  }

  private track!: HTMLDivElement
  private thumb!: HTMLDivElement
  private startArrow!: HTMLButtonElement
  private endArrow!: HTMLButtonElement
  private dragging = false
  private dragStart = 0
  private valueStart = 0
  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private resizeObserver: ResizeObserver | null = null

  connectedCallback() {
    if (this.shadowRoot) return
    const shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = STYLE_TEMPLATE

    this.startArrow = this.createArrow('start')
    this.endArrow = this.createArrow('end')
    this.track = document.createElement('div')
    this.track.className = 'track'
    this.thumb = document.createElement('div')
    this.thumb.className = 'thumb'
    this.track.appendChild(this.thumb)

    shadow.append(style, this.startArrow, this.track, this.endArrow)

    this.thumb.addEventListener('pointerdown', this.onThumbPointerDown)
    this.track.addEventListener('pointerdown', this.onTrackPointerDown)
    this.startArrow.addEventListener('pointerdown', this.onArrowStartPointerDown)
    this.endArrow.addEventListener('pointerdown', this.onArrowEndPointerDown)
    for (const btn of [this.startArrow, this.endArrow]) {
      btn.addEventListener('pointerup', this.stopHold)
      btn.addEventListener('pointerleave', this.stopHold)
      btn.addEventListener('pointercancel', this.stopHold)
    }

    this.resizeObserver = new ResizeObserver(() => this.render())
    this.resizeObserver.observe(this)

    this.render()
  }

  disconnectedCallback() {
    this.stopHold()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)
  }

  attributeChangedCallback() {
    this.render()
  }

  private get orientation(): Orientation {
    return this.getAttribute('orientation') === 'horizontal' ? 'horizontal' : 'vertical'
  }

  private get viewportSize() {
    return Number(this.getAttribute('viewport-size') || '0')
  }

  private get contentSize() {
    return Number(this.getAttribute('content-size') || '0')
  }

  private get value() {
    return Number(this.getAttribute('value') || '0')
  }

  private get step() {
    const raw = Number(this.getAttribute('step') || '40')
    return raw > 0 ? raw : 40
  }

  private get maxValue() {
    return Math.max(this.contentSize - this.viewportSize, 0)
  }

  /** Measured length of the track between the two arrows, in the active axis. */
  private getTrackLength(): number {
    const rect = this.track.getBoundingClientRect()
    const measured = this.orientation === 'vertical' ? rect.height : rect.width
    if (measured > 0) return measured
    // Pre-layout fallback so the thumb still has a sensible size on first render.
    return Math.max(this.viewportSize - ARROW_SIZE * 2, 1)
  }

  private computeThumbSize(trackLength: number): number {
    if (this.contentSize <= 0 || this.viewportSize <= 0 || trackLength <= 0) return 0
    const ratio = Math.min(this.viewportSize / this.contentSize, 1)
    return Math.max(20, ratio * trackLength)
  }

  private createArrow(side: 'start' | 'end'): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `arrow arrow-${side}`
    btn.setAttribute(
      'aria-label',
      side === 'start' ? 'Scroll back' : 'Scroll forward',
    )
    btn.appendChild(createChevronSvg())
    return btn
  }

  private onArrowStartPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    this.startHold(-1)
  }

  private onArrowEndPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    this.startHold(1)
  }

  private startHold(direction: -1 | 1) {
    this.stopHold()
    const tick = () => this.emitScroll(this.value + direction * this.step)
    tick()
    this.holdTimer = setTimeout(() => {
      this.holdTimer = setInterval(tick, HOLD_INTERVAL_MS)
    }, HOLD_DELAY_MS)
  }

  private stopHold = () => {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer)
      clearInterval(this.holdTimer)
      this.holdTimer = null
    }
  }

  private onThumbPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    this.dragging = true
    this.dragStart = this.orientation === 'vertical' ? event.clientY : event.clientX
    this.valueStart = this.value
    document.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('pointerup', this.onPointerUp)
  }

  private onTrackPointerDown = (event: PointerEvent) => {
    if (event.target === this.thumb) return
    const rect = this.track.getBoundingClientRect()
    const coord =
      this.orientation === 'vertical' ? event.clientY - rect.top : event.clientX - rect.left
    const trackSize = this.orientation === 'vertical' ? rect.height : rect.width
    const thumbSize = this.computeThumbSize(trackSize)
    const available = Math.max(trackSize - thumbSize, 1)
    const offset = Math.min(Math.max(coord - thumbSize / 2, 0), available)
    this.emitScroll((offset / available) * this.maxValue)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging) return
    const current = this.orientation === 'vertical' ? event.clientY : event.clientX
    const delta = current - this.dragStart
    const rect = this.track.getBoundingClientRect()
    const trackSize = this.orientation === 'vertical' ? rect.height : rect.width
    const thumbSize = this.computeThumbSize(trackSize)
    const available = Math.max(trackSize - thumbSize, 1)
    this.emitScroll(this.valueStart + (delta / available) * this.maxValue)
  }

  private onPointerUp = () => {
    this.dragging = false
    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)
  }

  private emitScroll(next: number) {
    const bounded = Math.min(Math.max(next, 0), this.maxValue)
    this.dispatchEvent(
      new CustomEvent('scroll-change', {
        detail: { value: bounded },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private render() {
    if (!this.shadowRoot) return
    const viewport = this.viewportSize
    const content = this.contentSize
    const hidden = content <= viewport || viewport <= 0
    this.style.opacity = hidden ? '0' : '1'
    this.style.pointerEvents = hidden ? 'none' : 'auto'

    const trackLength = this.getTrackLength()
    const thumbSize = this.computeThumbSize(trackLength)
    const maxValue = this.maxValue
    const ratio = maxValue > 0 ? this.value / maxValue : 0
    const offset = ratio * Math.max(trackLength - thumbSize, 0)

    if (this.orientation === 'vertical') {
      this.thumb.style.height = `${thumbSize}px`
      this.thumb.style.transform = `translateY(${offset}px)`
    } else {
      this.thumb.style.width = `${thumbSize}px`
      this.thumb.style.transform = `translateX(${offset}px)`
    }
    this.startArrow.disabled = hidden || this.value <= 0
    this.endArrow.disabled = hidden || this.value >= maxValue
  }
}

if (typeof window !== 'undefined' && !customElements.get('sv-grid-scrollbar')) {
  customElements.define('sv-grid-scrollbar', SvGridScrollbarElement)
}

export {}
