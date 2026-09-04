<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Minimal DB-backed rate limiter — no Redis/Memcached needed, per
 * SECURITY.md "Todo #2 Rate limiting"'s own recommendation. Coarse and
 * simple on purpose: this exists to stop casual brute-forcing of the new
 * auth endpoints (login, register, forgot-password, resend-verification),
 * not to be a general-purpose limiter for every route in the app.
 *
 * One row per bucket key (e.g. "login:1.2.3.4" or "login:someone@x.com").
 * A fixed-window counter: if the window has expired, it resets; otherwise
 * it increments. Callers decide the window length and max attempts per
 * endpoint (see Guard.php's per-endpoint wrappers).
 */

/**
 * Record one attempt for $bucketKey and return whether it should be
 * allowed (true) or rejected as rate-limited (false).
 *
 * @param string $bucketKey    e.g. "login:" . $ip, or "login:" . $email
 * @param int    $maxAttempts  max attempts allowed within the window
 * @param int    $windowSeconds window length in seconds
 */
function rateLimitCheck(string $bucketKey, int $maxAttempts, int $windowSeconds): bool
{
    $pdo = getPdo();

    // Fetch current bucket state, if any.
    $stmt = $pdo->prepare('SELECT window_start, attempt_count FROM rate_limits WHERE bucket_key = ?');
    $stmt->execute([$bucketKey]);
    $row = $stmt->fetch();
    $stmt->closeCursor();

    $now = new \DateTimeImmutable('now');

    if ($row === false) {
        // First attempt ever for this bucket.
        $ins = $pdo->prepare(
            'INSERT INTO rate_limits (bucket_key, window_start, attempt_count) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE window_start = VALUES(window_start), attempt_count = 1'
        );
        $ins->execute([$bucketKey, $now->format('Y-m-d H:i:s')]);
        return true;
    }

    $windowStart = new \DateTimeImmutable((string)$row['window_start']);
    $ageSeconds = $now->getTimestamp() - $windowStart->getTimestamp();

    if ($ageSeconds >= $windowSeconds) {
        // Window expired — reset.
        $upd = $pdo->prepare('UPDATE rate_limits SET window_start = ?, attempt_count = 1 WHERE bucket_key = ?');
        $upd->execute([$now->format('Y-m-d H:i:s'), $bucketKey]);
        return true;
    }

    $newCount = (int)$row['attempt_count'] + 1;
    $upd = $pdo->prepare('UPDATE rate_limits SET attempt_count = ? WHERE bucket_key = ?');
    $upd->execute([$newCount, $bucketKey]);

    return $newCount <= $maxAttempts;
}
