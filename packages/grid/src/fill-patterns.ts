/**
 * Pattern detection + extrapolation for the cell-range fill handle.
 *
 * Recognized patterns, in priority order:
 *
 *   1. Known sequences (case-insensitive): days of the week (Monday /
 *      Mon), months (January / Jan), quarters (Q1..Q4). When source
 *      values match a sequence and form an arithmetic progression of
 *      indices into it, we extrapolate by stepping through the sequence
 *      with wrap-around. Output case is matched to the source - UPPER,
 *      lower, or Title.
 *
 *   2. Prefix-number-suffix patterns: "Item 1", "Item 2" → "Item 3";
 *      "2024-Q1", "2024-Q2" → "2024-Q3". The shared prefix + suffix is
 *      preserved and the number is extrapolated.
 *
 *   3. Pure numeric arithmetic progression: 1, 2, 3 → 4, 5, 6; or
 *      100, 200, 300 → 400, 500, 600.
 *
 *   4. Fallback: cycle the source values across the new cells.
 *
 * A single source value falls through to the cycle case (repeats), which
 * matches Excel's default fill behavior.
 */

/** Lookup table for the named sequences we know how to extrapolate.
 *  Add new ones (zodiac signs, planets, …) and the rest of the code
 *  handles them automatically. */
const KNOWN_SEQUENCES: ReadonlyArray<ReadonlyArray<string>> = [
  // Days of the week, long
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  // Days of the week, short
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  // Months, long
  ['January', 'February', 'March', 'April', 'May', 'June',
   'July', 'August', 'September', 'October', 'November', 'December'],
  // Months, short
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  // Quarters
  ['Q1', 'Q2', 'Q3', 'Q4'],
]

/** Determine the "case style" of a string and project it onto another. */
function matchCase(target: string, sample: string): string {
  if (!sample) return target
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) {
    return target.toUpperCase()
  }
  if (sample === sample.toLowerCase() && sample !== sample.toUpperCase()) {
    return target.toLowerCase()
  }
  // Title case: first letter upper, rest lower.
  const first = sample[0]
  if (first && first === first.toUpperCase() && sample.slice(1) === sample.slice(1).toLowerCase()) {
    return target[0]!.toUpperCase() + target.slice(1).toLowerCase()
  }
  return target
}

/** Find a known sequence (case-insensitively) that contains every source
 *  value. Returns the sequence + each source's index inside it. */
function findSequenceMatch(values: ReadonlyArray<string>): {
  sequence: ReadonlyArray<string>
  indices: number[]
} | null {
  const lowered = values.map((v) => v.toLowerCase())
  outer: for (const sequence of KNOWN_SEQUENCES) {
    const lowSeq = sequence.map((s) => s.toLowerCase())
    const indices: number[] = []
    for (const v of lowered) {
      const idx = lowSeq.indexOf(v)
      if (idx < 0) continue outer
      indices.push(idx)
    }
    return { sequence, indices }
  }
  return null
}

/** Step a series of indices by `step` modulo the sequence length, then
 *  return the canonical sequence entries with the source's case
 *  projected onto them. */
function extrapolateSequence(
  match: { sequence: ReadonlyArray<string>; indices: number[] },
  sourceValues: ReadonlyArray<string>,
  step: number,
  targetCount: number,
): string[] {
  const seqLen = match.sequence.length
  const lastIdx = match.indices[match.indices.length - 1]!
  const caseSample = sourceValues[sourceValues.length - 1]!
  const out: string[] = []
  for (let i = 0; i < targetCount; i += 1) {
    const nextIdx = ((lastIdx + step * (i + 1)) % seqLen + seqLen) % seqLen
    out.push(matchCase(match.sequence[nextIdx]!, caseSample))
  }
  return out
}

/** Split a value into a shared prefix, a numeric body, and a shared
 *  suffix. Returns null if not all values fit a `prefix + number +
 *  suffix` shape with the same prefix and suffix. */
