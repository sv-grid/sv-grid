import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, project, dashScreen, detailScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const departments: EntitySchema = {
  name: 'departments',
  label: 'Department',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'parentId', type: 'relation', label: 'Parent dept', relation: { entity: 'departments', foreignKey: 'parentId', labelField: 'name' } },
    { field: 'location', type: 'text', label: 'Location', input: { editorType: 'country', help: 'Primary office country' } },
    { field: 'budget', type: 'number', label: 'Budget ($)', min: 0 },
    { field: 'headcount', type: 'number', label: 'Headcount', min: 0 },
    { field: 'color', type: 'text', label: 'Accent', defaultValue: '#8b5cf6', input: { editorType: 'color', help: 'Chart accent color' } },
  ],
}

const employees: EntitySchema = {
  name: 'employees',
  label: 'Employee',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'ssn', type: 'text', label: 'SSN', input: { editorType: 'mask', mask: '###-##-####', help: 'US tax identifier' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country' } },
    { field: 'deptId', type: 'relation', label: 'Department', relation: { entity: 'departments', foreignKey: 'deptId', labelField: 'name' } },
    { field: 'level', type: 'enum', options: [
      { value: 'junior', label: 'Junior', color: '#94a3b8' },
      { value: 'mid', label: 'Mid', color: '#0ea5e9' },
      { value: 'senior', label: 'Senior', color: '#6366f1' },
      { value: 'lead', label: 'Lead', color: '#10b981' },
    ] },
    { field: 'skills', type: 'text', label: 'Skills', input: { editorType: 'chips', help: 'Key skills and specialties' } },
    { field: 'performance', type: 'number', label: 'Performance', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 review score' } },
    { field: 'status', type: 'enum', defaultValue: 'active', options: [
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'on_leave', label: 'On leave', color: '#f59e0b' },
      { value: 'terminated', label: 'Terminated', color: '#ef4444' },
    ] },
    { field: 'salary', type: 'number', label: 'Salary ($)', min: 0 },
    // Derived: fully-loaded cost including benefits and overhead (display-only).
    { field: 'annualCost', type: 'number', label: 'Annual cost ($)', readonly: true, formula: 'salary * 1.3' },
    { field: 'hireDate', type: 'date', label: 'Hire date' },
    { field: 'portalPassword', type: 'text', label: 'Portal password', minLength: 8, hidden: { grid: true }, input: { editorType: 'password', help: 'Employee self-service login' } },
  ],
}

const timeOff: EntitySchema = {
  name: 'timeOff',
  label: 'Time off',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'employeeId', type: 'relation', label: 'Employee', relation: { entity: 'employees', foreignKey: 'employeeId', labelField: 'name' } },
    { field: 'type', type: 'enum', required: true, options: [
      { value: 'vacation', label: 'Vacation', color: '#0ea5e9' },
      { value: 'sick', label: 'Sick', color: '#ef4444' },
      { value: 'personal', label: 'Personal', color: '#f59e0b' },
    ] },
    { field: 'startDate', type: 'date', label: 'Start date', required: true },
    { field: 'endDate', type: 'date', label: 'End date' },
    { field: 'days', type: 'number', label: 'Days', min: 0 },
    { field: 'status', type: 'enum', defaultValue: 'requested', options: [
      { value: 'requested', label: 'Requested', color: '#94a3b8' },
      { value: 'approved', label: 'Approved', color: '#10b981' },
      { value: 'rejected', label: 'Rejected', color: '#ef4444' },
    ] },
  ],
}

