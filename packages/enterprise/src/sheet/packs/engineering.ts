/**
 * Excel's Engineering family: base conversion, the bitwise set, the unit
 * converter, the two step functions and the error integrals.
 *
 * Base conversion is where Excel is least like a programming language, and
 * the differences are the whole reason this module is careful:
 *
 *   - A negative number is TWO'S COMPLEMENT in a fixed ten digits, so
 *     `=DEC2BIN(-1)` is "1111111111" and not "-1". Ten digits means ten
 *     bits for binary, thirty for octal and forty for hex, which is where
 *     each function's range comes from.
 *   - `places` pads with leading zeros and is IGNORED for a negative
 *     number, since the two's complement already fills the width. Too few
 *     places for the digits needed is `#NUM!`, not a truncation.
 *   - The bitwise functions work on unsigned integers below 2^48, which is
 *     past what JavaScript's own bitwise operators can hold, so they run
 *     through BigInt rather than `&` and `|`.
 */
import { err, type CellValue } from '../ast'
import { toNumber, toText } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'
import { erf, erfc } from './special'

const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''
const num = (a: FnArgs, i: number): number => toNumber(nth(a, i))
const text = (a: FnArgs, i: number): string => toText(nth(a, i))
const given = (a: FnArgs, i: number): boolean => {
  const v = a.args[i]?.[0]
  return v !== undefined && v !== ''
}

/** Ten digits of this base is how many bits. */
const WIDTH = { 2: 10, 8: 30, 16: 40 } as const
type Base = keyof typeof WIDTH

/** Excel's ten-digit window for a base, as [min, max]. */
function range(base: Base): [number, number] {
  const half = Math.pow(2, WIDTH[base] - 1)
  return [-half, half - 1]
}

/** A number into `base`, ten-digit two's complement for a negative. */
function toBase(value: number, base: Base, places: CellValue | undefined): CellValue {
  const n = Math.trunc(value)
  const [lo, hi] = range(base)
  if (n < lo || n > hi) return err('#NUM!')
  if (n < 0) {
    // Two's complement fills the full width, so `places` has no say.
    const wrapped = n + Math.pow(2, WIDTH[base])
    return wrapped.toString(base).toUpperCase()
  }
  const digits = n.toString(base).toUpperCase()
  if (places === undefined || places === '') return digits
  const want = Math.trunc(toNumber(places))
  if (want < 0 || want > 10 || want < digits.length) return err('#NUM!')
  return digits.padStart(want, '0')
}

/** A string of `base` digits back to a number, reading the top bit as a sign. */
function fromBase(raw: string, base: Base): CellValue {
  const s = raw.trim().toUpperCase()
  if (s === '') return 0
  if (s.length > 10) return err('#NUM!')
  const valid = base === 2 ? /^[01]+$/ : base === 8 ? /^[0-7]+$/ : /^[0-9A-F]+$/
  if (!valid.test(s)) return err('#NUM!')
  const value = parseInt(s, base)
  // Only a full-width word carries a sign bit, which is why "11" is 3 and
  // "1111111111" is -1.
  if (s.length === 10 && value >= Math.pow(2, WIDTH[base] - 1)) {
    return value - Math.pow(2, WIDTH[base])
  }
  return value
}

/** A base-to-base conversion, which Excel routes through the decimal. */
const convert = (from: Base, to: Base): SheetFunction => (a) => {
  const value = fromBase(text(a, 0), from)
  if (typeof value !== 'number') return value
  return toBase(value, to, given(a, 1) ? nth(a, 1) : undefined)
}

/** The bitwise set's shared guard: a non-negative integer below 2^48. */
function bitOperand(value: number): bigint | null {
  if (!Number.isFinite(value)) return null
  const n = Math.trunc(value)
  if (n !== value || n < 0 || n > 281474976710655) return null
  return BigInt(n)
}

const bitwise = (op: (x: bigint, y: bigint) => bigint): SheetFunction => (a) => {
  const x = bitOperand(num(a, 0))
  const y = bitOperand(num(a, 1))
  if (x === null || y === null) return err('#NUM!')
  return Number(op(x, y))
}

/**
 * CONVERT's unit table, as a factor into each measure's base unit.
 *
 * Temperature is the exception and is handled separately, because it is an
 * affine conversion rather than a scaling: Celsius to Fahrenheit is not a
 * multiplication.
 */
const UNITS: Record<string, { measure: string; factor: number }> = {}
const unit = (measure: string, factor: number, ...names: string[]) => {
  for (const n of names) UNITS[n] = { measure, factor }
}

