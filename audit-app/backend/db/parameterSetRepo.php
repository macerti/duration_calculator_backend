<?php
declare(strict_types=1);

namespace AuditEngine;

function getActiveParameterSet(): ?array
{
    $stmt = getPdo()->query('SELECT data FROM parameter_sets WHERE is_active = 1 LIMIT 1');
    $row = $stmt->fetch();
    if (!$row) return null;
    return json_decode($row['data'], true);
}

function saveParameterSet(array $params, bool $activate = false, ?string $changedBy = null, ?string $changeSummary = null): void
{
    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO parameter_sets (id, version, is_active, change_note, data) VALUES (?, ?, 0, ?, ?)'
        );
        $stmt->execute([$params['id'], $params['version'], $params['changeNote'] ?? null, json_encode($params)]);

        if ($activate) {
            $pdo->exec('UPDATE parameter_sets SET is_active = 0');
            $stmt = $pdo->prepare('UPDATE parameter_sets SET is_active = 1 WHERE id = ?');
            $stmt->execute([$params['id']]);
        }

        if ($changeSummary) {
            $stmt = $pdo->prepare(
                'INSERT INTO parameter_change_log (parameter_set_id, changed_by, change_summary) VALUES (?, ?, ?)'
            );
            $stmt->execute([$params['id'], $changedBy, $changeSummary]);
        }

        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function seedDefaultParameterSet(): array
{
    $bootstrap = loadDefaultParameterSet();
    saveParameterSet($bootstrap, true, 'system', 'Initial seed from source CSVs + GS0106 spec transcription (PHP port)');
    return $bootstrap;
}
