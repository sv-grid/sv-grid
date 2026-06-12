// The vendored smart.export.js is a pure IIFE that registers
// Smart.Utilities.DataExporter on the global Smart namespace. It has no
// ESM exports of its own. This sibling .d.ts marks it as a module so
// TypeScript allows `import './smart.export.js'` as a side-effect import.
export {}
