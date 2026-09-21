/**
 * Mounts the recording stage and installs `window.__stage`, the API the
 * tutorial recorder (tools/tutorials/lib/drive.mjs, `h.stage`) drives through
 * page.evaluate. Every method returns when its animation has finished, so a
 * beat can await it and the narration timing stays honest.
 */
import { mount } from 'svelte'
import '../index.css'
import Stage from './Stage.svelte'
import { stage, sleep, type Layout, type TitleProps, type TermLine } from './state.svelte'
import type { PresetId } from './presets'

type OutLine = string | { text: string; cls?: TermLine['cls']; after?: number }

const jitter = (ms: number) => ms * (0.7 + Math.random() * 0.6)

mount(Stage, { target: document.getElementById('root')! })

// Scenes are laid out for 1280x720; scale the mount for a larger recording.
// The mount, not <html>: the recorder's cursor overlay lives on <body> and is
// positioned in viewport pixels, so it must stay outside the zoomed subtree.
function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720)
  ;(document.getElementById('root')!.style as unknown as { zoom: string }).zoom = String(s)
}
fit()
window.addEventListener('resize', fit)

const api = {
  /** Swap the scene with a short fade. `props` seeds the scene's state. */
  async show(layout: Layout, props: Record<string, unknown> = {}) {
    stage.fading = true
    await sleep(190)
    if (layout === 'title' || layout === 'end') {
      const p = props as TitleProps
      stage.title = { kicker: p.kicker ?? '', title: p.title ?? '', subtitle: p.subtitle ?? '', lines: p.lines ?? [], brand: p.brand ?? true }
    }
    if (layout === 'terminal' && typeof props.title === 'string') stage.terminal.title = props.title
    if (typeof props.prompt === 'string') stage.terminal.prompt = props.prompt
    if (layout === 'editor' || layout === 'split') {
      if (typeof props.file === 'string') stage.editor.file = props.file
      if (typeof props.code === 'string') stage.editor.code = props.code
    }
    if (layout === 'browser' || layout === 'split') {
      if (typeof props.url === 'string') stage.browser.url = props.url
      if (typeof props.preset === 'string') {
        stage.browser.preset = props.preset as PresetId
        stage.browser.key += 1
      }
    }
    stage.layout = layout
    stage.fading = false
    await sleep(220)
  },

  term: {
    /** Type a command, press Enter, then print its output line by line. */
    async run(cmd: string, { output = [] as OutLine[], typeMs = 55, outputDelay = 500, lineDelay = 70 } = {}) {
      stage.terminal.cursor = true
      for (const ch of cmd) {
        stage.terminal.typing += ch
        await sleep(jitter(typeMs))
      }
      await sleep(320)
      stage.terminal.lines.push({ kind: 'cmd', text: cmd })
      stage.terminal.typing = ''
      stage.terminal.cursor = false
      await sleep(outputDelay)
      await api.term.print(output, { lineDelay })
      stage.terminal.cursor = true
    },
    async print(lines: OutLine[], { lineDelay = 70 } = {}) {
      for (const l of lines) {
        const line = typeof l === 'string' ? { text: l } : l
        if (line.after) await sleep(line.after)
        stage.terminal.lines.push({ kind: 'out', text: line.text, cls: line.cls })
        await sleep(lineDelay)
      }
    },
    clear() {
      stage.terminal.lines = []
      stage.terminal.typing = ''
    },
  },

  editor: {
    open(file: string, code = '') {
      stage.editor.file = file
      stage.editor.code = code
      stage.editor.cursor = true
    },
    /** Append code with a typewriter; newlines pause a little longer. */
    async type(code: string, { cps = 48 } = {}) {
      stage.editor.cursor = true
      const per = 1000 / cps
      for (const ch of code) {
        stage.editor.code += ch
        await sleep(ch === '\n' ? per * 4 : jitter(per))
      }
    },
    set(code: string) {
      stage.editor.code = code
    },
    cursor(on: boolean) {
      stage.editor.cursor = on
    },
  },

  browser: {
    /** Show a blank tab for `loadMs`, then the preset, like a dev server reload. */
    async mount(preset: PresetId, { url, loadMs = 500 }: { url?: string; loadMs?: number } = {}) {
      if (url) stage.browser.url = url
      stage.browser.loading = true
      stage.browser.key += 1
      await sleep(loadMs)
      stage.browser.preset = preset
      stage.browser.loading = false
      stage.browser.key += 1
      await sleep(80)
    },
    url(text: string) {
      stage.browser.url = text
    },
  },
}

declare global {
  interface Window {
    __stage: typeof api
  }
}
window.__stage = api
