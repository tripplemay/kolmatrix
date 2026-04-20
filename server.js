/* eslint-disable @typescript-eslint/no-require-imports --
   server.js is a CommonJS entry point executed by Node directly (PM2
   cluster worker). Next.js app code is still TypeScript/ESM; this file
   just mounts it. */
// server.js — Next.js production server with PM2 wait_ready integration.
//
// PM2 cluster mode needs to know the exact moment a new worker starts
// accepting connections so it can kill the old one without overlap.
// `next start` alone never sends that signal, so PM2 falls back to a
// listen_timeout estimate and ends up cycling both workers nearly at
// once — 2-3s of dropped requests per reload. Mounting Next inside a
// custom http server lets us emit `process.send('ready')` the instant
// `server.listen` fires, and PM2 then waits for it before killing the
// predecessor. Result: true rolling replacement, zero dropped requests.
//
// Spec: docs/specs/BI2-f002-zero-downtime-fix.md §2.1.1

const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3001;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  server.listen(port, hostname, () => {
    console.log(`[server] listening on ${hostname}:${port}`);
    if (process.send) {
      process.send("ready");
    }
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.once(sig, () => {
      console.log(`[server] ${sig} received, closing connections`);
      server.close(() => process.exit(0));
    });
  }
});
