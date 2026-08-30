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
    // CORS: set to your actual site origin(s) once the frontend is deployed,
    // e.g. ['https://yourdomain.com']. '*' is fine while testing locally.
    'allowedOrigins' => ['*'],
];
