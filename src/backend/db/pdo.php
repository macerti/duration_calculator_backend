<?php
declare(strict_types=1);

namespace AuditEngine;

function loadConfig(): array
{
    $configPath = __DIR__ . '/../config.php';
    if (!file_exists($configPath)) {
        throw new \RuntimeException(
            'Missing config.php — copy config.example.php to config.php and fill in your DB credentials.'
        );
    }
    return require $configPath;
}

function getPdo(): \PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $cfg = loadConfig()['db'];
    $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['name']};charset={$cfg['charset']}";

    $pdo = new \PDO($dsn, $cfg['user'], $cfg['password'], [
        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        \PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function pingDb(): bool
{
    try {
        getPdo()->query('SELECT 1');
        return true;
    } catch (\Throwable $e) {
        return false;
    }
}
