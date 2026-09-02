<?php
declare(strict_types=1);

namespace AuditEngine;

function saveCalculationCase(array $input, array $result, ?int $clientId = null, string $status = 'draft', ?array $wizardState = null): int
{
    $stmt = getPdo()->prepare(
        'INSERT INTO calculation_cases
          (dossier_ref, client_id, status, parameter_set_id, commercial, scope_text, input_json, result_json, total_days, wizard_state_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $input['dossierRef'],
        $clientId,
        $status,
        $input['parameterSetId'] ?? 'default-v1',
        $input['commercial'] ?? null,
        $input['scopeText'] ?? null,
        json_encode($input),
        json_encode($result),
        $result['totalDaysAllSites'],
        $wizardState !== null ? json_encode($wizardState) : null,
    ]);
    return (int)getPdo()->lastInsertId();
}

function updateCalculationCase(int $id, array $input, array $result, ?string $status, ?array $roundingOverrides, ?array $wizardState = null): bool
{
    $sets = ['input_json = ?', 'result_json = ?', 'total_days = ?'];
    $params = [json_encode($input), json_encode($result), $result['totalDaysAllSites']];
    if ($status !== null) {
        $sets[] = 'status = ?';
        $params[] = $status;
    }
    if ($roundingOverrides !== null) {
        $sets[] = 'rounding_overrides_json = ?';
        $params[] = json_encode($roundingOverrides);
    }
    if ($wizardState !== null) {
        $sets[] = 'wizard_state_json = ?';
        $params[] = json_encode($wizardState);
    }
    $params[] = $id;
    $stmt = getPdo()->prepare('UPDATE calculation_cases SET ' . implode(', ', $sets) . ' WHERE id = ?');
    return $stmt->execute($params);
}

function listCalculationCases(int $limit = 50, ?int $clientId = null): array
{
    if ($clientId !== null) {
        $stmt = getPdo()->prepare(
            'SELECT id, dossier_ref, client_id, status, commercial, total_days, created_at, updated_at
             FROM calculation_cases WHERE client_id = ? ORDER BY updated_at DESC LIMIT ?'
        );
        $stmt->bindValue(1, $clientId, \PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, \PDO::PARAM_INT);
        $stmt->execute();
    } else {
        $stmt = getPdo()->prepare(
            'SELECT id, dossier_ref, client_id, status, commercial, total_days, created_at, updated_at
             FROM calculation_cases ORDER BY updated_at DESC LIMIT ?'
        );
        $stmt->bindValue(1, $limit, \PDO::PARAM_INT);
        $stmt->execute();
    }
    $rows = $stmt->fetchAll();
    return array_map(fn($r) => [
        'id' => (int)$r['id'],
        'dossierRef' => $r['dossier_ref'],
        'clientId' => $r['client_id'] !== null ? (int)$r['client_id'] : null,
        'status' => $r['status'],
        'commercial' => $r['commercial'],
        'totalDays' => $r['total_days'] !== null ? (float)$r['total_days'] : null,
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
    ], $rows);
}

function getCalculationCase(int $id): ?array
{
    $stmt = getPdo()->prepare(
        'SELECT input_json, result_json, client_id, status, rounding_overrides_json, wizard_state_json
         FROM calculation_cases WHERE id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return [
        'input' => json_decode($row['input_json'], true),
        'result' => json_decode($row['result_json'], true),
        'clientId' => $row['client_id'] !== null ? (int)$row['client_id'] : null,
        'status' => $row['status'],
        'roundingOverrides' => $row['rounding_overrides_json'] ? json_decode($row['rounding_overrides_json'], true) : null,
        'wizardState' => $row['wizard_state_json'] ? json_decode($row['wizard_state_json'], true) : null,
    ];
}

function deleteCalculationCase(int $id): bool
{
    $stmt = getPdo()->prepare('DELETE FROM calculation_cases WHERE id = ?');
    return $stmt->execute([$id]);
}
