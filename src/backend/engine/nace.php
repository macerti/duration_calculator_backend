<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * mb_strtolower() requires the mbstring extension, which isn't guaranteed on
 * every shared PHP host. Falls back to strtolower() (ASCII-only) if mbstring
 * isn't loaded — accented characters in NACE descriptions won't lowercase
 * perfectly in that fallback case, but search still works instead of
 * throwing a fatal error.
 */
function auditMbStrtolower(string $value): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($value) : strtolower($value);
}

/**
 * Strips common French/Latin accents so "telecom" matches "télécom" and vice
 * versa. Deliberately a manual character map rather than iconv(...TRANSLIT)
 * — iconv's transliteration behavior depends on the host's installed locale
 * data, which varies across shared-hosting providers and isn't something we
 * can guarantee or test for in advance. A fixed table is predictable
 * everywhere PHP runs, which matters more here than covering every possible
 * language's diacritics.
 */
function foldAccents(string $value): string
{
    static $map = [
        'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ã' => 'a', 'å' => 'a',
        'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
        'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u',
        'ç' => 'c', 'ñ' => 'n', 'ý' => 'y', 'ÿ' => 'y',
        'œ' => 'oe', 'æ' => 'ae',
    ];
    return strtr(auditMbStrtolower($value), $map);
}

function findNaceEntry(string $codeNace, array $params): ?array
{
    foreach ($params['naceTable'] as $entry) {
        if ($entry['codeNace'] === $codeNace) return $entry;
    }
    return null;
}

/**
 * Matches against description (accent-insensitive), NACE code, EAC code, or
 * any of the three per-standard technical reference codes (e.g. "14.2" for
 * QM/quality, "OH8" for OH/safety, "EM1" for EM/environment) — whichever
 * the person actually typed.
 */
function searchNaceByDescription(string $query, array $params): array
{
    $q = foldAccents(trim($query));
    if ($q === '') return [];
    return array_values(array_filter(
        $params['naceTable'],
        fn($e) => str_contains(foldAccents($e['description']), $q)
            || str_contains(auditMbStrtolower($e['codeNace']), $q)
            || str_contains(auditMbStrtolower($e['codeEac']), $q)
            || str_contains(auditMbStrtolower($e['codeQmQualite']), $q)
            || str_contains(auditMbStrtolower($e['codeOhSecurite']), $q)
            || str_contains(auditMbStrtolower($e['codeEmEnvironnement']), $q)
    ));
}
