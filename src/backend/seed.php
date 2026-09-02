<?php
declare(strict_types=1);

require_once __DIR__ . '/data/parameters.php';
require_once __DIR__ . '/db/pdo.php';
require_once __DIR__ . '/db/parameterSetRepo.php';

use function AuditEngine\pingDb;
use function AuditEngine\getActiveParameterSet;
use function AuditEngine\seedDefaultParameterSet;

if (!pingDb()) {
    fwrite(STDERR, "Could not connect to the database. Check config.php.\n");
    exit(1);
}

$existing = getActiveParameterSet();
if ($existing !== null) {
    echo "An active parameter set already exists: {$existing['id']} (v{$existing['version']}). Nothing to do.\n";
    exit(0);
}

$seeded = seedDefaultParameterSet();
echo "Seeded and activated parameter set: {$seeded['id']} (v{$seeded['version']})\n";
