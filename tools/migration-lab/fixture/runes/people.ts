export type Person = {
  id: number
  name: string
  department: string
  city: string
  salary: number
}

export const people: Person[] = [
  { id: 1, name: 'Ada Lovelace', department: 'Engineering', city: 'London', salary: 142000 },
  { id: 2, name: 'Grace Hopper', department: 'Engineering', city: 'New York', salary: 168000 },
  { id: 3, name: 'Linus Torvalds', department: 'Platform', city: 'Portland', salary: 155000 },
  { id: 4, name: 'Radia Perlman', department: 'Networking', city: 'Seattle', salary: 161000 },
  { id: 5, name: 'Barbara Liskov', department: 'Platform', city: 'Boston', salary: 172000 },
  { id: 6, name: 'Ken Thompson', department: 'Platform', city: 'Murray Hill', salary: 158000 },
  { id: 7, name: 'Margaret Hamilton', department: 'Engineering', city: 'Cambridge', salary: 165000 },
  { id: 8, name: 'Vint Cerf', department: 'Networking', city: 'Reston', salary: 150000 },
]
