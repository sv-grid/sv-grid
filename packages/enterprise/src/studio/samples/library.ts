import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, project, dashScreen, statusPills, detailScreen, pad, ids, type SampleApp } from './shared.js'

const books: EntitySchema = {
  name: 'books',
  label: 'Book',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true, minLength: 2 },
    { field: 'author', type: 'text', label: 'Author', required: true, minLength: 2 },
    { field: 'isbn', type: 'text', label: 'ISBN', input: { editorType: 'mask', mask: '###-#-#####-###-#', help: 'ISBN-13, digits only' } },
    { field: 'genre', type: 'enum', required: true, defaultValue: 'fiction', options: [
      { value: 'fiction', label: 'Fiction', color: '#6366f1' },
      { value: 'science', label: 'Science', color: '#0ea5e9' },
      { value: 'history', label: 'History', color: '#f59e0b' },
      { value: 'kids', label: 'Kids', color: '#ec4899' },
    ] },
    { field: 'rating', type: 'number', label: 'Rating', min: 0, max: 5, defaultValue: 3, input: { editorType: 'rating', help: 'Reader score 0-5' } },
    { field: 'tags', type: 'text', label: 'Tags', input: { editorType: 'chips', help: 'Themes / keywords' } },
    { field: 'spineColor', type: 'text', label: 'Spine color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Shelf label color' } },
    { field: 'copies', type: 'number', label: 'Copies', min: 0, defaultValue: 1, input: { help: 'Total copies owned' } },
    { field: 'year', type: 'number', label: 'Year', min: 0 },
    { field: 'coverUrl', type: 'text', label: 'Cover', format: 'url', input: { placeholder: 'https://…' } },
  ],
}

const members: EntitySchema = {
  name: 'members',
  label: 'Member',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true, input: { help: 'Used for hold notices' } },
    { field: 'phone', type: 'text', label: 'Phone', input: { editorType: 'phone' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Residence country' } },
    { field: 'tier', type: 'enum', required: true, defaultValue: 'standard', options: [
      { value: 'standard', label: 'Standard', color: '#6366f1' },
      { value: 'student', label: 'Student', color: '#10b981' },
      { value: 'senior', label: 'Senior', color: '#f59e0b' },
    ] },
    { field: 'pin', type: 'text', label: 'Card PIN', minLength: 4, hidden: { grid: true }, input: { editorType: 'password', help: 'Self-checkout PIN' } },
    { field: 'joinDate', type: 'date', label: 'Joined' },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const loans: EntitySchema = {
  name: 'loans',
  label: 'Loan',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'bookId', type: 'relation', label: 'Book', relation: { entity: 'books', foreignKey: 'bookId', labelField: 'title' } },
    { field: 'memberId', type: 'relation', label: 'Member', relation: { entity: 'members', foreignKey: 'memberId', labelField: 'name' } },
    { field: 'status', type: 'enum', required: true, defaultValue: 'borrowed', options: [
      { value: 'borrowed', label: 'Borrowed', color: '#0ea5e9' },
      { value: 'returned', label: 'Returned', color: '#10b981' },
      { value: 'overdue', label: 'Overdue', color: '#ef4444' },
    ] },
    { field: 'borrowedAt', type: 'date', label: 'Borrowed' },
    { field: 'dueDate', type: 'date', label: 'Due date' },
    { field: 'returnedAt', type: 'text', label: 'Returned at', input: { editorType: 'datetime', help: 'Exact check-in time' } },
    { field: 'daysOverdue', type: 'number', label: 'Days overdue', min: 0, defaultValue: 0, input: { help: 'Days past the due date' } },
    { field: 'dailyRate', type: 'number', label: 'Daily rate ($)', min: 0, defaultValue: 0.25, input: { help: 'Fine charged per overdue day' } },
    // Derived: total fine owed = overdue days times the daily rate (display-only).
    { field: 'fineAmount', type: 'number', label: 'Fine ($)', readonly: true, formula: 'daysOverdue * dailyRate' },
  ],
}

