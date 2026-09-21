/**
 * What the browser frame of the stage can show. Each preset is the real
 * component with the data the video's editor scene typed, so the "result"
 * frame of an install tutorial is the product, not a mock.
 */
import type { GridColumns } from '@svgrid/grid'

export type PresetId = 'none' | 'first-grid' | 'minimal-template' | 'sheet-budget'

export type Person = { firstName: string; age: number; status: string }

/** docs/getting-started/2-first-grid.md, verbatim. */
export const firstGrid = {
  rows: [
    { firstName: 'Ada', age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ] as Person[],
  columns: [
    { field: 'firstName', header: 'First name' },
    { field: 'age', header: 'Age' },
    { field: 'status', header: 'Status' },
  ] as GridColumns<Person>,
}

export type Employee = { id: number; name: string; team: string; salary: number; active: boolean }

/** packages/create-sv-grid/templates/minimal/src/App.svelte, verbatim. */
export const minimalTemplate = {
  rows: [
    { id: 1, name: 'Ada Lovelace', team: 'Engineering', salary: 145000, active: true },
    { id: 2, name: 'Alan Turing', team: 'Research', salary: 160000, active: true },
    { id: 3, name: 'Grace Hopper', team: 'Engineering', salary: 152000, active: false },
    { id: 4, name: 'Katherine Johnson', team: 'Data', salary: 138000, active: true },
    { id: 5, name: 'Edsger Dijkstra', team: 'Research', salary: 149000, active: false },
  ] as Employee[],
  columns: [
    { field: 'name', header: 'Name', editorType: 'text', width: 200 },
    { field: 'team', header: 'Team', editorType: 'text', width: 150 },
    { field: 'salary', header: 'Salary', width: 130, align: 'right', format: { type: 'currency', currency: 'USD' } },
    { field: 'active', header: 'Active', editorType: 'checkbox', width: 90 },
  ] as GridColumns<Employee>,
}

/** docs/help/cells/spreadsheet-shell.md, with enough rows for a SUM. */
export const sheetBudget = [
  {
    name: 'Budget',
    cells: [
      ['Line', 'Jan', 'Feb', 'Mar'],
      ['Rent', '2400', '2400', '2400'],
      ['Payroll', '18500', '18500', '19200'],
      ['Cloud', '1320', '1410', '1385'],
      ['Travel', '640', '910', '720'],
      ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)'],
    ],
  },
]
