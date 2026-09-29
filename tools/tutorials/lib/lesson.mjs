/**
 * Helpers for the "Learn SvGrid" course lessons.
 *
 * The rule a lesson obeys: the code on screen is the code that produced the
 * result on screen. Both come from one file - a ```svelte {runnable}``` block
 * that tools/build-doc-snippets.mjs extracted from the docs into
 * examples/src/doc-snippets/<id>.svelte and Vite compiled. The editor types
 * that file's own source; the browser frame mounts that same file.
 *
 * So a lesson never drifts from the docs: change the doc, re-record, and the
 * video teaches the new code.
 */

/** Type a line range of the snippet's own source into the editor scene. */
export async function typeLines(h, snippet, from, to, cps = 95) {
  const src = await h.stage.browser.source(snippet)
  const lines = src.split('\n')
  const chunk = lines.slice(from, to).join('\n') + '\n'
  await h.stage.editor.type(chunk, { cps })
}

/**
 * The reveal: swap the full-width editor for the split, carrying the finished
 * file, and mount that file beside it. Typing happens at full width because
 * the code is the subject and a half-empty browser pane is dead frame.
 */
export async function reveal(h, snippet, { file = 'src/App.svelte', url = 'localhost:5173', loadMs = 700, focus } = {}) {
  const src = await h.stage.browser.source(snippet)
  await h.stage.show('split', { file, code: src, url })
  await h.stage.editor.cursor(false)
  // `focus` names the line that earns what the browser is about to show. A
  // reveal drops the whole file in at once and the half-width pane holds
  // maybe 25 lines, so without this the viewer is left on line 1 while the
  // narration describes an option further down. `focus: 'match'` finds it.
  await h.stage.editor.focus(typeof focus === 'string' ? lineOf(src, focus) : (focus ?? null))
  await h.stage.browser.snippet(snippet, { loadMs })
}

/** 1-based line number of the first line containing `needle`, or null. */
export function lineOf(src, needle) {
  const i = src.split('\n').findIndex((l) => l.includes(needle))
  return i < 0 ? null : i + 1
}

/**
 * "row,col" of the grid's active cell, or null. Keyboard navigation is the
 * one claim with no visible side effect other than the focus ring, so a beat
 * that says "arrow keys move between cells" asserts on this.
 */
export async function activeCell(page, scope = '.br-page-snippet ') {
  const el = page.locator(`${scope}.sv-grid-cell-active`).first()
  if (!(await el.count())) return null
  return `${await el.getAttribute('data-svgrid-row')},${await el.getAttribute('data-svgrid-col')}`
}

/**
 * Text of the first REAL data row. Virtualization puts a spacer row first and
 * its text is empty, so `[role="row"]` first() compares empty to empty and an
 * assertion built on it passes (or fails) for the wrong reason.
 */
export async function firstRow(page, scope = '') {
  const el = page.locator(`${scope}.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)`).first()
  return ((await el.textContent()) ?? '').trim()
}

/** Rows painted by the mounted snippet, for a lesson's verify step. */
export const SNIPPET_ROW = '.br-page-snippet .sv-grid-body [role="row"]'
export const SNIPPET_CELL = '.br-page-snippet .sv-grid-body [role="gridcell"]'

/** A lesson's opening title card. */
export function titleCard(h, n, title, subtitle) {
  return h.stage.show('title', { kicker: `Learn SvGrid · lesson ${n}`, title, subtitle })
}

/** A lesson's closing card: what comes next, and where the code lives. */
export function endCard(h, title, subtitle, lines) {
  return h.stage.show('end', { kicker: 'Lesson complete', title, subtitle, lines })
}
