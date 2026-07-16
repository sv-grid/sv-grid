import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const books: EntitySchema = {
  name: 'books',
  label: 'Book',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true },
    { field: 'genre', type: 'enum', options: [
      { value: 'fiction', label: 'Fiction', color: '#6366f1' },
      { value: 'science', label: 'Science', color: '#0ea5e9' },
      { value: 'history', label: 'History', color: '#f59e0b' },
      { value: 'kids', label: 'Kids', color: '#ec4899' },
    ] },
    { field: 'copies', type: 'number', label: 'Copies' },
    { field: 'year', type: 'number', label: 'Year' },
  ],
}

const members: EntitySchema = {
  name: 'members',
  label: 'Member',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'tier', type: 'enum', options: [
      { value: 'standard', label: 'Standard', color: '#6366f1' },
      { value: 'student', label: 'Student', color: '#10b981' },
      { value: 'senior', label: 'Senior', color: '#f59e0b' },
    ] },
  ],
}

const loans: EntitySchema = {
  name: 'loans',
  label: 'Loan',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'bookId', type: 'relation', label: 'Book', relation: { entity: 'books', foreignKey: 'bookId', labelField: 'name' } },
    { field: 'memberId', type: 'relation', label: 'Member', relation: { entity: 'members', foreignKey: 'memberId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'borrowed', label: 'Borrowed', color: '#0ea5e9' },
      { value: 'returned', label: 'Returned', color: '#10b981' },
      { value: 'overdue', label: 'Overdue', color: '#ef4444' },
    ] },
    { field: 'fine', type: 'number', label: 'Fine ($)' },
    { field: 'dueDate', type: 'date', label: 'Due date' },
  ],
}

const seed = {
  books: [
    { id: 'bk1', title: 'The Silent Sea', genre: 'fiction', copies: 4, year: 2019 },
    { id: 'bk2', title: 'Quantum Frontiers', genre: 'science', copies: 3, year: 2021 },
    { id: 'bk3', title: 'Empires of Old', genre: 'history', copies: 2, year: 2015 },
    { id: 'bk4', title: 'The Curious Fox', genre: 'kids', copies: 6, year: 2022 },
    { id: 'bk5', title: 'Midnight Harbor', genre: 'fiction', copies: 5, year: 2018 },
    { id: 'bk6', title: 'Atoms and Stars', genre: 'science', copies: 3, year: 2020 },
  ],
  members: [
    { id: 'mb1', name: 'Eleanor Price', email: 'eleanor.price@example.com', tier: 'standard' },
    { id: 'mb2', name: 'Ravi Menon', email: 'ravi.menon@example.com', tier: 'student' },
    { id: 'mb3', name: 'Greta Olsen', email: 'greta.olsen@example.com', tier: 'senior' },
    { id: 'mb4', name: 'Tomas Vega', email: 'tomas.vega@example.com', tier: 'standard' },
    { id: 'mb5', name: 'Aisha Bello', email: 'aisha.bello@example.com', tier: 'student' },
    { id: 'mb6', name: 'Harold Finch', email: 'harold.finch@example.com', tier: 'senior' },
  ],
  loans: [
    { id: 'ln1', bookId: 'bk1', memberId: 'mb1', status: 'borrowed', fine: 0, dueDate: '2026-07-28' },
    { id: 'ln2', bookId: 'bk2', memberId: 'mb2', status: 'overdue', fine: 4.5, dueDate: '2026-07-05' },
    { id: 'ln3', bookId: 'bk3', memberId: 'mb3', status: 'returned', fine: 0, dueDate: '2026-06-20' },
    { id: 'ln4', bookId: 'bk4', memberId: 'mb4', status: 'borrowed', fine: 0, dueDate: '2026-08-02' },
    { id: 'ln5', bookId: 'bk5', memberId: 'mb5', status: 'overdue', fine: 7.25, dueDate: '2026-06-30' },
    { id: 'ln6', bookId: 'bk1', memberId: 'mb6', status: 'returned', fine: 1.0, dueDate: '2026-06-15' },
    { id: 'ln7', bookId: 'bk6', memberId: 'mb2', status: 'borrowed', fine: 0, dueDate: '2026-08-10' },
    { id: 'ln8', bookId: 'bk2', memberId: 'mb3', status: 'overdue', fine: 3.0, dueDate: '2026-07-01' },
  ],
}

export const library: SampleApp = {
  id: 'library',
  name: 'Library',
  description: 'Books, members and loans - circulation and overdue dashboards.',
  emoji: '📚',
  accent: '#a855f7',
  build: () =>
    project({
      title: 'BookNook',
      brand: 'BookNook',
      accent: '#a855f7',
      footer: '',
      entities: [books, members, loans],
      seed,
      screens: [
        dashScreen(loans, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Loans', reduce: 'count' },
          { kpi: 'Total fines', measure: 'fine', reduce: 'sum' },
          { kpi: 'Avg fine', measure: 'fine', reduce: 'avg' },
          { chart: 'status', measure: 'fine', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest fine', measure: 'fine', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(books, 'master-detail', { id: 'books', title: 'Books', order: 1, child: loans, foreignKey: 'bookId' }),
        screen(loans, 'crud', { id: 'loans', title: 'Loans', order: 2 }),
        screen(members, 'crud', { id: 'members', title: 'Members', order: 3 }),
      ],
    }),
}
