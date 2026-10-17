/**
 * Everything Zazo says out loud, in one place. The component shows these
 * lines as text, and tools/zazo-voice.mjs renders each one, plus every demo
 * title, to an mp3 in ./voice with the developer's voice from the promo
 * cartoons. A line's [tags] steer the voice and never show on screen.
 *
 * Change a line here, then run `node --env-file=.env tools/zazo-voice.mjs`:
 * it re-renders only what changed.
 */

export const LINES = {
  // Opening him, once a visit. He introduces himself in the bubble he shows
  // when he sits down ("Hi, I'm Zazo and I can help you."), which is not spoken.
  hi: "[cheerful] Hi! What can I help with?",
  leave: "[cheerful] Okay, I'll get out of your way. Bye!",
  thisOne: 'This one is...',
  shortVersion: "Here's the short version.",
  find: 'What are you building? Tell me a feature, like tree data, editing or export.',
  start: "Two steps. Install the package, then give the grid your rows and columns. Here's a complete page.",
  greet: "[cheerful] Hi! Ask me what this demo does, or tell me what you're building.",
  thanks: "Any time. I'll be right here.",
  who: "I'm Zazo. I build data apps. I stopped writing my own tables when I found SvGrid. Ask me about any demo.",
  bye: 'See you. Click me if you need me.',
  license: 'The grid is free and MIT licensed. Excel and PDF export, pivot, the spreadsheet and Studio are part of SvGrid Enterprise.',
  code: "Here's the code.",
  noSource: 'This page has no source view, sorry.',
  unknown: "[thoughtful] Hmm. I don't know that one yet. Try a feature name, like grouping, editing or export.",
  tryThis: 'Try this one:',
  opening: 'Opening...',
  docsToo: "There's a docs page on it too.",
  foundDocs: "Here's what I found in the docs.",
  // A question answered from the open demo's FAQ (examples/src/demos/meta/<id>.json).
  faq: "Good question. Here's what I know about this one.",} as const

export type LineKey = keyof typeof LINES

/** A line as it shows on screen: without the voice tags. */
export const shown = (key: LineKey): string => LINES[key].replace(/\[[^\]]*\]\s*/g, '')

/** FNV-1a, 32-bit: a stable short name for a piece of text. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * Clip file names. A title clip is named by the words it says, not the demo
 * id: the gallery and the website title some demos differently, and each
 * should hear the title it shows.
 */
export const lineClip = (key: LineKey) => `line-${key}`
export const titleClip = (title: string) => `title-${hash(spokenTitle(title))}`

/** A demo title as it should be read aloud. */
export function spokenTitle(title: string): string {
  return title
    .replace(/\s+[-–]\s+/g, ', ')
    .replace(/\s*·\s*/g, ', ')
    .replace(/\s*\+\s*/g, ' and ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*→\s*/g, ' to ')
    .replace(/(\w)\/(\w)/g, '$1 $2')
    .replace(/\b(\d+)k\b/gi, '$1 thousand')
    .replace(/\b(\d+)M\b/g, '$1 million')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]*$/, '.')
}
