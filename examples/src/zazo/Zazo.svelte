<script lang="ts" module>
  export type ZazoDemo = { id: string; title: string; blurb: string }
  export type ZazoLink = { label: string; href: string }
  /**
   * Where he sits: on the edge of `bar` (its bottom border, or its top edge),
   * just right of `after` when given, else just left of `beside`, else
   * `inset` px in from the bar's right. While he is on the page the wrapper
   * `.zazo` exists, so a host can make room for him with `:has(.zazo)`.
   */
  export type ZazoPerch = { bar: string; seat: 'top' | 'bottom'; after?: string; beside?: string; inset?: number }
  /**
   * What a visitor did with him, for the host's analytics: `action` is open,
   * menu, question, pick, tip, faq, sound, mic or hide, and `demo` the demo on
   * screen. A question carries what was asked (lowercased, at most 120
   * characters), the intent it read as, and what answered it.
   */
  export type ZazoEvent = { action: string; demo: string } & Record<string, string | number | boolean>
  export type ZazoMeta = { faq?: { question: string; answer: string }[] } | null
</script>

<script lang="ts">
  /**
   * Zazo, the developer from the promo cartoons, as the demo gallery's helper.
   * He sits on the top bar beside the search, legs hanging over its border, and
   * helps: what the open demo shows, finding another demo, how to install it,
   * and its source. People can type or say what they want (the mic uses the
   * browser's speech recognition). With his voice on he answers in the voice
   * from the cartoons: clips rendered ahead of time by tools/zazo-voice.mjs,
   * since a browser cannot hold the ElevenLabs key. His mouth, brows, eyes and
   * head follow the audio as it plays.
   *
   * "Hide Zazo" removes him (`?zazo` in the URL brings him back). Under
   * automation (navigator.webdriver) he stays away unless the URL has
   * `?zazo`, so e2e runs and recorded tutorials never get him. Hidden on
   * phones.
   *
   * Host-agnostic: the local gallery (examples/src/App.svelte) and the website
   * (website/src/routes/Demos.svelte) mount the same file. It lives outside
   * examples/src/shared on purpose: the website's playground and project
   * export pull in every file under shared/, and a demo has no use for Zazo.
   */
  import { onMount, tick, untrack } from 'svelte'
  import { matchFaq, understand, type Faq } from './zazo-brain'
  import { lineClip, shown, titleClip, type LineKey } from './zazo-lines'
  import { findTipTarget, loadTips, type Tip } from './zazo-tips'

  type View = 'hi' | 'about' | 'find' | 'start' | 'answer' | 'tip'
  type Mood = 'happy' | 'puzzled' | 'thinking'
  type Answer = { you: string; text: string; demos: ZazoDemo[]; docs: ZazoLink[]; links: ZazoLink[] }

  type Props = {
    /**
     * The demo on screen. Without one (the website's home page) he still finds
     * demos, shows how to install, says what is free, and answers questions;
     * the demo-only parts (about, tip, FAQ, source) stay out of his menu.
     */
    demo?: ZazoDemo | null
    /** Where he sits. */
    perch: ZazoPerch
    /** True when the demo imports @svgrid/enterprise. */
    enterprise?: boolean
    /** Docs that cover this demo, if the host knows them. */
    loadDocs?: (id: string) => Promise<ZazoLink[]>
    /** Docs pages matching a question, if the host can search them. */
    searchDocs?: (query: string) => Promise<ZazoLink[]>
    /** The getting-started page. */
    startHref: string
    /** The pricing page. */
    pricingHref: string
    /** Demos matching a query, best first. */
    search: (query: string) => ZazoDemo[] | Promise<ZazoDemo[]>
    onOpenDemo: (id: string) => void
    onShowSource?: () => void
    /** "Find me a demo" opens this (the page's own search) instead of his box. */
    onFind?: () => void
    /** The demo's meta json (examples/src/demos/meta/<id>.json); its FAQ answers questions. */
    loadMeta?: (id: string) => Promise<ZazoMeta>
    /** Where the demo renders, for pointing at a tip's target. */
    stage?: string
    /** What visitors do with him, for analytics. */
    onEvent?: (e: ZazoEvent) => void
    /** Hide while something else owns the screen (full screen, a modal). */
    hidden?: boolean
  }
  let { demo = null, perch, enterprise = false, loadDocs, searchDocs, startHref, pricingHref, search, onOpenDemo, onShowSource, onFind, loadMeta, stage = '.demo-stage', onEvent, hidden = false }: Props = $props()

  const emit = (action: string, data: Record<string, string | number | boolean> = {}) => {
    try { onEvent?.({ action, demo: demo?.id ?? '', ...data }) } catch { /* analytics never breaks him */ }
  }

  const KEY = 'svgrid-zazo'
  const SOUND_KEY = 'svgrid-zazo-sound'
  const read = (k: string): string | null => {
    try { return localStorage.getItem(k) } catch { return null }
  }
  const write = (k: string, v: string) => {
    try { localStorage.setItem(k, v) } catch { /* private mode */ }
  }

  // Off until mounted and allowed: no wrapper in prerendered HTML or under automation.
  let off = $state(true)
  let shown_ = $state(false) // hopped on
  let open = $state(false)
  let view = $state<View>('hi')
  let waving = $state(false)
  let mood = $state<Mood>('happy')

  // ---- where he sits ----------------------------------------------------------
  const W = 52 // px wide; the figure is 0..100 x -8..120 in its viewBox
  const H = W * 1.28
  const SEAT = (96 + 8) * (W / 100) // the seat line, px from his top
  let pos = $state<{ x: number; y: number } | null>(null)
  let vw = $state(1280)
  let vh = $state(800)
  let placing = 0
  function place() {
    cancelAnimationFrame(placing)
    placing = requestAnimationFrame(() => {
      vw = innerWidth
      vh = innerHeight
      const bar = document.querySelector(perch.bar)
      if (!bar) { pos = null; return }
      const b = bar.getBoundingClientRect()
      if (!b.width || b.bottom < 0 || b.top > vh) { pos = null; return }
      const seatY = (perch.seat === 'top' ? b.top : b.bottom) - SEAT
      const after = perch.after ? document.querySelector(perch.after)?.getBoundingClientRect() : null
      // The element he sits after is on the page but hidden (a phone layout
      // drops it): he sits out rather than fall back to the bar's edge, where
      // he would cover the icons.
      if (after && !after.width) { pos = null; return }
      if (after && after.width) {
        const x = after.right + 10
        // Off the window's edge on a narrow screen: then he sits out.
        if (x + W > vw - 2) { pos = null; return }
        pos = { x: Math.round(x), y: Math.round(seatY) }
        return
      }
      const besideEl = perch.beside ? document.querySelector(perch.beside) : null
      const beside = besideEl?.getBoundingClientRect()
      const right = beside && beside.width ? beside.left - 10 : b.right - (perch.inset ?? 16)
      if (beside && beside.width) {
        // Only where the bar has a gap for him: on a narrow window the nav
        // runs up to the search, and he would sit on a link.
        let used = b.left
        for (const el of bar.querySelectorAll('a, button, input')) {
          if (el === besideEl || besideEl!.contains(el)) continue
          const r = el.getBoundingClientRect()
          if (r.width && r.right <= beside.left) used = Math.max(used, r.right)
        }
        if (right - W < used + 4) { pos = null; return }
      }
      pos = { x: Math.round(right - W), y: Math.round((perch.seat === 'top' ? b.top : b.bottom) - SEAT) }
    })
  }
  const PANEL = 340
  const panelLeft = $derived(pos ? Math.max(8, Math.min(vw - PANEL - 8, pos.x + W / 2 - PANEL + 60)) : 8)
  const panelTop = $derived(pos ? pos.y + H + 6 : 80)
  const tailX = $derived(pos ? pos.x + W / 2 - panelLeft - 7 : 40)

  // ---- voice --------------------------------------------------------------------
  const CLIPS = import.meta.glob('./voice/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>
  const clipUrl = (clip: string) => CLIPS[`./voice/${clip}.mp3`]

  type Recognition = {
    lang: string
    interimResults: boolean
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
    onend: (() => void) | null
    onerror: ((e: { error: string }) => void) | null
    start(): void
    stop(): void
  }
  let canListen = $state(false)
  let sound = $state(false)
  let speaking = $state(false)
  let listening = $state(false)
  let micNote = $state('')
  let recognition: Recognition | null = null

  let audio: HTMLAudioElement | null = null
  let actx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let liveMouth = $state(false) // the mouth follows the audio (Web Audio available)
  let queue: string[] = []
  let figure = $state<HTMLButtonElement | null>(null)

  function ensureAudio() {
    if (audio) return
    audio = new Audio()
    audio.preload = 'auto'
    audio.onended = playNext
    audio.onerror = playNext
    try {
      actx = new AudioContext()
      const src = actx.createMediaElementSource(audio)
      analyser = actx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.5
      src.connect(analyser)
      analyser.connect(actx.destination)
      liveMouth = true
    } catch {
      // No Web Audio: he still talks, and the mouth runs on a loop instead.
      actx = null
      analyser = null
    }
  }
  // Browsers play sound only after the visitor clicks or types on the page; a
  // hover does not count. What he could not say waits here for that click.
  let pending: string[] = []
  let blocked = $state(false)

  /** Play clips back to back: line keys, or ready clip names (titles). */
  function say(...clips: string[]) {
    if (!sound) return
    pending = clips
    // No click or key on this page yet: the browser would mute him, and a
    // muted line would count as said. Hold it for the first click instead.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      blocked = true
      return
    }
    ensureAudio()
    void actx?.resume()
    queue = clips.map(clipUrl).filter((u): u is string => !!u)
    void playNext()
  }
  async function playNext() {
    const url = queue.shift()
    if (!url || !audio) { speaking = false; return }
    // His voice goes through the audio graph (it moves his mouth). A graph the
    // browser still holds suspended plays in silence, so wait for it to run,
    // and treat it as held back when it will not.
    const running = () => !actx || actx.state === 'running'
    if (!running()) {
      await Promise.race([actx!.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))])
      if (!running()) { speaking = false; queue = []; blocked = true; return }
    }
    audio.src = url
    audio.play().then(
      () => {
        blocked = false
        if (pending[0] === line('hi')) markGreeted()
        pending = []
        if (!speaking) { speaking = true; animate() }
      },
      () => { speaking = false; queue = []; blocked = true },
    )
  }
  /** The first click or key on the page: let the audio out, and say what was held back. */
  let heardOnClick = false
  function unlock(e: Event) {
    void actx?.resume()
    if (!blocked || !open || !pending.length) return
    const target = e.target as Element | null
    // A click on one of his own buttons starts a new line of its own.
    if (target?.closest?.('.zazo-panel button, .zazo-panel input, .zazo-panel a')) return
    // A click on him is someone wanting to hear him: say it, keep the popup.
    heardOnClick = !!target?.closest?.('.zazo-figure')
    say(...pending)
  }
  function hush() {
    queue = []
    audio?.pause()
    speaking = false
  }
  const line = (key: LineKey) => lineClip(key)

  function toggleSound() {
    sound = !sound
    emit('sound', { on: sound })
    write(SOUND_KEY, sound ? 'on' : 'off')
    if (sound) speakView(true)
    else hush()
  }

  // ---- the face follows the audio ----------------------------------------------
  const td = new Uint8Array(512)
  const fd = new Uint8Array(256)
  let level = 0
  let avg = 0
  function animate() {
    const el = figure
    if (!el) return
    let target = 0
    let wide = 0
    if (analyser && speaking) {
      analyser.getByteTimeDomainData(td)
      let sum = 0
      for (let i = 0; i < td.length; i++) { const v = (td[i]! - 128) / 128; sum += v * v }
      target = Math.min(1, Math.sqrt(sum / td.length) * 5.5)
      analyser.getByteFrequencyData(fd)
      let low = 0, high = 0
      for (let i = 2; i < 10; i++) low += fd[i]!
      for (let i = 14; i < 60; i++) high += fd[i]!
      // Bright sounds ("ee") spread the mouth; dark ones ("oo") round it.
      wide = Math.max(-1, Math.min(1, (high / 46 / (low / 8 + 1)) * 2.2 - 1))
    } else if (speaking) {
      const t = performance.now() / 1000
      target = 0.45 + 0.4 * Math.sin(t * 17) * Math.sin(t * 5.3)
    }
    level += (target - level) * (target > level ? 0.55 : 0.22)
    avg += (level - avg) * 0.04
    const t = performance.now() / 1000
    const s = el.style
    s.setProperty('--open', level.toFixed(3))
    s.setProperty('--wide', wide.toFixed(3))
    // Brows jump on stressed syllables: louder than the running average.
    s.setProperty('--lift', Math.min(1, Math.max(0, (level - avg) * 4)).toFixed(3))
    s.setProperty('--tilt', (Math.sin(t * 1.6) * 3 + Math.sin(t * 4.1) * level * 2).toFixed(2))
    if (speaking || level > 0.01) requestAnimationFrame(animate)
    else for (const p of ['--open', '--wide', '--lift', '--tilt']) s.setProperty(p, '0')
  }

  // ---- listening ----------------------------------------------------------------
  function listen() {
    if (listening) { recognition?.stop(); return }
    emit('mic')
    const SR = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
    const Ctor = SR.SpeechRecognition ?? SR.webkitSpeechRecognition
    if (!Ctor) return
    hush()
    // Talking to him means hearing him back.
    if (!sound) { sound = true; write(SOUND_KEY, 'on') }
    ensureAudio()
    void actx?.resume()
    micNote = ''
    let final = ''
    const r = new Ctor()
    r.lang = 'en-US'
    r.interimResults = true
    r.onresult = (e) => {
      let text = ''
      let done = false
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]![0]!.transcript
        done = e.results[i]!.isFinal
      }
      draft = text
      if (done) final = text
    }
    r.onerror = (e) => {
      micNote = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Allow the microphone to talk to me, or type below.'
        : e.error === 'no-speech' ? "I didn't catch that. Try again?" : ''
    }
    r.onend = () => {
      listening = false
      recognition = null
      if (final.trim()) ask(final)
    }
    recognition = r
    listening = true
    r.start()
  }

  onMount(() => {
    const forced = new URLSearchParams(location.search).has('zazo')
    if (navigator.webdriver && !forced) return
    if (forced) write(KEY, '')
    if (read(KEY) === 'off') return
    off = false
    // The tips (one per demo) are a chunk of their own; fetch it now he is here.
    if (demo) loadTips().then((t) => (tips = t)).catch(() => {})
    canListen = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    // His voice is on unless muted. Browsers only let a page play sound once
    // the visitor has clicked or typed on it, so until then he talks in text.
    sound = read(SOUND_KEY) !== 'off'

    place()
    const ro = new ResizeObserver(place)
    ro.observe(document.documentElement)
    addEventListener('resize', place)
    addEventListener('scroll', place, true)
    addEventListener('pointerdown', unlock, true)
    addEventListener('keydown', unlock, true)
    // He walks in, sits and waves; a click on him opens the popup.
    const t = setTimeout(arrive, 1200)
    return () => {
      clearTimeout(t)
      ro.disconnect()
      removeEventListener('resize', place)
      removeEventListener('scroll', place, true)
      removeEventListener('pointerdown', unlock, true)
      removeEventListener('keydown', unlock, true)
      hush()
      recognition?.stop()
      void actx?.close()
    }
  })

  // The bar can move when the page lays out again (a route change, a font load).
  $effect(() => {
    void demo?.id
    hidden
    place()
  })

  // Four swings of the raised hand, then it goes back down.
  let waveTimer = 0
  function wave() {
    clearTimeout(waveTimer)
    waving = true
    waveTimer = window.setTimeout(() => (waving = false), 1800)
  }
  // Opening him, he says "Hi! What can I help with?" once a visit; after that
  // the popup opens quietly. Counted once the line has actually played, so a
  // greeting the browser held back (no click on the page yet) still comes.
  const GREETED_KEY = 'svgrid-zazo-greeted'
  const greeted = () => {
    try { return sessionStorage.getItem(GREETED_KEY) === 'yes' } catch { return false }
  }
  const markGreeted = () => {
    try { sessionStorage.setItem(GREETED_KEY, 'yes') } catch { /* private mode */ }
  }
  // Sitting down after he walks in, he says who he is in a bubble beside him.
  const HELLO = "Hi, I'm Zazo and I can help you."
  let hello = $state(false)
  let helloTimer = 0
  function sayHello() {
    hello = true
    clearTimeout(helloTimer)
    helloTimer = window.setTimeout(() => (hello = false), 5000)
  }

  // ---- left alone: back to work ---------------------------------------------------
  // Thirty seconds with nobody at him (popup shut; not talking, listening,
  // pointing or walking) and he opens a laptop on his lap and types: he is
  // working on SvGrid. A hover or a click puts the laptop away, and the half
  // minute starts again once he is left alone.
  const IDLE_MS = 30_000
  // Shown in a bubble, not spoken: like the hello, it should not talk over the page.
  const WORKING_NOTE = "OK, if you need me, I'm here. While I'm idle, I'll continue improving SvGrid."
  let working = $state(false)
  let workNote = $state(false)
  let workNoteTimer = 0
  let idleRestart = $state(0)
  function startWorking() {
    working = true
    hello = false
    workNote = true
    clearTimeout(workNoteTimer)
    workNoteTimer = window.setTimeout(() => (workNote = false), 7000)
  }
  function stopWorking() {
    if (!working) return
    working = false
    workNote = false
    idleRestart++
  }
  $effect(() => {
    void idleRestart
    const calm = shown_ && !open && !hidden && !leaving && !arriving && !listening && !ring && !speaking
    if (!calm) {
      untrack(() => { working = false; workNote = false })
      return
    }
    if (working) return
    const t = setTimeout(startWorking, IDLE_MS)
    return () => clearTimeout(t)
  })

  // The mouse over him raises his hand (CSS); a click opens the popup. Only a
  // click: browsers let a page play sound once it has been clicked, so his
  // first words follow one.
  function onHover() {
    stopWorking()
    if (leaving) return
    // A heavy demo can hold up his entrance; the mouse reaching him brings him in now.
    shown_ = true
  }
  function onFigureClick() {
    // A touch screen has no hover: the click is what wakes him.
    stopWorking()
    if (!open) {
      emit('open', { via: 'click' })
      // Opened from a click or the keyboard: the focus goes into the popup.
      show('hi', true)
    } else if (heardOnClick) heardOnClick = false
    else close()
  }

  // ---- keyboard and screen readers ----------------------------------------------
  let panel = $state<HTMLDivElement | null>(null)
  const focusInPanel = () => !!panel && panel.contains(document.activeElement)
  /** Put the focus on the first thing to press in the popup. */
  async function focusPanel() {
    await tick()
    panel?.querySelector<HTMLElement>('.zazo-body button, .zazo-body a, .zazo-body input, .zazo-ask input')?.focus()
  }

  function show(v: View = 'hi', focus = false) {
    // A view change from inside the popup keeps the focus inside it: the
    // pressed button is about to disappear.
    const keep = focus || focusInPanel()
    view = v
    open = true
    hello = false
    mood = 'happy'
    if (v === 'hi') wave()
    speakView()
    if (keep) void focusPanel()
  }
  function close() {
    const hadFocus = focusInPanel()
    open = false
    hush()
    recognition?.stop()
    stopPointing()
    write(KEY, 'min')
    // Back to where the popup came from, not to the top of the page.
    if (hadFocus) figure?.focus()
  }
  /** A menu choice, counted. */
  function menu(item: 'about' | 'find' | 'start' | 'code' | 'tip' | 'license') {
    emit('menu', { item })
    if (item === 'find') void find()
    else if (item === 'code') onShowSource?.()
    else if (item === 'tip') showTip()
    else if (item === 'license') lineReply("What's free and what's paid?", 'license', { links: [{ label: 'Pricing', href: pricingHref }] })
    else show(item)
  }

  // "Hide Zazo": he says bye, stands up and walks off along the bar, toward
  // the nearer edge of the window.
  let leaving = $state<'' | 'stand' | 'walk'>('')
  let walkBy = $state(0)

  // Arriving is leaving played backwards: he comes in from the right edge of
  // the window, standing on the bar, stops at his seat, sits and waves.
  let arriving = $state<'' | 'start' | 'walk' | 'stand'>('')
  let walkMs = $state(2000)
  function arrive() {
    shown_ = true
    if (!pos || leaving) { wave(); return }
    walkBy = vw - pos.x + 24
    // A steady stroll, about 260 px a second, quicker across a wide window.
    walkMs = Math.round(Math.min(3200, Math.max(900, Math.abs(walkBy) / 0.26)))
    arriving = 'start'
    // Two frames, so the browser draws him off screen before the walk begins.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (arriving === 'start') arriving = 'walk' }))
    setTimeout(() => { if (arriving) arriving = 'stand' }, walkMs + 60)
    setTimeout(() => { if (arriving) { arriving = ''; wave(); if (!open) sayHello() } }, walkMs + 380)
  }
  function hideForGood() {
    arriving = ''
    emit('hide')
    stopPointing()
    open = false
    recognition?.stop()
    write(KEY, 'off')
    if (!pos) { hush(); off = true; return }
    say(line('leave'))
    const right = pos.x + W / 2 > vw / 2
    walkBy = right ? vw - pos.x + 24 : -(pos.x + W + 24)
    leaving = 'stand'
    wave()
    setTimeout(() => (leaving = 'walk'), 700)
    // Off the screen by then; let the goodbye finish before the audio goes.
    setTimeout(() => { off = true; leaving = '' }, 700 + 3000)
    setTimeout(hush, 700 + 3000 + 800)
  }

  // ---- what this demo shows -----------------------------------------------
  /** The first two sentences: the blurb's lead, without the full spec. */
  const lead = $derived.by(() => {
    const blurb = demo?.blurb ?? ''
    const parts = blurb.match(/[^.!?]+[.!?]+(\s|$)/g)
    return parts && parts.length > 2 ? parts.slice(0, 2).join('').trim() : blurb
  })
  let docs = $state<ZazoLink[]>([])
  $effect(() => {
    const id = demo?.id
    docs = []
    if (!id) return
    let live = true
    loadDocs?.(id).then((d) => { if (live) docs = d.slice(0, 3) }).catch(() => {})
    return () => { live = false }
  })

  // ---- questions people ask about this demo ------------------------------------
  let faq = $state<Faq[]>([])
  $effect(() => {
    const id = demo?.id
    faq = []
    if (!id) return
    let live = true
    loadMeta?.(id).then((m) => { if (live) faq = m?.faq ?? [] }).catch(() => {})
    return () => { live = false }
  })
  function answerFaq(index: number) {
    const entry = faq[index]
    if (!entry) return
    emit('faq', { q: index })
    reply(entry.question, entry.answer, [line('faq')])
  }

  // ---- a tip: one thing to try, and where it is ---------------------------------
  let tips = $state<Record<string, Tip> | null>(null)
  const tip = $derived(demo ? tips?.[demo.id] ?? null : null)
  let ring = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let look = $state<{ x: number; y: number } | null>(null)
  let pointing = 0
  function stopPointing() {
    cancelAnimationFrame(pointing)
    ring = null
    look = null
  }
  // A new demo: stop ringing the old one's target, and leave its tip.
  $effect(() => {
    void demo?.id
    untrack(() => {
      stopPointing()
      if (view === 'tip') view = 'hi'
    })
  })
  function showTip() {
    if (!tip) return
    show('tip')
    pointAt()
  }
  /** Ring the tip's target for six seconds, and look at it. */
  function pointAt() {
    stopPointing()
    if (!tip) return
    const el = findTipTarget(document.querySelector(stage) ?? document, tip.target)
    emit('tip', { found: !!el })
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const until = performance.now() + 6000
    const follow = () => {
      if (!el.isConnected || performance.now() > until) { stopPointing(); return }
      const r = el.getBoundingClientRect()
      ring = { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 }
      if (pos) {
        // His eyes sit at about a third of his height; the pupils move 2.4 units at most.
        const dx = r.left + r.width / 2 - (pos.x + W / 2)
        const dy = r.top + r.height / 2 - (pos.y + H * 0.37)
        const d = Math.hypot(dx, dy) || 1
        look = { x: (dx / d) * 2.4, y: (dy / d) * 2.4 }
      }
      pointing = requestAnimationFrame(follow)
    }
    follow()
  }

  /** What he says for the popup on screen. `again` repeats the greeting even if he has said it this visit. */
  function speakView(again = false) {
    if (view === 'tip') { if (demo) say(`tip-${demo.id}`) }
    else if (view === 'hi') { if (again || !greeted()) say(line('hi')) }
    else if (view === 'about') { if (demo) say(line('thisOne'), titleClip(demo.title), line('shortVersion')) }
    else if (view === 'find') say(line('find'))
    else if (view === 'start') say(line('start'))
    else if (answer) say(...answer.clips)
  }

  // ---- talk -------------------------------------------------------------------
  let draft = $state('')
  let hits = $state<ZazoDemo[]>([])
  let answer = $state<(Answer & { clips: string[] }) | null>(null)
  let input = $state<HTMLInputElement | null>(null)
  let thinking = $state(false)

  // In "find" the box searches as you type.
  $effect(() => {
    const q = draft.trim()
    if (view !== 'find' || !q) { hits = []; return }
    let live = true
    Promise.resolve(search(q)).then((r) => { if (live) hits = r.slice(0, 5) })
    return () => { live = false }
  })

  async function find() {
    // The page's own search, when it has one: one search box, not two.
    if (onFind) {
      close()
      onFind()
      return
    }
    show('find')
    await tick()
    input?.focus()
  }
  function pick(id: string) {
    emit('pick', { to: id })
    onOpenDemo(id)
    draft = ''
    view = 'about'
    // The demo prop changes after navigation; speak once it has.
    tick().then(() => speakView())
  }

  function reply(you: string, text: string, clips: string[], extra: Partial<Answer> = {}, m: Mood = 'happy') {
    answer = { you, text, demos: [], docs: [], links: [], ...extra, clips }
    view = 'answer'
    open = true
    mood = m
    say(...clips)
  }
  const lineReply = (you: string, key: LineKey, extra: Partial<Answer> = {}, m: Mood = 'happy') =>
    reply(you, shown(key), [line(key)], extra, m)

  async function ask(raw: string) {
    const you = raw.trim()
    draft = ''
    if (!you) return
    const intent = understand(you)
    // What was asked and what answered it: the unanswered ones say which
    // features people look for and do not find.
    const asked = (answered: string) => emit('question', { query: you.toLowerCase().slice(0, 120), intent: intent.kind, answered })
    if (intent.kind === 'search' || intent.kind === 'open') {
      // A question about the demo on screen: its own FAQ knows best.
      const hit = matchFaq(you, faq)
      if (hit) {
        asked('faq')
        return reply(you, hit.answer, [line('faq')])
      }
    }
    if (intent.kind !== 'search' && intent.kind !== 'open') asked('line')
    switch (intent.kind) {
      // The greet line mentions "this demo"; with none on screen, the plain hello.
      case 'greet': return lineReply(you, demo ? 'greet' : 'hi')
      case 'thanks': return lineReply(you, 'thanks')
      case 'who': return lineReply(you, 'who')
      case 'bye':
        say(line('bye'))
        open = false
        write(KEY, 'min')
        return
      case 'about': return demo ? show('about') : show('hi')
      case 'start': return show('start')
      case 'code':
        if (onShowSource) { say(line('code')); onShowSource() }
        else lineReply(you, 'noSource', {}, 'puzzled')
        return
      case 'license': return lineReply(you, 'license', { links: [{ label: 'Pricing', href: pricingHref }] })
    }
    thinking = true
    mood = 'thinking'
    const [demos, docHits] = await Promise.all([
      Promise.resolve(search(intent.query)).catch(() => [] as ZazoDemo[]),
      searchDocs ? searchDocs(intent.query).catch(() => [] as ZazoLink[]) : Promise.resolve([] as ZazoLink[]),
    ])
    thinking = false
    const best = demos[0]
    asked(best ? 'demo' : docHits.length ? 'docs' : 'none')
    if (intent.kind === 'open' && best) {
      reply(you, `Opening ${best.title}.`, [line('opening'), titleClip(best.title)], { demos: demos.slice(1, 4), docs: docHits.slice(0, 2) })
      onOpenDemo(best.id)
      return
    }
    if (!best && !docHits.length) return lineReply(you, 'unknown', {}, 'puzzled')
    if (!best) return reply(you, shown('foundDocs'), [line('foundDocs')], { docs: docHits.slice(0, 3) })
    const text = `${shown('tryThis')} ${best.title}.${docHits[0] ? ` ${shown('docsToo')}` : ''}`
    const clips = [line('tryThis'), titleClip(best.title), ...(docHits[0] ? [line('docsToo')] : [])]
    reply(you, text, clips, { demos: demos.slice(0, 4), docs: docHits.slice(0, 2) })
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (view === 'find' && hits[0]) return pick(hits[0].id)
    ask(draft)
  }

  // ---- install --------------------------------------------------------------
  const install = $derived(enterprise ? 'npm install @svgrid/grid @svgrid/enterprise' : 'npm install @svgrid/grid')
  // A closing script tag cannot appear literally inside this script block.
  const SNIPPET = [
    '<script>',
    "  import { SvGrid } from '@svgrid/grid'",
    "  import '@svgrid/grid/themes/ember.css'",
    '',
    '  const rows = [',
    "    { name: 'Ada', role: 'Engineer' },",
    "    { name: 'Alan', role: 'Researcher' },",
    '  ]',
    '  const columns = [',
    "    { field: 'name', header: 'Name' },",
    "    { field: 'role', header: 'Role' },",
    '  ]',
    '</' + 'script>',
    '',
    '<SvGrid data={rows} {columns} />',
  ].join('\n')
  let copied = $state<'' | 'install' | 'snippet'>('')
  async function copy(what: 'install' | 'snippet') {
    try {
      await navigator.clipboard.writeText(what === 'install' ? install : SNIPPET)
      copied = what
      setTimeout(() => (copied = ''), 1500)
    } catch { /* no clipboard permission: the text is still selectable */ }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close()
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !off}
  <div class="zazo">
    {#if !hidden && pos}
    <button
      bind:this={figure}
      type="button"
      class="zazo-figure mood-{mood}"
      class:is-shown={shown_}
      class:is-waving={waving}
      class:is-speaking={speaking}
      class:is-listening={listening}
      class:is-working={working}
      class:no-analyser={speaking && !liveMouth}
      class:is-standing={leaving !== '' || arriving !== ''}
      class:is-walking={leaving === 'walk' || arriving === 'start' || arriving === 'walk'}
      class:arrive-start={arriving === 'start'}
      class:arrive-walk={arriving === 'walk'}
      class:walk-left={arriving ? walkBy > 0 : walkBy < 0}
      style:--walk="{walkBy}px"
      style:--walk-ms="{walkMs}ms"
      inert={leaving !== ''}
      style:left="{pos.x}px"
      style:top="{pos.y}px"
      style:width="{W}px"
      style:height="{H}px"
      aria-label={open ? 'Close Zazo' : working ? 'Zazo is working on SvGrid. Ask Zazo for help' : 'Ask Zazo for help'}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls="zazo-panel"
      onclick={onFigureClick}
      onmouseenter={onHover}
    >
      <svg viewBox="0 -8 100 128" aria-hidden="true">
        <defs>
          <clipPath id="zazo-eye-l"><ellipse cx="40" cy="40" rx="6" ry="6.5" /></clipPath>
          <clipPath id="zazo-eye-r"><ellipse cx="60" cy="40" rx="6" ry="6.5" /></clipPath>
        </defs>
        <circle class="zazo-ring" cx="50" cy="40" r="40" fill="none" stroke-width="3" />
        <!-- legs, hanging over the bar's edge -->
        <g class="zazo-leg zazo-leg-l">
          <rect x="35" y="94" width="9.5" height="18" rx="3" fill="#334155" />
          <ellipse cx="39" cy="113.5" rx="7.5" ry="4.2" fill="#e7e5e4" />
          <path d="M32 115 h14" stroke="#a8a29e" stroke-width="1.4" />
        </g>
        <g class="zazo-leg zazo-leg-r">
          <rect x="55.5" y="94" width="9.5" height="18" rx="3" fill="#334155" />
          <ellipse cx="61" cy="113.5" rx="7.5" ry="4.2" fill="#e7e5e4" />
          <path d="M54 115 h14" stroke="#a8a29e" stroke-width="1.4" />
        </g>
        <rect class="zazo-seat" x="27" y="88" width="46" height="10" rx="4.5" fill="#3f4d63" />
        <!-- body: a black SvGrid T-shirt -->
        <path class="zazo-shirt" d="M29 67 Q50 60 71 67 L74 93 Q50 97 26 93 Z" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="45" y="58" width="10" height="10" rx="3" fill="#74472d" />
        <path d="M43.5 64.5 q6.5 5.5 13 0" fill="none" stroke="#52525b" stroke-width="1.8" stroke-linecap="round" />
        <!-- The SvGrid mark (the site header's logo): a header row with a sort
             caret over three columns, the last one orange. At his size the
             logo's 32% white cells blur into the shirt, so they are a solid
             grey here. -->
        <g transform="translate(38.6 68.4) scale(0.95)">
          <rect x="4" y="4" width="6" height="4" rx="1.2" fill="#fafaf9" />
          <rect x="11" y="4" width="4" height="4" rx="1.2" fill="#fafaf9" />
          <rect x="16" y="4" width="4" height="4" rx="1.2" fill="#fafaf9" />
          <path d="M16.9 5.4 L19.1 5.4 L18 6.9 Z" fill="#ff5a1f" />
          <rect x="4" y="9" width="6" height="3" rx="0.9" fill="#71717a" /><rect x="11" y="9" width="4" height="3" rx="0.9" fill="#71717a" /><rect x="16" y="9" width="4" height="3" rx="0.9" fill="#ff5a1f" />
          <rect x="4" y="13" width="6" height="3" rx="0.9" fill="#71717a" /><rect x="11" y="13" width="4" height="3" rx="0.9" fill="#71717a" /><rect x="16" y="13" width="4" height="3" rx="0.9" fill="#ff5a1f" />
          <rect x="4" y="17" width="6" height="3" rx="0.9" fill="#71717a" /><rect x="11" y="17" width="4" height="3" rx="0.9" fill="#71717a" /><rect x="16" y="17" width="4" height="3" rx="0.9" fill="#ff5a1f" />
        </g>
        <g class="zazo-arm-l">
          <path d="M31 70 Q21 80 24 92" stroke="#8d5a3b" stroke-width="7" stroke-linecap="round" fill="none" />
          <path class="zazo-sleeve" d="M31 70 Q26 74.5 25.3 79" stroke="#18181b" stroke-width="9.5" stroke-linecap="round" fill="none" />
          <circle cx="24" cy="94" r="4.3" fill="#8d5a3b" />
        </g>
        <g class="zazo-arm">
          <path d="M69 70 Q80 63 82 50" stroke="#8d5a3b" stroke-width="7" stroke-linecap="round" fill="none" />
          <path class="zazo-sleeve" d="M69 70 Q74 67 76.5 63.5" stroke="#18181b" stroke-width="9.5" stroke-linecap="round" fill="none" />
          <circle cx="82.5" cy="45" r="5" fill="#8d5a3b" />
          <path d="M79 41 v-4.5 M82.5 40 v-5.5 M86 41 v-4.5 M87.5 46 l3 -2.5" stroke="#8d5a3b" stroke-width="2.4" stroke-linecap="round" />
        </g>
        <!-- at rest: the right hand down on the bar, like the left -->
        <g class="zazo-arm-down">
          <path d="M69 70 Q79 80 76 92" stroke="#8d5a3b" stroke-width="7" stroke-linecap="round" fill="none" />
          <path class="zazo-sleeve" d="M69 70 Q74 74.5 74.7 79" stroke="#18181b" stroke-width="9.5" stroke-linecap="round" fill="none" />
          <circle cx="76" cy="94" r="4.3" fill="#8d5a3b" />
        </g>
        <!-- head -->
        <g class="zazo-head">
          <ellipse cx="25" cy="42.5" rx="5" ry="7.5" fill="#8d5a3b" />
          <ellipse cx="75" cy="42.5" rx="5" ry="7.5" fill="#8d5a3b" />
          <ellipse cx="50" cy="40" rx="25" ry="28" fill="#8d5a3b" />
          <g fill="#1b1210">
            <circle cx="27.5" cy="20" r="11.5" /><circle cx="37.5" cy="12" r="12.5" /><circle cx="50" cy="8.5" r="13.5" />
            <circle cx="63" cy="11.5" r="12.5" /><circle cx="72.5" cy="20" r="11.5" /><circle cx="76.5" cy="31.5" r="9" />
            <circle cx="23.5" cy="31.5" r="9" /><circle cx="34" cy="6.5" r="8.5" /><circle cx="56.5" cy="3.5" r="9" /><circle cx="67.5" cy="7.5" r="7.5" />
          </g>
          <path d="M22.5 35 q27.5 -47.5 55 0" fill="none" stroke="#27272a" stroke-width="3" />
          <rect x="19" y="34" width="7.5" height="14.5" rx="3" fill="#27272a" />
          <rect x="73.5" y="34" width="7.5" height="14.5" rx="3" fill="#27272a" />
          <path d="M23.5 48 q2 17.5 21.5 14.5" fill="none" stroke="#27272a" stroke-width="1.75" />
          <circle cx="45.5" cy="62.5" r="2.25" fill="#27272a" />
          <!-- eyes -->
          <ellipse cx="40" cy="40" rx="6" ry="6.5" fill="#fff" />
          <ellipse cx="60" cy="40" rx="6" ry="6.5" fill="#fff" />
          <g class="zazo-pupils" transform={look ? `translate(${look.x.toFixed(2)} ${look.y.toFixed(2)})` : undefined}>
            <circle cx="40.5" cy="41" r="3" fill="#3b2314" /><circle cx="60.5" cy="41" r="3" fill="#3b2314" />
            <circle cx="41.5" cy="39.8" r="1" fill="#fff" /><circle cx="61.5" cy="39.8" r="1" fill="#fff" />
          </g>
          <g clip-path="url(#zazo-eye-l)">
            <rect class="zazo-lid" x="32.5" y="32.5" width="15" height="15" fill="#8d5a3b" />
            <rect class="zazo-squint" x="32.5" y="46.5" width="15" height="6" fill="#8d5a3b" />
          </g>
          <g clip-path="url(#zazo-eye-r)">
            <rect class="zazo-lid" x="52.5" y="32.5" width="15" height="15" fill="#8d5a3b" />
            <rect class="zazo-squint" x="52.5" y="46.5" width="15" height="6" fill="#8d5a3b" />
          </g>
          <rect x="31.5" y="32" width="17.5" height="16" rx="5.5" fill="none" stroke="#111" stroke-width="1.75" />
          <rect x="51" y="32" width="17.5" height="16" rx="5.5" fill="none" stroke="#111" stroke-width="1.75" />
          <path d="M49 38.5 h2" stroke="#111" stroke-width="1.75" />
          <!-- brows: mood moves each one, the voice lifts both -->
          <g class="zazo-brows">
            <path class="zazo-brow-l" d="M33.5 27.5 q6 -4 12.5 -1" fill="none" stroke="#1b1210" stroke-width="2.4" stroke-linecap="round" />
            <path class="zazo-brow-r" d="M54 26.5 q6.5 -3 12.5 1" fill="none" stroke="#1b1210" stroke-width="2.4" stroke-linecap="round" />
          </g>
          <ellipse class="zazo-cheek" cx="34" cy="53" rx="4" ry="2.25" fill="#c2410c" />
          <ellipse class="zazo-cheek" cx="66" cy="53" rx="4" ry="2.25" fill="#c2410c" />
          <!-- mouths: one per mood when quiet, the live one when talking -->
          <g class="zazo-smile">
            <path d="M42 55 q8 8.5 16 0 z" fill="#3b1408" />
            <path d="M44 55.4 q6 2.2 12 0" fill="#fff" />
          </g>
          <path class="zazo-flat" d="M44 57 q6 -1.5 12 0.5" fill="none" stroke="#3b1408" stroke-width="2" stroke-linecap="round" />
          <ellipse class="zazo-oh" cx="50" cy="57" rx="2.6" ry="3" fill="#3b1408" />
          <g class="zazo-talk">
            <ellipse cx="50" cy="57" rx="5.5" ry="4" fill="#3b1408" />
            <ellipse cx="50" cy="59.2" rx="3" ry="1.5" fill="#e11d48" opacity=".7" />
            <path d="M46 54.2 q4 -1.2 8 0" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" />
          </g>
        </g>
        <!-- Left alone: an orange laptop (Svelte's orange) on his lap, drawn the
             way everyone draws a laptop - screen up, keyboard in front - so it
             reads at 52px. It lands shut; the lid folds back on its hinge and
             the screen comes up with SvGrid on it: a grid and a line of code
             with a blinking cursor. His hands come round to the keys. -->
        <g class="zazo-laptop">
          <!-- keyboard deck: a trapezoid seen from above, keys in rows -->
          <path d="M31 86 H69 L78 95 H22 Z" fill="#ff3e00" />
          <path d="M22 95 H78 V97.5 Q78 98.5 77 98.5 H23 Q22 98.5 22 97.5 Z" fill="#b32d00" />
          <path d="M32.5 88 H67.5" stroke="#7a1f00" stroke-width="1.5" stroke-dasharray="2.4 0.9" />
          <path d="M30.5 90.3 H69.5" stroke="#7a1f00" stroke-width="1.5" stroke-dasharray="2.4 0.9" />
          <path d="M28.5 92.6 H38 M62 92.6 H71.5" stroke="#7a1f00" stroke-width="1.5" stroke-dasharray="2.4 0.9" />
          <path d="M40 92.6 H60" stroke="#7a1f00" stroke-width="1.5" stroke-linecap="round" />
          <!-- the screen, rising on the hinge at the deck's back edge -->
          <g class="zazo-screen">
            <rect x="29" y="60" width="42" height="26.5" rx="3" fill="#ff3e00" stroke="#c43000" stroke-width="0.8" />
            <rect x="31.5" y="62.5" width="37" height="21" rx="1.2" fill="#111827" />
            <!-- SvGrid on screen: an orange header row over grey rows -->
            <rect x="33.5" y="64.5" width="33" height="3" rx="0.6" fill="#ff3e00" />
            <g fill="#4b5563">
              <rect x="33.5" y="68.6" width="12" height="2.2" rx="0.5" /><rect x="46.5" y="68.6" width="9" height="2.2" rx="0.5" /><rect x="56.5" y="68.6" width="10" height="2.2" rx="0.5" />
              <rect x="33.5" y="71.8" width="12" height="2.2" rx="0.5" /><rect x="46.5" y="71.8" width="9" height="2.2" rx="0.5" /><rect x="56.5" y="71.8" width="10" height="2.2" rx="0.5" />
            </g>
            <rect class="zazo-new-row" x="33.5" y="75" width="33" height="2.2" rx="0.5" fill="#fb923c" />
            <!-- the line he is typing, and its cursor -->
            <rect class="zazo-typed" x="33.5" y="79.2" width="20" height="1.8" rx="0.5" fill="#a3e635" />
            <rect class="zazo-cursor" x="55" y="78.6" width="1.4" height="3" fill="#f9fafb" />
          </g>
          <!-- shut: the lid lies on the keys, folding back as the screen comes up -->
          <path class="zazo-lid-shut" d="M31 86 H69 L78 95 H22 Z" fill="#ff5a26" stroke="#c43000" stroke-width="0.8" />
          <!-- hands on the keys -->
          <g class="zazo-type-l">
            <path d="M31 70 Q19 82 33 91" stroke="#8d5a3b" stroke-width="6.5" stroke-linecap="round" fill="none" />
            <path class="zazo-sleeve" d="M31 70 Q26 74.5 25.2 79" stroke="#18181b" stroke-width="9.5" stroke-linecap="round" fill="none" />
            <ellipse cx="34.5" cy="91.2" rx="4.2" ry="3" fill="#8d5a3b" />
          </g>
          <g class="zazo-type-r">
            <path d="M69 70 Q81 82 67 91" stroke="#8d5a3b" stroke-width="6.5" stroke-linecap="round" fill="none" />
            <path class="zazo-sleeve" d="M69 70 Q74 74.5 74.8 79" stroke="#18181b" stroke-width="9.5" stroke-linecap="round" fill="none" />
            <ellipse cx="65.5" cy="91.2" rx="4.2" ry="3" fill="#8d5a3b" />
          </g>
        </g>
        <!-- what he is writing, drifting up from the screen -->
        <g class="zazo-glyphs" aria-hidden="true">
          <text class="zazo-glyph-1" x="72" y="62">&lt;/&gt;</text>
          <text class="zazo-glyph-2" x="76" y="64">{'{ }'}</text>
        </g>
      </svg>
    </button>

    {#if hello && !open}
      <!-- Who he is, beside him, on the side with room: a click opens him. -->
      {@const onLeft = pos.x + W / 2 > vw / 2}
      <button
        type="button"
        class="zazo-hello"
        class:on-left={onLeft}
        style:top="{Math.round(pos.y + H * 0.22)}px"
        style:left={onLeft ? undefined : `${pos.x + W + 10}px`}
        style:right={onLeft ? `${vw - pos.x + 10}px` : undefined}
        onclick={() => { emit('open', { via: 'hello' }); show('hi', true) }}
      >{HELLO}</button>
    {/if}
    {#if workNote && working && !open}
      <!-- What he says as he opens the laptop, in the same place as his hello. -->
      {@const onLeft = pos.x + W / 2 > vw / 2}
      <button
        type="button"
        class="zazo-hello zazo-work-note"
        class:on-left={onLeft}
        style:top="{Math.round(pos.y + H * 0.22)}px"
        style:left={onLeft ? undefined : `${pos.x + W + 10}px`}
        style:right={onLeft ? `${vw - pos.x + 10}px` : undefined}
        onclick={() => { emit('open', { via: 'working' }); show('hi', true) }}
      >{WORKING_NOTE}</button>
    {/if}
    {#if open}
      <div bind:this={panel} id="zazo-panel" class="zazo-panel" role="dialog" aria-label="Zazo, the SvGrid helper" style:left="{panelLeft}px" style:top="{panelTop}px" style:max-height="{vh - panelTop - 16}px" style:--tail="{tailX}px">
        <div class="zazo-tools">
          <button type="button" class="zazo-icon" aria-pressed={sound} title={sound ? "Mute Zazo's voice" : "Turn on Zazo's voice"} aria-label={sound ? "Mute Zazo's voice" : "Turn on Zazo's voice"} onclick={toggleSound}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke-width="1.5" />
              {#if sound}
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              {:else}
                <path d="m16 9 6 6M22 9l-6 6" />
              {/if}
            </svg>
          </button>
          <button type="button" class="zazo-icon" aria-label="Hide Zazo" title="Hide Zazo" onclick={hideForGood}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h11" /></svg>
          </button>
          <button type="button" class="zazo-icon" aria-label="Close" title="Close" onclick={close}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
          </button>
        </div>

        <div class="zazo-body" aria-live="polite">
          {#if thinking}
            <p class="zazo-blurb">Looking...</p>
          {:else if view === 'hi'}
            <p class="zazo-hi">{shown('hi')}</p>
            <div class="zazo-menu">
              {#if demo}<button type="button" onclick={() => menu('about')}>What does this demo show?</button>{/if}
              {#if tip}<button type="button" onclick={() => menu('tip')}>What should I try here?</button>{/if}
              <button type="button" onclick={() => menu('find')}>Find me a demo</button>
              <button type="button" onclick={() => menu('start')}>How do I add it to my app?</button>
              {#if !demo}<button type="button" onclick={() => menu('license')}>What's free and what's paid?</button>{/if}
              {#if onShowSource}<button type="button" onclick={() => menu('code')}>Show me the code</button>{/if}
            </div>
          {:else if view === 'tip' && tip}
            <p class="zazo-title">Try this</p>
            <p>{tip.text}</p>
            <div class="zazo-row">
              <button type="button" onclick={pointAt}>Show me where</button>
              <button type="button" class="is-quiet" onclick={() => show('hi')}>Back</button>
            </div>
          {:else if view === 'about' && demo}
            <p class="zazo-title">{demo.title}</p>
            <p class="zazo-blurb">{lead}</p>
            {#if faq.length}
              <p class="zazo-label">People ask</p>
              <ul class="zazo-hits">
                {#each faq.slice(0, 3) as f, i (f.question)}
                  <li><button type="button" onclick={() => answerFaq(i)}>{f.question}</button></li>
                {/each}
              </ul>
            {/if}
            {#if docs.length}
              <p class="zazo-label">Read more</p>
              <ul class="zazo-links">
                {#each docs as d (d.href)}<li><a href={d.href}>{d.label}</a></li>{/each}
              </ul>
            {/if}
            <div class="zazo-row">
              {#if tip}<button type="button" onclick={() => menu('tip')}>What should I try?</button>{/if}
              {#if onShowSource}<button type="button" onclick={() => menu('code')}>Show me the code</button>{/if}
              <button type="button" class="is-quiet" onclick={() => show('hi')}>Back</button>
            </div>
          {:else if view === 'find'}
            <p class="zazo-title">What are you building?</p>
            <p class="zazo-blurb">Type a feature below, like tree data, editing or export.</p>
            {#if hits.length}
              <ul class="zazo-hits">
                {#each hits as h (h.id)}
                  <li><button type="button" onclick={() => pick(h.id)}>{h.title}</button></li>
                {/each}
              </ul>
            {:else if draft.trim()}
              <p class="zazo-blurb">Nothing for that one. Try a feature name, like "grouping" or "charts".</p>
            {/if}
            <div class="zazo-row"><button type="button" class="is-quiet" onclick={() => show('hi')}>Back</button></div>
          {:else if view === 'start'}
            <p class="zazo-title">Two steps</p>
            <p class="zazo-label">1. Install</p>
            <div class="zazo-code">
              <code>{install}</code>
              <button type="button" onclick={() => copy('install')}>{copied === 'install' ? 'Copied' : 'Copy'}</button>
            </div>
            <p class="zazo-label">2. Give it rows and columns <button type="button" class="zazo-copy" onclick={() => copy('snippet')}>{copied === 'snippet' ? 'Copied' : 'Copy'}</button></p>
            <pre class="zazo-pre">{SNIPPET}</pre>
            <p class="zazo-blurb">That renders a two-row table with Name and Role columns.</p>
            {#if enterprise}<p class="zazo-blurb">This demo also uses @svgrid/enterprise, which needs a license key in production.</p>{/if}
            <div class="zazo-row">
              <a class="zazo-btn" href={startHref}>Getting started guide</a>
              <button type="button" class="is-quiet" onclick={() => show('hi')}>Back</button>
            </div>
          {:else if answer}
            <p class="zazo-you">{answer.you}</p>
            <p>{answer.text}</p>
            {#if answer.demos.length}
              <ul class="zazo-hits">
                {#each answer.demos as h (h.id)}
                  <li><button type="button" onclick={() => pick(h.id)}>{h.title}</button></li>
                {/each}
              </ul>
            {/if}
            {#if answer.docs.length || answer.links.length}
              <ul class="zazo-links">
                {#each [...answer.docs, ...answer.links] as d (d.href)}<li><a href={d.href}>{d.label}</a></li>{/each}
              </ul>
            {/if}
            <div class="zazo-row"><button type="button" class="is-quiet" onclick={() => show('hi')}>Back</button></div>
          {/if}
        </div>

        <form class="zazo-ask" onsubmit={onSubmit}>
          <input
            bind:this={input}
            bind:value={draft}
            type="text"
            placeholder={listening ? 'Listening...' : view === 'find' ? 'tree, editing, pivot, export...' : 'Ask Zazo anything...'}
            aria-label={view === 'find' ? 'Search the demos' : 'Ask Zazo'}
            enterkeyhint="send"
          />
          {#if canListen}
            <button type="button" class="zazo-icon zazo-mic" class:is-on={listening} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Talk to Zazo'} title={listening ? 'Stop listening' : 'Talk to Zazo'} onclick={listen}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>
          {/if}
          <button type="submit" class="zazo-icon" aria-label="Send" title="Send" disabled={!draft.trim() || thinking}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
        {#if micNote}<p class="zazo-note">{micNote}</p>{/if}
        {#if blocked && sound}
          <!-- Browsers keep a page quiet until it is clicked: this click lets him talk. -->
          <p class="zazo-note zazo-hear">
            <button type="button" onclick={() => say(...pending)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              Hear Zazo
            </button>
            Your browser waits for a click before any sound.
          </p>
        {/if}
        <button type="button" class="zazo-off" onclick={hideForGood}>Hide Zazo</button>
      </div>
    {/if}
    {/if}
    {#if ring}
      <!-- The tip's target, ringed while he looks at it. -->
      <div class="zazo-target" aria-hidden="true" style:left="{ring.x}px" style:top="{ring.y}px" style:width="{ring.w}px" style:height="{ring.h}px"></div>
    {/if}
  </div>
{/if}

<style>
  .zazo {
    --z-bg: var(--sg-bg, #ffffff);
    --z-fg: var(--sg-fg, #1c1917);
    --z-muted: var(--sg-muted, #78716c);
    --z-border: var(--sg-border, #e7e5e4);
    --z-soft: var(--sg-header-bg, #f5f5f4);
    --z-accent: var(--sg-accent, #ff5a1f);
    font: 400 14px/1.45 Inter, system-ui, sans-serif;
  }

  .zazo-figure {
    --open: 0;
    --wide: 0;
    --lift: 0;
    --tilt: 0;
    position: fixed;
    z-index: 91;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    opacity: 0;
    transform: translateY(-14px);
    transition: opacity 0.2s, transform 0.45s cubic-bezier(0.34, 1.6, 0.64, 1);
  }
  .zazo-figure.is-shown { opacity: 1; transform: none; }

  /* Leaving: up onto his feet on the bar, then a walk off the edge. */
  .zazo-figure.is-standing {
    transform: translateY(-9px);
    transition: transform 0.4s cubic-bezier(0.3, 1.5, 0.6, 1);
  }
  .zazo-figure.is-walking {
    transform: translate(var(--walk), -9px);
    transition: transform 3s cubic-bezier(0.45, 0, 0.9, 0.7);
  }
  /* Arriving: placed off the edge at once, then a walk in that slows to a stop. */
  .zazo-figure.arrive-start {
    transform: translate(var(--walk), -9px);
    transition: none;
  }
  .zazo-figure.arrive-walk {
    transform: translate(0, -9px);
    transition: transform var(--walk-ms, 2000ms) cubic-bezier(0.2, 0.55, 0.45, 1);
  }
  .zazo-seat { transition: opacity 0.2s; }
  .zazo-figure.is-standing .zazo-seat { opacity: 0; }
  .zazo-figure.is-standing .zazo-leg-l,
  .zazo-figure.is-standing .zazo-leg-r { animation: none; transform: none; }
  .zazo-figure.is-walking.walk-left svg { transform: scaleX(-1); }
  .zazo-figure.is-walking .zazo-leg-l { animation: zazo-step 0.42s ease-in-out infinite; }
  .zazo-figure.is-walking .zazo-leg-r { animation: zazo-step 0.42s ease-in-out -0.21s infinite; }
  .zazo-figure.is-walking .zazo-head { animation: zazo-bob 0.21s ease-in-out infinite alternate; }
  .zazo-figure.is-walking .zazo-arm-l { transform-origin: 31px 70px; animation: zazo-step 0.42s ease-in-out -0.21s infinite; }
  @keyframes zazo-step {
    0%, 100% { transform: rotate(-18deg); }
    50% { transform: rotate(18deg); }
  }
  @keyframes zazo-bob {
    from { transform: translateY(0); }
    to { transform: translateY(-2px); }
  }
  .zazo-figure:focus-visible { outline: none; }
  .zazo-figure:focus-visible svg { filter: drop-shadow(0 0 2px var(--z-accent)); }
  .zazo-figure svg { display: block; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3)); }

  /* Every moving part turns about its own joint. */
  .zazo-figure :global(*) { transform-box: view-box; }
  .zazo-head { transform-origin: 50px 66px; transform: rotate(calc(var(--tilt) * 1deg)) translateY(calc(var(--open) * 0.8px)); }
  .zazo-leg-l { transform-origin: 40px 94px; animation: zazo-swing 2.6s ease-in-out infinite; }
  .zazo-leg-r { transform-origin: 60px 94px; animation: zazo-swing 2.6s ease-in-out -1.3s infinite; }
  @keyframes zazo-swing {
    0%, 100% { transform: rotate(-7deg); }
    50% { transform: rotate(7deg); }
  }
  .zazo-lid { transform: translateY(-15px); animation: zazo-blink 4.2s infinite; }
  @keyframes zazo-blink {
    0%, 94%, 100% { transform: translateY(-15px); }
    97% { transform: translateY(0); }
  }
  /* Talking pushes the cheeks up into the eyes, and colours them. */
  .zazo-squint { transform: translateY(calc(var(--open) * -2.6px)); }
  .zazo-cheek { opacity: calc(0.22 + var(--open) * 0.35); }
  .zazo-brows { transform: translateY(calc(var(--lift) * -3px)); }

  /* The right hand rests on the bar. Point at him, or let him say hi or bye,
     and it comes up and waves. */
  .zazo-arm { opacity: 0; transform-origin: 69px 70px; }
  .zazo-arm-down { transform-origin: 69px 70px; }
  .zazo-figure:hover .zazo-arm,
  .zazo-figure.is-waving .zazo-arm { opacity: 1; animation: zazo-wave 0.45s ease-in-out infinite; }
  .zazo-figure:hover .zazo-arm-down,
  .zazo-figure.is-waving .zazo-arm-down { opacity: 0; }
  .zazo-figure:hover .zazo-brows { transform: translateY(-1.5px); }
  /* Walking off with the hand down: it swings. */
  .zazo-figure.is-walking:not(.is-waving) .zazo-arm-down { animation: zazo-step 0.42s ease-in-out infinite; }
  @keyframes zazo-wave {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(18deg); }
  }

  /* Left alone: the laptop lands on his lap shut, the lid folds back on its
     hinge (the deck's back edge, y 86) and the screen comes up from it; his
     resting arms go to the keys. Putting it away runs the other way, quicker. */
  .zazo-laptop, .zazo-glyphs text { opacity: 0; }
  .zazo-laptop { transform: translateY(10px); transition: opacity 0.25s 0.2s, transform 0.3s ease-in 0.2s; }
  .zazo-figure.is-working .zazo-laptop { opacity: 1; transform: none; transition: opacity 0.25s, transform 0.35s cubic-bezier(0.3, 1.4, 0.6, 1); }
  .zazo-lid-shut { transform-origin: 50px 86px; transition: transform 0.15s ease-out 0.05s; }
  .zazo-figure.is-working .zazo-lid-shut { transform: scaleY(0); transition: transform 0.25s ease-in 0.45s; }
  .zazo-screen { transform-origin: 50px 86.5px; transform: scaleY(0); transition: transform 0.15s ease-in; }
  .zazo-figure.is-working .zazo-screen { transform: none; transition: transform 0.5s cubic-bezier(0.3, 1.35, 0.55, 1) 0.65s; }
  .zazo-figure.is-working .zazo-arm-l,
  .zazo-figure.is-working .zazo-arm-down { opacity: 0; }
  .zazo-figure.is-working:not(.is-speaking) .zazo-pupils { transform: translate(0, 2px); }
  .zazo-figure.is-working .zazo-brows { transform: translateY(1px); }
  /* On the screen: the line he types grows, the cursor blinks, and the grid's
     newest row lights up as he saves. */
  .zazo-typed { transform-origin: 33.5px 80px; }
  .zazo-figure.is-working .zazo-typed { animation: zazo-typing 2.6s steps(9, end) 1.2s infinite; }
  .zazo-figure.is-working .zazo-cursor { animation: zazo-blink-cursor 0.9s steps(1, end) infinite; }
  .zazo-figure.is-working .zazo-new-row { animation: zazo-new-row 2.6s ease-out 1.2s infinite; }
  @keyframes zazo-typing {
    0% { transform: scaleX(0); }
    80%, 100% { transform: scaleX(1); }
  }
  @keyframes zazo-blink-cursor {
    0% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes zazo-new-row {
    0%, 75% { opacity: 0.25; }
    85% { opacity: 1; }
    100% { opacity: 0.55; }
  }
  .zazo-type-l { transform-origin: 31px 70px; }
  .zazo-type-r { transform-origin: 69px 70px; }
  /* Typing starts once the screen is up. */
  .zazo-figure.is-working .zazo-type-l { animation: zazo-type 0.34s ease-in-out 1.2s infinite; }
  .zazo-figure.is-working .zazo-type-r { animation: zazo-type 0.34s ease-in-out 1.37s infinite; }
  @keyframes zazo-type {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.6px); }
  }
  .zazo-glyphs text { font: 700 12px ui-monospace, SFMono-Regular, Menlo, monospace; fill: var(--z-accent); }
  .zazo-figure.is-working .zazo-glyph-1 { animation: zazo-float 2.8s ease-out 1.4s infinite; }
  .zazo-figure.is-working .zazo-glyph-2 { animation: zazo-float 2.8s ease-out 2.8s infinite; }
  @keyframes zazo-float {
    0% { opacity: 0; transform: translate(0, 0); }
    15% { opacity: 1; }
    100% { opacity: 0; transform: translate(10px, -36px); }
  }
  /* His line is longer than the hello: let it wrap. Two classes, so it beats
     the hello's nowrap, which comes later in this sheet. */
  .zazo-hello.zazo-work-note { white-space: normal; width: max-content; max-width: 250px; text-align: left; }

  /* Mouths: the smile by default, the live mouth while the audio plays. */
  .zazo-flat, .zazo-oh, .zazo-talk { opacity: 0; }
  .zazo-talk {
    transform-origin: 50px 57px;
    transform: scale(calc(0.9 + var(--wide) * 0.28), calc(0.12 + var(--open) * 1.15));
  }
  .zazo-figure.is-speaking .zazo-smile,
  .zazo-figure.is-speaking .zazo-flat,
  .zazo-figure.is-speaking .zazo-oh { opacity: 0 !important; }
  .zazo-figure.is-speaking .zazo-talk { opacity: 1; }

  /* Moods. */
  .zazo-brow-l { transform-origin: 40px 27px; }
  .zazo-brow-r { transform-origin: 60px 26px; }
  .mood-puzzled .zazo-smile { opacity: 0; }
  .mood-puzzled .zazo-flat { opacity: 1; }
  .mood-puzzled .zazo-brow-l { transform: translateY(-3px) rotate(-8deg); }
  .mood-puzzled .zazo-brow-r { transform: translateY(1px); }
  .mood-thinking .zazo-smile { opacity: 0; }
  .mood-thinking .zazo-oh { opacity: 1; }
  .mood-thinking .zazo-pupils { transform: translate(1.6px, -2px); }
  .mood-thinking .zazo-brows { transform: translateY(-2px); }

  /* Listening: brows up, a pulse around his head. */
  /* His shirt is black, which on a white page made him a dark blob beside the
     header buttons. In light mode it is denim; the dark theme keeps black. */
  :global(html:not([data-theme='dark'])) .zazo-shirt { fill: #3b5b8c; stroke: #2c4670; }
  :global(html:not([data-theme='dark'])) .zazo-sleeve { stroke: #3b5b8c; }
  .zazo-ring { stroke: var(--z-accent); opacity: 0; transform-origin: 50px 40px; }
  .zazo-figure.is-listening .zazo-brows { transform: translateY(-3px); }
  .zazo-figure.is-listening .zazo-ring { animation: zazo-pulse 1.2s ease-out infinite; }
  @keyframes zazo-pulse {
    0% { opacity: 0.7; transform: scale(0.85); }
    100% { opacity: 0; transform: scale(1.2); }
  }
  /* No Web Audio: a canned mouth loop instead of the live one. */
  .zazo-figure.no-analyser .zazo-talk { animation: zazo-mouth 0.62s infinite; }
  @keyframes zazo-mouth {
    0%, 100% { transform: scaleY(0.25); }
    20% { transform: scaleY(1); }
    40% { transform: scaleY(0.4); }
    60% { transform: scaleY(0.85); }
    80% { transform: scaleY(0.2); }
  }

  .zazo-panel {
    position: fixed;
    z-index: 90;
    width: min(340px, calc(100vw - 16px));
    display: flex;
    flex-direction: column;
    padding: 14px 16px 12px;
    color: var(--z-fg);
    background: var(--z-bg);
    border: 1px solid var(--z-border);
    border-radius: 16px;
    box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.35);
    animation: zazo-pop 0.22s ease-out;
    transform-origin: var(--tail) 0;
  }
  /* The tail points up at Zazo. */
  .zazo-panel::before {
    content: '';
    position: absolute;
    left: var(--tail);
    top: -8px;
    width: 14px;
    height: 14px;
    background: var(--z-bg);
    border-left: 1px solid var(--z-border);
    border-top: 1px solid var(--z-border);
    transform: rotate(45deg);
  }
  @keyframes zazo-pop {
    from { opacity: 0; transform: scale(0.92) translateY(-6px); }
    to { opacity: 1; transform: none; }
  }
  .zazo-body { overflow-y: auto; min-height: 0; padding-right: 2px; }
  .zazo-panel p { margin: 0 0 10px; }
  .zazo-hi { font-size: 17px; font-weight: 800; padding-right: 60px; }
  .zazo-title { font-weight: 700; padding-right: 60px; }
  .zazo-blurb { color: var(--z-muted); }
  .zazo-you { display: table; margin: 0 64px 10px 0 !important; padding: 6px 10px; background: var(--z-soft); border-radius: 10px; }
  .zazo-label { display: flex; align-items: center; justify-content: space-between; margin: 10px 0 6px !important; font-size: 12px; font-weight: 600; color: var(--z-muted); }
  .zazo-note { font-size: 12px; color: var(--z-muted); margin: 6px 0 0 !important; }
  .zazo-hear { display: flex; align-items: center; gap: 8px; }
  .zazo-hear button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font: 600 12px/1.2 Inter, system-ui, sans-serif;
    color: var(--z-fg);
    background: var(--z-soft);
    border: 1px solid var(--z-border);
    border-radius: 999px;
    cursor: pointer;
  }
  .zazo-hear button:hover { border-color: var(--z-muted); }

  .zazo-tools { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; z-index: 1; }
  .zazo-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--z-muted);
    background: none;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
  }
  .zazo-icon:hover:not(:disabled) { background: var(--z-soft); color: var(--z-fg); }
  .zazo-icon[aria-pressed='true'] { color: var(--z-fg); }
  .zazo-icon:disabled { opacity: 0.4; cursor: default; }
  .zazo-mic.is-on { color: #fff; background: var(--z-accent); }

  .zazo-menu { display: flex; flex-direction: column; gap: 6px; }
  .zazo-menu button,
  .zazo-row button,
  .zazo-btn,
  .zazo-hits button,
  .zazo-code button,
  .zazo-copy {
    font: inherit;
    color: var(--z-fg);
    background: var(--z-soft);
    border: 1px solid var(--z-border);
    border-radius: 10px;
    cursor: pointer;
    text-decoration: none;
  }
  .zazo-menu button { padding: 8px 12px; text-align: left; font-weight: 500; }
  .zazo-menu button:hover,
  .zazo-row button:hover,
  .zazo-btn:hover,
  .zazo-hits button:hover,
  .zazo-code button:hover,
  .zazo-copy:hover { border-color: var(--z-muted); }
  .zazo-row { display: flex; gap: 8px; margin-top: 12px; }
  .zazo-row button, .zazo-btn { padding: 6px 12px; font-size: 13px; font-weight: 500; }
  .zazo-row .is-quiet { background: none; border-color: transparent; color: var(--z-muted); }
  .zazo-copy { padding: 2px 8px; font-size: 11px; font-weight: 500; border-radius: 8px; }

  .zazo-links { margin: 0; padding: 0 0 0 18px; list-style: disc; }
  .zazo-links li { margin: 2px 0; }
  .zazo-links a { color: var(--z-fg); text-decoration: underline; text-underline-offset: 2px; }
  .zazo-hits { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .zazo-hits button { width: 100%; padding: 6px 10px; text-align: left; font-size: 13px; }

  .zazo-code { display: flex; align-items: center; gap: 8px; }
  .zazo-code code,
  .zazo-pre {
    font: 12px/1.5 'JetBrains Mono', ui-monospace, monospace;
    background: var(--z-soft);
    border: 1px solid var(--z-border);
    border-radius: 8px;
  }
  .zazo-code code { flex: 1; padding: 6px 8px; white-space: normal; overflow-wrap: anywhere; }
  .zazo-code button { padding: 5px 10px; font-size: 12px; }
  .zazo-pre { margin: 0 0 10px; padding: 8px 10px; white-space: pre; overflow-x: auto; }

  .zazo-ask {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 10px;
    padding: 3px 3px 3px 10px;
    background: var(--sg-input-bg, var(--z-bg));
    border: 1px solid var(--sg-input-border, var(--z-border));
    border-radius: 12px;
  }
  .zazo-ask:focus-within { box-shadow: 0 0 0 2px var(--sg-focus-ring, #ff5a1f); }
  .zazo-ask input { flex: 1; min-width: 0; padding: 5px 0; font: inherit; color: var(--z-fg); background: none; border: 0; outline: none; }

  .zazo-off {
    align-self: flex-start;
    margin-top: 8px;
    padding: 0;
    font: inherit;
    font-size: 12px;
    color: var(--z-muted);
    background: none;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }

  /* "Hi, I'm Zazo and I can help you.": a bubble beside him once he sits. */
  .zazo-hello {
    position: fixed;
    z-index: 92;
    padding: 7px 12px;
    font: 600 13px/1.3 Inter, system-ui, sans-serif;
    white-space: nowrap;
    color: var(--z-fg);
    background: var(--z-bg);
    border: 1px solid var(--z-border);
    border-radius: 12px;
    box-shadow: 0 8px 22px -8px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    animation: zazo-hello-in 0.3s ease-out;
  }
  /* The tail points at him: on the left side of a bubble to his right, and
     the other way round. */
  .zazo-hello::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -6px;
    width: 10px;
    height: 10px;
    background: var(--z-bg);
    border-left: 1px solid var(--z-border);
    border-bottom: 1px solid var(--z-border);
    transform: translateY(-50%) rotate(45deg);
  }
  .zazo-hello.on-left::before {
    left: auto;
    right: -6px;
    border: 0;
    border-right: 1px solid var(--z-border);
    border-top: 1px solid var(--z-border);
  }
  .zazo-hello:hover { border-color: var(--z-muted); }
  @keyframes zazo-hello-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: none; }
  }

  /* A tip's target on the page. */
  .zazo-target {
    position: fixed;
    z-index: 89;
    pointer-events: none;
    border: 3px solid var(--z-accent);
    border-radius: 10px;
    animation: zazo-target 1.1s ease-out infinite;
  }
  @keyframes zazo-target {
    0% { box-shadow: 0 0 0 0 rgba(255, 90, 31, 0.55); }
    100% { box-shadow: 0 0 0 12px rgba(255, 90, 31, 0); }
  }

  /* Reduced motion stops the loops he runs on his own (swinging legs,
     blinking, the listening pulse). What the visitor sets off still plays:
     the wave when the mouse comes to him, and walking off on "Hide Zazo". */
  @media (prefers-reduced-motion: reduce) {
    .zazo-figure:not(.is-standing) { transition: none; }
    .zazo-figure:not(.is-standing) .zazo-leg-l,
    .zazo-figure:not(.is-standing) .zazo-leg-r,
    .zazo-lid, .zazo-panel,
    .zazo-figure.is-listening .zazo-ring,
    .zazo-figure.no-analyser .zazo-talk,
    .zazo-target { animation: none !important; }
    /* At the laptop, still: open at once, no typing, no drifting code, a
       finished line on a steady screen. */
    .zazo-type-l, .zazo-type-r, .zazo-typed, .zazo-cursor, .zazo-new-row { animation: none !important; }
    .zazo-laptop, .zazo-lid-shut, .zazo-screen { transition: none !important; }
    .zazo-glyphs { display: none; }
  }
  /* Phones: the top bar has no room beside the search, and the screen is the demo's. */
  @media (max-width: 767px) {
    .zazo { display: none; }
  }
</style>
