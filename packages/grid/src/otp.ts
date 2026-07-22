/**
 * otp - pure helpers behind <SvOtpInput>: sanitize/spread a raw string across N
 * segments (used on paste and per-cell input) and detect completion.
 * Framework-free + pure so they are unit-tested directly.
 */

/**
 * Keep only the characters allowed for `numeric` mode (digits) or any
 * non-whitespace otherwise, then clamp to `length`. Returns the cleaned string
 * (<= length chars).
 */
export function sanitizeOtp(raw: string, length: number, numeric: boolean): string {
  const kept = numeric ? raw.replace(/\D/g, '') : raw.replace(/\s/g, '')
  return kept.slice(0, Math.max(0, length))
}

/** Split a value into exactly `length` single-char cells (padding with ''). */
export function otpCells(value: string, length: number): string[] {
  const cells: string[] = []
  for (let i = 0; i < length; i++) cells[i] = value[i] ?? ''
  return cells
}

/** Whether `value` fills every cell (a joined OTP has no internal gaps, so an
 *  exact-length string is complete). */
export function isOtpComplete(value: string, length: number): boolean {
  return value.length === length
}
