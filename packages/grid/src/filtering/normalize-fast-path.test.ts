/**
 * Equivalence tests for `normalizeForFilter`'s ASCII fast path.
 *
 * The function NFD-decomposes, strips combining marks, then lowercases. It runs
 * once per cell per filter - 100,000 times for a one-column filter on a 100k
 * grid - and a CPU profile of a browser filter put 15.5% of the whole operation
 * inside it, more than any other single function.
 *
 * For a pure-ASCII string the first two steps are provably no-ops: ASCII is
 * already in NFD, and the combining-marks block (U+0300..U+036F) contains no
 * ASCII. So the fast path returns `lowercase(s)` directly.
 *
 * "Provably" is doing a lot of work in that sentence, so the first test checks
 * it exhaustively over every ASCII code point rather than trusting the argument.
 */
import { describe, expect, it } from 'vitest'
import { normalizeForFilter } from './excel-filters'

/** The original implementation, verbatim, as the oracle. */
const DIACRITIC_RE = /[̀-ͯ]/g
function reference(s: string, locale?: string | ReadonlyArray<string>): string {
  if (!s) return ''
  const stripped = s.normalize('NFD').replace(DIACRITIC_RE, '')
  return locale
    ? stripped.toLocaleLowerCase(locale as string | string[])
    : stripped.toLowerCase()
}

describe('normalizeForFilter - ASCII fast path equivalence', () => {
  it('matches on every single ASCII code point', () => {
    for (let code = 0; code < 128; code++) {
      const ch = String.fromCharCode(code)
      expect(normalizeForFilter(ch), `code point ${code}`).toBe(reference(ch))
    }
  })

  it('matches on every ASCII code point under a Turkish locale', () => {
    // Turkish is the locale that makes ASCII lowercasing locale-dependent:
    // 'I'.toLocaleLowerCase('tr') is 'ı', not 'i'. The fast path must still
    // route through toLocaleLowerCase rather than assuming ASCII is safe.
    for (let code = 0; code < 128; code++) {
      const ch = String.fromCharCode(code)
      expect(normalizeForFilter(ch, 'tr'), `code point ${code}`).toBe(reference(ch, 'tr'))
    }
  })

  const CASES: Array<[string, string]> = [
    ['empty', ''],
    ['plain ascii', 'Hello World'],
    ['ascii with digits and punctuation', 'ABC-123_x.y,z!'],
    ['precomposed accents', 'café CAFÉ Café'],
    ['decomposed accents', 'café'],
    ['mixed ascii and accents', 'naive naïve NAÏVE'],
    ['german sharp s', 'straße STRASSE'],
    ['greek', 'ΣΊΣΥΦΟΣ σίσυφος'],
    ['cyrillic', 'Привет МИР'],
    ['cjk', '日本語テキスト'],
    ['emoji', 'grid 🚀 test'],
    ['combining marks alone', '̀́̂'],
    ['ascii then combining mark', 'áb'],
    ['turkish dotted capital', 'İstanbul ISTANBUL'],
    ['ligature', 'ﬁle ﬂow'],
    ['fullwidth', 'ＡＢＣ'],
    ['nbsp and control chars', 'a b\tc\nd'],
    ['long ascii', 'x'.repeat(500)],
    ['long with one non-ascii at the end', 'x'.repeat(500) + 'é'],
  ]

  for (const [name, input] of CASES) {
    it(`matches: ${name}`, () => {
      expect(normalizeForFilter(input)).toBe(reference(input))
    })
    it(`matches with locale: ${name}`, () => {
      expect(normalizeForFilter(input, 'tr')).toBe(reference(input, 'tr'))
      expect(normalizeForFilter(input, 'de')).toBe(reference(input, 'de'))
    })
  }

  it('matches across randomised mixed-script strings', () => {
    let seed = 7
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const pools = [
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.',
      'áéíóúàèìòùâêîôûäëïöüñçÁÉÍÓÚÑÇ',
      '̀́̂̃̈',
      'ΑΒΓΔαβγδ',
      'абвгдАБВГД',
      '日本語中文한국어',
    ]
    for (let trial = 0; trial < 300; trial++) {
      let s = ''
      const len = 1 + Math.floor(rand() * 20)
      for (let i = 0; i < len; i++) {
        const pool = pools[Math.floor(rand() * pools.length)]!
        s += pool[Math.floor(rand() * pool.length)]
      }
      expect(normalizeForFilter(s), s).toBe(reference(s))
      expect(normalizeForFilter(s, 'tr'), s).toBe(reference(s, 'tr'))
    }
  })
})
