/**
 * The people every SvGrid Base demo's user fields choose from. User fields
 * read one list for the whole page, and the gallery loads every demo on one
 * page, so the demos share this list rather than each setting its own.
 */
import { setCurrentUser, setFieldUsers, type FieldUser } from '@svgrid/enterprise/base'
import { portrait } from './gallery-art'

export const PEOPLE: FieldUser[] = [
  ['u1', 'Ana Ruiz'],
  ['u2', 'Ben Okafor'],
  ['u3', 'Cleo Park'],
  ['u4', 'Dev Shah'],
  ['u5', 'Elena Novak'],
  ['u6', 'Farah Haddad'],
  ['u7', 'Gus Moreau'],
  ['u8', 'Hana Sato'],
].map(([id, name], i) => ({ id: id!, name: name!, email: `${name!.split(' ')[0]!.toLowerCase()}@example.com`, avatarUrl: portrait(i + 3) }))

/** Set the shared people and "you" (Ana): safe to call from every demo. */
export function usePeople(): void {
  setFieldUsers(PEOPLE)
  setCurrentUser(PEOPLE[0]!)
}