const seed = {
  departments: [
    { id: 'dp0', name: 'Executive', parentId: '', location: 'United States', budget: 400000, headcount: 4, color: '#334155' },
    { id: 'dp1', name: 'Engineering', parentId: 'dp0', location: 'United States', budget: 1800000, headcount: 42, color: '#6366f1' },
    { id: 'dp2', name: 'Sales', parentId: 'dp0', location: 'United Kingdom', budget: 950000, headcount: 28, color: '#10b981' },
    { id: 'dp3', name: 'Marketing', parentId: 'dp2', location: 'Germany', budget: 620000, headcount: 16, color: '#f59e0b' },
    { id: 'dp4', name: 'Finance', parentId: 'dp0', location: 'United States', budget: 540000, headcount: 12, color: '#0ea5e9' },
    { id: 'dp5', name: 'People Ops', parentId: 'dp0', location: 'Canada', budget: 380000, headcount: 9, color: '#8b5cf6' },
  ],
  employees: [
    { id: 'em1', name: 'Ada Lovelace', email: 'ada@company.com', phone: '+1 (415) 555-0101', ssn: '123-45-6789', country: 'United States', deptId: 'dp1', level: 'lead', skills: ['Architecture', 'Leadership', 'Rust'], performance: 5, status: 'active', salary: 165000, hireDate: '2026-01-06', portalPassword: 'lovelace-01' },
    { id: 'em2', name: 'Alan Turing', email: 'alan@company.com', phone: '+44 20 7946 0102', ssn: '234-56-7890', country: 'United Kingdom', deptId: 'dp1', level: 'senior', skills: ['Cryptography', 'Python'], performance: 5, status: 'active', salary: 142000, hireDate: '2026-01-20', portalPassword: 'turing-4102' },
    { id: 'em3', name: 'Grace Hopper', email: 'grace@company.com', phone: '+1 (312) 555-0103', ssn: '345-67-8901', country: 'United States', deptId: 'dp2', level: 'mid', skills: ['Compilers', 'Mentoring'], performance: 4, status: 'on_leave', salary: 98000, hireDate: '2026-02-03', portalPassword: 'hopper-cobol' },
    { id: 'em4', name: 'Linus Torvalds', email: 'linus@company.com', phone: '+1 (650) 555-0104', ssn: '456-78-9012', country: 'Finland', deptId: 'dp1', level: 'senior', skills: ['Kernel', 'Git', 'C'], performance: 4, status: 'active', salary: 138000, hireDate: '2026-02-17', portalPassword: 'torvalds-git' },
    { id: 'em5', name: 'Barbara Liskov', email: 'barbara@company.com', phone: '+1 (617) 555-0105', ssn: '567-89-0123', country: 'United States', deptId: 'dp3', level: 'junior', skills: ['Research', 'Writing'], performance: 3, status: 'active', salary: 72000, hireDate: '2026-03-02', portalPassword: 'liskov-2026' },
    { id: 'em6', name: 'Katherine Johnson', email: 'kj@company.com', phone: '+1 (757) 555-0106', ssn: '678-90-1234', country: 'United States', deptId: 'dp4', level: 'mid', skills: ['Analytics', 'Forecasting'], performance: 2, status: 'terminated', salary: 89000, hireDate: '2026-03-16', portalPassword: 'johnson-nasa' },
    { id: 'em7', name: 'Margaret Hamilton', email: 'mh@company.com', phone: '+1 (212) 555-0107', ssn: '789-01-2345', country: 'United States', deptId: 'dp5', level: 'lead', skills: ['Systems', 'Reliability', 'Leadership'], performance: 5, status: 'active', salary: 151000, hireDate: '2026-04-01', portalPassword: 'hamilton-apollo' },
  ],
  timeOff: [
    { id: 'to1', employeeId: 'em1', type: 'vacation', startDate: '2026-07-06', endDate: '2026-07-10', days: 5, status: 'approved' },
    { id: 'to2', employeeId: 'em3', type: 'sick', startDate: '2026-06-15', endDate: '2026-06-17', days: 3, status: 'approved' },
    { id: 'to3', employeeId: 'em2', type: 'personal', startDate: '2026-07-21', endDate: '2026-07-21', days: 1, status: 'requested' },
    { id: 'to4', employeeId: 'em5', type: 'vacation', startDate: '2026-08-03', endDate: '2026-08-12', days: 8, status: 'rejected' },
    { id: 'to5', employeeId: 'em4', type: 'sick', startDate: '2026-06-22', endDate: '2026-06-23', days: 2, status: 'approved' },
    { id: 'to6', employeeId: 'em7', type: 'vacation', startDate: '2026-09-07', endDate: '2026-09-10', days: 4, status: 'requested' },
  ],
}

// Employee grid formatting: level + status pills, plus numeric thresholds
// (under-performers red, top reviews green + bold, six-figure salaries bold) -
// data-driven color, not just status pills.
const empFormats: FormatRule[] = [
  ...statusPills(employees, 'level'),
  ...statusPills(employees, 'status'),
  { field: 'performance', op: 'lt', value: 3, color: '#dc2626' },
  { field: 'performance', op: 'gte', value: 5, color: '#16a34a', bold: true },
  { field: 'salary', op: 'gte', value: 150000, bold: true },
]

// Time-off grid formatting: type + status pills for a triage-ready request list.
const timeOffFormats: FormatRule[] = [
  ...statusPills(timeOff, 'type'),
  ...statusPills(timeOff, 'status'),
]

