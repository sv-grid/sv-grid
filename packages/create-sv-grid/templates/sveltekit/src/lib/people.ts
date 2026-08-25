export type Person = { id: number; name: string; role: string; year: number }

// Stands in for your database. Mutating a module-level array is fine for a
// tutorial; swap it for real queries and the rest of the page is unchanged.
const people: Person[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Mathematician', year: 1843 },
  { id: 2, name: 'Grace Hopper', role: 'Rear Admiral', year: 1952 },
  { id: 3, name: 'Karen Sparck Jones', role: 'Computer Scientist', year: 1972 },
  { id: 4, name: 'Barbara Liskov', role: 'Computer Scientist', year: 1968 },
  { id: 5, name: 'Margaret Hamilton', role: 'Software Engineer', year: 1969 },
]

export function listPeople(sortBy: keyof Person = 'name', desc = false): Person[] {
  const rows = [...people]
  rows.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : a[sortBy] < b[sortBy] ? -1 : 0))
  return desc ? rows.reverse() : rows
}

export function renamePerson(id: number, name: string): void {
  const row = people.find((p) => p.id === id)
  if (row) row.name = name
}
