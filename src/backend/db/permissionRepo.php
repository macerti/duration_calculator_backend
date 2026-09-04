<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Permissions — the machine-checkable "functions" a role can be granted
 * (e.g. manage_users, override_percentages). Seeded with a small starting
 * set in migrations/002_add_auth_and_rbac.sql; new ones get added here
 * (by a developer wiring a new gated feature, or by an admin from the UI)
 * as they're identified — see docs/ROADMAP.md item 9's hand-off note.
 */

function listPermissions(): array
{
    $rows = getPdo()->query(
        'SELECT id, key_name, label, description FROM permissions ORDER BY key_name ASC'
    )->fetchAll();
    return array_map(fn($r) => [
        'id' => (int)$r['id'],
        'key' => $r['key_name'],
        'label' => $r['label'],
        'description' => $r['description'],
    ], $rows);
}

function getPermissionByKey(string $key): ?array
{
    $stmt = getPdo()->prepare('SELECT id, key_name, label, description FROM permissions WHERE key_name = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return ['id' => (int)$row['id'], 'key' => $row['key_name'], 'label' => $row['label'], 'description' => $row['description']];
}

/** @throws \RuntimeException if the key already exists or is malformed */
function createPermission(string $key, string $label, ?string $description): array
{
    $key = trim($key);
    if (!preg_match('/^[a-z][a-z0-9_]{2,99}$/', $key)) {
        throw new \RuntimeException(
            "La clé technique doit être en minuscules, chiffres et underscores uniquement (ex: manage_reports)."
        );
    }
    if (getPermissionByKey($key) !== null) {
        throw new \RuntimeException("Une permission avec cette clé existe déjà.");
    }
    $stmt = getPdo()->prepare('INSERT INTO permissions (key_name, label, description) VALUES (?, ?, ?)');
    $stmt->execute([$key, trim($label), $description !== null ? trim($description) : null]);
    $id = (int)getPdo()->lastInsertId();
    return ['id' => $id, 'key' => $key, 'label' => trim($label), 'description' => $description];
}

function updatePermission(int $id, string $label, ?string $description): void
{
    $stmt = getPdo()->prepare('UPDATE permissions SET label = ?, description = ? WHERE id = ?');
    $stmt->execute([trim($label), $description !== null ? trim($description) : null, $id]);
}

/** @throws \RuntimeException if still assigned to a role (delete would silently weaken it there) */
function deletePermission(int $id): void
{
    $stmt = getPdo()->prepare('SELECT COUNT(*) AS c FROM role_permissions WHERE permission_id = ?');
    $stmt->execute([$id]);
    $count = (int)$stmt->fetch()['c'];
    if ($count > 0) {
        throw new \RuntimeException(
            "Cette permission est encore attribuée à $count rôle(s). Retirez-la de ces rôles avant de la supprimer."
        );
    }
    $del = getPdo()->prepare('DELETE FROM permissions WHERE id = ?');
    $del->execute([$id]);
}
