import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, schedulerScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const drivers: EntitySchema = {
  name: 'drivers',
  label: 'Driver',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'phone', type: 'text', input: { editorType: 'phone', help: 'Mobile contact number' } },
    { field: 'email', type: 'text', format: 'email', required: true, input: { placeholder: 'name@fleetly.com' } },
    { field: 'license', type: 'text', label: 'License', input: { editorType: 'mask', mask: 'AA-######', help: 'State code + 6 digits' } },
    { field: 'rating', type: 'number', label: 'Safety rating', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 safety score' } },
    { field: 'hireDate', type: 'date', label: 'Hire date' },
  ],
}

const vehicles: EntitySchema = {
  name: 'vehicles',
  label: 'Vehicle',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'vin', type: 'text', label: 'VIN', input: { editorType: 'mask', mask: '*****************', help: '17-character vehicle identification number' } },
    { field: 'plate', type: 'text', label: 'Plate', input: { editorType: 'mask', mask: 'AAA-####', help: 'Fleet plate, e.g. FLT-1201' } },
    { field: 'type', type: 'enum', required: true, defaultValue: 'van', options: [
      { value: 'van', label: 'Van', color: '#6366f1' },
      { value: 'truck', label: 'Truck', color: '#10b981' },
      { value: 'car', label: 'Car', color: '#f59e0b' },
      { value: 'bike', label: 'Bike', color: '#0ea5e9' },
    ] },
    { field: 'year', type: 'number', label: 'Year', min: 1990, max: 2030 },
    { field: 'mileage', type: 'number', label: 'Mileage', min: 0, input: { help: 'Odometer reading' } },
    { field: 'fuelLevel', type: 'number', label: 'Fuel level (%)', min: 0, max: 100, defaultValue: 100, input: { editorType: 'slider', help: 'Current tank level' } },
    { field: 'status', type: 'enum', required: true, defaultValue: 'available', options: [
      { value: 'available', label: 'Available', color: '#10b981' },
      { value: 'on_trip', label: 'On trip', color: '#0ea5e9' },
      { value: 'maintenance', label: 'Maintenance', color: '#ef4444' },
    ] },
    { field: 'color', type: 'text', label: 'Livery color', input: { editorType: 'color', help: 'Fleet livery / map color' } },
  ],
}

const trips: EntitySchema = {
  name: 'trips',
  label: 'Trip',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'vehicleId', type: 'relation', label: 'Vehicle', required: true, relation: { entity: 'vehicles', foreignKey: 'vehicleId', labelField: 'name' } },
    { field: 'driverId', type: 'relation', label: 'Driver', required: true, relation: { entity: 'drivers', foreignKey: 'driverId', labelField: 'name' } },
    { field: 'status', type: 'enum', required: true, defaultValue: 'planned', options: [
      { value: 'planned', label: 'Planned', color: '#94a3b8' },
      { value: 'ongoing', label: 'Ongoing', color: '#0ea5e9' },
      { value: 'done', label: 'Done', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
    ] },
    { field: 'distanceKm', type: 'number', label: 'Distance (km)', min: 0, input: { help: 'Route distance in kilometers' } },
    { field: 'cost', type: 'number', label: 'Cost ($)', min: 0 },
    // Derived: cost efficiency per kilometer (display-only, never stored).
    { field: 'costPerKm', type: 'number', label: 'Cost / km ($)', readonly: true, formula: 'cost / distanceKm' },
    { field: 'startAt', type: 'datetime', label: 'Start', input: { editorType: 'datetime', help: 'Scheduled departure time' } },
  ],
}

