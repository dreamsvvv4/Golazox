/**
 * PM2 Ecosystem Config — GolazOX Production
 *
 * Usage on Hostinger (or any Node.js host with PM2):
 *   npx pm2 start ecosystem.config.js
 *   npx pm2 save           ← persist across reboots
 *   npx pm2 startup        ← run on system boot (follow instructions)
 *   npx pm2 logs golazox   ← live logs
 *   npx pm2 reload golazox ← zero-downtime reload
 *
 * Environment variables to set on the server (or in .env.ps1 / Hostinger panel):
 *   SITE_URL    = "https://golazox.com"
 *   NODE_ENV    = "production"
 *   PORT        = 3000          (Hostinger assigns this automatically)
 *   EMAIL_USER  = "info@golazox.com"
 *   EMAIL_PASS  = "<password del buzon info@golazox.com>"  ← set ONLY in Hostinger panel, never en código
 *   EMAIL_HOST  = "smtp.hostinger.com"   (o mail.golazox.com — ver Hostinger → Email → Configure)
 *   EMAIL_PORT  = "465"                  (SSL) o "587" (STARTTLS)
 */
module.exports = {
  apps: [
    {
      name:              'golazox',
      script:            'server.js',
      instances:         1,            // single instance — safe for in-memory SQUADS cache
      exec_mode:         'fork',
      watch:             ['squads-meta.json'],   // restart when league metadata changes
      max_memory_restart: '512M',      // restart if Node exceeds 512 MB RAM
      restart_delay:     3000,         // wait 3 s before restarting on crash
      max_restarts:      10,           // give up after 10 consecutive crashes
      env: {
        NODE_ENV: 'development',
        PORT:     3000,
      },
      env_production: {
        NODE_ENV:   'production',
        PORT:       process.env.PORT || 3000,
        SITE_URL:   process.env.SITE_URL  || 'https://golazox.com',
        EMAIL_USER: process.env.EMAIL_USER || 'info@golazox.com',
        // EMAIL_PASS, EMAIL_HOST, EMAIL_PORT: set ONLY via Hostinger environment variables panel
      },
      // Log files
      out_file:   './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