// Mass, base kilogram.
unit('mass', 0.001, 'g')
unit('mass', 1, 'kg')
unit('mass', 0.45359237, 'lbm')
unit('mass', 0.45359237 / 16, 'ozm')
unit('mass', 1.6605402e-27, 'u')
unit('mass', 0.0000647989, 'grain')
unit('mass', 907.18474, 'ton')
unit('mass', 1016.0469088, 'uk_ton', 'LTON', 'brton')
unit('mass', 6.35029318, 'stone')
unit('mass', 0.0000020, 'sg')

// Distance, base metre.
unit('distance', 1, 'm')
unit('distance', 0.0254, 'in')
unit('distance', 0.3048, 'ft')
unit('distance', 0.9144, 'yd')
unit('distance', 1609.344, 'mi')
unit('distance', 1852, 'Nmi')
unit('distance', 1e-10, 'ang')
unit('distance', 0.0037, 'pica')
unit('distance', 0.0254 / 72, 'Pica')
unit('distance', 9.46073047258e15, 'ly')
unit('distance', 3.08567758149137e16, 'parsec', 'pc')
unit('distance', 201.168, 'survey_mi')

// Time, base second.
unit('time', 31557600, 'yr')
unit('time', 86400, 'day', 'd')
unit('time', 3600, 'hr')
unit('time', 60, 'mn', 'min')
unit('time', 1, 'sec', 's')

// Pressure, base pascal.
unit('pressure', 1, 'Pa', 'p')
unit('pressure', 101325, 'atm', 'at')
unit('pressure', 133.322368421, 'mmHg')
unit('pressure', 6894.75729317, 'psi')
unit('pressure', 100000, 'Torr')

// Force, base newton.
unit('force', 1, 'N')
unit('force', 0.00001, 'dyn', 'dy')
unit('force', 4.4482216152605, 'lbf')
unit('force', 9.80665, 'pond')

// Energy, base joule.
unit('energy', 1, 'J')
unit('energy', 0.0000001, 'e')
unit('energy', 1.05505585262e3, 'BTU', 'btu')
unit('energy', 4.1868, 'c')
unit('energy', 4.184, 'cal')
unit('energy', 1.60217733e-19, 'eV', 'ev')
unit('energy', 1.3558179483314, 'flb')
unit('energy', 3600000, 'Wh', 'wh')
unit('energy', 101.3252, 'HPh', 'hh')

// Power, base watt.
unit('power', 1, 'W', 'w')
unit('power', 745.69987158227, 'HP', 'h')
unit('power', 0.73549875, 'PS')

// Magnetism, base tesla.
unit('magnetism', 1, 'T')
unit('magnetism', 0.0001, 'ga')

// Volume, base litre.
unit('volume', 1, 'l', 'L', 'lt')
unit('volume', 0.0000163870640693, 'in3', 'in^3')
unit('volume', 28.316846592, 'ft3', 'ft^3')
unit('volume', 764.554857984, 'yd3', 'yd^3')
unit('volume', 1000, 'm3', 'm^3')
unit('volume', 3.785411784, 'gal')
unit('volume', 0.94635295, 'qt')
unit('volume', 0.473176473, 'pt', 'us_pt')
unit('volume', 0.5682612532, 'uk_pt')
unit('volume', 0.2365882365, 'cup')
unit('volume', 0.0295735295625, 'oz')
unit('volume', 0.01478676478125, 'tbs')
unit('volume', 0.00492892159375, 'tsp')
unit('volume', 0.00492892159375, 'tspm')
unit('volume', 158.987294928, 'barrel', 'bbl')
unit('volume', 119240.471196, 'MTON')
unit('volume', 158.987294928 * 6.28981, 'GRT', 'regton')

// Area, base square metre.
unit('area', 1, 'm2', 'm^2')
unit('area', 4046.8564224, 'acre', 'uk_acre', 'us_acre')
unit('area', 0.00064516, 'in2', 'in^2')
unit('area', 0.09290304, 'ft2', 'ft^2')
unit('area', 0.83612736, 'yd2', 'yd^2')
unit('area', 2589988.110336, 'mi2', 'mi^2')
unit('area', 10000, 'ha')
unit('area', 1e-28, 'ang2', 'ang^2')

// Information, base bit.
unit('information', 1, 'bit')
unit('information', 8, 'byte')

// Speed, base metres per second.
unit('speed', 1, 'm/s', 'm/sec')
unit('speed', 1 / 3.6, 'm/h', 'm/hr')
unit('speed', 1609.344 / 3600, 'mph')
unit('speed', 1852 / 3600, 'kn', 'admkn')

/** The SI prefixes CONVERT accepts in front of a metric unit. */
const PREFIXES: Record<string, number> = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2,
  e: 1e1, d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
  a: 1e-18, z: 1e-21, y: 1e-24,
}