function findPrefixNumberSuffix(values: ReadonlyArray<string>):
  | { prefix: string; suffix: string; numbers: number[]; numberFormat: { width: number; padChar: '0' | ' ' | '' } }
  | null {
  // Capture leading non-digit run, the digit run, and trailing run.
  // We do NOT match a leading minus inside the digit group - that turns
  // strings like "Run-001" into prefix="Run", numStr="-001", which both
  // breaks zero-pad detection AND extrapolates downward instead of up.
  // True numeric negatives are already handled by the arithmetic-progression
  // branch above; strings get a literal `-` as part of the prefix.
  const parts: Array<{ prefix: string; numStr: string; suffix: string }> = []
  const pattern = /^(.*?)(\d+)(.*)$/
  for (const v of values) {
    const m = v.match(pattern)
    if (!m) return null
    parts.push({ prefix: m[1] ?? '', numStr: m[2] ?? '', suffix: m[3] ?? '' })
  }
  const prefix = parts[0]!.prefix
  const suffix = parts[0]!.suffix
  for (const p of parts) {
    if (p.prefix !== prefix || p.suffix !== suffix) return null
  }
  // Detect zero-padding from the first numeric chunk so generated
  // values match (e.g. "001", "002" → "003").
  const firstNum = parts[0]!.numStr
  const width = firstNum.length
  const padChar: '0' | ' ' | '' =
    firstNum.length > 1 && firstNum[0] === '0' && firstNum !== '0' ? '0' : ''
  return {
    prefix,
    suffix,
    numbers: parts.map((p) => Number(p.numStr)),
    numberFormat: { width, padChar },
  }
}

function formatPaddedNumber(
  n: number,
  format: { width: number; padChar: '0' | ' ' | '' },
): string {
  const raw = String(n)
  if (!format.padChar || raw.length >= format.width) return raw
  const padded = raw.padStart(format.width, format.padChar)
  // padStart can over-pad if the number's sign character was included
  // in the width; that's fine in practice for fill scenarios.
  return padded
}

/** Detect a constant arithmetic step across an array. Returns the step
 *  or null if values aren't equally spaced. */
function arithmeticStep(nums: ReadonlyArray<number>): number | null {
  if (nums.length < 2) return null
  const step = nums[1]! - nums[0]!
  for (let i = 2; i < nums.length; i += 1) {
    if (nums[i]! - nums[i - 1]! !== step) return null
  }
  return step
}

/**
 * Compute the values to write into `targetCount` new cells given the
 * `sourceValues` already in the selection. See module header for the
 * pattern-detection rules.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The sources as day stamps when every one is a date: `Date` objects, or
 * `YYYY-MM-DD` text (read as UTC so a fill never crosses a day boundary
 * with the time zone). Anything else means "not a date series".
 */
function datesOf(values: ReadonlyArray<unknown>): { stamps: number[]; iso: boolean } | null {
  if (values.every((v) => v instanceof Date && Number.isFinite(v.getTime()))) {
    return { stamps: values.map((v) => (v as Date).getTime()), iso: false }
  }
  if (values.every((v) => typeof v === 'string' && ISO_DATE.test(v))) {
    const stamps = values.map((v) => Date.parse(`${v}T00:00:00Z`))
    return stamps.every((t) => Number.isFinite(t)) ? { stamps, iso: true } : null
  }
  return null
}

