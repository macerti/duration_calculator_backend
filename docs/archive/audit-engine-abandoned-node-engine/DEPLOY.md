# Deploying to cPanel Shared Hosting

Two things need to exist on the host: a MariaDB database, and a way to run this
Node app. This doc assumes you don't yet know if "Setup Node.js App" is
available — steps for both cases are below.

## 1. Database setup (do this regardless)

1. cPanel → **MySQL Databases**.
2. Create a database (e.g. `auditdb`) — cPanel will prefix it: `cpaneluser_auditdb`.
3. Create a database user, set a strong password — also prefixed: `cpaneluser_dbuser`.
4. Add that user to the database with **All Privileges**.
5. Open **phpMyAdmin**, select the new database, go to the **SQL** tab, paste the
   contents of `db/schema.sql`, and run it. You should see 3 new tables:
   `parameter_sets`, `calculation_cases`, `parameter_change_log`.

## 2. Check for Node.js support

cPanel → look for **"Setup Node.js App"**. If it's there:

### 2a. With Node.js Selector
1. Click **Create Application**.
2. Node version: pick the highest available 18+ (this project targets ES2022).
3. Application root: e.g. `audit-engine` (a folder under your home directory,
   **not** inside `public_html` directly — Passenger handles routing).
4. Application URL: the subdomain or path you want it served at (e.g. `api.yourdomain.com`).
5. Application startup file: `app.js`.
6. Save, then use the **"Run NPM Install"** button cPanel provides, or SSH in and run
   it yourself (see step 3).
7. In the app's **Environment Variables** section (cPanel UI), add the `DB_*` vars
   from `.env.example` — use the values from step 1. You generally don't need a
   `.env` file at all here, since cPanel injects these directly.
8. Restart the app from the cPanel UI after setting env vars.

### 2b. No Node.js Selector available
Options, roughly in order of effort:
- Ask your host to enable it (many shared plans have it off by default but will
  turn it on if asked — it costs them nothing).
- Move just the Node app to a small separate host (Railway, Render, a cheap VPS)
  and point your cPanel-hosted frontend/domain at it via a subdomain CNAME —
  keeps the database on cPanel/MariaDB if you open remote MySQL access, or
  duplicate schema on the new host.
- Last resort: cPanel's cron + a persistent process manager is fragile on shared
  hosting without Passenger; not recommended.

We'll revisit this once you've checked with your host — no need to decide now.

## 3. Getting the code onto the server

Via SSH (if your plan includes it) or cPanel's **Terminal**:

```bash
cd ~/audit-engine        # or wherever you set the application root
git clone <your-repo-url> .        # or upload+extract the tarball via File Manager
npm install
npm run build             # compiles TypeScript -> dist/
cp .env.example .env      # only needed if NOT using cPanel's env var UI
# edit .env with real DB_* values if using the file approach
npm run db:seed           # seeds + activates the default parameter set (one-time)
```

Then restart the app from the Node.js Selector UI (or however your host's
process manager expects a restart — usually touching a `tmp/restart.txt` file
under Passenger conventions, cPanel's UI does this for you).

## 4. Verify

```bash
curl https://api.yourdomain.com/health
```

Expect:
```json
{"status":"ok","parameterSetId":"default-v1","version":1,"dbConnected":true,"dbBackedParameters":true}
```

If `dbConnected` is `false`, double-check the `DB_*` values (host is almost
always `localhost` on cPanel, not an external hostname). If `dbBackedParameters`
is `false` but `dbConnected` is `true`, you forgot `npm run db:seed`.

## Notes
- `connectionLimit: 5` in `src/db/pool.ts` is intentionally conservative — shared
  hosting MySQL plans often cap total connections; raise it only if you know
  your plan's limit.
- Never commit `.env` — it's in `.gitignore`.