/** A unit name into its measure and its factor, prefix allowed for. */
function lookup(name: string): { measure: string; factor: number } | null {
  const direct = UNITS[name]
  if (direct) return direct
  // A prefix only counts when what follows it is a unit in its own right.
  const head = name.slice(0, 1)
  const rest = name.slice(1)
  const scale = PREFIXES[head]
  const base = scale === undefined ? undefined : UNITS[rest]
  if (scale !== undefined && base) return { measure: base.measure, factor: base.factor * scale }
  return null
}

/** Temperature, which scales AND shifts, so it sits outside the table. */
const TEMPERATURE: Record<string, { toK: (v: number) => number; fromK: (v: number) => number }> = {
  C: { toK: (v) => v + 273.15, fromK: (v) => v - 273.15 },
  F: { toK: (v) => ((v - 32) * 5) / 9 + 273.15, fromK: (v) => ((v - 273.15) * 9) / 5 + 32 },
  K: { toK: (v) => v, fromK: (v) => v },
  Rank: { toK: (v) => (v * 5) / 9, fromK: (v) => (v * 9) / 5 },
  Reau: { toK: (v) => v * 1.25 + 273.15, fromK: (v) => (v - 273.15) * 0.8 },
}
TEMPERATURE.cel = TEMPERATURE.C!
TEMPERATURE.fah = TEMPERATURE.F!
TEMPERATURE.kel = TEMPERATURE.K!

export const ENGINEERING_FUNCTIONS: Record<string, SheetFunction> = {
  // ---- Base conversion -------------------------------------------------
  DEC2BIN: (a) => toBase(num(a, 0), 2, given(a, 1) ? nth(a, 1) : undefined),
  DEC2OCT: (a) => toBase(num(a, 0), 8, given(a, 1) ? nth(a, 1) : undefined),
  DEC2HEX: (a) => toBase(num(a, 0), 16, given(a, 1) ? nth(a, 1) : undefined),
  BIN2DEC: (a) => fromBase(text(a, 0), 2),
  OCT2DEC: (a) => fromBase(text(a, 0), 8),
  HEX2DEC: (a) => fromBase(text(a, 0), 16),
  BIN2OCT: convert(2, 8),
  BIN2HEX: convert(2, 16),
  OCT2BIN: convert(8, 2),
  OCT2HEX: convert(8, 16),
  HEX2BIN: convert(16, 2),
  HEX2OCT: convert(16, 8),

  // ---- Bitwise ---------------------------------------------------------
  BITAND: bitwise((x, y) => x & y),
  BITOR: bitwise((x, y) => x | y),
  BITXOR: bitwise((x, y) => x ^ y),
  BITLSHIFT: (a) => {
    const x = bitOperand(num(a, 0))
    const by = Math.trunc(num(a, 1))
    if (x === null || Math.abs(by) > 53) return err('#NUM!')
    const out = by >= 0 ? x << BigInt(by) : x >> BigInt(-by)
    return out > 281474976710655n ? err('#NUM!') : Number(out)
  },
  BITRSHIFT: (a) => {
    const x = bitOperand(num(a, 0))
    const by = Math.trunc(num(a, 1))
    if (x === null || Math.abs(by) > 53) return err('#NUM!')
    const out = by >= 0 ? x >> BigInt(by) : x << BigInt(-by)
    return out > 281474976710655n ? err('#NUM!') : Number(out)
  },

  // ---- Step functions --------------------------------------------------
  DELTA: (a) => (num(a, 0) === (given(a, 1) ? num(a, 1) : 0) ? 1 : 0),
  GESTEP: (a) => (num(a, 0) >= (given(a, 1) ? num(a, 1) : 0) ? 1 : 0),

  // ---- Error integrals -------------------------------------------------
  // ERF with two arguments is the integral BETWEEN the limits.
  ERF: (a) => (given(a, 1) ? erf(num(a, 1)) - erf(num(a, 0)) : erf(num(a, 0))),
  'ERF.PRECISE': (a) => erf(num(a, 0)),
  ERFC: (a) => erfc(num(a, 0)),
  'ERFC.PRECISE': (a) => erfc(num(a, 0)),

  // ---- Units -----------------------------------------------------------
  CONVERT: (a) => {
    const value = num(a, 0)
    const from = text(a, 1)
    const to = text(a, 2)
    const tFrom = TEMPERATURE[from]
    const tTo = TEMPERATURE[to]
    if (tFrom || tTo) {
      // Both sides have to be temperatures, or the measures do not agree.
      if (!tFrom || !tTo) return err('#N/A')
      return tTo.fromK(tFrom.toK(value))
    }
    const f = lookup(from)
    const t = lookup(to)
    if (!f || !t) return err('#N/A')
    if (f.measure !== t.measure) return err('#N/A')
    return (value * f.factor) / t.factor
  },
}
