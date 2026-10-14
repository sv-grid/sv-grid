/**
 * The people a person field picks from. The sample tables name these ids
 * (u1 to u8); replace the list with your own users, for example from your
 * auth provider, and call setCurrentUser with the signed-in one.
 */
import { setCurrentUser, setFieldUsers, type FieldUser } from '@svgrid/enterprise/base'

export const PEOPLE: FieldUser[] = [
  ['u1', 'Ana Ruiz'],
  ['u2', 'Ben Okafor'],
  ['u3', 'Cleo Park'],
  ['u4', 'Dev Shah'],
  ['u5', 'Elena Novak'],
  ['u6', 'Farah Haddad'],
  ['u7', 'Gus Moreau'],
  ['u8', 'Hana Sato'],
].map(([id, name]) => ({ id: id!, name: name!, email: `${name!.split(' ')[0]!.toLowerCase()}@example.com` }))

setFieldUsers(PEOPLE)
setCurrentUser(PEOPLE[0]!)
