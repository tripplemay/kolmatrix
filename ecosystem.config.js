/**
 * PM2 process manifest for the KOLMatrix production VPS.
 *
 * First-time bootstrap on the VPS (run once, as the deploy user):
 *   pm2 start ecosystem.config.js
 *   pm2 save                            # freeze the process list
 *   pm2 startup                         # prints a systemd command — copy,
 *                                       # run it with sudo, then `pm2 save`
 *                                       # again so PM2 comes back after reboot
 *
 * Deploy-time reload (zero-downtime):
 *   pm2 reload kolmatrix --update-env   # picks up new .env.production
 *
 * `.env.production` is maintained manually on the VPS — NEVER check it
 * into git.  Everything here that differs per-environment should live
 * in that file, not in this manifest.
 *
 * Worker process is stubbed out until B5 wires BullMQ; uncomment then.
 *
 * Spec: docs/specs/BI2-deployment-automation-spec.md §F002
 */
module.exports = {
  apps: [
    {
      name: "kolmatrix",
      // Point PM2 at Next.js's own binary (a JS file), NOT `npm start`.
      // `npm start` double-forks (npm → next), so Node's cluster module
      // can't hook the grandchild's `server.listen`, and the second
      // worker EADDRINUSE-crashes on 3001. Running `next` directly makes
      // it the actual cluster worker, so PM2's port-sharing works.
      // See docs/specs/BI2-f002-zero-downtime-fix.md §2.1 (fix-up after
      // 2026-04-20 live reverify caught 116× crash-loop on id 7).
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/opt/kolmatrix",
      // Cluster needs ≥2 workers for true zero-downtime reload — single
      // instance leaves a 200-500ms port-close window during reload.
      instances: 2,
      exec_mode: "cluster",
      // Give Next.js up to 5s to drain in-flight requests before SIGKILL
      // (PM2 default is 1.6s, too tight for SSR with DB round-trips).
      kill_timeout: 5000,
      // Restart the process if RSS grows past 1 GiB — Next.js in prod
      // should sit comfortably below this; crossing it almost always
      // means a leak.
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // Secrets (DATABASE_URL, NEXTAUTH_SECRET, RESEND_API_KEY, ...)
      // live in a root-owned file on the VPS, loaded by PM2 at spawn.
      env_file: "/opt/kolmatrix/.env.production",
      // Log to the system pm2 dir so logrotate (BI4 scope) can pick them up
      // without per-user path weirdness.
      out_file: "/var/log/pm2/kolmatrix-out.log",
      error_file: "/var/log/pm2/kolmatrix-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },

    // B5 — BullMQ worker. Kept in-manifest (commented) so reviewers
    // see the intended shape when we flip it on.
    //
    // {
    //   name: "kolmatrix-worker",
    //   script: "node",
    //   args: "dist/workers/index.js",
    //   cwd: "/opt/kolmatrix",
    //   instances: 2,
    //   exec_mode: "cluster",
    //   max_memory_restart: "512M",
    //   env: { NODE_ENV: "production" },
    //   env_file: "/opt/kolmatrix/.env.production",
    //   out_file: "/var/log/pm2/kolmatrix-worker-out.log",
    //   error_file: "/var/log/pm2/kolmatrix-worker-error.log",
    //   log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    //   merge_logs: true,
    // },
  ],
};
