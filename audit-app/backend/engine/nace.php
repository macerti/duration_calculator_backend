<?php
declare(strict_types=1);

namespace AuditEngine;

function findNaceEntry(string $codeNace, array $params): ?array
{
    foreach ($params['naceTable'] as $entry) {
        if ($entry['codeNace'] === $codeNace) return $entry;
    }
    return null;
}

function searchNaceByDescription(string $query, array $params): array
{
    $lower = function_exists('mb_strtolower') ? fn($s) => mb_strtolower($s) : 'strtolower';
    $q = $lower($query);
    return array_values(array_filter(
        $params['naceTable'],
        fn($e) => str_contains($lower($e['description']), $q)
    ));
}