export function buildFillPattern(
  sourceValues: ReadonlyArray<unknown>,
  targetCount: number,
): unknown[] {
  if (sourceValues.length === 0 || targetCount <= 0) return []

  // -------- 0) Dates step by the day ---------------------------------
  // Before the numeric rule, since a Date coerces to a finite number of
  // milliseconds, and before the prefix rule, which read 2024-01-15 as the
  // number 2024 with a suffix and filled 2025-01-15. Two dates set the step
  // (a week apart fills weekly); one date steps by a day, as Excel's does.
  const dates = datesOf(sourceValues)
  if (dates) {
    const DAY = 86_400_000
    const days = dates.stamps.map((t) => Math.round(t / DAY))
    const step = days.length >= 2 ? arithmeticStep(days) : 1
    if (step !== null) {
      const last = days[days.length - 1]!
      return Array.from({ length: targetCount }, (_, i) => {
        const stamp = (last + step * (i + 1)) * DAY
        return dates.iso ? new Date(stamp).toISOString().slice(0, 10) : new Date(stamp)
      })
    }
  }

  // -------- 1) Numbers: the linear trend (2+ values) -----------------
  // Excel's AutoFill of two or more numbers continues their least-squares
  // line: 1, 2, 3 goes on 4, 5, 6, and 1, 2, 4 goes on 5.33, 6.83, ...
  // rather than repeating. An even step is the same line, so the common
  // case is unchanged.
  const nums = sourceValues.map((v) => Number(v))
  const allNumericLike =
    sourceValues.every((v) => v !== null && v !== '' && v !== undefined) &&
    nums.every((n) => Number.isFinite(n))
  if (allNumericLike && sourceValues.length >= 2) {
    const step = arithmeticStep(nums)
    if (step !== null) {
      const last = nums[nums.length - 1]!
      return Array.from({ length: targetCount }, (_, i) => last + step * (i + 1))
    }
    const n = nums.length
    const meanX = (n - 1) / 2
    const meanY = nums.reduce((a, b) => a + b, 0) / n
    let sxy = 0
    let sxx = 0
    for (let i = 0; i < n; i += 1) { sxy += (i - meanX) * (nums[i]! - meanY); sxx += (i - meanX) ** 2 }
    const slope = sxx === 0 ? 0 : sxy / sxx
    const intercept = meanY - slope * meanX
    // Rounded to the precision floating point gives 5.333333333333333, so
    // 10, 20, 40 fills 50, 60 and not 50.00000000000001.
    return Array.from({ length: targetCount }, (_, i) => Number((intercept + slope * (n + i)).toPrecision(15)))
  }

  // -------- 2) Known string sequence (days / months / quarters) -----
  const allStrings = sourceValues.every((v) => typeof v === 'string')
  if (allStrings && sourceValues.length >= 1) {
    const stringSources = sourceValues as string[]
    const match = findSequenceMatch(stringSources)
    if (match) {
      const step = stringSources.length >= 2
        ? arithmeticStep(match.indices) ?? 1
        : 1
      return extrapolateSequence(match, stringSources, step, targetCount)
    }
  }

  // -------- 3) Prefix-number-suffix ("Item 1", "Item 2", …) ---------
  if (allStrings && sourceValues.length >= 1) {
    const stringSources = sourceValues as string[]
    const split = findPrefixNumberSuffix(stringSources)
    // A bare number as text ('5') is a number, not 'Item 5': one of them
    // copies, as a numeric 5 does, and two or more were a progression above.
    if (split && (split.prefix !== '' || split.suffix !== '')) {
      const step = split.numbers.length >= 2
        ? arithmeticStep(split.numbers) ?? 1
        : 1
      const last = split.numbers[split.numbers.length - 1]!
      return Array.from({ length: targetCount }, (_, i) => {
        const next = last + step * (i + 1)
        return split.prefix + formatPaddedNumber(next, split.numberFormat) + split.suffix
      })
    }
  }

  // -------- 4) Fallback: cycle the sources -------------------------
  // Deep-clone arrays / plain objects so each filled cell gets an
  // independent value - otherwise multi-value cells (chips columns
  // store arrays) would all point at the SAME array, and editing one
  // would silently mutate the others.
  return Array.from({ length: targetCount }, (_, i) => cloneFillValue(sourceValues[i % sourceValues.length]))
}

function cloneFillValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice()
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    return { ...(value as Record<string, unknown>) }
  }
  return value
}
