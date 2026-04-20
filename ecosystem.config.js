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
      // Custom server.js mounts Next inside an http server we own, so we
      // can emit `process.send('ready')` the instant listen fires. PM2
      // then waits for that signal (wait_ready) before killing the old
      // worker — true rolling replacement, no overlap gap. Running
      // `npm start` double-forks and breaks cluster hooks (id 7 crash
      // loop); running `next` directly avoids the crash but has no ready
      // signal (56/60 reload drops). See docs/specs/BI2-f002-zero-downtime-fix.md §2.1.
      script: "server.js",
      cwd: "/opt/kolmatrix",
      // Cluster needs ≥2 workers for true zero-downtime reload — single
      // instance leaves a 200-500ms port-close window during reload.
      instances: 2,
      exec_mode: "cluster",
      // Wait for server.js to call process.send('ready') before declaring
      // the new worker live and killing the old one.
      wait_ready: true,
      // Cap on how long PM2 waits for that ready signal. Next.js cold
      // start is ~400-450ms; 10s gives plenty of headroom for cold cache
      // or brief GC pauses without ever being the bottleneck.
      listen_timeout: 10000,
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

    // BI3 F003 — Staging sibling process. Same codebase, independent DB
    // (kolmatrix_staging), independent port (3002), behind Nginx vhost
    // staging.kol.guangai.ai. Single fork instance: staging load is
    // trivial and zero-downtime reload isn't needed — preview branches
    // will simply `pm2 restart kolmatrix-staging`.
    {
      name: "kolmatrix-staging",
      script: "server.js",
      cwd: "/opt/kolmatrix-staging",
      instances: 1,
      exec_mode: "fork",
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        APP_ENV: "staging",
      },
      env_file: "/opt/kolmatrix-staging/.env.staging",
      out_file: "/var/log/pm2/kolmatrix-staging-out.log",
      error_file: "/var/log/pm2/kolmatrix-staging-error.log",
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