const seed = {
  drivers: [
    { id: 'dr1', name: 'Miguel Santos', phone: '+1 (415) 555-0201', email: 'miguel@fleetly.com', license: 'CA-482910', rating: 5, hireDate: '2021-03-15' },
    { id: 'dr2', name: 'Aisha Khan', phone: '+1 (312) 555-0202', email: 'aisha@fleetly.com', license: 'IL-118273', rating: 4, hireDate: '2022-07-01' },
    { id: 'dr3', name: 'Tom Becker', phone: '+1 (206) 555-0203', email: 'tom@fleetly.com', license: 'WA-905641', rating: 4, hireDate: '2020-11-20' },
    { id: 'dr4', name: 'Lena Novak', phone: '+1 (720) 555-0204', email: 'lena@fleetly.com', license: 'CO-337882', rating: 3, hireDate: '2023-02-10' },
    { id: 'dr5', name: 'Raj Mehta', phone: '+1 (646) 555-0205', email: 'raj@fleetly.com', license: 'NY-556201', rating: 5, hireDate: '2019-09-05' },
    { id: 'dr6', name: 'Sofia Rossi', phone: '+1 (305) 555-0206', email: 'sofia@fleetly.com', license: 'FL-774519', rating: 4, hireDate: '2024-01-22' },
  ],
  vehicles: [
    { id: 've1', name: 'Sprinter 1', vin: '1HGCM82633A004352', plate: 'FLT-1201', type: 'van', year: 2021, mileage: 82000, fuelLevel: 80, status: 'available', color: '#0284c7' },
    { id: 've2', name: 'Hauler 2', vin: '2FMDK48C97BB12345', plate: 'FLT-1202', type: 'truck', year: 2019, mileage: 154000, fuelLevel: 45, status: 'on_trip', color: '#dc2626' },
    { id: 've3', name: 'Sedan 3', vin: '3VWFE21C04M001234', plate: 'FLT-1203', type: 'car', year: 2022, mileage: 41000, fuelLevel: 95, status: 'available', color: '#0f172a' },
    { id: 've4', name: 'Courier 4', vin: '5UXWX7C5XG0R12345', plate: 'FLT-1204', type: 'bike', year: 2023, mileage: 12000, fuelLevel: 60, status: 'maintenance', color: '#f59e0b' },
    { id: 've5', name: 'Hauler 5', vin: '1FTFW1ET5DFA12345', plate: 'FLT-1205', type: 'truck', year: 2020, mileage: 132000, fuelLevel: 30, status: 'on_trip', color: '#10b981' },
    { id: 've6', name: 'Sprinter 6', vin: '1GNEK13ZX3R123456', plate: 'FLT-1206', type: 'van', year: 2021, mileage: 76000, fuelLevel: 70, status: 'available', color: '#6366f1' },
  ],
  trips: [
    { id: 'tp1', vehicleId: 've1', driverId: 'dr1', status: 'done', distanceKm: 120, cost: 180, startAt: '2026-07-08T08:30:00' },
    { id: 'tp2', vehicleId: 've2', driverId: 'dr2', status: 'ongoing', distanceKm: 340, cost: 520, startAt: '2026-07-12T06:15:00' },
    { id: 'tp3', vehicleId: 've3', driverId: 'dr3', status: 'planned', distanceKm: 60, cost: 90, startAt: '2026-07-15T09:00:00' },
    { id: 'tp4', vehicleId: 've4', driverId: 'dr4', status: 'cancelled', distanceKm: 15, cost: 25, startAt: '2026-07-09T14:45:00' },
    { id: 'tp5', vehicleId: 've5', driverId: 'dr5', status: 'ongoing', distanceKm: 410, cost: 640, startAt: '2026-07-13T05:30:00' },
    { id: 'tp6', vehicleId: 've1', driverId: 'dr6', status: 'done', distanceKm: 95, cost: 140, startAt: '2026-07-11T11:20:00' },
    { id: 'tp7', vehicleId: 've2', driverId: 'dr1', status: 'done', distanceKm: 275, cost: 430, startAt: '2026-07-10T07:00:00' },
  ],
}

// Vehicle grid formatting: type + status pills, plus numeric thresholds (low fuel
// red + bold, healthy fuel green, high-mileage vehicles bold) - data-driven color,
// not just status pills.
const vehicleFormats: FormatRule[] = [
  ...statusPills(vehicles, 'status'),
  ...statusPills(vehicles, 'type'),
  { field: 'fuelLevel', op: 'lt', value: 25, color: '#dc2626', bold: true },
  { field: 'fuelLevel', op: 'gte', value: 75, color: '#16a34a' },
  { field: 'mileage', op: 'gte', value: 150000, bold: true },
]

// Trip grid formatting: status pills, plus expensive trips bold and long-haul
// distances highlighted.
const tripFormats: FormatRule[] = [
  ...statusPills(trips, 'status'),
  { field: 'cost', op: 'gte', value: 500, bold: true },
  { field: 'distanceKm', op: 'gte', value: 300, color: '#0284c7', bold: true },
]