export const hr: SampleApp = {
  id: 'hr',
  name: 'HR',
  description: 'Employees, departments and time off - headcount and time-off dashboards (payroll KPI sparkline + target, performance gauge, level/status breakdowns, a level x status pivot, tabs, a time-off area trend), filtered status-pill grids with row actions, master/detail, and rich edit forms (phone, SSN mask, country, skills chips, performance rating, password).',
  emoji: '\u{1F465}',
  accent: '#8b5cf6',
  build: () => {
    const departmentRows = pad(departments, seed.departments, 10)
    const deptPool = ids(departmentRows)
    const employeeRows = pad(employees, seed.employees, 32, { deptId: deptPool })
    const employeePool = ids(employeeRows)
    const timeOffRows = pad(timeOff, seed.timeOff, 28, { employeeId: employeePool })
    return project({
      title: 'People Ops',
      brand: 'People Ops',
      accent: '#8b5cf6',
      preset: 'fluent',
      footer: '',
      entities: [departments, employees, timeOff],
      seed: { departments: departmentRows, employees: employeeRows, timeOff: timeOffRows },
      screens: [
        // Headcount dashboard: KPI cards (a payroll card with a sparkline over hire
        // dates + a $1.5M target, compact-formatted), a performance-rating gauge (0-5),
        // payroll + headcount breakdowns by level and status, a tabbed view, a level x
        // status payroll pivot, and a status-pill employee grid with inline edit.
        dashScreen(employees, { id: 'headcount', title: 'Headcount', order: 0 }, [
          { kpi: 'Headcount', reduce: 'count', span: 1 },
          { kpi: 'Total payroll', measure: 'salary', reduce: 'sum', format: 'compact', trendField: 'hireDate', trendReduce: 'sum', target: 1500000, span: 1 },
          { kpi: 'Avg salary', measure: 'salary', reduce: 'avg', format: 'compact', span: 1 },
          { gauge: 'Avg performance', measure: 'performance', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'level', measure: 'salary', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'level', reduce: 'count', type: 'bar', span: 2 },
          { tabs: [
            { label: 'Payroll by level', tiles: [{ chart: 'level', measure: 'salary', reduce: 'sum', type: 'bar' }] },
            { label: 'Headcount by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 1 },
          { pivot: { rows: ['level'], cols: ['status'], measure: 'salary', aggregate: 'sum' }, span: 3 },
          { grid: true, format: empFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Time-off dashboard: request + days KPIs, an average-days gauge, a days-booked
        // area trend over start dates, type/status breakdowns, a faceted filter, and a
        // grid with type + status pills and inline edit actions.
        dashScreen(timeOff, { id: 'timeoff', title: 'Time off', order: 1 }, [
          { kpi: 'Requests', reduce: 'count', span: 1 },
          { kpi: 'Days booked', measure: 'days', reduce: 'sum', span: 1 },
          { kpi: 'Avg days', measure: 'days', reduce: 'avg', span: 1 },
          { gauge: 'Avg days per request', measure: 'days', reduce: 'avg', min: 0, max: 20, unit: 'd', span: 1 },
          { chart: 'startDate', measure: 'days', reduce: 'sum', type: 'area', span: 3 },
          { chart: 'type', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'status', reduce: 'count', type: 'bar', span: 2 },
          { filter: ['type', 'status'], span: 3 },
          { grid: true, format: timeOffFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Employee 360: a full record page (header with the department subtitle, a
        // status pill and salary/performance tiles) plus a time-off timeline tab.
        detailScreen(employees, { id: 'employee-360', title: 'Employee 360', order: 2 }, {
          titleField: 'name', subtitleField: 'deptId', statusField: 'status', metricFields: ['salary', 'performance'],
          related: [{ entity: 'timeOff', foreignKey: 'employeeId', label: 'Time off', titleField: 'type', dateField: 'startDate', statusField: 'status' }],
        }),
        screen(departments, 'master-detail', { id: 'departments', title: 'Departments', order: 3, child: employees, foreignKey: 'deptId' }),
        formScreen(employees, { id: 'employees', title: 'Employees', order: 4 }, undefined, { format: empFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'employee-360', sourceField: 'id', targetField: 'id' } }, ['deptId', 'level', 'status']),
        formScreen(timeOff, { id: 'requests', title: 'Requests', order: 5 }, undefined, { format: timeOffFormats, summaries: true }, ['employeeId', 'type', 'status']),
        // Org chart: the department hierarchy as a collapsible tree (parentId ->
        // id, self-referential), beside the department grid.
        dashScreen(departments, { id: 'org', title: 'Org chart', order: 6 }, [
          { tree: { labelField: 'name', parentField: 'parentId' }, span: 3 },
          { grid: true, summaries: true, span: 3 },
        ]),
      ],
    })
  },
}
