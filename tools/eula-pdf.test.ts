/**
 * The EULA is served twice: as the docs page at /docs/legal/EULA/ (from
 * docs/legal/EULA.md) and as the PDF the page links, built from the same
 * markdown by tools/eula-to-pdf.mjs into website/public/legal/. The PDF is
 * tracked, so an EULA edit that skips `pnpm eula:pdf` would ship two versions
 * of one agreement. Chromium writes the document title into the PDF's info
 * dictionary as a plain string, and the builder puts the version in it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain .mjs helper, no types
import { EULA_MD, EULA_PDF, eulaVersion } from './lib/eula.mjs'

describe('EULA PDF', () => {
  const version = eulaVersion(readFileSync(EULA_MD, 'utf8'))

  it('the markdown states its version', () => {
    expect(version).toMatch(/^\d+\.\d+$/)
  })

  it('is built from the current EULA version (run `pnpm eula:pdf` after an EULA edit)', () => {
    expect(existsSync(EULA_PDF), `${EULA_PDF} is missing`).toBe(true)
    const info = readFileSync(EULA_PDF).toString('latin1')
    expect(info).toContain(`/Title (SvGrid End User License Agreement - Version ${version})`)
  })

  it('the page links the PDF at the path the site serves it from', () => {
    const md = readFileSync(EULA_MD, 'utf8')
    expect(md).toContain('](/legal/SvGrid-EULA.pdf)')
  })
})