export const fleet: SampleApp = {
  id: 'fleet',
  name: 'Fleet',
  description: 'Vehicles, drivers and trips - fleet + trips dashboards (mileage/cost KPIs with a startAt sparkline, a fuel-level gauge, a type x status pivot, a cost-over-time area trend, tabbed breakdowns), filtered status-pill grids with row actions, master/detail, and rich edit forms (phone, license/VIN/plate masks, safety rating, fuel slider, livery color, datetime).',
  emoji: '\u{1F69A}',
  accent: '#38bdf8',
  build: () => {
    const driverRows = pad(drivers, seed.drivers, 12)
    const vehicleRows = pad(vehicles, seed.vehicles, 14)
    const tripRows = pad(trips, seed.trips, 30, { vehicleId: ids(vehicleRows), driverId: ids(driverRows) })
    return project({
      title: 'Fleetly',
      brand: 'Fleetly',
      accent: '#38bdf8',
      preset: 'carbon',
      mode: 'dark',
      footer: '',
      entities: [drivers, vehicles, trips],
      seed: { drivers: driverRows, vehicles: vehicleRows, trips: tripRows },
      screens: [
        // Fleet dashboard: fleet-size + mileage KPIs, a fuel-level gauge (avg tank
        // 0-100), mileage-by-type + status breakdowns, a type x status pivot, a
        // tabbed view, and a status-pill vehicle grid with inline edit actions.
        dashScreen(vehicles, { id: 'overview', title: 'Fleet', order: 0 }, [
          { kpi: 'Vehicles', reduce: 'count', span: 1 },
          { kpi: 'Total mileage', measure: 'mileage', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Avg mileage', measure: 'mileage', reduce: 'avg', format: 'compact', span: 1 },
          { gauge: 'Avg fuel level', measure: 'fuelLevel', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'type', measure: 'mileage', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['type'], cols: ['status'], aggregate: 'count' }, span: 3 },
          { tabs: [
            { label: 'Mileage by type', tiles: [{ chart: 'type', measure: 'mileage', reduce: 'sum', type: 'bar' }] },
            { label: 'Vehicles by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: vehicleFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Trips dashboard: distance + cost KPIs (both trending over start time via a
        // sparkline), an avg-distance gauge, a cost-over-time area trend, a status
        // pie, a tabbed breakdown, a faceted filter, and a status-pill trip grid.
        dashScreen(trips, { id: 'trips-dashboard', title: 'Trips', order: 1 }, [
          { kpi: 'Trips', reduce: 'count', span: 1 },
          { kpi: 'Total distance', measure: 'distanceKm', reduce: 'sum', format: 'compact', trendField: 'startAt', trendReduce: 'sum', span: 1 },
          { kpi: 'Total cost', measure: 'cost', reduce: 'sum', format: 'currency', trendField: 'startAt', trendReduce: 'sum', span: 1 },
          { kpi: 'Avg cost', measure: 'cost', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg distance (km)', measure: 'distanceKm', reduce: 'avg', min: 0, max: 500, unit: 'km', span: 1 },
          { chart: 'startAt', measure: 'cost', reduce: 'sum', type: 'area', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { tabs: [
            { label: 'Cost by status', tiles: [{ chart: 'status', measure: 'cost', reduce: 'sum', type: 'bar' }] },
            { label: 'Distance by status', tiles: [{ chart: 'status', measure: 'distanceKm', reduce: 'sum', type: 'bar' }] },
          ], span: 3 },
          { filter: ['status', 'vehicleId', 'driverId'], span: 3 },
          { grid: true, format: tripFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Resource scheduler: a column per vehicle, trips placed by time + tinted by status,
        // drag-to-reassign a vehicle + a detail drawer (week view). Was a month calendar.
        schedulerScreen(trips, { id: 'dispatch', title: 'Dispatch', order: 2 }, { startField: 'startAt', titleField: 'driverId', colorField: 'status', resourceField: 'vehicleId', initialView: 'week' }),
        // Vehicle detail: asset header (status pill) + mileage / fuel tiles with a
        // trip-history timeline (each trip titled by its driver, colored by status).
        detailScreen(vehicles, { id: 'vehicle-detail', title: 'Vehicle detail', order: 3 }, {
          titleField: 'name', subtitleField: 'plate', statusField: 'status', metricFields: ['mileage', 'fuelLevel'],
          related: [{ entity: 'trips', foreignKey: 'vehicleId', label: 'Trips', titleField: 'driverId', subtitleField: 'distanceKm', dateField: 'startAt', statusField: 'status' }],
        }),
        screen(vehicles, 'master-detail', { id: 'vehicles', title: 'Vehicles', order: 4, child: trips, foreignKey: 'vehicleId', linkScreen: 'vehicle-detail' }),
        formScreen(trips, { id: 'trip-forms', title: 'Trip forms', order: 5 }, ['vehicleId', 'driverId', 'status'], { format: tripFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'vehicleId', 'driverId']),
        formScreen(drivers, { id: 'drivers', title: 'Drivers', order: 6 }, ['name', 'phone', 'rating'], { summaries: true }, ['rating']),
      ],
    })
  },
}
