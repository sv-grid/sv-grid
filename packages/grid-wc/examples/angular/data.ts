export type Person = {
  id: number
  name: string
  team: 'Design' | 'Engineering' | 'Sales' | 'Support'
  country: string
  amount: number
  active: boolean
  joined: string
}

const TEAMS: Person['team'][] = ['Design', 'Engineering', 'Sales', 'Support']
const COUNTRIES = ['Bulgaria', 'Germany', 'Portugal', 'Norway', 'Japan', 'Canada']
const NAMES = [
  'Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Barbara Liskov',
  'Ken Thompson', 'Margaret Hamilton', 'Donald Knuth', 'Radia Perlman', 'Dennis Ritchie',
]

export const people: Person[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  name: `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
  team: TEAMS[i % TEAMS.length],
  country: COUNTRIES[i % COUNTRIES.length],
  amount: 20_000 + ((i * 7919) % 180_000),
  active: i % 5 !== 0,
  joined: new Date(2020, i % 12, ((i * 3) % 27) + 1).toISOString().slice(0, 10),
}))

/** Column definitions shared by the recipes that do not customise them. */
export const columns = [
  { id: 'id', field: 'id', header: 'ID', width: 70 },
  { id: 'name', field: 'name', header: 'Name', width: 200 },
  { id: 'team', field: 'team', header: 'Team', width: 130 },
  { id: 'country', field: 'country', header: 'Country', width: 140 },
  {
    id: 'amount',
    field: 'amount',
    header: 'Amount',
    width: 140,
    align: 'right',
    cellDataType: 'number',
    format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } },
  },
  { id: 'joined', field: 'joined', header: 'Joined', width: 120, cellDataType: 'dateString' },
]
