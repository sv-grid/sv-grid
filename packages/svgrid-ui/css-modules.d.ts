// Recipes may import a theme preset for a side effect (`import
// '@svgrid/grid/themes/shadcn.css'`). Bundlers resolve that through the grid's
// `./themes/*.css` export, but svelte-check wants a module declaration for it.
declare module '*.css'
