/**
 * avatar - pure helpers behind <SvAvatar>: derive up-to-two-letter initials from
 * a name, and a stable hue from a string so the same name always gets the same
 * fallback colour. Framework-free + pure so they are unit-tested directly.
 */

/** Up to two uppercase initials for `name` (first + last word, or first two
 *  letters of a single word). Empty string for blank input. */
export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Deterministic hue (0-359) derived from a string, for the fallback tint. */
export function avatarColorHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}
