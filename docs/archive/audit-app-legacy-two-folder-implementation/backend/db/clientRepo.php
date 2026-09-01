<?php
declare(strict_types=1);

namespace AuditEngine;

function createClient(string $name): int
{
    $stmt = getPdo()->prepare('INSERT INTO clients (name) VALUES (?)');
    $stmt->execute([trim($name)]);
    return (int)getPdo()->lastInsertId();
}

function listClients(): array
{
    $stmt = getPdo()->query(
        'SELECT c.id, c.name, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM calculation_cases cc WHERE cc.client_id = c.id) AS calculation_count
         FROM clients c ORDER BY c.updated_at DESC'
    );
    $rows = $stmt->fetchAll();
    return array_map(fn($r) => [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
        'calculationCount' => (int)$r['calculation_count'],
    ], $rows);
}

function getClient(int $id): ?array
{
    $stmt = getPdo()->prepare('SELECT id, name, created_at, updated_at FROM clients WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function updateClientName(int $id, string $name): bool
{
    $stmt = getPdo()->prepare('UPDATE clients SET name = ? WHERE id = ?');
    return $stmt->execute([trim($name), $id]);
}

/** Calculations belonging to this client are orphaned (client_id -> NULL via
 * the FK's ON DELETE SET NULL), never destroyed — see schema.sql comment. */
function deleteClient(int $id): bool
{
    $stmt = getPdo()->prepare('DELETE FROM clients WHERE id = ?');
    return $stmt->execute([$id]);
}
