/**
 * The EULA's version, read from docs/legal/EULA.md, shared by the PDF builder
 * and the test that keeps the served PDF in step with the markdown.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const EULA_MD = resolve(root, 'docs/legal/EULA.md')
export const EULA_PDF = resolve(root, 'website/public/legal/SvGrid-EULA.pdf')

/** The markdown without its `---` frontmatter block. */
export function stripFrontmatter(md) {
  const m = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(md)
  return m ? md.slice(m[0].length) : md
}

/** "1.2" from the "Version 1.2" line under the title, or null. */
export function eulaVersion(md) {
  const m = /^Version (\d+\.\d+)\b/m.exec(stripFrontmatter(md))
  return m ? m[1] : null
}

export function readEulaVersion() {
  return eulaVersion(readFileSync(EULA_MD, 'utf8'))
}
