/**
 * Pure unit tests for the locale-aware text normalization + Excel
 * filter pipeline. No DOM, no mounted grid - just the two exported
 * helpers `normalizeForFilter` and `applyExcelFilter`.
 *
 * Covers:
 *   - Diacritic stripping (Café → cafe)
 *   - Composed / decomposed Unicode round-trip
 *   - Locale-specific lowercasing (Turkish dotted-I)
 *   - All Excel operators × locale option × accented inputs
 *   - Edge cases: empty strings, null/undefined, numeric mixed with text
 */

import { describe, expect, it } from 'vitest'
import {
  applyExcelFilter,
  normalizeForFilter,
} from './excel-filters'

describe('normalizeForFilter - diacritic stripping', () => {
  it('strips Latin accents (NFD path)', () => {
    expect(normalizeForFilter('Café')).toBe('cafe')
    expect(normalizeForFilter('CAFÉ')).toBe('cafe')
    expect(normalizeForFilter('München')).toBe('munchen')
    expect(normalizeForFilter('São Paulo')).toBe('sao paulo')
    expect(normalizeForFilter('Tōkyō')).toBe('tokyo')
    expect(normalizeForFilter('Genève')).toBe('geneve')
    expect(normalizeForFilter('Québec')).toBe('quebec')
    expect(normalizeForFilter('Málaga')).toBe('malaga')
    expect(normalizeForFilter('Brasília')).toBe('brasilia')
  })

  it('handles already-decomposed input (NFD-stable)', () => {
    // "Café" composed (4 code points) vs decomposed (5 code points).
    const composed = 'Café'.normalize('NFC')
    const decomposed = 'Café'.normalize('NFD')
    expect(normalizeForFilter(composed)).toBe('cafe')
    expect(normalizeForFilter(decomposed)).toBe('cafe')
  })

  it('preserves base ASCII unchanged', () => {
    expect(normalizeForFilter('Hello World')).toBe('hello world')
    expect(normalizeForFilter('ABC-123')).toBe('abc-123')
    expect(normalizeForFilter('email@example.com')).toBe('email@example.com')
  })

  it('returns empty string for empty / falsy input', () => {
    expect(normalizeForFilter('')).toBe('')
  })

  it('keeps non-Latin alphabets intact', () => {
    // The diacritic strip only touches the Combining Diacritical Marks
    // block (U+0300..U+036F). CJK / Cyrillic / Arabic stay as-is.
    expect(normalizeForFilter('東京')).toBe('東京')
    expect(normalizeForFilter('Москва')).toBe('москва')
    expect(normalizeForFilter('القاهرة')).toBe('القاهرة')
  })
})

describe('normalizeForFilter - locale-aware lowercase', () => {
  it('default (no locale) makes English "istanbul" match dotted Turkish "İstanbul"', () => {
    // No locale: NFD decomposes İ → I + combining dot above; the dot is
    // stripped; remaining 'I' becomes 'i' under default lowercase.
    expect(normalizeForFilter('İstanbul')).toBe('istanbul')
    expect(normalizeForFilter('istanbul')).toBe('istanbul')
  })

  it('Turkish locale honors dotted-I / dotless-i asymmetry', () => {
    // With "tr-TR" the bare 'I' (post-dot-strip) lowercases to dotless
    // 'ı'. This is intentional Turkish behavior and is why we expose a
    // locale prop: consumers who explicitly want Turkish casing get it.
    // English-typed "istanbul" then no longer matches Turkish "İstanbul"
    // - locale-pickers should make that trade-off knowingly.
    expect(normalizeForFilter('İSTANBUL', 'tr-TR')).toBe('ıstanbul')
    expect(normalizeForFilter('I',        'tr-TR')).toBe('ı')
  })

  it('default (no locale) behaves like toLowerCase()', () => {
    expect(normalizeForFilter('HELLO')).toBe('hello')
    expect(normalizeForFilter('CafÉ')).toBe('cafe') // É
  })

  it('accepts an array of fallback locales', () => {
    expect(normalizeForFilter('Café', ['fr-CA', 'en-US'])).toBe('cafe')
  })

  it('Greek / Cyrillic / German all fold cleanly', () => {
    // Greek: stripped tones (oxia)
    expect(normalizeForFilter('Αθήνα')).toBe('αθηνα')
    // German: umlauts strip
    expect(normalizeForFilter('Düsseldorf')).toBe('dusseldorf')
    // Cyrillic: no diacritics, just locale-aware lowercase
    expect(normalizeForFilter('Москва', 'ru-RU')).toBe('москва')
  })
})

