<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Roles — the admin-editable access levels (e.g. administrateur, technicien,
 * utilisateur). Seeded in migrations/002_add_auth_and_rbac.sql; fully
 * create/edit/delete-able afterwards via the admin UI (see api/index.php's
 * /admin/roles routes).
 */

/** @return array<int, array{id:int,name:string,description:?string,isSystem:bool,userCount:int,permissions:array<int,string>}> */
function listRoles(): array
{
    $pdo = getPdo();
    $roles = $pdo->query(
        'SELECT r.id, r.name, r.description, r.is_system,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
         FROM roles r ORDER BY r.is_system DESC, r.name ASC'
    )->fetchAll();

    $permStmt = $pdo->prepare(
        'SELECT p.key_name FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ? ORDER BY p.key_name ASC'
    );

    return array_map(function ($r) use ($permStmt) {
        $permStmt->execute([$r['id']]);
        $perms = array_column($permStmt->fetchAll(), 'key_name');
        return [
            'id' => (int)$r['id'],
            'name' => $r['name'],
            'description' => $r['description'],
            'isSystem' => (bool)$r['is_system'],
            'userCount' => (int)$r['user_count'],
            'permissions' => $perms,
        ];
    }, $roles);
}

function getRoleById(int $id): ?array
{
    $stmt = getPdo()->prepare('SELECT id, name, description, is_system FROM roles WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'description' => $row['description'],
        'isSystem' => (bool)$row['is_system'],
    ];
}

/** The role newly-registered accounts get by default (least-privilege). */
function getDefaultRoleId(): int
{
    $stmt = getPdo()->prepare("SELECT id FROM roles WHERE name = 'utilisateur' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row) return (int)$row['id'];
    // Fallback: if 'utilisateur' was renamed/deleted by an admin, fall back
    // to the least-permissioned remaining role (fewest granted permissions),
    // so registration never hard-fails just because the seed name changed.
    $fallback = getPdo()->query(
        'SELECT r.id FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         WHERE r.is_system = 0
         GROUP BY r.id ORDER BY COUNT(rp.permission_id) ASC, r.id ASC LIMIT 1'
    )->fetch();
    if ($fallback) return (int)$fallback['id'];
    // Last resort: the system admin role (should only happen on a very
    // unusual install where every non-system role was deleted).
    $sys = getPdo()->query("SELECT id FROM roles WHERE is_system = 1 LIMIT 1")->fetch();
    return (int)$sys['id'];
}

/** The bootstrap admin role, used to promote the very first registered user. */
function getSystemAdminRoleId(): ?int
{
    $stmt = getPdo()->query('SELECT id FROM roles WHERE is_system = 1 LIMIT 1');
    $row = $stmt->fetch();
    return $row ? (int)$row['id'] : null;
}

function countUsers(): int
{
    return (int)getPdo()->query('SELECT COUNT(*) AS c FROM users')->fetch()['c'];
}

function createRole(string $name, ?string $description, array $permissionKeys): array
{
    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO roles (name, description, is_system) VALUES (?, ?, 0)');
        $stmt->execute([trim($name), $description !== null ? trim($description) : null]);
        $id = (int)$pdo->lastInsertId();
        setRolePermissions($id, $permissionKeys);
        $pdo->commit();
        return getRoleById($id) + ['permissions' => $permissionKeys];
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

/** @param array<int,string>|null $permissionKeys pass null to leave permissions unchanged */
function updateRole(int $id, string $name, ?string $description, ?array $permissionKeys): void
{
    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE roles SET name = ?, description = ? WHERE id = ?');
        $stmt->execute([trim($name), $description !== null ? trim($description) : null, $id]);
        if ($permissionKeys !== null) {
            setRolePermissions($id, $permissionKeys);
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

/** Replace a role's full permission set with exactly $permissionKeys. */
function setRolePermissions(int $roleId, array $permissionKeys): void
{
    $pdo = getPdo();
    $del = $pdo->prepare('DELETE FROM role_permissions WHERE role_id = ?');
    $del->execute([$roleId]);
    if (empty($permissionKeys)) return;

    $placeholders = implode(',', array_fill(0, count($permissionKeys), '?'));
    $find = $pdo->prepare("SELECT id, key_name FROM permissions WHERE key_name IN ($placeholders)");
    $find->execute(array_values($permissionKeys));
    $ids = array_column($find->fetchAll(), 'id');

    if (empty($ids)) return;
    $ins = $pdo->prepare('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    foreach ($ids as $permId) {
        $ins->execute([$roleId, (int)$permId]);
    }
}

/**
 * @throws \RuntimeException with a client-safe message if deletion isn't allowed
 */
function deleteRole(int $id): void
{
    $role = getRoleById($id);
    if ($role === null) throw new \RuntimeException("Rôle introuvable.");
    if ($role['isSystem']) {
        throw new \RuntimeException("Ce rôle est protégé et ne peut pas être supprimé.");
    }
    $stmt = getPdo()->prepare('SELECT COUNT(*) AS c FROM users WHERE role_id = ?');
    $stmt->execute([$id]);
    $count = (int)$stmt->fetch()['c'];
    if ($count > 0) {
        throw new \RuntimeException(
            "Ce rôle est encore attribué à $count utilisateur(s). Réattribuez-les à un autre rôle avant de le supprimer."
        );
    }
    // FK is ON DELETE RESTRICT for users and ON DELETE CASCADE for
    // role_permissions, so this only ever succeeds when truly unused.
    $del = getPdo()->prepare('DELETE FROM roles WHERE id = ?');
    $del->execute([$id]);
}
