// Entrypoint for cPanel's "Setup Node.js App" (Passenger). Passenger looks for
// an "Application startup file" — set that field to "app.js" in the cPanel UI,
// or point it directly at "dist/api/server.js" instead of using this shim.
//
// Run `npm run build` before deploying — this requires the compiled output
// in dist/, it does not run TypeScript directly.
require("./dist/api/server.js");
