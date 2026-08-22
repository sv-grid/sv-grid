/**
 * UserError - a mistake the person at the keyboard can fix (a typo in a
 * connection string, an empty table selection, a folder that already holds
 * another app), as opposed to a defect in Studio.
 *
 * The CLI prints these plainly and stops. Everything else is treated as a crash
 * and gets a sanitized bug report plus a prefilled issue link, so ordinary
 * fat-fingering never looks like something worth reporting.
 *
 * `isUserError` is duck-typed rather than an `instanceof` check: the class can
 * cross a bundle boundary (browser ESM source vs. the Node build), and a
 * mis-detected user error would send someone to file an issue about their own
 * typo.
 */
export class UserError extends Error {
  /** Marker read by `isUserError`; survives bundling and subclassing. */
  readonly isUserError = true
  /** Optional follow-up: what to try instead. */
  readonly hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'UserError'
    if (hint !== undefined) this.hint = hint
  }
}

/** True for anything thrown as a `UserError`, across module instances. */
export function isUserError(err: unknown): err is UserError {
  return !!err && typeof err === 'object' && (err as { isUserError?: unknown }).isUserError === true
}
