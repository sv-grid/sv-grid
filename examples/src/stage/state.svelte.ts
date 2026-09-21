/**
 * State of the recording stage (examples/stage.html), mutated by the API that
 * main.ts installs on `window.__stage` and read by the scene components.
 *
 * The stage exists so the tutorial recorder (tools/tutorials/) can show the
 * parts of a "getting started" video that a gallery demo cannot: a terminal
 * where a command is typed, an editor where a file is written, a browser
 * frame around the real component rendering that file, and the title and
 * end cards of a marketing cut. Nothing here is a demo, and nothing links to
 * it.
 */
import type { PresetId } from './presets'

export type Layout = 'blank' | 'title' | 'terminal' | 'editor' | 'browser' | 'split' | 'end'

export type TermLine = { kind: 'cmd' | 'out'; text: string; cls?: 'ok' | 'dim' | 'bold' | 'warn' | 'err' }

export type TitleProps = { kicker?: string; title?: string; subtitle?: string; lines?: string[]; brand?: boolean }

export const stage = $state({
  layout: 'blank' as Layout,
  /** True while a scene swap fades the old scene out. */
  fading: false,
  title: { kicker: '', title: '', subtitle: '', lines: [] as string[], brand: true } as Required<TitleProps>,
  terminal: {
    title: 'Terminal',
    prompt: '$ ',
    lines: [] as TermLine[],
    /** The command being typed right now (before Enter). */
    typing: '',
    /** Show the block cursor. */
    cursor: true,
  },
  editor: {
    file: 'src/App.svelte',
    code: '',
    cursor: true,
  },
  browser: {
    url: 'localhost:5173',
    preset: 'none' as PresetId,
    /** Bumped to remount the preset. */
    key: 0,
    loading: false,
  },
})

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
