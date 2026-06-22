// Ambient declaration so TypeScript accepts side-effect CSS imports
// (e.g. `import "./SvGrid.css"`). The bundler resolves the actual asset.
declare module "*.css";