describe('applyExcelFilter - contains (locale-aware)', () => {
  it('matches case + accent insensitively without a locale', () => {
    const ok = applyExcelFilter('Café Genève', {
      id: 'name', operator: 'contains', value: 'cafe geneve',
    })
    expect(ok).toBe(true)
  })

  it('matches with a German locale', () => {
    const ok = applyExcelFilter('München', {
      id: 'city', operator: 'contains', value: 'munch',
    }, { locale: 'de-DE' })
    expect(ok).toBe(true)
  })

  it('matches with a French locale', () => {
    const ok = applyExcelFilter('Montréal', {
      id: 'city', operator: 'contains', value: 'montreal',
    }, { locale: 'fr-CA' })
    expect(ok).toBe(true)
  })

  it('matches with a Portuguese locale', () => {
    const ok = applyExcelFilter('São Paulo', {
      id: 'city', operator: 'contains', value: 'sao paulo',
    }, { locale: 'pt-BR' })
    expect(ok).toBe(true)
  })

  it('rejects non-matching queries even with locale', () => {
    const ok = applyExcelFilter('München', {
      id: 'city', operator: 'contains', value: 'berlin',
    }, { locale: 'de-DE' })
    expect(ok).toBe(false)
  })

  it('empty needle matches every cell (includes "")', () => {
    expect(applyExcelFilter('München', {
      id: 'city', operator: 'contains', value: '',
    })).toBe(true)
  })
})

describe('applyExcelFilter - equals (locale-aware)', () => {
  it('case + accent insensitive equals', () => {
    expect(applyExcelFilter('Café', { id: 'x', operator: 'equals', value: 'CAFE' })).toBe(true)
    expect(applyExcelFilter('Café', { id: 'x', operator: 'equals', value: 'cafe' })).toBe(true)
    expect(applyExcelFilter('Café', { id: 'x', operator: 'equals', value: 'Café' })).toBe(true)
  })

  it('rejects when normalized strings differ', () => {
    expect(applyExcelFilter('Café', { id: 'x', operator: 'equals', value: 'cafes' })).toBe(false)
    expect(applyExcelFilter('Café', { id: 'x', operator: 'equals', value: 'café!' })).toBe(false)
  })
})

describe('applyExcelFilter - startsWith (locale-aware)', () => {
  it('matches stripped prefix', () => {
    expect(applyExcelFilter('München-Schwabing', {
      id: 'x', operator: 'startsWith', value: 'munchen',
    })).toBe(true)
  })

  it('rejects mid-string match', () => {
    expect(applyExcelFilter('Großmünchen', {
      id: 'x', operator: 'startsWith', value: 'munchen',
    })).toBe(false)
  })
})

describe('applyExcelFilter - numeric operators (locale-independent)', () => {
  it('greaterThan / lessThan / between still work', () => {
    expect(applyExcelFilter(150, { id: 'price', operator: 'greaterThan', value: 100 })).toBe(true)
    expect(applyExcelFilter(150, { id: 'price', operator: 'lessThan', value: 200 })).toBe(true)
    expect(applyExcelFilter(150, {
      id: 'price', operator: 'between', value: 100, valueTo: 200,
    })).toBe(true)
  })

  it('between rejects out-of-range', () => {
    expect(applyExcelFilter(50, {
      id: 'price', operator: 'between', value: 100, valueTo: 200,
    })).toBe(false)
  })
})

describe('applyExcelFilter - isBlank', () => {
  it('treats empty / whitespace-only as blank', () => {
    expect(applyExcelFilter('',     { id: 'x', operator: 'isBlank' })).toBe(true)
    expect(applyExcelFilter('   ',  { id: 'x', operator: 'isBlank' })).toBe(true)
    expect(applyExcelFilter(null,   { id: 'x', operator: 'isBlank' })).toBe(true)
    expect(applyExcelFilter(undefined, { id: 'x', operator: 'isBlank' })).toBe(true)
  })

  it('rejects non-blank cells', () => {
    expect(applyExcelFilter('Café', { id: 'x', operator: 'isBlank' })).toBe(false)
    expect(applyExcelFilter(' x ',  { id: 'x', operator: 'isBlank' })).toBe(false)
  })
})

describe('applyExcelFilter - regression: pre-locale behavior preserved', () => {
  // Before locale support, ASCII case-insensitive matching was the rule.
  // Verify nothing regressed for the common path.
  it('plain ASCII contains', () => {
    expect(applyExcelFilter('Ada Lovelace', {
      id: 'name', operator: 'contains', value: 'lovelace',
    })).toBe(true)
    expect(applyExcelFilter('Ada Lovelace', {
      id: 'name', operator: 'contains', value: 'LOVELACE',
    })).toBe(true)
  })

  it('plain ASCII equals', () => {
    expect(applyExcelFilter('active', {
      id: 'status', operator: 'equals', value: 'ACTIVE',
    })).toBe(true)
  })

  it('plain ASCII startsWith', () => {
    expect(applyExcelFilter('Linus Torvalds', {
      id: 'name', operator: 'startsWith', value: 'linus',
    })).toBe(true)
  })
})