const seed = {
  books: [
    { id: 'bk1', title: 'The Silent Sea', author: 'Marina Cole', isbn: '978-0-14028-329-5', genre: 'fiction', rating: 4, tags: ['Mystery', 'Ocean'], spineColor: '#6366f1', copies: 4, year: 2019, coverUrl: 'https://covers.example.com/silent-sea.jpg' },
    { id: 'bk2', title: 'Quantum Frontiers', author: 'Devan Rao', isbn: '978-1-40889-641-3', genre: 'science', rating: 5, tags: ['Physics', 'Space'], spineColor: '#0ea5e9', copies: 3, year: 2021, coverUrl: 'https://covers.example.com/quantum.jpg' },
    { id: 'bk3', title: 'Empires of Old', author: 'Sofia Marek', isbn: '978-0-33450-403-8', genre: 'history', rating: 3, tags: ['Rome', 'War'], spineColor: '#f59e0b', copies: 2, year: 2015, coverUrl: 'https://covers.example.com/empires.jpg' },
    { id: 'bk4', title: 'The Curious Fox', author: 'Penny Hart', isbn: '978-1-59327-599-0', genre: 'kids', rating: 5, tags: ['Animals', 'Adventure'], spineColor: '#ec4899', copies: 6, year: 2022, coverUrl: 'https://covers.example.com/fox.jpg' },
    { id: 'bk5', title: 'Midnight Harbor', author: 'Louis Brenn', isbn: '978-0-74322-620-9', genre: 'fiction', rating: 4, tags: ['Noir', 'Thriller'], spineColor: '#8b5cf6', copies: 5, year: 2018, coverUrl: 'https://covers.example.com/harbor.jpg' },
    { id: 'bk6', title: 'Atoms and Stars', author: 'Iris Chen', isbn: '978-0-30788-743-6', genre: 'science', rating: 4, tags: ['Astronomy', 'Chemistry'], spineColor: '#14b8a6', copies: 3, year: 2020, coverUrl: 'https://covers.example.com/atoms.jpg' },
  ],
  members: [
    { id: 'mb1', name: 'Eleanor Price', email: 'eleanor.price@example.com', phone: '+1 (415) 555-0111', country: 'United States', tier: 'standard', pin: '4821', joinDate: '2023-02-14', active: true },
    { id: 'mb2', name: 'Ravi Menon', email: 'ravi.menon@example.com', phone: '+44 20 7946 0112', country: 'United Kingdom', tier: 'student', pin: '9037', joinDate: '2024-09-01', active: true },
    { id: 'mb3', name: 'Greta Olsen', email: 'greta.olsen@example.com', phone: '+49 30 5550113', country: 'Germany', tier: 'senior', pin: '2264', joinDate: '2021-06-30', active: true },
    { id: 'mb4', name: 'Tomas Vega', email: 'tomas.vega@example.com', phone: '+34 91 555 0114', country: 'Spain', tier: 'standard', pin: '7715', joinDate: '2022-11-19', active: true },
    { id: 'mb5', name: 'Aisha Bello', email: 'aisha.bello@example.com', phone: '+234 1 555 0115', country: 'Nigeria', tier: 'student', pin: '3390', joinDate: '2025-01-08', active: true },
    { id: 'mb6', name: 'Harold Finch', email: 'harold.finch@example.com', phone: '+1 (212) 555-0116', country: 'United States', tier: 'senior', pin: '5582', joinDate: '2020-03-27', active: false },
  ],
  loans: [
    { id: 'ln1', bookId: 'bk1', memberId: 'mb1', status: 'borrowed', borrowedAt: '2026-07-14', dueDate: '2026-07-28', returnedAt: '', daysOverdue: 0, dailyRate: 0.25 },
    { id: 'ln2', bookId: 'bk2', memberId: 'mb2', status: 'overdue', borrowedAt: '2026-06-21', dueDate: '2026-07-05', returnedAt: '', daysOverdue: 18, dailyRate: 0.25 },
    { id: 'ln3', bookId: 'bk3', memberId: 'mb3', status: 'returned', borrowedAt: '2026-06-06', dueDate: '2026-06-20', returnedAt: '2026-06-19T15:42:00.000Z', daysOverdue: 0, dailyRate: 0.25 },
    { id: 'ln4', bookId: 'bk4', memberId: 'mb4', status: 'borrowed', borrowedAt: '2026-07-19', dueDate: '2026-08-02', returnedAt: '', daysOverdue: 0, dailyRate: 0.10 },
    { id: 'ln5', bookId: 'bk5', memberId: 'mb5', status: 'overdue', borrowedAt: '2026-06-16', dueDate: '2026-06-30', returnedAt: '', daysOverdue: 29, dailyRate: 0.25 },
    { id: 'ln6', bookId: 'bk1', memberId: 'mb6', status: 'returned', borrowedAt: '2026-06-01', dueDate: '2026-06-15', returnedAt: '2026-06-18T09:05:00.000Z', daysOverdue: 3, dailyRate: 0.25 },
    { id: 'ln7', bookId: 'bk6', memberId: 'mb2', status: 'borrowed', borrowedAt: '2026-07-27', dueDate: '2026-08-10', returnedAt: '', daysOverdue: 0, dailyRate: 0.25 },
    { id: 'ln8', bookId: 'bk2', memberId: 'mb3', status: 'overdue', borrowedAt: '2026-06-17', dueDate: '2026-07-01', returnedAt: '', daysOverdue: 24, dailyRate: 0.50 },
  ],
}

