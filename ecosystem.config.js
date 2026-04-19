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
      script: "npm",
      args: "start",
      cwd: "/opt/kolmatrix",
      instances: 1,
      exec_mode: "cluster",
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
