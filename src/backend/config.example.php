<?php
// Copy this file to config.php and fill in your real DirectAdmin/cPanel DB credentials.
// config.php is gitignored — never commit real credentials.

return [
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'name'     => 'your_db_name',
        'user'     => 'your_db_user',
        'password' => 'your_db_password',
        'charset'  => 'utf8mb4',
    ],
    // URL path in front of the API routes in production, e.g.
    // '/duration_calculator/api' if the app is deployed at
    // https://yourdomain.com/duration_calculator/api/health. Leave empty
    // ('') for local/dev testing, where the API is served at the origin
    // root (e.g. http://127.0.0.1:8080/health). This used to be derived
    // automatically from SCRIPT_NAME, which PHP's built-in dev server sets
    // inconsistently for router-script requests (see BUG-030 in
    // docs/BUGLOG.md) — set it explicitly instead so routing behavior
    // doesn't depend on how the dev server happens to be invoked.
    'basePath' => '',
    // CORS: set to your actual site origin(s) once the frontend is deployed,
    // e.g. ['https://yourdomain.com']. '*' is fine while testing locally.
    'allowedOrigins' => ['*'],
    // When false (or absent — this is the safe default), unexpected server
    // errors return a generic message to the client and log the real detail
    // server-side only. Set true only for your own local debugging, never on
    // the live site — a detailed error message is information a real
    // attacker can use to map the app's internals.
    'debug' => false,

    // -----------------------------------------------------------------
    // Production database migrations — POST /api/migrate (see
    // docs/ROADMAP.md P1 item 0, docs/BUGLOG.md BUG-045). deploy.yml in
    // the deployment repo calls this endpoint right after every FTP sync
    // so pending db/migrations/*.sql files are actually applied to the
    // real production database, not just uploaded as files.
    //
    // Set this to a long random value (e.g. `openssl rand -hex 32`) and
    // put the SAME value in the `MIGRATE_SECRET` GitHub Actions secret on
    // the `macerti/duration_calculator` repo. Leave empty ('') to disable
    // the endpoint entirely (it returns 501 and does nothing).
    //
    // This is the ONLY step that must still be done by hand, and only
    // once: config.php lives solely on the server (gitignored, never
    // deployed by any pipeline), so nothing that runs on GitHub can set
    // it for you. Everything else is automatic after this one line is in
    // place.
    'migration_secret' => '',

    // -----------------------------------------------------------------
    // SSO — Microsoft Entra ID (Azure AD) & Google OAuth 2.0
    // Leave empty ('') to disable that provider.
    // Never commit real secrets — keep them only in the live config.php.
    // -----------------------------------------------------------------

    // The full public URL where the frontend is served, without trailing slash.
    // Used to build the redirect_uri sent to Microsoft/Google, e.g.:
    //   https://tools.macerti.com/duration_calculator
    // The callback URLs registered in Azure Portal and Google Cloud Console
    // MUST match: <app_url>/api/auth/callback/microsoft  (and /google).
    'app_url' => 'https://tools.macerti.com/duration_calculator',

    // Microsoft Entra ID — from portal.azure.com → App registrations
    'microsoft_client_id'     => 'YOUR_AZURE_APPLICATION_CLIENT_ID',
    'microsoft_client_secret' => 'YOUR_AZURE_CLIENT_SECRET_VALUE',

    // Google OAuth 2.0 — from console.cloud.google.com → Credentials
    'google_client_id'     => 'YOUR_GOOGLE_CLIENT_ID',
    'google_client_secret' => 'YOUR_GOOGLE_CLIENT_SECRET',

    // -----------------------------------------------------------------
    // Mail — verification emails, password-reset links, etc.
    // See src/backend/auth/Mailer.php's own header comment for the full
    // driver contract. Two drivers:
    //   'log'  — writes emails to a local file instead of sending them.
    //            Safe default; no other 'mail' keys are required.
    //   'smtp' — real sending through an actual mailbox, e.g.
    //            info@macerti.com. Uncomment and fill in the block below.
    // Never commit real SMTP credentials — keep them only in the live
    // config.php (already gitignored, like the 'db' credentials above).
    // -----------------------------------------------------------------
    'mail' => [
        'driver' => 'log',
        // 'log_path' => '/tmp/audit_app_mail_log.txt', // optional, only used by 'log'

        // Uncomment for real sending and set 'driver' => 'smtp' above:
        // 'host'       => 'mail.macerti.com',        // your mail provider's SMTP host
        // 'port'       => 587,                        // 587 (STARTTLS) or 465 (implicit TLS)
        // 'encryption' => 'tls',                       // 'tls' | 'ssl' | ''
        // 'username'   => 'info@macerti.com',
        // 'password'   => 'YOUR_MAILBOX_PASSWORD',
        // 'from_email' => 'info@macerti.com',          // required once driver is 'smtp'
        // 'from_name'  => 'Macerti',                   // required once driver is 'smtp'
    ],
];