// Loan grid formatting: status pills, plus numeric thresholds so overdue loans
// jump out (any overdue day red + bold, a badly overdue loan gets a red wash) -
// data-driven color, not just status pills.
const loanFormats: FormatRule[] = [
  ...statusPills(loans, 'status'),
  { field: 'daysOverdue', op: 'gt', value: 0, color: '#dc2626', bold: true },
  { field: 'daysOverdue', op: 'gte', value: 21, background: 'color-mix(in srgb, #ef4444 18%, transparent)' },
]

// Book grid formatting: genre pills plus rating thresholds (top-rated green +
// bold, weak titles red).
const bookFormats: FormatRule[] = [
  ...statusPills(books, 'genre'),
  { field: 'rating', op: 'gte', value: 4, color: '#16a34a', bold: true },
  { field: 'rating', op: 'lt', value: 3, color: '#dc2626' },
]

export const library: SampleApp = {
  id: 'library',
  name: 'Library',
  description: 'Books, members and loans - circulation + catalog dashboards (an overdue-days KPI sparkline over borrow dates, a rating gauge, status and genre breakdowns, a status x borrow-date pivot, tabbed views), conditional-format status-pill grids with overdue-red rows and row actions, master/detail, and rich edit forms (ISBN mask, star rating, tag chips, phone, country, and a computed fine).',
  emoji: '📚',
  accent: '#a855f7',
  build: () => {
    const bookRows = pad(books, seed.books, 60)
    const memberRows = pad(members, seed.members, 40)
    const loanRows = pad(loans, seed.loans, 90, { bookId: ids(bookRows), memberId: ids(memberRows) })
    return project({
      title: 'BookNook',
      brand: 'BookNook',
      accent: '#a855f7',
      preset: 'shadcn',
      footer: '© BookNook Library',
      entities: [books, members, loans],
      seed: { books: bookRows, members: memberRows, loans: loanRows },
      screens: [
        // Circulation dashboard: loan KPIs (overdue-days card trends over borrow
        // dates as a sparkline), an average-overdue gauge, status breakdowns, a
        // status x borrow-date pivot, a tabbed view, and a status-pill loan grid
        // where overdue rows go red.
        dashScreen(loans, { id: 'overview', title: 'Circulation', order: 0 }, [
          { kpi: 'Active loans', reduce: 'count', span: 1 },
          { kpi: 'Days overdue', measure: 'daysOverdue', reduce: 'sum', trendField: 'borrowedAt', trendReduce: 'sum', span: 1 },
          { kpi: 'Avg daily rate', measure: 'dailyRate', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg days overdue', measure: 'daysOverdue', reduce: 'avg', min: 0, max: 30, unit: 'd', span: 1 },
          { chart: 'status', measure: 'daysOverdue', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['status'], cols: ['borrowedAt'], measure: 'daysOverdue', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Overdue by status', tiles: [{ chart: 'status', measure: 'daysOverdue', reduce: 'sum', type: 'bar' }] },
            { label: 'Loans by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: loanFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Catalog dashboard: book KPIs (avg rating targets 4 stars), a rating gauge
        // 0-5, copies + count by genre, a copies-by-year area trend, a genre filter,
        // and a genre-pill book grid with rating thresholds.
        dashScreen(books, { id: 'catalog', title: 'Catalog', order: 1 }, [
          { kpi: 'Titles', reduce: 'count', span: 1 },
          { kpi: 'Copies on shelf', measure: 'copies', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Avg rating', measure: 'rating', reduce: 'avg', target: 4, span: 1 },
          { gauge: 'Avg rating', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'genre', measure: 'copies', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'genre', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'year', measure: 'copies', reduce: 'sum', type: 'area', span: 3 },
          { filter: ['genre'], span: 3 },
          { grid: true, format: bookFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        detailScreen(members, { id: 'member-360', title: 'Member 360', order: 2 }, {
          titleField: 'name', subtitleField: 'email', statusField: 'tier',
          related: [{ entity: 'loans', foreignKey: 'memberId', label: 'Loans', titleField: 'bookId', dateField: 'borrowedAt', statusField: 'status' }],
        }),
        screen(books, 'master-detail', { id: 'books', title: 'Books', order: 3, child: loans, foreignKey: 'bookId' }),
        formScreen(loans, { id: 'loans', title: 'Loans', order: 4 }, undefined, { format: loanFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'bookId', 'memberId']),
        formScreen(members, { id: 'members', title: 'Members', order: 5 }, undefined, { rowLink: { screen: 'member-360', sourceField: 'id', targetField: 'id' } }, ['tier', 'country', 'active']),
      ],
    })
  },
}
