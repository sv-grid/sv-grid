import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const departments: EntitySchema = {
  name: 'departments',
  label: 'Department',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'budget', type: 'number', label: 'Budget ($)' },
  ],
}

const employees: EntitySchema = {
  name: 'employees',
  label: 'Employee',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'deptId', type: 'relation', label: 'Department', relation: { entity: 'departments', foreignKey: 'deptId', labelField: 'name' } },
    { field: 'level', type: 'enum', options: [
      { value: 'junior', label: 'Junior', color: '#94a3b8' },
      { value: 'mid', label: 'Mid', color: '#0ea5e9' },
      { value: 'senior', label: 'Senior', color: '#6366f1' },
      { value: 'lead', label: 'Lead', color: '#10b981' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'on_leave', label: 'On leave', color: '#f59e0b' },
      { value: 'terminated', label: 'Terminated', color: '#ef4444' },
    ] },
    { field: 'salary', type: 'number', label: 'Salary ($)' },
    { field: 'hireDate', type: 'date', label: 'Hire date' },
  ],
}

const timeOff: EntitySchema = {
  name: 'timeOff',
  label: 'Time off',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'employeeId', type: 'relation', label: 'Employee', relation: { entity: 'employees', foreignKey: 'employeeId', labelField: 'name' } },
    { field: 'type', type: 'enum', options: [
      { value: 'vacation', label: 'Vacation', color: '#0ea5e9' },
      { value: 'sick', label: 'Sick', color: '#ef4444' },
      { value: 'personal', label: 'Personal', color: '#f59e0b' },
    ] },
    { field: 'days', type: 'number', label: 'Days' },
    { field: 'status', type: 'enum', options: [
      { value: 'requested', label: 'Requested', color: '#94a3b8' },
      { value: 'approved', label: 'Approved', color: '#10b981' },
      { value: 'rejected', label: 'Rejected', color: '#ef4444' },
    ] },
  ],
}

const seed = {
  departments: [
    { id: 'dp1', name: 'Engineering', budget: 1800000 },
    { id: 'dp2', name: 'Sales', budget: 950000 },
    { id: 'dp3', name: 'Marketing', budget: 620000 },
    { id: 'dp4', name: 'Finance', budget: 540000 },
    { id: 'dp5', name: 'People Ops', budget: 380000 },
  ],
  employees: [
    { id: 'em1', name: 'Ada Lovelace', email: 'ada@company.com', deptId: 'dp1', level: 'lead', status: 'active', salary: 165000, hireDate: '2026-01-06' },
    { id: 'em2', name: 'Alan Turing', email: 'alan@company.com', deptId: 'dp1', level: 'senior', status: 'active', salary: 142000, hireDate: '2026-01-20' },
    { id: 'em3', name: 'Grace Hopper', email: 'grace@company.com', deptId: 'dp2', level: 'mid', status: 'on_leave', salary: 98000, hireDate: '2026-02-03' },
    { id: 'em4', name: 'Linus Torvalds', email: 'linus@company.com', deptId: 'dp1', level: 'senior', status: 'active', salary: 138000, hireDate: '2026-02-17' },
    { id: 'em5', name: 'Barbara Liskov', email: 'barbara@company.com', deptId: 'dp3', level: 'junior', status: 'active', salary: 72000, hireDate: '2026-03-02' },
    { id: 'em6', name: 'Katherine Johnson', email: 'kj@company.com', deptId: 'dp4', level: 'mid', status: 'terminated', salary: 89000, hireDate: '2026-03-16' },
    { id: 'em7', name: 'Margaret Hamilton', email: 'mh@company.com', deptId: 'dp5', level: 'lead', status: 'active', salary: 151000, hireDate: '2026-04-01' },
  ],
  timeOff: [
    { id: 'to1', employeeId: 'em1', type: 'vacation', days: 5, status: 'approved' },
    { id: 'to2', employeeId: 'em3', type: 'sick', days: 3, status: 'approved' },
    { id: 'to3', employeeId: 'em2', type: 'personal', days: 1, status: 'requested' },
    { id: 'to4', employeeId: 'em5', type: 'vacation', days: 8, status: 'rejected' },
    { id: 'to5', employeeId: 'em4', type: 'sick', days: 2, status: 'approved' },
    { id: 'to6', employeeId: 'em7', type: 'vacation', days: 4, status: 'requested' },
  ],
}

export const hr: SampleApp = {
  id: 'hr',
  name: 'HR',
  description: 'Employees, departments and time off - headcount and payroll dashboards.',
  emoji: '\u{1F465}',
  accent: '#8b5cf6',
  build: () =>
    project({
      title: 'People Ops',
      brand: 'People Ops',
      accent: '#8b5cf6',
      footer: '',
      entities: [departments, employees, timeOff],
      seed,
      screens: [
        dashScreen(employees, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Headcount', reduce: 'count' },
          { kpi: 'Total payroll', measure: 'salary', reduce: 'sum' },
          { kpi: 'Avg salary', measure: 'salary', reduce: 'avg' },
          { chart: 'level', measure: 'salary', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Top salary', measure: 'salary', reduce: 'max', span: 1 },
          { chart: 'level', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(departments, 'master-detail', { id: 'departments', title: 'Departments', order: 1, child: employees, foreignKey: 'deptId' }),
        screen(employees, 'crud', { id: 'employees', title: 'Employees', order: 2 }),
        screen(timeOff, 'crud', { id: 'timeOff', title: 'Time off', order: 3 }),
      ],
    }),
}
