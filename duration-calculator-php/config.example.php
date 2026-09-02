<?php
// Copy this file to config.php and fill in your real DirectAdmin/cPanel DB credentials.
// config.php is gitignored — never commit real credentials.

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'your_db_name',
        'user' => 'your_db_user',
        'password' => 'your_db_password',
        'charset' => 'utf8mb4',
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
];
